const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Status constants
const ORDER_STATUS = Object.freeze({
    PENDING: 'pending',
    IN_TRANSIT: 'in_transit',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
});

const ACTIVE_STATUSES = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.IN_TRANSIT,
    ORDER_STATUS.OUT_FOR_DELIVERY
];

// Use the same database path logic as app.js so model and app share a DB.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Ensure the orders table exists when the model is loaded in isolation.
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        pickup_address TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        package_description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status)');
});

function isPositiveInteger(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function normalizeDescription(description) {
    if (description === undefined || description === null) {
        return null;
    }
    if (typeof description !== 'string') {
        return null;
    }
    const trimmed = description.trim();
    return trimmed.length === 0 ? null : trimmed;
}

class Order {
    // Create a new order. Returns the newly-inserted row.
    static create(userId, { pickup_address, delivery_address, package_description } = {}) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(userId)) {
                return reject(new Error('Invalid userId'));
            }

            if (typeof pickup_address !== 'string' || pickup_address.trim().length === 0) {
                return reject(new Error('pickup_address is required'));
            }
            if (typeof delivery_address !== 'string' || delivery_address.trim().length === 0) {
                return reject(new Error('delivery_address is required'));
            }

            const pickup = pickup_address.trim();
            const delivery = delivery_address.trim();
            const description = normalizeDescription(package_description);

            const stmt = db.prepare(
                'INSERT INTO orders (user_id, pickup_address, delivery_address, package_description) VALUES (?, ?, ?, ?)'
            );
            stmt.run([userId, pickup, delivery, description], function (err) {
                if (err) {
                    return reject(err);
                }
                const insertedId = this.lastID;
                db.get('SELECT * FROM orders WHERE id = ?', [insertedId], (selectErr, row) => {
                    if (selectErr) {
                        return reject(selectErr);
                    }
                    resolve(row);
                });
            });
            stmt.finalize();
        });
    }

    // Find all orders for a given user, newest first.
    static findByUserId(userId) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(userId)) {
                return reject(new Error('Invalid userId'));
            }
            db.all(
                'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(rows || []);
                }
            );
        });
    }

    // Find a single order by id.
    static findById(id) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(id)) {
                return reject(new Error('Invalid id'));
            }
            db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row);
            });
        });
    }

    // Count active orders (pending, in_transit, out_for_delivery) for a user.
    static countActiveByUserId(userId) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(userId)) {
                return reject(new Error('Invalid userId'));
            }
            const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
            const sql = `SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND status IN (${placeholders})`;
            db.get(sql, [userId, ...ACTIVE_STATUSES], (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row ? row.count : 0);
            });
        });
    }

    // Count delivered orders for a user.
    static countDeliveredByUserId(userId) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(userId)) {
                return reject(new Error('Invalid userId'));
            }
            db.get(
                'SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND status = ?',
                [userId, ORDER_STATUS.DELIVERED],
                (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(row ? row.count : 0);
                }
            );
        });
    }

    // Count pending orders for a user.
    static countPendingByUserId(userId) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(userId)) {
                return reject(new Error('Invalid userId'));
            }
            db.get(
                'SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND status = ?',
                [userId, ORDER_STATUS.PENDING],
                (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(row ? row.count : 0);
                }
            );
        });
    }

    // Find all orders across all users (admin use), newest first.
    static findAll() {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM orders ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(rows || []);
                }
            );
        });
    }

    // Update the status of a single order. Returns true if a row was changed,
    // false if the order does not exist. Rejects if status is invalid.
    static updateStatus(id, status) {
        return new Promise((resolve, reject) => {
            if (!isPositiveInteger(id)) {
                return reject(new Error('Invalid id'));
            }
            const validStatuses = Object.values(ORDER_STATUS);
            if (!validStatuses.includes(status)) {
                return reject(new Error(`Invalid status: ${status}`));
            }
            db.run(
                'UPDATE orders SET status = ? WHERE id = ?',
                [status, id],
                function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(this.changes > 0);
                }
            );
        });
    }

    // Insert a row into order_status_history. Non-blocking — caller should
    // chain .catch(console.error) for fire-and-forget use.
    static logStatusChange(orderId, changedByUserId, oldStatus, newStatus) {
        return new Promise((resolve, reject) => {
            const histDb = new sqlite3.Database(DB_PATH);
            histDb.run(
                'INSERT INTO order_status_history (order_id, changed_by_user_id, old_status, new_status) VALUES (?, ?, ?, ?)',
                [orderId, changedByUserId, oldStatus, newStatus],
                function (err) {
                    histDb.close();
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Retrieve the full audit history for a single order, newest-first.
    static getStatusHistory(orderId) {
        return new Promise((resolve, reject) => {
            const histDb = new sqlite3.Database(DB_PATH);
            histDb.all(
                'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at DESC',
                [orderId],
                (err, rows) => {
                    histDb.close();
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
}

Order.STATUS = ORDER_STATUS;
Order.ACTIVE_STATUSES = ACTIVE_STATUSES;

module.exports = Order;
