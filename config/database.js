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
            // Run migration after table creation
            migrateUserTable();
        }
    });
});

// Migration function to add profile fields
const migrateUserTable = () => {
    return new Promise((resolve, reject) => {
        // Check if columns already exist to avoid duplicate migration
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                console.error('Error checking table structure:', err.message);
                reject(err);
                return;
            }

            const existingColumns = columns.map(col => col.name);
            const columnsToAdd = [];

            if (!existingColumns.includes('phone')) {
                columnsToAdd.push('ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL');
            }
            if (!existingColumns.includes('bio')) {
                columnsToAdd.push('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL');
            }
            if (!existingColumns.includes('avatar_url')) {
                columnsToAdd.push('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL');
            }

            if (columnsToAdd.length === 0) {
                console.log('User table migration: all profile columns already exist');
                resolve();
                return;
            }

            let completed = 0;
            let hasError = false;

            columnsToAdd.forEach((sql) => {
                db.run(sql, (err) => {
                    if (err && !hasError) {
                        console.error('Error during user table migration:', err.message);
                        hasError = true;
                        reject(err);
                        return;
                    }
                    
                    completed++;
                    if (completed === columnsToAdd.length && !hasError) {
                        console.log(`User table migration: added ${columnsToAdd.length} new profile columns`);
                        resolve();
                    }
                });
            });
        });
    });
};

// Database helper functions
const dbHelpers = {
    // Get user by email
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            if (!email || typeof email !== 'string') {
                reject(new Error('Invalid email parameter'));
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
                reject(new Error('Invalid user ID parameter'));
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

    // Get user profile by ID with all fields
    getUserProfile: (id) => {
        return new Promise((resolve, reject) => {
            if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                reject(new Error('Invalid user ID parameter'));
                return;
            }
            
            db.get('SELECT id, name, email, phone, bio, avatar_url, created_at FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Create new user with complete validation
    createUser: (userData) => {
        return new Promise((resolve, reject) => {
            // Extract and validate parameters
            const { name, email, password, phone = null, bio = null, avatar_url = null } = userData || {};
            
            // Validation constants
            const NAME_MIN_LENGTH = 2;
            const NAME_MAX_LENGTH = 50;
            const BIO_MAX_LENGTH = 500;
            const PHONE_MAX_LENGTH = 20;
            const AVATAR_URL_MAX_LENGTH = 255;
            const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const PHONE_REGEX = /^[\d\s\-\(\)]+$/;

            // Validate required fields
            if (!name || typeof name !== 'string' || name.trim().length < NAME_MIN_LENGTH || name.trim().length > NAME_MAX_LENGTH) {
                reject(new Error(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`));
                return;
            }

            if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
                reject(new Error('Valid email address is required'));
                return;
            }

            if (!password || typeof password !== 'string' || password.length === 0) {
                reject(new Error('Password is required'));
                return;
            }

            // Validate optional fields if provided
            if (phone && (typeof phone !== 'string' || phone.length > PHONE_MAX_LENGTH || !PHONE_REGEX.test(phone))) {
                reject(new Error('Invalid phone number format'));
                return;
            }

            if (bio && (typeof bio !== 'string' || bio.length > BIO_MAX_LENGTH)) {
                reject(new Error(`Bio must not exceed ${BIO_MAX_LENGTH} characters`));
                return;
            }

            if (avatar_url && (typeof avatar_url !== 'string' || avatar_url.length > AVATAR_URL_MAX_LENGTH)) {
                reject(new Error(`Avatar URL must not exceed ${AVATAR_URL_MAX_LENGTH} characters`));
                return;
            }

            // Check if email already exists
            db.get('SELECT id FROM users WHERE email = ?', [email.trim()], (err, existingUser) => {
                if (err) {
                    reject(new Error('Database error during email validation'));
                    return;
                }

                if (existingUser) {
                    reject(new Error('Email address already exists'));
                    return;
                }

                // Insert new user with all profile fields
                const sql = `INSERT INTO users (name, email, password, phone, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?)`;
                const values = [
                    name.trim(),
                    email.trim(),
                    password, // Password should already be hashed by caller
                    phone ? phone.trim() : null,
                    bio ? bio.trim() : null,
                    avatar_url ? avatar_url.trim() : null
                ];

                db.run(sql, values, function(err) {
                    if (err) {
                        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                            reject(new Error('Email address already exists'));
                        } else {
                            reject(new Error('Database error during user creation'));
                        }
                    } else {
                        resolve({
                            id: this.lastID,
                            name: name.trim(),
                            email: email.trim(),
                            phone: phone ? phone.trim() : null,
                            bio: bio ? bio.trim() : null,
                            avatar_url: avatar_url ? avatar_url.trim() : null
                        });
                    }
                });
            });
        });
    },

    // Update user profile
    updateUserProfile: (id, updates) => {
        return new Promise((resolve, reject) => {
            if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                reject(new Error('Invalid user ID parameter'));
                return;
            }
            if (!updates || typeof updates !== 'object') {
                reject(new Error('Invalid updates parameter'));
                return;
            }

            const allowedFields = ['name', 'email', 'phone', 'bio', 'avatar_url'];
            const updateFields = [];
            const updateValues = [];

            // Build dynamic update query with only allowed fields
            Object.keys(updates).forEach(field => {
                if (allowedFields.includes(field) && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            });

            if (updateFields.length === 0) {
                reject(new Error('No valid fields to update'));
                return;
            }

            // Add ID to values array for WHERE clause
            updateValues.push(id);

            const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
            
            db.run(sql, updateValues, function(err) {
                if (err) {
                    reject(err);
                } else {
                    if (this.changes === 0) {
                        reject(new Error('User not found or no changes made'));
                    } else {
                        resolve({ changes: this.changes, id: id });
                    }
                }
            });
        });
    }
};

module.exports = {
    db,
    dbHelpers,
    migrateUserTable
};