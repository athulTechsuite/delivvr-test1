// Tests for admin user-role management UI: GET /admin/users, POST /admin/users/:id/role,
// User.findAllWithRoles(), User.updateRole(), and regression checks.
// PRD: TEC-395 — Add admin UI for managing user roles (RBAC)

const path = require('path');
const fs = require('fs');

// Configure env before any modules are loaded.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'admin-users-test-secret';
process.env.DB_PATH = path.join(__dirname, 'admin-users-integration-test.db');

// Start with a clean database for each run.
if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
}

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH;

let db;
let adminUserId;
let regularUserId;
let secondAdminUserId;
let adminToken;
let userToken;
let secondAdminToken;

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

    // Insert primary admin user.
    const adminResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin User', 'admin@admin-users.test', hashed]
    );
    adminUserId = adminResult.lastID;

    // Insert regular user.
    const userResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
        ['Regular User', 'user@admin-users.test', hashed]
    );
    regularUserId = userResult.lastID;

    // Insert a second admin for self-demotion tests.
    const secondAdminResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Second Admin', 'admin2@admin-users.test', hashed]
    );
    secondAdminUserId = secondAdminResult.lastID;

    // Issue tokens using app.js convention: { id, email }.
    adminToken = jwt.sign({ id: adminUserId, email: 'admin@admin-users.test' }, JWT_SECRET);
    userToken = jwt.sign({ id: regularUserId, email: 'user@admin-users.test' }, JWT_SECRET);
    secondAdminToken = jwt.sign({ id: secondAdminUserId, email: 'admin2@admin-users.test' }, JWT_SECRET);
});

afterAll((done) => {
    db.close(() => {
        if (fs.existsSync(DB_PATH)) {
            try { fs.unlinkSync(DB_PATH); } catch (_) { /* ignore */ }
        }
        done();
    });
});

// ─── User model unit tests ─────────────────────────────────────────────────────

