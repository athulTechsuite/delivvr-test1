// Tests for Role-Based Access Control (RBAC) — TEC-393
// Covers: middleware/rbac.js, PATCH /orders/:id/status, GET /admin/users,
//         POST /admin/users/:id/role, JWT role embedding, and regressions.
const path = require('path');
const fs = require('fs');

// Configure env before loading app so DB_PATH and JWT_SECRET are in place.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'rbac-test-secret-key';
process.env.DB_PATH = path.join(__dirname, 'rbac-test.db');

// Remove any stale DB from previous runs so schema and data start clean.
if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
}

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { requireRole } = require('../middleware/rbac');

// App is loaded after env is configured.
let app;

let db;
let customerUserId;
let driverUserId;
let adminUserId;
let secondUserId;

let customerToken;
let driverToken;
let adminToken;

const JWT_SECRET = process.env.JWT_SECRET;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runAsync(sql, params) {
    params = params || [];
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function getAsync(sql, params) {
    params = params || [];
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function makeToken(payload) {
    return jwt.sign(payload, JWT_SECRET);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
    db = new sqlite3.Database(process.env.DB_PATH);

    // Create schema with role column so the app migration guard is exercised.
    await runAsync(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
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

    const hashed = await bcrypt.hash('Password1', 10);

    // customer user
    const r1 = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')",
        ['Customer User', 'customer@rbac.test', hashed]
    );
    customerUserId = r1.lastID;

    // driver user
    const r2 = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'driver')",
        ['Driver User', 'driver@rbac.test', hashed]
    );
    driverUserId = r2.lastID;

    // admin user
    const r3 = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin User', 'admin@rbac.test', hashed]
    );
    adminUserId = r3.lastID;

    // second customer (target for role-change tests)
    const r4 = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')",
        ['Second User', 'second@rbac.test', hashed]
    );
    secondUserId = r4.lastID;

    customerToken = makeToken({ id: customerUserId, email: 'customer@rbac.test', role: 'customer' });
    driverToken   = makeToken({ id: driverUserId,   email: 'driver@rbac.test',   role: 'driver'   });
    adminToken    = makeToken({ id: adminUserId,     email: 'admin@rbac.test',     role: 'admin'    });

    // Load app after env + schema are configured so db.serialize() migration runs.
    app = require('../app');
});

afterAll((done) => {
    db.close(() => {
        if (fs.existsSync(process.env.DB_PATH)) {
            try { fs.unlinkSync(process.env.DB_PATH); } catch (_) { /* ignore */ }
        }
        done();
    });
});

// Clean orders between tests; leave users intact.
afterEach(async () => {
    await runAsync('DELETE FROM orders');
});

// ---------------------------------------------------------------------------
// requireRole unit tests
// ---------------------------------------------------------------------------

