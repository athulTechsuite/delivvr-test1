require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

// Constants
const REFRESH_TOKEN_LENGTH = 64;
const BCRYPT_ROUNDS = 10;

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
        refresh_token TEXT DEFAULT NULL,
        token_expires_at DATETIME DEFAULT NULL,
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
            if (!email || typeof email !== 'string') {
                reject(new Error('Email is required and must be a string'));
                return;
            }
            
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
            if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                reject(new Error('User ID is required and must be a number or string'));
                return;
            }
            
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
            if (!name || typeof name !== 'string') {
                reject(new Error('Name is required and must be a string'));
                return;
            }
            if (!email || typeof email !== 'string') {
                reject(new Error('Email is required and must be a string'));
                return;
            }
            if (!hashedPassword || typeof hashedPassword !== 'string') {
                reject(new Error('Hashed password is required and must be a string'));
                return;
            }
            
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

    // Generate refresh token
    generateRefreshToken: () => {
        try {
            return crypto.randomBytes(REFRESH_TOKEN_LENGTH / 2).toString('hex');
        } catch (err) {
            throw new Error('Failed to generate refresh token: ' + err.message);
        }
    },

    // Hash refresh token
    hashRefreshToken: async (token) => {
        try {
            if (!token || typeof token !== 'string') {
                throw new Error('Token is required and must be a string');
            }
            
            const hashedToken = await bcrypt.hash(token, BCRYPT_ROUNDS);
            return hashedToken;
        } catch (err) {
            throw new Error('Failed to hash refresh token: ' + err.message);
        }
    },

    // Validate refresh token
    validateRefreshToken: async (plainToken, hashedToken) => {
        try {
            if (!plainToken || typeof plainToken !== 'string') {
                throw new Error('Plain token is required and must be a string');
            }
            if (!hashedToken || typeof hashedToken !== 'string') {
                throw new Error('Hashed token is required and must be a string');
            }
            
            const isValid = await bcrypt.compare(plainToken, hashedToken);
            return isValid;
        } catch (err) {
            throw new Error('Failed to validate refresh token: ' + err.message);
        }
    },

    // Set user refresh token
    setUserRefreshToken: (userId, hashedToken, expiresAt) => {
        return new Promise((resolve, reject) => {
            if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
                reject(new Error('User ID is required and must be a number or string'));
                return;
            }
            if (!hashedToken || typeof hashedToken !== 'string') {
                reject(new Error('Hashed token is required and must be a string'));
                return;
            }
            if (!expiresAt || (typeof expiresAt !== 'string' && !(expiresAt instanceof Date))) {
                reject(new Error('Expires at is required and must be a date string or Date object'));
                return;
            }
            
            const expiresAtString = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
            
            db.run('UPDATE users SET refresh_token = ?, token_expires_at = ? WHERE id = ?', 
                [hashedToken, expiresAtString, userId], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes === 0) {
                            reject(new Error('User not found'));
                        } else {
                            resolve({ userId, hashedToken, expiresAt: expiresAtString });
                        }
                    }
                }
            );
        });
    },

    // Clear user refresh token
    clearUserRefreshToken: (userId) => {
        return new Promise((resolve, reject) => {
            if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
                reject(new Error('User ID is required and must be a number or string'));
                return;
            }
            
            db.run('UPDATE users SET refresh_token = NULL, token_expires_at = NULL WHERE id = ?', 
                [userId], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ userId, cleared: this.changes > 0 });
                    }
                }
            );
        });
    },

    // Get user by refresh token
    getUserByRefreshToken: (hashedToken) => {
        return new Promise((resolve, reject) => {
            if (!hashedToken || typeof hashedToken !== 'string') {
                reject(new Error('Hashed token is required and must be a string'));
                return;
            }
            
            db.get('SELECT * FROM users WHERE refresh_token = ? AND token_expires_at > datetime("now")', 
                [hashedToken], 
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }
};

module.exports = {
    db,
    dbHelpers
};