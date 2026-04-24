// Tests for the Order model and the /orders routes.
const path = require('path');
const fs = require('fs');

// Ensure env is set up before loading app / model.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
process.env.DB_PATH = path.join(__dirname, 'orders-test.db');

// Remove any stale DB from previous runs so schema and data start clean.
if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
}

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Order = require('../models/Order');

let db;
let testUserId;
let validToken;

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
    db = new sqlite3.Database(process.env.DB_PATH);

    await runAsync(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
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
    const result = await runAsync(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        ['Order Tester', 'order-tester@example.com', hashed]
    );
    testUserId = result.lastID;

    validToken = jwt.sign(
        { id: testUserId, email: 'order-tester@example.com' },
        process.env.JWT_SECRET
    );
});

afterAll((done) => {
    db.close(() => {
        if (fs.existsSync(process.env.DB_PATH)) {
            try {
                fs.unlinkSync(process.env.DB_PATH);
            } catch (_) {
                // ignore unlink errors
            }
        }
        done();
    });
});

afterEach(async () => {
    await runAsync('DELETE FROM orders');
});

describe('Order model', () => {
    test('create() inserts an order with trimmed fields and returns the row', async () => {
        const order = await Order.create(testUserId, {
            pickup_address: '  123 Pickup St  ',
            delivery_address: '  456 Delivery Ave  ',
            package_description: '  Small box  '
        });

        expect(order).toBeTruthy();
        expect(order.user_id).toBe(testUserId);
        expect(order.pickup_address).toBe('123 Pickup St');
        expect(order.delivery_address).toBe('456 Delivery Ave');
        expect(order.package_description).toBe('Small box');
        expect(order.status).toBe('pending');
    });

    test('create() stores NULL for whitespace-only package_description', async () => {
        const order = await Order.create(testUserId, {
            pickup_address: '123 Pickup St',
            delivery_address: '456 Delivery Ave',
            package_description: '   '
        });

        expect(order.package_description).toBeNull();
    });

    test('create() stores NULL when package_description is omitted', async () => {
        const order = await Order.create(testUserId, {
            pickup_address: '123 Pickup St',
            delivery_address: '456 Delivery Ave'
        });

        expect(order.package_description).toBeNull();
    });

    test('create() rejects missing required fields', async () => {
        await expect(
            Order.create(testUserId, { pickup_address: '', delivery_address: 'x' })
        ).rejects.toThrow('pickup_address is required');

        await expect(
            Order.create(testUserId, { pickup_address: 'x', delivery_address: '' })
        ).rejects.toThrow('delivery_address is required');
    });

    test('create() rejects invalid userId', async () => {
        await expect(
            Order.create(0, { pickup_address: 'a', delivery_address: 'b' })
        ).rejects.toThrow('Invalid userId');
    });

    test('findByUserId() returns orders newest first', async () => {
        const first = await Order.create(testUserId, {
            pickup_address: 'First pickup',
            delivery_address: 'First delivery'
        });
        // Ensure distinct created_at timestamps
        await new Promise((r) => setTimeout(r, 1100));
        const second = await Order.create(testUserId, {
            pickup_address: 'Second pickup',
            delivery_address: 'Second delivery'
        });

        const rows = await Order.findByUserId(testUserId);
        expect(rows).toHaveLength(2);
        expect(rows[0].id).toBe(second.id);
        expect(rows[1].id).toBe(first.id);
    });

    test('findByUserId() returns empty array when there are no orders', async () => {
        const rows = await Order.findByUserId(testUserId);
        expect(rows).toEqual([]);
    });

    test('findById() returns the matching order', async () => {
        const created = await Order.create(testUserId, {
            pickup_address: 'P',
            delivery_address: 'D'
        });
        const found = await Order.findById(created.id);
        expect(found).toBeTruthy();
        expect(found.id).toBe(created.id);
    });

    test('countActiveByUserId() counts pending, in_transit, out_for_delivery', async () => {
        await Order.create(testUserId, { pickup_address: 'p', delivery_address: 'd' });
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address, status) VALUES (?, ?, ?, ?)',
            [testUserId, 'p2', 'd2', 'in_transit']
        );
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address, status) VALUES (?, ?, ?, ?)',
            [testUserId, 'p3', 'd3', 'out_for_delivery']
        );
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address, status) VALUES (?, ?, ?, ?)',
            [testUserId, 'p4', 'd4', 'delivered']
        );

        const count = await Order.countActiveByUserId(testUserId);
        expect(count).toBe(3);
    });

    test('countPendingByUserId() counts only pending orders', async () => {
        await Order.create(testUserId, { pickup_address: 'p', delivery_address: 'd' });
        await runAsync(
            'INSERT INTO orders (user_id, pickup_address, delivery_address, status) VALUES (?, ?, ?, ?)',
            [testUserId, 'p2', 'd2', 'delivered']
        );

        const count = await Order.countPendingByUserId(testUserId);
        expect(count).toBe(1);
    });
});

