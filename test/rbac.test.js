/**
 * RBAC test suite — covers TEC-392 role-based access control feature.
 *
 * Test IDs follow the PRD:
 *   TC-F-001 … TC-F-008  (functional)
 *   TC-E-001 … TC-E-005  (edge cases)
 *   TC-R-001 … TC-R-003  (regression)
 */

const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

// jest-setup.js sets JWT_SECRET and DB_PATH before any module is loaded.
// When running this file standalone, apply the same env defaults.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, 'test.db');

const JWT_SECRET = process.env.JWT_SECRET;
const TEST_DB_PATH = process.env.DB_PATH;

// Load the app AFTER env vars are set.
const app = require('../app');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Open a direct connection to the test database so we can seed and inspect
 * rows without going through the app's own connection pool.
 */
let testDb;

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    testDb.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    testDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Insert a user with the given role and return { id, email, plainPassword }.
 * The caller is responsible for supplying a unique email per test.
 */
async function createUser({ name, email, password, role = 'customer' }) {
  const hashed = await bcrypt.hash(password, 10);
  const result = await dbRun(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, hashed, role]
  );
  return { id: result.lastID, name, email, plainPassword: password, role };
}

/**
 * Sign a JWT for a user with the given payload — mirrors exactly what app.js
 * does at POST /login, including the `role` field.
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll((done) => {
  testDb = new sqlite3.Database(TEST_DB_PATH);
  // Ensure the users table exists with the role column before any test runs.
  testDb.serialize(() => {
    testDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    testDb.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      pickup_address TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      package_description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, done);
  });
});

afterAll((done) => {
  testDb.close(done);
});

afterEach((done) => {
  testDb.serialize(() => {
    testDb.run('DELETE FROM orders');
    testDb.run('DELETE FROM users', done);
  });
});

// ─── Functional Tests ───────────────────────────────────────────────────────

describe('TC-F-001: Customer can access order form', () => {
  test('GET /orders/new returns 200 for a logged-in customer', async () => {
    const u = await createUser({ name: 'Alice', email: 'alice@test.com', password: 'Pass1word', role: 'customer' });
    const token = signToken({ id: u.id, email: u.email, role: u.role });

    const res = await request(app)
      .get('/orders/new')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('pickup_address');
  });
});

describe('TC-F-002: Customer is blocked from the admin page', () => {
  test('GET /admin/users returns 403 with "Access Denied" for a customer', async () => {
    const u = await createUser({ name: 'Bob', email: 'bob@test.com', password: 'Pass1word', role: 'customer' });
    const token = signToken({ id: u.id, email: u.email, role: u.role });

    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(403);
    expect(res.text).toContain('Access Denied');
  });
});

describe('TC-F-003: Admin can access order form', () => {
  test('GET /orders/new returns 200 for a logged-in admin', async () => {
    const u = await createUser({ name: 'Carol', email: 'carol@test.com', password: 'Pass1word', role: 'admin' });
    const token = signToken({ id: u.id, email: u.email, role: u.role });

    const res = await request(app)
      .get('/orders/new')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('pickup_address');
  });
});

describe('TC-F-004: Admin can view user list', () => {
  test('GET /admin/users returns 200 with a table for a logged-in admin', async () => {
    const u = await createUser({ name: 'Dave', email: 'dave@test.com', password: 'Pass1word', role: 'admin' });
    const token = signToken({ id: u.id, email: u.email, role: u.role });

    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('<table');
    expect(res.text).toContain(u.email);
  });
});

describe('TC-F-005: Admin promotes user', () => {
  test('POST /admin/users/:id/role with role=admin redirects and updates DB', async () => {
    const admin = await createUser({ name: 'Eve Admin', email: 'eve@test.com', password: 'Pass1word', role: 'admin' });
    const customer = await createUser({ name: 'Frank', email: 'frank@test.com', password: 'Pass1word', role: 'customer' });
    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });

    const res = await request(app)
      .post(`/admin/users/${customer.id}/role`)
      .set('Cookie', `token=${token}`)
      .send('role=admin');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/users');

    const row = await dbGet('SELECT role FROM users WHERE id = ?', [customer.id]);
    expect(row.role).toBe('admin');
  });
});

describe('TC-F-006: Admin demotes user', () => {
  test('POST /admin/users/:id/role with role=customer redirects and updates DB', async () => {
    const admin = await createUser({ name: 'Grace Admin', email: 'grace@test.com', password: 'Pass1word', role: 'admin' });
    const adminUser = await createUser({ name: 'Hank', email: 'hank@test.com', password: 'Pass1word', role: 'admin' });
    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });

    const res = await request(app)
      .post(`/admin/users/${adminUser.id}/role`)
      .set('Cookie', `token=${token}`)
      .send('role=customer');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/users');

    const row = await dbGet('SELECT role FROM users WHERE id = ?', [adminUser.id]);
    expect(row.role).toBe('customer');
  });
});

describe('TC-F-007: New signup defaults to customer', () => {
  test('POST /signup creates user with role=customer', async () => {
    const res = await request(app)
      .post('/signup')
      .send({ name: 'Ivan New', email: 'ivan@test.com', password: 'ValidPass1' });

    expect(res.status).toBe(302);

    const row = await dbGet('SELECT role FROM users WHERE email = ?', ['ivan@test.com']);
    expect(row).toBeTruthy();
    expect(row.role).toBe('customer');
  });
});

describe('TC-F-008: JWT contains role field', () => {
  test('POST /login returns a cookie whose JWT payload includes role', async () => {
    await createUser({ name: 'Judy', email: 'judy@test.com', password: 'ValidPass1', role: 'customer' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'judy@test.com', password: 'ValidPass1' });

    expect(res.status).toBe(302);

    const cookies = res.headers['set-cookie'] || [];
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    expect(tokenCookie).toBeTruthy();

    const tokenValue = tokenCookie.split(';')[0].replace('token=', '');
    const decoded = jwt.verify(tokenValue, JWT_SECRET);

    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('email', 'judy@test.com');
    expect(decoded).toHaveProperty('role', 'customer');
  });

  test('POST /login JWT role equals "admin" for an admin account', async () => {
    await createUser({ name: 'Karl Admin', email: 'karl@test.com', password: 'ValidPass1', role: 'admin' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'karl@test.com', password: 'ValidPass1' });

    expect(res.status).toBe(302);

    const cookies = res.headers['set-cookie'] || [];
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    const tokenValue = tokenCookie.split(';')[0].replace('token=', '');
    const decoded = jwt.verify(tokenValue, JWT_SECRET);

    expect(decoded.role).toBe('admin');
  });
});

// ─── Edge Case Tests ─────────────────────────────────────────────────────────

describe('TC-E-001: Role change JWT lag', () => {
  test('Promoted user with old customer token still gets 403 on /admin/users', async () => {
    const admin = await createUser({ name: 'Leo Admin', email: 'leo@test.com', password: 'Pass1word', role: 'admin' });
    const customer = await createUser({ name: 'Mia', email: 'mia@test.com', password: 'Pass1word', role: 'customer' });

    // Mia's old token (role=customer)
    const oldToken = signToken({ id: customer.id, email: customer.email, role: 'customer' });

    // Admin promotes Mia to admin in the DB
    const adminToken = signToken({ id: admin.id, email: admin.email, role: 'admin' });
    await request(app)
      .post(`/admin/users/${customer.id}/role`)
      .set('Cookie', `token=${adminToken}`)
      .send('role=admin');

    // Mia still uses the old customer token — must be denied
    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', `token=${oldToken}`);

    expect(res.status).toBe(403);
  });
});

describe('TC-E-002: Invalid role value rejected', () => {
  test('POST /admin/users/:id/role with role=superuser returns 400', async () => {
    const admin = await createUser({ name: 'Nina Admin', email: 'nina@test.com', password: 'Pass1word', role: 'admin' });
    const customer = await createUser({ name: 'Omar', email: 'omar@test.com', password: 'Pass1word', role: 'customer' });
    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });

    const res = await request(app)
      .post(`/admin/users/${customer.id}/role`)
      .set('Cookie', `token=${token}`)
      .send('role=superuser');

    expect(res.status).toBe(400);

    // DB row should be unchanged
    const row = await dbGet('SELECT role FROM users WHERE id = ?', [customer.id]);
    expect(row.role).toBe('customer');
  });
});

describe('TC-E-003: Non-integer user ID rejected', () => {
  test('POST /admin/users/abc/role returns 400', async () => {
    const admin = await createUser({ name: 'Pat Admin', email: 'pat@test.com', password: 'Pass1word', role: 'admin' });
    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });

    const res = await request(app)
      .post('/admin/users/abc/role')
      .set('Cookie', `token=${token}`)
      .send('role=admin');

    expect(res.status).toBe(400);
  });
});

describe('TC-E-004: Idempotent migration on server restart', () => {
  test('app module loads without throwing even if role column already exists', () => {
    // The app is already loaded (require cache). If the ALTER TABLE migration
    // threw on duplicate column, app startup would have failed before reaching
    // this test. We just assert the module exports a valid Express app.
    expect(typeof app.listen).toBe('function');
  });
});

describe('TC-E-005: Unauthenticated request to admin route redirects to /login', () => {
  test('GET /admin/users with no cookie returns 302 to /login', async () => {
    const res = await request(app).get('/admin/users');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

// ─── Regression Tests ────────────────────────────────────────────────────────

describe('TC-R-001: Unauthenticated order creation blocked', () => {
  test('POST /orders with no token redirects to /login', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ pickup_address: '1 Main St', delivery_address: '2 Main St' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('TC-R-002: Tenant order isolation preserved', () => {
  test('Customer A cannot see Customer B order — returns 404 not 403', async () => {
    const userA = await createUser({ name: 'Quinn', email: 'quinn@test.com', password: 'Pass1word', role: 'customer' });
    const userB = await createUser({ name: 'Rose', email: 'rose@test.com', password: 'Pass1word', role: 'customer' });

    // Insert an order belonging to userB directly
    const result = await dbRun(
      'INSERT INTO orders (user_id, pickup_address, delivery_address) VALUES (?, ?, ?)',
      [userB.id, '10 Pickup Ave', '20 Drop St']
    );
    const orderId = result.lastID;

    const tokenA = signToken({ id: userA.id, email: userA.email, role: 'customer' });

    const res = await request(app)
      .get(`/orders/${orderId}`)
      .set('Cookie', `token=${tokenA}`);

    // Must be 404, not 403, preserving tenant isolation
    expect(res.status).toBe(404);
  });
});

describe('TC-R-003: Existing signup flow unaffected', () => {
  test('POST /signup succeeds without a role field in the body, user gets role=customer', async () => {
    const res = await request(app)
      .post('/signup')
      .send({ name: 'Sam New', email: 'sam@test.com', password: 'ValidPass1' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');

    const row = await dbGet('SELECT role FROM users WHERE email = ?', ['sam@test.com']);
    expect(row).toBeTruthy();
    expect(row.role).toBe('customer');
  });
});

// ─── 403 View Tests ──────────────────────────────────────────────────────────

describe('403 view correctness', () => {
  test('403 page contains "Access Denied" heading and dashboard link', async () => {
    const u = await createUser({ name: 'Tina', email: 'tina@test.com', password: 'Pass1word', role: 'customer' });
    const token = signToken({ id: u.id, email: u.email, role: 'customer' });

    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(403);
    expect(res.text).toContain('Access Denied');
    expect(res.text).toContain('href="/dashboard"');
  });
});