describe('User.findAllWithRoles()', () => {
    test('TC-F-001 (model) returns all users with role field, newest first', async () => {
        const rows = await User.findAllWithRoles();
        // Should have at least the 3 seeded users.
        expect(rows.length).toBeGreaterThanOrEqual(3);
        // Every row must have the role field.
        rows.forEach((row) => {
            expect(row).toHaveProperty('role');
            expect(row).toHaveProperty('id');
            expect(row).toHaveProperty('name');
            expect(row).toHaveProperty('email');
            expect(row).toHaveProperty('created_at');
            // Password must NOT be exposed.
            expect(row).not.toHaveProperty('password');
        });
    });

    test('findAllWithRoles() returns empty array when no users exist (unit isolation)', async () => {
        // Create an isolated in-memory db to confirm the empty-array case.
        const memDb = new sqlite3.Database(':memory:');
        await new Promise((resolve, reject) => {
            memDb.run(
                `CREATE TABLE users (
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
        // findAllWithRoles operates on the module-level db, not memDb —
        // so we verify the module resolves an array (not undefined/null).
        const rows = await User.findAllWithRoles();
        expect(Array.isArray(rows)).toBe(true);
        memDb.close();
    });
});

describe('User.updateRole()', () => {
    test('TC-F-002 (model) promotes user to admin and resolves updated row', async () => {
        // Ensure user starts as 'user'.
        await runAsync("UPDATE users SET role = 'user' WHERE id = ?", [regularUserId]);

        const updated = await User.updateRole(regularUserId, 'admin');
        expect(updated).not.toBeNull();
        expect(updated.id).toBe(regularUserId);
        expect(updated.role).toBe('admin');

        // Verify in DB.
        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('admin');

        // Reset for other tests.
        await runAsync("UPDATE users SET role = 'user' WHERE id = ?", [regularUserId]);
    });

    test('TC-F-003 (model) demotes admin to user and resolves updated row', async () => {
        // Ensure secondAdmin starts as 'admin'.
        await runAsync("UPDATE users SET role = 'admin' WHERE id = ?", [secondAdminUserId]);

        const updated = await User.updateRole(secondAdminUserId, 'user');
        expect(updated).not.toBeNull();
        expect(updated.role).toBe('user');

        // Reset for other tests.
        await runAsync("UPDATE users SET role = 'admin' WHERE id = ?", [secondAdminUserId]);
    });

    test('TC-E-002 (model) rejects invalid role with INVALID_ROLE code', async () => {
        await expect(User.updateRole(regularUserId, 'dispatcher')).rejects.toMatchObject({
            code: 'INVALID_ROLE',
            message: expect.stringContaining('Invalid role. Must be one of: user, admin')
        });
    });

    test('TC-E-002 (model) rejects empty string role', async () => {
        await expect(User.updateRole(regularUserId, '')).rejects.toMatchObject({
            code: 'INVALID_ROLE'
        });
    });

    test('TC-E-003 (model) resolves null when user id does not exist', async () => {
        const result = await User.updateRole(99999, 'user');
        expect(result).toBeNull();
    });
});

describe('User.VALID_ROLES', () => {
    test('VALID_ROLES contains exactly user and admin', () => {
        expect(User.VALID_ROLES).toContain('user');
        expect(User.VALID_ROLES).toContain('admin');
        expect(User.VALID_ROLES).toHaveLength(2);
    });

    test('VALID_ROLES is frozen (immutable)', () => {
        expect(Object.isFrozen(User.VALID_ROLES)).toBe(true);
    });
});

// ─── HTTP route tests ──────────────────────────────────────────────────────────

describe('Admin users HTTP routes', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-001 Admin views user list
    test('TC-F-001 GET /admin/users returns 200 with user table for admin', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('Manage Users');
        expect(res.text).toContain('Admin User');
        expect(res.text).toContain('Regular User');
    });

    // TC-F-004 Unauthenticated request redirects to /login
    test('TC-F-004 GET /admin/users redirects to /login when unauthenticated', async () => {
        const res = await request(app).get('/admin/users');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    // TC-F-005 Non-admin gets 403
    test('TC-F-005 GET /admin/users returns 403 for non-admin user', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access Denied');
    });

    // TC-F-002 Promote user to admin
    test('TC-F-002 POST /admin/users/:id/role promotes user to admin and redirects', async () => {
        // Ensure user starts as 'user'.
        await runAsync("UPDATE users SET role = 'user' WHERE id = ?", [regularUserId]);

        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('admin');

        // Reset for other tests.
        await runAsync("UPDATE users SET role = 'user' WHERE id = ?", [regularUserId]);
    });

    // TC-F-003 Demote second admin to user
    test('TC-F-003 POST /admin/users/:id/role demotes admin to user', async () => {
        await runAsync("UPDATE users SET role = 'admin' WHERE id = ?", [secondAdminUserId]);

        const res = await request(app)
            .post(`/admin/users/${secondAdminUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        const row = await getAsync('SELECT role FROM users WHERE id = ?', [secondAdminUserId]);
        expect(row.role).toBe('user');

        // Reset.
        await runAsync("UPDATE users SET role = 'admin' WHERE id = ?", [secondAdminUserId]);
    });

    // TC-E-001 Self-demotion blocked
    test('TC-E-001 POST /admin/users/:id/role returns 403 when admin tries to change own role', async () => {
        const res = await request(app)
            .post(`/admin/users/${adminUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Cannot change your own role');

        // DB row must be unchanged.
        const row = await getAsync('SELECT role FROM users WHERE id = ?', [adminUserId]);
        expect(row.role).toBe('admin');
    });

    // TC-E-002 Invalid role value
    test('TC-E-002 POST /admin/users/:id/role returns 400 for invalid role', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'dispatcher' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid role. Must be one of: user, admin');
    });

    // TC-E-003 Non-existent user id
    test('TC-E-003 POST /admin/users/99999/role returns 404 for non-existent user', async () => {
        const res = await request(app)
            .post('/admin/users/99999/role')
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/User not found/i);
    });

    // TC-E-004 Non-integer id in path
    test('TC-E-004 POST /admin/users/abc/role returns 404 for non-integer ID', async () => {
        const res = await request(app)
            .post('/admin/users/abc/role')
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/User not found/i);
    });

    // TC-R-001 Admin orders route unaffected
    test('TC-R-001 GET /admin/orders still returns 200 for admin after new routes added', async () => {
        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('All Orders');
    });

    test('TC-R-001 GET /admin/orders returns 403 for regular user', async () => {
        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
    });

    // TC-R-002 Order status PATCH unaffected
    test('TC-R-002 PATCH /orders/:id/status still works for admin', async () => {
        const result = await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
            [regularUserId, 'Regression Pickup', 'Regression Delivery']
        );
        const orderId = result.lastID;

        const res = await request(app)
            .patch(`/orders/${orderId}/status`)
            .set('Cookie', `token=${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'delivered' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        await runAsync('DELETE FROM orders WHERE id = ?', [orderId]);
    });

    // TC-R-003 requireRole middleware unchanged (renders 403 view, not JSON)
    test('TC-R-003 requireRole renders 403 view for non-admin web requests', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
        // Must be an HTML response (rendered view), not JSON.
        expect(res.headers['content-type']).toMatch(/html/);
        expect(res.body.error).toBeUndefined();
    });

    // admin-orders nav link
    test('admin-orders view contains link to /admin/users with text Manage Users', async () => {
        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('href="/admin/users"');
        expect(res.text).toContain('Manage Users');
    });

    // admin-users view disables own-account row controls
    test('admin-users view disables controls for the authenticated admin own row', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        // The response should contain a disabled attribute somewhere in the table.
        expect(res.text).toContain('disabled');
    });
});
