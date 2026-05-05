// Tests for RBAC: role column, requireRole middleware, admin routes, Order.findAll,
// Order.updateStatus, seed-admin script, and regression checks.
// PRD: TEC-394 — Add role-based access control (RBAC) to delivery management app

const path = require('path');
const fs = require('fs');

// Configure env before any modules are loaded.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'rbac-test-secret';
process.env.DB_PATH = path.join(__dirname, 'rbac-integration-test.db');

// Start with a clean database for each run.
if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
}

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');

const Order = require('../models/Order');

const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH;

let db;
let adminUserId;
let regularUserId;
let adminToken;
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

    // Create schema with role column.
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

    const hashed = await bcrypt.hash('Password123', 10);

    // Insert admin user.
    const adminResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin User', 'admin@rbac-integration.test', hashed]
    );
    adminUserId = adminResult.lastID;

    // Insert regular user.
    const userResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
        ['Regular User', 'user@rbac-integration.test', hashed]
    );
    regularUserId = userResult.lastID;

    // Issue tokens using app.js convention: { id, email }.
    adminToken = jwt.sign({ id: adminUserId, email: 'admin@rbac-integration.test' }, JWT_SECRET);
    userToken = jwt.sign({ id: regularUserId, email: 'user@rbac-integration.test' }, JWT_SECRET);
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
    // Clear orders between tests to avoid state bleed.
    await runAsync('DELETE FROM orders');
});

// ─── Order model unit tests ────────────────────────────────────────────────────

describe('Order.findAll()', () => {
    test('TC-F-001 (model) returns all orders across all users, newest first', async () => {
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address, created_at) VALUES (?, ?, ?, ?)',
            [regularUserId, 'A pickup', 'A delivery', '2024-01-01 09:00:00']
        );
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address, created_at) VALUES (?, ?, ?, ?)',
            [adminUserId, 'B pickup', 'B delivery', '2024-01-01 10:00:00']
        );

        const rows = await Order.findAll();
        expect(rows.length).toBeGreaterThanOrEqual(2);
        // Newest first: the B row (later created_at) should come before A.
        const bIdx = rows.findIndex((r) => r.pickup_address === 'B pickup');
        const aIdx = rows.findIndex((r) => r.pickup_address === 'A pickup');
        expect(bIdx).toBeLessThan(aIdx);
    });

    test('findAll() returns empty array when no orders exist', async () => {
        const rows = await Order.findAll();
        expect(rows).toEqual([]);
    });
});

describe('Order.updateStatus()', () => {
    test('TC-F-003 (model) updates status and returns true when order exists', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );
        const orderId = result.lastID;

        const updated = await Order.updateStatus(orderId, 'in_transit');
        expect(updated).toBe(true);

        const row = await getAsync('SELECT status FROM orders WHERE id = ?', [orderId]);
        expect(row.status).toBe('in_transit');
    });

    test('TC-F-004 (model) updates status to delivered', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );
        const updated = await Order.updateStatus(result.lastID, 'delivered');
        expect(updated).toBe(true);
    });

    test('TC-F-005 (model) rejects invalid status string', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );
        await expect(Order.updateStatus(result.lastID, 'flying')).rejects.toThrow('Invalid status');
    });

    test('TC-E-002 (model) returns false for non-existent order ID', async () => {
        const updated = await Order.updateStatus(99999, 'delivered');
        expect(updated).toBe(false);
    });

    test('updateStatus rejects invalid id (non-positive integer)', async () => {
        await expect(Order.updateStatus(0, 'pending')).rejects.toThrow('Invalid id');
        await expect(Order.updateStatus(-1, 'pending')).rejects.toThrow('Invalid id');
        await expect(Order.updateStatus('abc', 'pending')).rejects.toThrow('Invalid id');
    });
});

// ─── HTTP route tests ──────────────────────────────────────────────────────────

