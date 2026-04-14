const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');

// Create database connection
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

// Constants
const REFRESH_TOKEN_SALT_ROUNDS = 12;
const REFRESH_TOKEN_LENGTH = 64;
const DEFAULT_REFRESH_TOKEN_DAYS = 7;

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TEXT,
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

    // Generate refresh token pair (plain token and bcrypt hash)
    static async generateRefreshTokenPair() {
        try {
            const plainToken = crypto.randomBytes(REFRESH_TOKEN_LENGTH / 2).toString('hex');
            const hashedToken = await bcrypt.hash(plainToken, REFRESH_TOKEN_SALT_ROUNDS);
            
            return {
                success: true,
                plainToken,
                hashedToken
            };
        } catch (error) {
            console.error('Error generating refresh token pair:', error.message);
            return {
                success: false,
                error: 'Failed to generate refresh token'
            };
        }
    }

    // Set refresh token for user
    static async setRefreshToken(userId, plainToken, daysValid = DEFAULT_REFRESH_TOKEN_DAYS) {
        return new Promise(async (resolve, reject) => {
            try {
                // Validate inputs
                if (!userId || !Number.isInteger(userId) || userId <= 0) {
                    return resolve({
                        success: false,
                        error: 'Invalid user ID'
                    });
                }

                if (!plainToken || typeof plainToken !== 'string' || plainToken.length !== REFRESH_TOKEN_LENGTH) {
                    return resolve({
                        success: false,
                        error: 'Invalid refresh token format'
                    });
                }

                if (!/^[a-f0-9]{64}$/.test(plainToken)) {
                    return resolve({
                        success: false,
                        error: 'Refresh token must be 64-character hex string'
                    });
                }

                if (!Number.isInteger(daysValid) || daysValid <= 0) {
                    return resolve({
                        success: false,
                        error: 'Invalid days valid value'
                    });
                }

                // Hash the token
                const hashedToken = await bcrypt.hash(plainToken, REFRESH_TOKEN_SALT_ROUNDS);
                
                // Calculate expiration date
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + daysValid);
                const expiresAtISO = expiresAt.toISOString();

                const stmt = db.prepare('UPDATE users SET refresh_token = ?, token_expires_at = ? WHERE id = ?');
                stmt.run([hashedToken, expiresAtISO, userId], function(err) {
                    stmt.finalize();
                    
                    if (err) {
                        console.error('Database error setting refresh token:', err.message);
                        resolve({
                            success: false,
                            error: 'Database error setting refresh token'
                        });
                    } else if (this.changes === 0) {
                        resolve({
                            success: false,
                            error: 'User not found'
                        });
                    } else {
                        resolve({
                            success: true,
                            expiresAt: expiresAtISO
                        });
                    }
                });
            } catch (error) {
                console.error('Error setting refresh token:', error.message);
                resolve({
                    success: false,
                    error: 'Failed to set refresh token'
                });
            }
        });
    }

    // Validate refresh token for user
    static async validateRefreshToken(userId, plainToken) {
        return new Promise((resolve, reject) => {
            try {
                // Validate inputs
                if (!userId || !Number.isInteger(userId) || userId <= 0) {
                    return resolve({
                        success: false,
                        error: 'Invalid user ID'
                    });
                }

                if (!plainToken || typeof plainToken !== 'string' || plainToken.length !== REFRESH_TOKEN_LENGTH) {
                    return resolve({
                        success: false,
                        error: 'Invalid refresh token format'
                    });
                }

                if (!/^[a-f0-9]{64}$/.test(plainToken)) {
                    return resolve({
                        success: false,
                        error: 'Refresh token must be 64-character hex string'
                    });
                }

                db.get('SELECT refresh_token, token_expires_at FROM users WHERE id = ?', [userId], async (err, row) => {
                    if (err) {
                        console.error('Database error validating refresh token:', err.message);
                        return resolve({
                            success: false,
                            error: 'Database error validating refresh token'
                        });
                    }

                    if (!row || !row.refresh_token || !row.token_expires_at) {
                        return resolve({
                            success: false,
                            error: 'No refresh token found for user'
                        });
                    }

                    // Check if token is expired
                    const expiresAt = new Date(row.token_expires_at);
                    const now = new Date();
                    
                    if (now >= expiresAt) {
                        return resolve({
                            success: false,
                            error: 'Refresh token expired'
                        });
                    }

                    try {
                        // Compare the tokens
                        const isValid = await bcrypt.compare(plainToken, row.refresh_token);
                        
                        resolve({
                            success: isValid,
                            error: isValid ? null : 'Invalid refresh token'
                        });
                    } catch (compareError) {
                        console.error('Error comparing refresh tokens:', compareError.message);
                        resolve({
                            success: false,
                            error: 'Failed to validate refresh token'
                        });
                    }
                });
            } catch (error) {
                console.error('Error validating refresh token:', error.message);
                resolve({
                    success: false,
                    error: 'Failed to validate refresh token'
                });
            }
        });
    }

    // Clear refresh token for user
    static async clearRefreshToken(userId) {
        return new Promise((resolve, reject) => {
            try {
                // Validate input
                if (!userId || !Number.isInteger(userId) || userId <= 0) {
                    return resolve({
                        success: false,
                        error: 'Invalid user ID'
                    });
                }

                const stmt = db.prepare('UPDATE users SET refresh_token = NULL, token_expires_at = NULL WHERE id = ?');
                stmt.run([userId], function(err) {
                    stmt.finalize();
                    
                    if (err) {
                        console.error('Database error clearing refresh token:', err.message);
                        resolve({
                            success: false,
                            error: 'Database error clearing refresh token'
                        });
                    } else {
                        resolve({
                            success: true,
                            changes: this.changes
                        });
                    }
                });
            } catch (error) {
                console.error('Error clearing refresh token:', error.message);
                resolve({
                    success: false,
                    error: 'Failed to clear refresh token'
                });
            }
        });
    }

    // Find user by valid refresh token
    static async getByValidRefreshToken(plainToken) {
        return new Promise((resolve, reject) => {
            try {
                // Validate input
                if (!plainToken || typeof plainToken !== 'string' || plainToken.length !== REFRESH_TOKEN_LENGTH) {
                    return resolve({
                        success: false,
                        error: 'Invalid refresh token format'
                    });
                }

                if (!/^[a-f0-9]{64}$/.test(plainToken)) {
                    return resolve({
                        success: false,
                        error: 'Refresh token must be 64-character hex string'
                    });
                }

                db.all('SELECT id, name, email, refresh_token, token_expires_at FROM users WHERE refresh_token IS NOT NULL AND token_expires_at IS NOT NULL', [], async (err, rows) => {
                    if (err) {
                        console.error('Database error finding user by refresh token:', err.message);
                        return resolve({
                            success: false,
                            error: 'Database error finding user'
                        });
                    }

                    if (!rows || rows.length === 0) {
                        return resolve({
                            success: false,
                            error: 'No users with refresh tokens found'
                        });
                    }

                    // Check each user's refresh token
                    for (const row of rows) {
                        try {
                            // Check if token is expired
                            const expiresAt = new Date(row.token_expires_at);
                            const now = new Date();
                            
                            if (now >= expiresAt) {
                                continue; // Skip expired tokens
                            }

                            // Compare the tokens
                            const isValid = await bcrypt.compare(plainToken, row.refresh_token);
                            
                            if (isValid) {
                                return resolve({
                                    success: true,
                                    user: {
                                        id: row.id,
                                        name: row.name,
                                        email: row.email
                                    }
                                });
                            }
                        } catch (compareError) {
                            console.error('Error comparing refresh token for user', row.id, ':', compareError.message);
                            continue;
                        }
                    }

                    resolve({
                        success: false,
                        error: 'Invalid or expired refresh token'
                    });
                });
            } catch (error) {
                console.error('Error finding user by refresh token:', error.message);
                resolve({
                    success: false,
                    error: 'Failed to find user by refresh token'
                });
            }
        });
    }

    // Update refresh token for current user instance
    async updateRefreshToken(plainToken, daysValid = DEFAULT_REFRESH_TOKEN_DAYS) {
        try {
            if (!this.id) {
                return {
                    success: false,
                    error: 'User instance has no ID'
                };
            }

            return await User.setRefreshToken(this.id, plainToken, daysValid);
        } catch (error) {
            console.error('Error updating refresh token for user instance:', error.message);
            return {
                success: false,
                error: 'Failed to update refresh token'
            };
        }
    }
}

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