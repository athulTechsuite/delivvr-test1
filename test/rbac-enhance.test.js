// Tests for RBAC enhancements: manager role, admin UI for user management,
// audit log, JWT fix, and role-aware navigation.
// PRD: e6e151d5-f264-4b95-9195-9f0b9ca828ac

const path = require('path');
const fs = require('fs');

// Configure env before any modules are loaded.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'rbac-enhance-test-secret';
process.env.DB_PATH = path.join(__dirname, 'rbac-enhance-integration-test.db');

// Start with a clean database for each run.
if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
}

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Order = require('../models/Order');

const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH;

let db;
let adminUserId;
let managerUserId;
let regularUserId;
let adminToken;
let managerToken;
let userToken;

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

beforeAll(async () => {
    db = new sqlite3.Database(DB_PATH);

    await runAsync(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        pickup_address TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        package_description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS order_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        changed_by_user_id INTEGER NOT NULL,
        old_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    )`);

    const hashed = await bcrypt.hash('Password123', 10);

    const adminResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin User', 'admin@rbac-enhance.test', hashed]
    );
    adminUserId = adminResult.lastID;

    const managerResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'manager')",
        ['Manager User', 'manager@rbac-enhance.test', hashed]
    );
    managerUserId = managerResult.lastID;

    const userResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
        ['Regular User', 'user@rbac-enhance.test', hashed]
    );
    regularUserId = userResult.lastID;

    // Tokens use { id, email } — matching app.js and routes/auth.js convention.
    adminToken = jwt.sign({ id: adminUserId, email: 'admin@rbac-enhance.test' }, JWT_SECRET);
    managerToken = jwt.sign({ id: managerUserId, email: 'manager@rbac-enhance.test' }, JWT_SECRET);
    userToken = jwt.sign({ id: regularUserId, email: 'user@rbac-enhance.test' }, JWT_SECRET);
});

afterAll((done) => {
    db.close(() => {
        if (fs.existsSync(DB_PATH)) {
            try { fs.unlinkSync(DB_PATH); } catch (_) { /* ignore */ }
        }
        done();
    });
});

afterEach(async () => {
    // Clear orders and history between tests to prevent state bleed.
    await runAsync('DELETE FROM order_status_history');
    await runAsync('DELETE FROM orders');
});

// ─── HTTP route tests ──────────────────────────────────────────────────────────

describe('RBAC Enhancement HTTP routes', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-001 Manager can access GET /admin/orders
    test('TC-F-001 Manager can GET /admin/orders (200)', async () => {
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'Manager Test Pickup', 'Manager Test Delivery']
        );

        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${managerToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('All Orders');
        expect(res.text).toContain('Manager Test Pickup');
    });

    // TC-F-002 Manager cannot PATCH /orders/:id/status (only admin can)
    test('TC-F-002 Manager cannot PATCH /orders/:id/status (403)', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );

        const res = await request(app)
            .patch(`/orders/${result.lastID}/status`)
            .set('Cookie', `token=${managerToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'in_transit' });

        expect(res.status).toBe(403);
    });

    // TC-F-003 Manager cannot GET /admin/users (only admin can)
    test('TC-F-003 Manager cannot GET /admin/users (403)', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${managerToken}`);

        expect(res.status).toBe(403);
    });

    // TC-F-004 Admin can GET /admin/users (200)
    test('TC-F-004 Admin can GET /admin/users (200)', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('Manage Users');
        expect(res.text).toContain('admin@rbac-enhance.test');
    });

    // TC-F-005 Admin can POST /admin/users/:id/role to change role (302 redirect)
    test('TC-F-005 Admin can POST /admin/users/:id/role (302)', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'manager' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        // Verify role was actually updated in DB.
        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('manager');

        // Restore original role for other tests.
        await runAsync('UPDATE users SET role = ? WHERE id = ?', ['user', regularUserId]);
    });

    // TC-F-006 Audit row is inserted when status changes
    test('TC-F-006 Audit row inserted on PATCH /orders/:id/status', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'Audit Pickup', 'Audit Delivery']
        );
        const orderId = result.lastID;

        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'in_transit' });

        expect(res.status).toBe(200);

        // Wait briefly for the non-blocking audit insert to complete.
        await new Promise((r) => setTimeout(r, 100));

        const histRows = await allAsync(
            'SELECT * FROM order_status_history WHERE order_id = ?',
            [orderId]
        );
        expect(histRows.length).toBe(1);
        expect(histRows[0].old_status).toBe('pending');
        expect(histRows[0].new_status).toBe('in_transit');
        expect(histRows[0].changed_by_user_id).toBe(adminUserId);
    });

    // TC-F-007 GET /admin/orders/:id/history returns correct data
    test('TC-F-007 GET /admin/orders/:id/history returns correct audit data', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'History Pickup', 'History Delivery']
        );
        const orderId = result.lastID;

        // Insert a history row directly.
        await runAsync(
            'INSERT INTO order_status_history (order_id, changed_by_user_id, old_status, new_status) VALUES (?, ?, ?, ?)',
            [orderId, adminUserId, 'pending', 'delivered']
        );

        const res = await request(app)
            .get(`/admin/orders/${orderId}/history`)
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.orderId).toBe(orderId);
        expect(Array.isArray(res.body.history)).toBe(true);
        expect(res.body.history.length).toBe(1);
        expect(res.body.history[0].old_status).toBe('pending');
        expect(res.body.history[0].new_status).toBe('delivered');
    });

    // TC-E-001 Invalid role value rejected (400) when updating user role
    test('TC-E-001 POST /admin/users/:id/role with invalid role returns 400', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'superuser' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid role/);
    });

    // TC-E-002 Invalid role value rejected when missing role field
    test('TC-E-002 POST /admin/users/:id/role with missing role returns 400', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid role/);
    });

    // TC-F-008 JWT payload fix: decoded.id is present after login
    test('TC-F-008 JWT payload fix: decoded.id is present after login', async () => {
        const res = await request(app)
            .post('/login')
            .type('form')
            .send({ email: 'admin@rbac-enhance.test', password: 'Password123' });

        expect(res.status).toBe(302);

        const cookieHeader = res.headers['set-cookie'];
        expect(cookieHeader).toBeDefined();
        const tokenCookie = cookieHeader.find((c) => c.startsWith('token='));
        expect(tokenCookie).toBeDefined();

        const tokenValue = tokenCookie.split(';')[0].replace('token=', '');
        const decoded = jwt.verify(tokenValue, JWT_SECRET);

        // Verify the JWT payload uses `id` (not `userId`) and has `email`.
        expect(decoded.id).toBeDefined();
        expect(decoded.email).toBeDefined();
        expect(decoded.userId).toBeUndefined();
        expect(decoded.role).toBeUndefined();
    });

    // TC-R-001 Regular user still blocked from GET /admin/orders
    test('TC-R-001 Regular user cannot GET /admin/orders (403)', async () => {
        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
    });

    // TC-R-002 Unauthenticated request to /admin/users redirects to login
    test('TC-R-002 GET /admin/users redirects to /login when unauthenticated', async () => {
        const res = await request(app).get('/admin/users');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    // TC-R-003 GET /admin/orders/:id/history returns 404 for non-integer ID
    test('TC-R-003 GET /admin/orders/abc/history returns 404 for non-integer ID', async () => {
        const res = await request(app)
            .get('/admin/orders/abc/history')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Order not found/i);
    });

    // TC-R-004 requireRole now accepts arrays
    test('TC-R-004 requireRole accepts array of roles — both admin and manager allowed', () => {
        const { requireRole } = require('../middleware/auth');

        // Admin should pass.
        const adminReq = { user: { role: 'admin' } };
        const managerReq = { user: { role: 'manager' } };
        const userReq = { user: { role: 'user' } };

        let adminPassed = false;
        let managerPassed = false;
        let userPassed = false;

        const fakeRes = {
            status(code) { return this; },
            render() {},
            redirect() {}
        };

        requireRole(['admin', 'manager'])(adminReq, fakeRes, () => { adminPassed = true; });
        requireRole(['admin', 'manager'])(managerReq, fakeRes, () => { managerPassed = true; });
        requireRole(['admin', 'manager'])(userReq, fakeRes, () => { userPassed = true; });

        expect(adminPassed).toBe(true);
        expect(managerPassed).toBe(true);
        expect(userPassed).toBe(false);
    });
});

// ─── Audit log model tests ─────────────────────────────────────────────────────

describe('Order.logStatusChange() and Order.getStatusHistory()', () => {
    test('TC-F-009 logStatusChange inserts a row and getStatusHistory retrieves it', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'Model Pickup', 'Model Delivery']
        );
        const orderId = result.lastID;

        await Order.logStatusChange(orderId, adminUserId, 'pending', 'delivered');

        const history = await Order.getStatusHistory(orderId);
        expect(history.length).toBe(1);
        expect(history[0].order_id).toBe(orderId);
        expect(history[0].changed_by_user_id).toBe(adminUserId);
        expect(history[0].old_status).toBe('pending');
        expect(history[0].new_status).toBe('delivered');
    });

    test('TC-F-010 getStatusHistory returns rows newest-first for multiple changes', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'Multi Pickup', 'Multi Delivery']
        );
        const orderId = result.lastID;

        await runAsync(
            'INSERT INTO order_status_history (order_id, changed_by_user_id, old_status, new_status, changed_at) VALUES (?, ?, ?, ?, ?)',
            [orderId, adminUserId, 'pending', 'in_transit', '2024-01-01 09:00:00']
        );
        await runAsync(
            'INSERT INTO order_status_history (order_id, changed_by_user_id, old_status, new_status, changed_at) VALUES (?, ?, ?, ?, ?)',
            [orderId, adminUserId, 'in_transit', 'delivered', '2024-01-01 10:00:00']
        );

        const history = await Order.getStatusHistory(orderId);
        expect(history.length).toBe(2);
        // Newest first: delivered row should come before in_transit row.
        expect(history[0].new_status).toBe('delivered');
        expect(history[1].new_status).toBe('in_transit');
    });

    test('TC-E-003 getStatusHistory returns empty array for order with no history', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'No History Pickup', 'No History Delivery']
        );
        const history = await Order.getStatusHistory(result.lastID);
        expect(history).toEqual([]);
    });
});