describe('RBAC HTTP routes', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-001 Admin views all orders
    test('TC-F-001 GET /admin/orders returns 200 with all orders for admin', async () => {
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'User Pickup', 'User Delivery']
        );
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [adminUserId, 'Admin Pickup', 'Admin Delivery']
        );

        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('All Orders');
        expect(res.text).toContain('User Pickup');
        expect(res.text).toContain('Admin Pickup');
    });

    // TC-F-002 Regular user blocked from admin orders
    test('TC-F-002 GET /admin/orders returns 403 for regular user', async () => {
        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access Denied');
    });

    // TC-F-006 Unauthenticated request to admin route
    test('TC-F-006 GET /admin/orders redirects to /login when unauthenticated', async () => {
        const res = await request(app).get('/admin/orders');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    // TC-F-003 Admin updates order status to in_transit
    test('TC-F-003 PATCH /orders/:id/status returns 200 and updates status for admin', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'Patch Pickup', 'Patch Delivery']
        );
        const orderId = result.lastID;

        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'in_transit' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBe(orderId);
        expect(res.body.status).toBe('in_transit');

        const row = await getAsync('SELECT status FROM orders WHERE id = ?', [orderId]);
        expect(row.status).toBe('in_transit');
    });

    // TC-F-004 Admin updates order status to delivered
    test('TC-F-004 PATCH /orders/:id/status updates to delivered', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );

        const res = await request(app)
            .patch(`/orders/${result.lastID}/status`)
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'delivered' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('delivered');
    });

    // TC-F-005 Invalid status string rejected
    test('TC-F-005 PATCH /orders/:id/status returns 400 for invalid status', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );

        const res = await request(app)
            .patch(`/orders/${result.lastID}/status`)
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'flying' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Must be one of/);
        expect(res.body.error).toContain('pending');
        expect(res.body.error).toContain('in_transit');
    });

    // PATCH by regular user → 403
    test('TC-F-002 PATCH /orders/:id/status returns 403 for regular user', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'P', 'D']
        );

        const res = await request(app)
            .patch(`/orders/${result.lastID}/status`)
            .set('Cookie', `token=${userToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'in_transit' });

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access Denied');
    });

    // TC-E-002 PATCH non-existent order
    test('TC-E-002 PATCH /orders/99999/status returns 404 for non-existent order', async () => {
        const res = await request(app)
            .patch('/orders/99999/status')
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'delivered' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Order not found/i);
    });

    // TC-E-003 PATCH with non-integer order ID
    test('TC-E-003 PATCH /orders/abc/status returns 404 for non-integer ID', async () => {
        const res = await request(app)
            .patch('/orders/abc/status')
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'in_transit' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Order not found/i);
    });

    // TC-E-005 requireRole called without prior authenticateToken
    test('TC-E-005 requireRole redirects to /login when req.user is undefined', async () => {
        // Hit the admin route without any token — authenticateToken redirects to /login.
        // To test requireRole alone, we confirm that its !req.user guard redirects to /login.
        const { requireRole } = require('../middleware/auth');
        let redirectTarget = null;
        const fakeReq = { user: undefined };
        const fakeRes = {
            redirect(url) { redirectTarget = url; }
        };
        const next = jest.fn();

        requireRole('admin')(fakeReq, fakeRes, next);

        expect(redirectTarget).toBe('/login');
        expect(next).not.toHaveBeenCalled();
    });

    // TC-E-001 Role lookup for deleted user — JWT valid but user row gone
    test('TC-E-001 authenticateToken redirects to /login when user row is deleted after token issuance', async () => {
        // Create a transient user, issue a token, then delete the row.
        const hashed = await bcrypt.hash('Password123', 10);
        const ghostResult = await runAsync(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
            ['Ghost User', `ghost-${Date.now()}@rbac.test`, hashed]
        );
        const ghostId = ghostResult.lastID;
        const ghostToken = jwt.sign({ id: ghostId, email: `ghost-${ghostId}@rbac.test` }, JWT_SECRET);

        // Delete the user row.
        await runAsync('DELETE FROM users WHERE id = ?', [ghostId]);

        const res = await request(app)
            .get('/dashboard')
            .set('Cookie', `token=${ghostToken}`);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    // TC-R-001 Regular user order list unaffected
    test('TC-R-001 GET /orders returns only own orders for regular user', async () => {
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'My Pickup', 'My Delivery']
        );
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [adminUserId, 'Admin SECRET Pickup', 'Admin SECRET Delivery']
        );

        const res = await request(app)
            .get('/orders')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('My Pickup');
        expect(res.text).not.toContain('Admin SECRET Pickup');
    });

    // TC-R-002 Login JWT payload unchanged (no role field)
    test('TC-R-002 POST /login JWT payload contains id and email but not role', async () => {
        // The app.js login route signs { id, email }. Verify via cookie decode.
        const res = await request(app)
            .post('/login')
            .type('form')
            .send({ email: 'admin@rbac-integration.test', password: 'Password123' });

        // Should redirect to dashboard on success.
        expect(res.status).toBe(302);

        const cookieHeader = res.headers['set-cookie'];
        expect(cookieHeader).toBeDefined();
        const tokenCookie = cookieHeader.find((c) => c.startsWith('token='));
        expect(tokenCookie).toBeDefined();

        const tokenValue = tokenCookie.split(';')[0].replace('token=', '');
        const decoded = jwt.verify(tokenValue, JWT_SECRET);

        expect(decoded.id).toBeDefined();
        expect(decoded.email).toBeDefined();
        expect(decoded.role).toBeUndefined();
    });

    // TC-R-003 Order detail tenant isolation (existing behaviour unchanged)
    test('TC-R-003 GET /orders/:id returns 404 for cross-tenant access', async () => {
        // Create an order owned by admin.
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [adminUserId, 'Admin Only Pickup', 'Admin Only Delivery']
        );
        const adminOrderId = result.lastID;

        // Regular user tries to access admin's order.
        const res = await request(app)
            .get(`/orders/${adminOrderId}`)
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(404);
        expect(res.status).not.toBe(403);
    });

    // TC-R-004 Signup sets role = 'user' by default
    test('TC-R-004 POST /signup inserts new user with role = user', async () => {
        const uniqueEmail = `signup-test-${Date.now()}@rbac-integration.test`;

        const res = await request(app)
            .post('/signup')
            .type('form')
            .send({
                name: 'Signup Tester',
                email: uniqueEmail,
                password: 'Password1'
            });

        // Should redirect to /login after successful registration.
        expect(res.status).toBe(302);

        const row = await getAsync('SELECT role FROM users WHERE email = ?', [uniqueEmail]);
        expect(row).toBeDefined();
        expect(row.role).toBe('user');
    });

    // TC-R-005 Health endpoint unaffected
    test('TC-R-005 GET /health returns 200 with status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ─── Admin seed script ─────────────────────────────────────────────────────────

describe('database/seed-admin.js', () => {
    let seedDbPath;
    let seedDb;

    beforeAll(async () => {
        seedDbPath = path.join(__dirname, 'seed-script-test.db');
        if (fs.existsSync(seedDbPath)) fs.unlinkSync(seedDbPath);

        seedDb = new sqlite3.Database(seedDbPath);

        // Create minimal users table with role column.
        await new Promise((resolve, reject) => {
            seedDb.run(
                `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                (err) => (err ? reject(err) : resolve())
            );
        });

        // Insert a regular user.
        await new Promise((resolve, reject) => {
            seedDb.run(
                "INSERT INTO users (name, email, password, role) VALUES ('Seed User', 'seed@example.com', 'hashed', 'user')",
                (err) => (err ? reject(err) : resolve())
            );
        });
    });

    afterAll((done) => {
        seedDb.close(() => {
            if (fs.existsSync(seedDbPath)) {
                try { fs.unlinkSync(seedDbPath); } catch (_) { /* ignore */ }
            }
            done();
        });
    });

    test('TC-F-007 seed-admin.js promotes user to admin and logs success', () => {
        const result = execSync(
            `node database/seed-admin.js seed@example.com`,
            { env: { ...process.env, DB_PATH: seedDbPath } }
        ).toString();

        expect(result).toContain('Success: seed@example.com has been promoted to admin.');
    });

    test('TC-F-007 (verify) role is admin in DB after seed script', (done) => {
        seedDb.get(
            "SELECT role FROM users WHERE email = 'seed@example.com'",
            (err, row) => {
                expect(err).toBeNull();
                expect(row.role).toBe('admin');
                done();
            }
        );
    });

    test('TC-E-004 seed-admin.js exits with code 1 when no email argument provided', () => {
        let threw = false;
        try {
            execSync('node database/seed-admin.js', {
                env: { ...process.env, DB_PATH: seedDbPath }
            });
        } catch (err) {
            threw = true;
            expect(err.status).toBe(1);
            expect(err.stderr.toString()).toContain('Usage:');
        }
        expect(threw).toBe(true);
    });

    test('seed-admin.js exits with code 1 for unknown email', () => {
        let threw = false;
        try {
            execSync('node database/seed-admin.js unknown@nothere.com', {
                env: { ...process.env, DB_PATH: seedDbPath }
            });
        } catch (err) {
            threw = true;
            expect(err.status).toBe(1);
            expect(err.stderr.toString()).toContain('No user found with email: unknown@nothere.com');
        }
        expect(threw).toBe(true);
    });
});

