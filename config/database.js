require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Security constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\(\)]+$/;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const BIO_MAX_LENGTH = 500;
const PHONE_MAX_LENGTH = 20;
const AVATAR_URL_MAX_LENGTH = 255;

// Allowlisted fields for user table operations
const ALLOWED_USER_FIELDS = ['name', 'email', 'phone', 'bio', 'avatar_url'];
const ALLOWED_SELECT_FIELDS = ['id', 'name', 'email', 'phone', 'bio', 'avatar_url', 'created_at'];

// Input validation helpers
const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        throw new Error('Email must be a non-empty string');
    }
    const trimmedEmail = email.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
        throw new Error('Invalid email format');
    }
    return trimmedEmail;
};

const validateFieldName = (fieldName, allowedFields) => {
    if (!fieldName || typeof fieldName !== 'string') {
        throw new Error('Field name must be a non-empty string');
    }
    if (!allowedFields.includes(fieldName)) {
        throw new Error(`Invalid field name: ${fieldName}. Allowed fields: ${allowedFields.join(', ')}`);
    }
    return fieldName;
};

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
    // Get user by email with proper validation
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            try {
                const validatedEmail = validateEmail(email);
                
                db.get('SELECT * FROM users WHERE email = ?', [validatedEmail], (err, row) => {
                    if (err) {
                        reject(new Error('Database error during user lookup'));
                    } else {
                        resolve(row);
                    }
                });
            } catch (validationError) {
                reject(validationError);
            }
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
                    reject(new Error('Database error during user lookup'));
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
                    reject(new Error('Database error during profile lookup'));
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Create new user with complete validation
    createUser: (userData) => {
        return new Promise((resolve, reject) => {
            try {
                // Extract and validate parameters
                const { name, email, password, phone = null, bio = null, avatar_url = null } = userData || {};
                
                // Validate required fields
                if (!name || typeof name !== 'string' || name.trim().length < NAME_MIN_LENGTH || name.trim().length > NAME_MAX_LENGTH) {
                    reject(new Error(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`));
                    return;
                }

                const validatedEmail = validateEmail(email);

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
                db.get('SELECT id FROM users WHERE email = ?', [validatedEmail], (err, existingUser) => {
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
                        validatedEmail,
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
                                email: validatedEmail,
                                phone: phone ? phone.trim() : null,
                                bio: bio ? bio.trim() : null,
                                avatar_url: avatar_url ? avatar_url.trim() : null
                            });
                        }
                    });
                });
            } catch (validationError) {
                reject(validationError);
            }
        });
    },

    // Update user profile with field name validation
    updateUserProfile: (id, updates) => {
        return new Promise((resolve, reject) => {
            try {
                if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                    reject(new Error('Invalid user ID parameter'));
                    return;
                }
                if (!updates || typeof updates !== 'object') {
                    reject(new Error('Invalid updates parameter'));
                    return;
                }

                const updateFields = [];
                const updateValues = [];

                // Build dynamic update query with only allowed fields and proper validation
                Object.keys(updates).forEach(field => {
                    if (updates[field] !== undefined) {
                        try {
                            // Validate field name against allowlist
                            const validatedField = validateFieldName(field, ALLOWED_USER_FIELDS);
                            
                            // Additional validation for specific fields
                            if (validatedField === 'email') {
                                const validatedEmail = validateEmail(updates[field]);
                                updateFields.push(`${validatedField} = ?`);
                                updateValues.push(validatedEmail);
                            } else if (validatedField === 'phone' && updates[field]) {
                                if (typeof updates[field] !== 'string' || updates[field].length > PHONE_MAX_LENGTH || !PHONE_REGEX.test(updates[field])) {
                                    throw new Error('Invalid phone number format');
                                }
                                updateFields.push(`${validatedField} = ?`);
                                updateValues.push(updates[field].trim());
                            } else if (validatedField === 'name') {
                                if (!updates[field] || typeof updates[field] !== 'string' || 
                                    updates[field].trim().length < NAME_MIN_LENGTH || 
                                    updates[field].trim().length > NAME_MAX_LENGTH) {
                                    throw new Error(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);
                                }
                                updateFields.push(`${validatedField} = ?`);
                                updateValues.push(updates[field].trim());
                            } else if (validatedField === 'bio' && updates[field]) {
                                if (typeof updates[field] !== 'string' || updates[field].length > BIO_MAX_LENGTH) {
                                    throw new Error(`Bio must not exceed ${BIO_MAX_LENGTH} characters`);
                                }
                                updateFields.push(`${validatedField} = ?`);
                                updateValues.push(updates[field].trim());
                            } else if (validatedField === 'avatar_url' && updates[field]) {
                                if (typeof updates[field] !== 'string' || updates[field].length > AVATAR_URL_MAX_LENGTH) {
                                    throw new Error(`Avatar URL must not exceed ${AVATAR_URL_MAX_LENGTH} characters`);
                                }
                                updateFields.push(`${validatedField} = ?`);
                                updateValues.push(updates[field].trim());
                            } else {
                                updateFields.push(`${validatedField} = ?`);
                                updateValues.push(updates[field]);
                            }
                        } catch (validationError) {
                            reject(validationError);
                            return;
                        }
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
                        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                            reject(new Error('Email address already exists'));
                        } else {
                            reject(new Error('Database error during profile update'));
                        }
                    } else {
                        if (this.changes === 0) {
                            reject(new Error('User not found or no changes made'));
                        } else {
                            resolve({ changes: this.changes, id: id });
                        }
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
};

module.exports = {
    db,
    dbHelpers,
    migrateUserTable
};