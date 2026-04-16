const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Create database connection
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

// Constants for validation
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const NAME_REGEX = /^[a-zA-Z\s]+$/;
const MAX_FILE_SIZE = 5242880; // 5MB in bytes
const ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Add profile_picture column if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding profile_picture column:', err.message);
        }
    });
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

    // Find user by ID including profile picture
    static getUserWithProfilePicture(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT id, name, email, profile_picture, created_at FROM users WHERE id = ?', [id], (err, row) => {
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

    // Validate profile data
    static validateProfileData(data) {
        const errors = {};

        // Validate name
        if (!data.name || typeof data.name !== 'string') {
            errors.name = 'Name is required';
        } else if (data.name.length < NAME_MIN_LENGTH || data.name.length > NAME_MAX_LENGTH) {
            errors.name = `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`;
        } else if (!NAME_REGEX.test(data.name)) {
            errors.name = 'Name must contain only letters and spaces';
        }

        // Validate email
        if (!data.email || typeof data.email !== 'string') {
            errors.email = 'Email is required';
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                errors.email = 'Please enter a valid email address';
            }
        }

        // Validate profile picture path if provided
        if (data.profile_picture && typeof data.profile_picture === 'string') {
            const ext = path.extname(data.profile_picture).toLowerCase();
            if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
                errors.profile_picture = 'Profile picture must be a valid image file (jpg, jpeg, png, gif)';
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    // Delete profile picture file
    static async deleteProfilePicture(profilePicturePath) {
        return new Promise((resolve, reject) => {
            if (!profilePicturePath) {
                resolve();
                return;
            }

            const fullPath = path.join(__dirname, '..', 'public', profilePicturePath);
            
            fs.access(fullPath, fs.constants.F_OK, (err) => {
                if (err) {
                    // File doesn't exist, which is fine
                    resolve();
                    return;
                }

                fs.unlink(fullPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('Error deleting profile picture:', unlinkErr);
                        reject(unlinkErr);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    // Update user profile
    static async updateProfile(userId, updates) {
        return new Promise(async (resolve, reject) => {
            try {
                // Validate input data
                const validation = User.validateProfileData(updates);
                if (!validation.isValid) {
                    reject(new Error(JSON.stringify(validation.errors)));
                    return;
                }

                // Start transaction
                db.serialize(async () => {
                    db.run('BEGIN TRANSACTION');

                    try {
                        // Check if email is unique (excluding current user)
                        if (updates.email) {
                            const existingUser = await new Promise((resolve, reject) => {
                                db.get('SELECT id FROM users WHERE email = ? AND id != ?', [updates.email, userId], (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row);
                                });
                            });

                            if (existingUser) {
                                db.run('ROLLBACK');
                                reject(new Error('Email already exists'));
                                return;
                            }
                        }

                        // Get current user data to handle profile picture cleanup
                        const currentUser = await new Promise((resolve, reject) => {
                            db.get('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });

                        // Delete old profile picture if a new one is being uploaded
                        if (updates.profile_picture && currentUser && currentUser.profile_picture && 
                            currentUser.profile_picture !== updates.profile_picture) {
                            try {
                                await User.deleteProfilePicture(currentUser.profile_picture);
                            } catch (deleteErr) {
                                console.error('Warning: Could not delete old profile picture:', deleteErr);
                                // Continue with update even if old file deletion fails
                            }
                        }

                        // Prepare update query
                        const fields = [];
                        const values = [];

                        if (updates.name) {
                            fields.push('name = ?');
                            values.push(updates.name);
                        }

                        if (updates.email) {
                            fields.push('email = ?');
                            values.push(updates.email.toLowerCase());
                        }

                        if (updates.profile_picture !== undefined) {
                            fields.push('profile_picture = ?');
                            values.push(updates.profile_picture);
                        }

                        if (fields.length === 0) {
                            db.run('ROLLBACK');
                            reject(new Error('No valid fields to update'));
                            return;
                        }

                        values.push(userId);
                        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

                        // Execute update
                        db.run(query, values, function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                if (err.message.includes('UNIQUE constraint failed')) {
                                    reject(new Error('Email already exists'));
                                } else {
                                    reject(err);
                                }
                            } else if (this.changes === 0) {
                                db.run('ROLLBACK');
                                reject(new Error('User not found'));
                            } else {
                                // Commit transaction
                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        reject(commitErr);
                                    } else {
                                        resolve({ 
                                            success: true,
                                            changes: this.changes,
                                            message: 'Profile updated successfully'
                                        });
                                    }
                                });
                            }
                        });

                    } catch (transactionErr) {
                        db.run('ROLLBACK');
                        reject(transactionErr);
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
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