// Tests for TEC-398: Admin UI for user roles (GET /admin/users, POST /admin/users/:id/role)
// and related admin nav link visibility in views.

const path = require('path');
const fs = require('fs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'admin-users-test-secret';
process.env.DB_PATH = path.join(__dirname, 'admin-users-integration-test.db');

// Start with a clean database for each run.
if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
}

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH;

let db;
let adminUserId;
let regularUserId;
let secondUserId;
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

    const hashed = await bcrypt.hash('Password123', 10);

    const adminResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin User', 'admin@admin-users-test.test', hashed]
    );
    adminUserId = adminResult.lastID;

    const userResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
        ['Regular User', 'user@admin-users-test.test', hashed]
    );
    regularUserId = userResult.lastID;

    const secondResult = await runAsync(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
        ['Second User', 'second@admin-users-test.test', hashed]
    );
    secondUserId = secondResult.lastID;

    adminToken = jwt.sign({ id: adminUserId, email: 'admin@admin-users-test.test' }, JWT_SECRET);
    userToken = jwt.sign({ id: regularUserId, email: 'user@admin-users-test.test' }, JWT_SECRET);
});

afterAll((done) => {
    db.close(() => {
        if (fs.existsSync(DB_PATH)) {
            try { fs.unlinkSync(DB_PATH); } catch (_) { /* ignore */ }
        }
        done();
    });
});

describe('GET /admin/users', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-001 Admin views user list
    test('TC-F-001 returns HTTP 200 and renders user table for admin', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('User Management');
        expect(res.text).toContain('Admin User');
        expect(res.text).toContain('Regular User');
        expect(res.text).toContain('Second User');
        expect(res.text).toContain('admin@admin-users-test.test');
    });

    // TC-F-004 Non-admin blocked from user list
    test('TC-F-004 returns HTTP 403 for regular user', async () => {
        const res = await request(app)
            .get('/admin/users')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
        expect(res.text).toContain('Access Denied');
    });

    // TC-F-005 Unauthenticated request blocked
    test('TC-F-005 redirects to /login when no token present', async () => {
        const res = await request(app).get('/admin/users');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });
});

describe('POST /admin/users/:id/role', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-002 Admin promotes a user
    test('TC-F-002 admin can promote regular user to admin (302 redirect)', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        const row = await getAsync('SELECT role FROM users WHERE id = ?', [regularUserId]);
        expect(row.role).toBe('admin');

        // Reset back to user for subsequent tests
        await runAsync('UPDATE users SET role = ? WHERE id = ?', ['user', regularUserId]);
    });

    // TC-F-003 Admin demotes another user
    test('TC-F-003 admin can demote another admin to user (302 redirect)', async () => {
        await runAsync('UPDATE users SET role = ? WHERE id = ?', ['admin', secondUserId]);

        const res = await request(app)
            .post(`/admin/users/${secondUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');

        const row = await getAsync('SELECT role FROM users WHERE id = ?', [secondUserId]);
        expect(row.role).toBe('user');
    });

    // TC-E-001 Self-demotion rejected
    test('TC-E-001 admin cannot demote themselves (403)', async () => {
        const res = await request(app)
            .post(`/admin/users/${adminUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/cannot demote yourself/i);

        // Verify DB row is unchanged
        const row = await getAsync('SELECT role FROM users WHERE id = ?', [adminUserId]);
        expect(row.role).toBe('admin');
    });

    // TC-E-005 Self-promotion to admin is allowed
    test('TC-E-005 admin can set their own role to admin without error (302)', async () => {
        const res = await request(app)
            .post(`/admin/users/${adminUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/users');
    });

    // TC-E-002 Invalid role value
    test('TC-E-002 returns 400 for invalid role value', async () => {
        const res = await request(app)
            .post(`/admin/users/${regularUserId}/role`)
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'dispatcher' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid role/i);
        expect(res.body.error).toContain('user');
        expect(res.body.error).toContain('admin');
    });

    // TC-E-003 Non-existent user id
    test('TC-E-003 returns 404 for non-existent user id', async () => {
        const res = await request(app)
            .post('/admin/users/99999/role')
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/User not found/i);
    });

    // TC-E-004 Non-integer user id
    test('TC-E-004 returns 404 for non-integer user id', async () => {
        const res = await request(app)
            .post('/admin/users/abc/role')
            .set('Cookie', `token=${adminToken}`)
            .type('form')
            .send({ role: 'admin' });

        expect(res.status).toBe(404);
    });

    // Non-admin blocked
    test('POST /admin/users/:id/role returns 403 for regular user', async () => {
        const res = await request(app)
            .post(`/admin/users/${adminUserId}/role`)
            .set('Cookie', `token=${userToken}`)
            .type('form')
            .send({ role: 'user' });

        expect(res.status).toBe(403);
    });
});

describe('Admin nav link visibility', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-F-006 Admin nav link visible for admin on dashboard
    test('TC-F-006 GET /dashboard shows admin nav link for admin user', async () => {
        const res = await request(app)
            .get('/dashboard')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('href="/admin/users"');
    });

    // TC-F-007 Admin nav link hidden for regular user on dashboard
    test('TC-F-007 GET /dashboard does not show admin nav link for regular user', async () => {
        const res = await request(app)
            .get('/dashboard')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(200);
        expect(res.text).not.toContain('href="/admin/users"');
    });

    // TC-F-008 Dashboard role propagated
    test('TC-F-008 GET /dashboard passes role in user object (admin link present)', async () => {
        const res = await request(app)
            .get('/dashboard')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        // The admin nav link is only rendered when user.role === 'admin'
        expect(res.text).toContain('href="/admin/users"');
    });

    // TC-R-003 Dashboard loads for regular user with no admin nav link
    test('TC-R-003 GET /dashboard returns 200 for regular user without admin nav link', async () => {
        const res = await request(app)
            .get('/dashboard')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(200);
        expect(res.text).not.toContain('href="/admin/users"');
    });

    // TC-R-004 Profile page loads with complete user object
    test('TC-R-004 GET /profile returns 200 with user data including id and role', async () => {
        const res = await request(app)
            .get('/profile')
            .set('Cookie', `token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('Admin User');
        expect(res.text).toContain('admin@admin-users-test.test');
    });
});

describe('Regression tests', () => {
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    // TC-R-001 Existing admin orders route still protected
    test('TC-R-001 GET /admin/orders returns 403 for regular user', async () => {
        const res = await request(app)
            .get('/admin/orders')
            .set('Cookie', `token=${userToken}`);

        expect(res.status).toBe(403);
    });

    // TC-R-002 Order status update still protected
    test('TC-R-002 PATCH /orders/:id/status returns 403 for regular user', async () => {
        const res = await request(app)
            .patch('/orders/1/status')
            .set('Cookie', `token=${userToken}`)
            .set('Content-Type', 'application/json')
            .send({ status: 'delivered' });

        expect(res.status).toBe(403);
    });
});
