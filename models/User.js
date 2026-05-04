const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Use the same database path logic as app.js and middleware/auth.js so all
// modules share a single SQLite file.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

class User {
    constructor(name, email, password) {
        this.name = name;
        this.email = email;
        this.password = password;
    }

    // Create a new user
    async save() {
        return new Promise(async (resolve, reject) => {
            try {
                // Hash the password
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(this.password, saltRounds);

                const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                stmt.run([this.name, this.email, hashedPassword], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            name: this.name,
                            email: this.email
                        });
                    }
                });
                stmt.finalize();
            } catch (error) {
                reject(error);
            }
        });
    }

    // Find user by email
    static findByEmail(email) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Find user by ID
    static findById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Validate password
    static async validatePassword(plainPassword, hashedPassword) {
        try {
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            throw error;
        }
    }

    // Get all users (for admin purposes)
    static findAll() {
        return new Promise((resolve, reject) => {
            db.all('SELECT id, name, email, created_at FROM users', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Update user
    static updateById(id, updates) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(updates);
            const values = Object.values(updates);
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            
            const query = `UPDATE users SET ${setClause} WHERE id = ?`;
            values.push(id);

            db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Delete user
    static deleteById(id) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }
}

// Allowed role values — extend this array if the role enum ever grows.
User.VALID_ROLES = Object.freeze(['user', 'admin']);

// Return all users with their roles, newest first.
User.findAllWithRoles = function findAllWithRoles() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC',
            [],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            }
        );
    });
};

// Update a user's role. Validates the enum, then updates and re-fetches the row.
// Resolves to the updated user row, or null if the user does not exist.
User.updateRole = function updateRole(id, role) {
    return new Promise((resolve, reject) => {
        if (!User.VALID_ROLES.includes(role)) {
            return reject(
                Object.assign(
                    new Error(`Invalid role. Must be one of: ${User.VALID_ROLES.join(', ')}`),
                    { code: 'INVALID_ROLE' }
                )
            );
        }
        db.run('UPDATE users SET role = ? WHERE id = ?', [role, id], function (err) {
            if (err) return reject(err);
            if (this.changes === 0) return resolve(null); // user not found
            db.get(
                'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
                [id],
                (selErr, row) => {
                    if (selErr) return reject(selErr);
                    resolve(row);
                }
            );
        });
    });
};

// Close database connection on process termination
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

module.exports = User;