// ─── Migration script ──────────────────────────────────────────────────────────

describe('database/migrate-add-role.js', () => {
    let migrateDbPath;

    beforeAll(() => {
        migrateDbPath = path.join(__dirname, 'migrate-test.db');
        if (fs.existsSync(migrateDbPath)) fs.unlinkSync(migrateDbPath);

        // Create a users table WITHOUT the role column to simulate pre-migration state.
        return new Promise((resolve, reject) => {
            const tempDb = new sqlite3.Database(migrateDbPath);
            tempDb.run(
                `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                (err) => {
                    if (err) return tempDb.close(() => reject(err));
                    tempDb.close((closeErr) => (closeErr ? reject(closeErr) : resolve()));
                }
            );
        });
    });

    afterAll(() => {
        if (fs.existsSync(migrateDbPath)) {
            try { fs.unlinkSync(migrateDbPath); } catch (_) { /* ignore */ }
        }
    });

    test('TC-F-008 first run adds role column and logs applied message', () => {
        const result = execSync(
            'node database/migrate-add-role.js',
            { env: { ...process.env, DB_PATH: migrateDbPath } }
        ).toString();

        expect(result).toContain('Migration applied: role column added to users table.');
    });

    test('TC-F-008 second run logs already applied message (idempotent)', () => {
        const result = execSync(
            'node database/migrate-add-role.js',
            { env: { ...process.env, DB_PATH: migrateDbPath } }
        ).toString();

        expect(result).toContain('Migration already applied — role column exists.');
    });
});
