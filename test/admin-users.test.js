// Integration tests for RBAC Admin UI — GET /admin/users and POST /admin/users/:id/role
// PRD: task-1777900377134 — Add RBAC Admin UI for user role management

const path = require('path');
const fs = require('fs');

// Configure env before any modules are loaded.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'admin-users-test-secret';
// The auth middleware and User model both need to see the same DB.
// models/User.js uses path.join(__dirname, '..', 'database.db') which ignores DB_PATH.
// We set DB_PATH for middleware/auth.js and seed the User model's own DB separately.
const USER_MODEL_DB_PATH = path.join(__dirname, '..', 'database.db');
// For auth middleware we use the same path (so roles are found on auth checks)
process.env.DB_PATH = USER_MODEL_DB_PATH;

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = USER_MODEL_DB_PATH;

let db;
let adminUserId;
let regularUserId;
let adminToken;
let userToken;

// Unique email suffix per test run to avoid collisions with existing data
const RUN_ID = `admin-users-test-${Date.now()}`;

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

    // Ensure schema exists
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

    const adminResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin User', `admin@${RUN_ID}.test`, hashed]
    );
    adminUserId = adminResult.lastID;

    const userResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
        ['Regular User', `user@${RUN_ID}.test`, hashed]
    );
    regularUserId = userResult.lastID;

    adminToken = jwt.sign({ id: adminUserId, email: `admin@${RUN_ID}.test` }, JWT_SECRET);
    userToken = jwt.sign({ id: regularUserId, email: `user@${RUN_ID}.test` }, JWT_SECRET);
});

afterAll(async () => {
    // Clean up the test users we created
    await runAsync('DELETE FROM users WHERE id = ? OR id = ?', [adminUserId, regularUserId]).catch(() => {});
    await new Promise((resolve) => db.close(resolve));
});

describe('Admin Users routes', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-001: Non-authenticated request to GET /admin/users → redirect to login
    test('TC-F-001 GET /admin/users redirects to /login when unauthenticated', async () => {
        const res = await request(app).get('/admin/users');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    // TC-F-002: Non-admin user request to GET /admin/users → 403
    test('TC-F-002 GET /admin/users returns 403 for non-admin user', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access Denied');
    });

    // TC-F-003: Admin user can GET /admin/users → 200
    test('TC-F-003 GET /admin/users returns 200 for admin user', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('Manage Users');
    });

    // TC-F-003 (detail): Response includes table structure with role select
    test('TC-F-003 GET /admin/users response includes user table with role select', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        // Should contain form elements for role selection
        expect(res.text).toContain('name="role"');
        // Should contain our test users in the table
        expect(res.text).toContain(`admin@${RUN_ID}.test`);
        expect(res.text).toContain(`user@${RUN_ID}.test`);
    });

    // TC-F-004: Admin can POST /admin/users/:id/role with valid role → redirect
    test('TC-F-004 POST /admin/users/:id/role with valid role redirects to /admin/users', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        // Verify role was actually updated in the database
        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('admin');

        // Restore original role for subsequent tests
        await runAsync('UPDATE users SET role = ? WHERE id = ?', ['user', regularUserId]);
    });

    // TC-F-004 (verify restore): Role is back to 'user' after restore
    test('TC-F-004 (verify) regular user role is restored to user after previous test', async () => {
        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('user');
    });

    // TC-E-001: POST with invalid role → 400
    test('TC-E-001 POST /admin/users/:id/role with invalid role returns 400', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'superuser' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid role');
    });

    // TC-E-002: POST with empty role → 400
    test('TC-E-002 POST /admin/users/:id/role with empty role returns 400', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid role');
    });

    // TC-F-005: Non-admin POST to /admin/users/:id/role → 403
    test('TC-F-005 POST /admin/users/:id/role returns 403 for non-admin user', async () => {
        const res = await request(app)
            .post(`/admin/users/${adminUserId}/role`)
            .set('Cookie', `token=${userToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access Denied');
    });

    // TC-F-006: Unauthenticated POST to /admin/users/:id/role → redirect
    test('TC-F-006 POST /admin/users/:id/role redirects to /login when unauthenticated', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    // TC-R-001: Admin can update role back to 'user'
    test('TC-R-001 Admin can demote admin to user via POST /admin/users/:id/role', async () => {
        // First promote to admin
        await runAsync('UPDATE users SET role = ? WHERE id = ?', ['admin', regularUserId]);

        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(302);

        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('user');
    });

    // TC-R-002: User model findAll returns role column
    test('TC-R-002 User.findAll() includes role column in results', async () => {
        const User = require('../models/User');
        const users = await User.findAll();
        expect(users.length).toBeGreaterThan(0);
        users.forEach((u) => {
            expect(u).toHaveProperty('role');
        });
    });

    // TC-R-003: User model findAll contains both test users and is ordered by created_at DESC
    test('TC-R-003 User.findAll() returns all users and is ordered by created_at DESC', async () => {
        const User = require('../models/User');
        const users = await User.findAll();
        expect(users.length).toBeGreaterThanOrEqual(2);

        // Both test users should be present
        const adminIdx = users.findIndex((u) => u.id === adminUserId);
        const userIdx = users.findIndex((u) => u.id === regularUserId);
        expect(adminIdx).toBeGreaterThanOrEqual(0);
        expect(userIdx).toBeGreaterThanOrEqual(0);

        // Verify the results are in DESC created_at order (each row's created_at >= next row's)
        for (let i = 0; i < users.length - 1; i++) {
            const curr = new Date(users[i].created_at).getTime();
            const next = new Date(users[i + 1].created_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(next);
        }
    });
});
