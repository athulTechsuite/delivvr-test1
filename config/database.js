require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const db = new sqlite3.Database(path.join(__dirname, '..', 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready');
        }
    });
});

// Database helper functions
const dbHelpers = {
    // Get user by email
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Get user by ID
    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Create new user
    createUser: (name, email, hashedPassword) => {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
                [name, email, hashedPassword], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, name, email });
                    }
                }
            );
        });
    },

    // Update user name
    updateUserName: (id, name) => {
        return new Promise((resolve, reject) => {
            if (!id || typeof id !== 'number') {
                reject(new Error('Invalid user ID'));
                return;
            }
            if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
                reject(new Error('Invalid name'));
                return;
            }
            
            const trimmedName = name.trim();
            db.run('UPDATE users SET name = ? WHERE id = ?', 
                [trimmedName, id], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('User not found'));
                    } else {
                        resolve({ success: true, changes: this.changes });
                    }
                }
            );
        });
    },

    // Update user password
    updateUserPassword: (id, hashedPassword) => {
        return new Promise((resolve, reject) => {
            if (!id || typeof id !== 'number') {
                reject(new Error('Invalid user ID'));
                return;
            }
            if (!hashedPassword || typeof hashedPassword !== 'string') {
                reject(new Error('Invalid password hash'));
                return;
            }

            db.run('UPDATE users SET password = ? WHERE id = ?', 
                [hashedPassword, id], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('User not found'));
                    } else {
                        resolve({ success: true, changes: this.changes });
                    }
                }
            );
        });
    },

    // Get user for password update (includes password field for verification)
    getUserForPasswordUpdate: (id) => {
        return new Promise((resolve, reject) => {
            if (!id || typeof id !== 'number') {
                reject(new Error('Invalid user ID'));
                return;
            }

            db.get('SELECT id, name, email, password FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error('User not found'));
                } else {
                    resolve(row);
                }
            });
        });
    }
};

module.exports = {
    db,
    dbHelpers
};