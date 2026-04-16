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

    // Add profile_picture column migration
    db.run('ALTER TABLE users ADD COLUMN profile_picture TEXT', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Profile picture column migration failed:', err);
        } else {
            console.log('Profile picture column ready');
        }
    });
});

// Database helper functions
const dbHelpers = {
    // Get user by email
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            if (!email || typeof email !== 'string') {
                reject(new Error('Email must be a non-empty string'));
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
            if (!id || (!Number.isInteger(id) && !Number.isInteger(parseInt(id)))) {
                reject(new Error('ID must be a valid integer'));
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

    // Get user profile by ID including profile picture
    getUserProfileById: (id) => {
        return new Promise((resolve, reject) => {
            if (!id || (!Number.isInteger(id) && !Number.isInteger(parseInt(id)))) {
                reject(new Error('ID must be a valid integer'));
                return;
            }
            
            db.get('SELECT id, name, email, profile_picture, created_at FROM users WHERE id = ?', [id], (err, row) => {
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
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                reject(new Error('Name must be a non-empty string'));
                return;
            }
            if (!email || typeof email !== 'string' || email.trim().length === 0) {
                reject(new Error('Email must be a non-empty string'));
                return;
            }
            if (!hashedPassword || typeof hashedPassword !== 'string' || hashedPassword.trim().length === 0) {
                reject(new Error('Hashed password must be a non-empty string'));
                return;
            }
            
            db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
                [name.trim(), email.trim(), hashedPassword], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, name: name.trim(), email: email.trim() });
                    }
                }
            );
        });
    },

    // Update user profile
    updateProfile: (userId, name, email, profilePicture) => {
        return new Promise((resolve, reject) => {
            if (!userId || (!Number.isInteger(userId) && !Number.isInteger(parseInt(userId)))) {
                reject(new Error('User ID must be a valid integer'));
                return;
            }
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                reject(new Error('Name must be a non-empty string'));
                return;
            }
            if (!email || typeof email !== 'string' || email.trim().length === 0) {
                reject(new Error('Email must be a non-empty string'));
                return;
            }
            if (profilePicture !== null && typeof profilePicture !== 'string') {
                reject(new Error('Profile picture must be a string or null'));
                return;
            }

            const trimmedName = name.trim();
            const trimmedEmail = email.trim();
            
            db.run('UPDATE users SET name = ?, email = ?, profile_picture = ? WHERE id = ?', 
                [trimmedName, trimmedEmail, profilePicture, userId], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('User not found or no changes made'));
                    } else {
                        resolve({ 
                            id: userId, 
                            name: trimmedName, 
                            email: trimmedEmail, 
                            profile_picture: profilePicture 
                        });
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