describe('requireRole middleware unit tests', () => {
    function mockReqRes(role) {
        const req = { user: role !== undefined ? { id: 1, email: 'x@y.com', role } : { id: 1, email: 'x@y.com' } };
        const res = {
            _status: null,
            _json: null,
            status(code) { this._status = code; return this; },
            json(body) { this._json = body; return this; }
        };
        const next = jest.fn();
        return { req, res, next };
    }

    test('calls next() when role is in the allowed list', () => {
        const { req, res, next } = mockReqRes('driver');
        requireRole('driver', 'admin')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res._status).toBeNull();
    });

    test('returns 403 JSON when role is not in the allowed list', () => {
        const { req, res, next } = mockReqRes('customer');
        requireRole('driver', 'admin')(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._status).toBe(403);
        expect(res._json).toEqual({ error: 'Forbidden' });
    });

    test('treats missing role (legacy JWT) as customer — blocks driver-only route', () => {
        // req.user exists but has no role field (legacy token)
        const req = { user: { id: 1, email: 'x@y.com' } };
        const res = {
            _status: null,
            _json: null,
            status(code) { this._status = code; return this; },
            json(body) { this._json = body; return this; }
        };
        const next = jest.fn();
        requireRole('driver', 'admin')(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._status).toBe(403);
        expect(res._json).toEqual({ error: 'Forbidden' });
    });

    test('allows customer when customer is in allowed roles', () => {
        const { req, res, next } = mockReqRes('customer');
        requireRole('customer', 'driver', 'admin')(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// TC-F-001 — Login includes role claim
// ---------------------------------------------------------------------------

describe('TC-F-001 — Login includes role claim', () => {
    test('POST /login for driver user returns JWT with role=driver in payload', async () => {
        const res = await request(app)
            .post('/login')
            .type('form')
            .send({ email: 'driver@rbac.test', password: 'Password1' });

        expect(res.status).toBe(302);

        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const tokenCookie = cookies.find((c) => c.startsWith('token='));
        expect(tokenCookie).toBeTruthy();

        const rawToken = tokenCookie.split(';')[0].replace('token=', '');
        const decoded = jwt.verify(rawToken, JWT_SECRET);
        expect(decoded.role).toBe('driver');
        expect(decoded.id).toBe(driverUserId);
        expect(decoded.email).toBe('driver@rbac.test');
    });
});

// ---------------------------------------------------------------------------
// TC-F-002 & TC-F-003 — Driver and admin update order status
// ---------------------------------------------------------------------------

describe('TC-F-002 & TC-F-003 — Driver and admin update order status', () => {
    async function createOrder(userId) {
        const result = await runAsync(
            "INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, 'Pickup St', 'Delivery Ave')",
            [userId]
        );
        return result.lastID;
    }

    test('TC-F-002 — driver JWT → PATCH /orders/:id/status returns 200 with updated order', async () => {
        const orderId = await createOrder(customerUserId);
        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${driverToken}`)
            .send({ status: 'in_transit' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('in_transit');
        expect(res.body.id).toBe(orderId);
    });

    test('TC-F-003 — admin JWT → PATCH /orders/:id/status returns 200 with updated order', async () => {
        const orderId = await createOrder(customerUserId);
        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${adminToken}`)
            .send({ status: 'delivered' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('delivered');
    });
});

// ---------------------------------------------------------------------------
// TC-F-004 — Admin lists users
// ---------------------------------------------------------------------------

describe('TC-F-004 — Admin lists users', () => {
    test('GET /admin/users with admin JWT returns 200 with HTML table containing users', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('<table');
        expect(res.text).toContain('customer@rbac.test');
        expect(res.text).toContain('driver@rbac.test');
        expect(res.text).toContain('admin@rbac.test');
    });
});

// ---------------------------------------------------------------------------
// TC-F-005 — Admin changes user role
// ---------------------------------------------------------------------------

describe('TC-F-005 — Admin changes user role via POST /admin/users/:id/role', () => {
    test('POST /admin/users/:id/role with admin JWT → 302 redirect and role updated in DB', async () => {
        const res = await request(app)
            .post(`/admin/users/${secondUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'driver' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        const row = await getAsync('SELECT role FROM users WHERE id = ?', [secondUserId]);
        expect(row.role).toBe('driver');

        // Restore original role for subsequent tests
        await runAsync('UPDATE users SET role = ? WHERE id = ?', ['customer', secondUserId]);
    });
});

// ---------------------------------------------------------------------------
// TC-F-006 — Customer creates order (regression: existing flow unchanged)
// ---------------------------------------------------------------------------

describe('TC-F-006 — Customer creates order (unchanged flow)', () => {
    test('POST /orders with customer JWT → 302 redirect to /orders', async () => {
        const res = await request(app)
            .post('/orders')
            .set('Cookie', `token=${customerToken}`)
            .type('form')
            .send({
                pickup_address: '10 Pickup Road',
                delivery_address: '20 Delivery Lane',
                package_description: 'Books'
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/orders');

        const row = await getAsync(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [customerUserId]
        );
        expect(row).toBeTruthy();
        expect(row.pickup_address).toBe('10 Pickup Road');
    });
});

// ---------------------------------------------------------------------------
// TC-E-001 — Customer blocked from status update
// ---------------------------------------------------------------------------

describe('TC-E-001 — Customer blocked from PATCH /orders/:id/status', () => {
    test('customer JWT → PATCH /orders/:id/status returns 403 Forbidden, order unchanged', async () => {
        const result = await runAsync(
            "INSERT INTO orders (user_id, pickup_address, delivery_address, status) VALUES (?, 'P', 'D', 'pending')",
            [customerUserId]
        );
        const orderId = result.lastID;

        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${customerToken}`)
            .send({ status: 'delivered' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden' });

        const row = await getAsync('SELECT status FROM orders WHERE id = ?', [orderId]);
        expect(row.status).toBe('pending');
    });
});

// ---------------------------------------------------------------------------
// TC-E-002 — Driver blocked from admin panel
// ---------------------------------------------------------------------------

describe('TC-E-002 — Driver blocked from GET /admin/users', () => {
    test('driver JWT → GET /admin/users returns 403 Forbidden', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${driverToken}`);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden' });
    });
});

// ---------------------------------------------------------------------------
// TC-E-003 — Legacy JWT without role claim
// ---------------------------------------------------------------------------

describe('TC-E-003 — Legacy JWT without role claim treated as customer', () => {
    test('JWT with no role field → PATCH /orders/:id/status returns 403, no crash', async () => {
        const legacyToken = jwt.sign({ id: 1, email: 'x@y.com' }, JWT_SECRET); // no role
        const result = await runAsync(
            "INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, 'P', 'D')",
            [customerUserId]
        );
        const orderId = result.lastID;

        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${legacyToken}`)
            .send({ status: 'in_transit' });

        // Must be 403 (customer default), not 500 crash
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden' });
    });
});

// ---------------------------------------------------------------------------
// TC-E-004 — PATCH non-existent order returns 404
// ---------------------------------------------------------------------------

describe('TC-E-004 — PATCH non-existent order returns 404', () => {
    test('driver JWT, PATCH /orders/99999/status → 404 Order not found', async () => {
        const res = await request(app)
            .patch('/orders/99999/status')
            .set('Cookie', `token=${driverToken}`)
            .send({ status: 'delivered' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Order not found' });
    });
});

// ---------------------------------------------------------------------------
// TC-E-005 — Invalid status value returns 400
// ---------------------------------------------------------------------------

describe('TC-E-005 — Invalid status value', () => {
    test('driver JWT, PATCH /orders/:id/status with invalid status → 400 Invalid status', async () => {
        const result = await runAsync(
            "INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, 'P', 'D')",
            [driverUserId]
        );
        const orderId = result.lastID;

        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${driverToken}`)
            .send({ status: 'flying' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid status' });
    });
});

// ---------------------------------------------------------------------------
// TC-E-006 — Invalid role on POST /admin/users/:id/role returns 400
// ---------------------------------------------------------------------------

describe('TC-E-006 — Invalid role submitted to POST /admin/users/:id/role', () => {
    test('admin JWT, role=superuser → 400 Invalid role', async () => {
        const res = await request(app)
            .post(`/admin/users/${secondUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'superuser' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid role' });
    });
});

// ---------------------------------------------------------------------------
// TC-E-007 — ALTER TABLE idempotency (second boot against existing DB)
// ---------------------------------------------------------------------------

describe('TC-E-007 — ALTER TABLE migration guard is idempotent', () => {
    test('app loads without crashing when role column already exists', () => {
        // The app was already loaded in beforeAll against a DB that includes
        // the role column in CREATE TABLE. The ALTER TABLE guard runs inside
        // db.serialize() and silently swallows the "duplicate column name" error.
        // If we reached this point the app loaded successfully — assert truthiness.
        expect(app).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// TC-R-001 — Existing login flow unchanged
// ---------------------------------------------------------------------------

describe('TC-R-001 — Existing login flow unchanged', () => {
    test('POST /login with valid credentials sets cookie and redirects to /dashboard', async () => {
        const res = await request(app)
            .post('/login')
            .type('form')
            .send({ email: 'customer@rbac.test', password: 'Password1' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/dashboard');

        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const tokenCookie = cookies.find((c) => c.startsWith('token='));
        expect(tokenCookie).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// TC-R-002 — Order creation unchanged (GET /orders, GET /orders/:id no 403)
// ---------------------------------------------------------------------------

describe('TC-R-002 — Order-related routes have no 403 regressions', () => {
    test('GET /orders with customer JWT returns 200', async () => {
        const res = await request(app)
            .get('/orders')
            .set('Cookie', `token=${customerToken}`);
        expect(res.status).toBe(200);
    });

    test('GET /orders/:id for own order returns 200', async () => {
        const result = await runAsync(
            "INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, 'P', 'D')",
            [customerUserId]
        );
        const orderId = result.lastID;

        const res = await request(app)
            .get(`/orders/${orderId}`)
            .set('Cookie', `token=${customerToken}`);
        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// TC-R-003 — Unauthenticated /dashboard still redirects (not 403)
// ---------------------------------------------------------------------------

describe('TC-R-003 — Unauthenticated /dashboard redirects to /login', () => {
    test('GET /dashboard without cookie returns 302 to /login', async () => {
        const res = await request(app).get('/dashboard');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });
});

// ---------------------------------------------------------------------------
// TC-R-004 — Health endpoint unaffected
// ---------------------------------------------------------------------------

describe('TC-R-004 — GET /health returns 200 without auth', () => {
    test('GET /health → 200 { status: "ok" }', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ---------------------------------------------------------------------------
// TC-R-005 — Signup assigns customer role
// ---------------------------------------------------------------------------

describe('TC-R-005 — Signup assigns customer role via DB default', () => {
    test('POST /signup creates user with role=customer', async () => {
        const email = `signup-${Date.now()}@rbac.test`;

        const res = await request(app)
            .post('/signup')
            .type('form')
            .send({ name: 'New Tester', email, password: 'Password1' });

        expect(res.status).toBe(302);

        const row = await getAsync('SELECT role FROM users WHERE email = ?', [email]);
        expect(row).toBeTruthy();
        expect(row.role).toBe('customer');
    });
});