describe('Order HTTP routes', () => {
    // Load app lazily after env + schema are configured.
    let request;
    let app;

    beforeAll(() => {
        request = require('supertest');
        app = require('../app');
    });

    test('GET /orders/new requires authentication', async () => {
        const res = await request(app).get('/orders/new');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    test('GET /orders/new renders the form for authenticated users', async () => {
        const res = await request(app)
            .get('/orders/new')
            .set('Cookie', `token=${validToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('name="pickup_address"');
        expect(res.text).toContain('name="delivery_address"');
        expect(res.text).toContain('name="package_description"');
        expect(res.text).toContain('Place Order');
    });

    test('POST /orders creates an order and redirects', async () => {
        const res = await request(app)
            .post('/orders')
            .set('Cookie', `token=${validToken}`)
            .type('form')
            .send({
                pickup_address: '10 Main Street',
                delivery_address: '20 Oak Avenue',
                package_description: 'Books'
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/orders');

        const saved = await getAsync(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [testUserId]
        );
        expect(saved).toBeTruthy();
        expect(saved.pickup_address).toBe('10 Main Street');
        expect(saved.delivery_address).toBe('20 Oak Avenue');
        expect(saved.package_description).toBe('Books');
        expect(saved.status).toBe('pending');
    });

    test('POST /orders stores NULL for whitespace-only description', async () => {
        await request(app)
            .post('/orders')
            .set('Cookie', `token=${validToken}`)
            .type('form')
            .send({
                pickup_address: '10 Main Street',
                delivery_address: '20 Oak Avenue',
                package_description: '     '
            });

        const saved = await getAsync(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [testUserId]
        );
        expect(saved.package_description).toBeNull();
    });

    test('POST /orders re-renders the form with errors when validation fails', async () => {
        const res = await request(app)
            .post('/orders')
            .set('Cookie', `token=${validToken}`)
            .type('form')
            .send({
                pickup_address: '',
                delivery_address: 'somewhere far away'
            });

        expect(res.status).toBe(400);
        expect(res.text).toContain('Pickup address is required');
        // Form should be re-rendered, not crashed
        expect(res.text).toContain('name="pickup_address"');
    });

    test('GET /orders lists the user orders', async () => {
        await Order.create(testUserId, {
            pickup_address: 'List pickup',
            delivery_address: 'List delivery',
            package_description: 'Docs'
        });

        const res = await request(app)
            .get('/orders')
            .set('Cookie', `token=${validToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('My Orders');
        expect(res.text).toContain('List pickup');
        expect(res.text).toContain('List delivery');
        expect(res.text).toContain('Docs');
    });

    test('GET /orders shows empty state when no orders exist', async () => {
        const res = await request(app)
            .get('/orders')
            .set('Cookie', `token=${validToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('No orders yet');
    });

    test('GET /dashboard shows live counts from Order model', async () => {
        await Order.create(testUserId, {
            pickup_address: 'Dash pickup',
            delivery_address: 'Dash delivery'
        });

        const res = await request(app)
            .get('/dashboard')
            .set('Cookie', `token=${validToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('Active Deliveries');
        expect(res.text).toContain('Pending Pickups');
        expect(res.text).toContain('Place Order');
        // Unused count rows should not crash rendering
        expect(res.text).not.toContain('<%= activeDeliveriesCount %>');
    });
});
