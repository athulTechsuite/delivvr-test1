const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Create database connection
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

// Constants
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const BCRYPT_SALT_ROUNDS = 10;

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        profile_picture TEXT,
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
                const hashedPassword = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);

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
            if (!email || typeof email !== 'string') {
                reject(new Error('Invalid email parameter'));
                return;
            }

            db.get('SELECT * FROM users WHERE email = ?', [email.trim()], (err, row) => {
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
            if (!id || typeof id !== 'number') {
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
    }

    // Validate password
    static async validatePassword(plainPassword, hashedPassword) {
        try {
            if (!plainPassword || !hashedPassword) {
                return false;
            }
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            throw error;
        }
    }

    // Get all users (for admin purposes)
    static findAll() {
        return new Promise((resolve, reject) => {
            db.all('SELECT id, name, email, profile_picture, created_at FROM users', (err, rows) => {
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
            if (!id || typeof id !== 'number' || !updates || typeof updates !== 'object') {
                reject(new Error('Invalid parameters'));
                return;
            }

            const fields = Object.keys(updates);
            if (fields.length === 0) {
                resolve({ changes: 0 });
                return;
            }

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
            if (!id || typeof id !== 'number') {
                reject(new Error('Invalid user ID parameter'));
                return;
            }

            db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Validate email format
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    // Validate name format
    static isValidName(name) {
        if (!name || typeof name !== 'string') {
            return false;
        }
        const trimmedName = name.trim();
        if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
            return false;
        }
        const nameRegex = /^[a-zA-Z\s]+$/;
        return nameRegex.test(trimmedName);
    }

    // Validate password strength
    static isValidPassword(password) {
        if (!password || typeof password !== 'string') {
            return false;
        }
        if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
            return false;
        }
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        return hasUppercase && hasLowercase && hasNumber;
    }

    // Check if profile picture file exists
    static profilePictureExists(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }
        try {
            const fullPath = path.join(__dirname, '..', 'public', filePath);
            return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
        } catch (error) {
            return false;
        }
    }

    // Delete profile picture file
    static deleteProfilePicture(filePath) {
        return new Promise((resolve, reject) => {
            if (!filePath || typeof filePath !== 'string') {
                resolve(false);
                return;
            }

            try {
                const fullPath = path.join(__dirname, '..', 'public', filePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlink(fullPath, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(true);
                        }
                    });
                } else {
                    resolve(false);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Update user profile
    static async updateProfile(userId, updates) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!userId || typeof userId !== 'number') {
                    reject(new Error('Invalid user ID'));
                    return;
                }

                if (!updates || typeof updates !== 'object') {
                    reject(new Error('Invalid updates object'));
                    return;
                }

                // Validate updates
                const validatedUpdates = {};

                if (updates.name !== undefined) {
                    const trimmedName = updates.name.trim();
                    if (!User.isValidName(trimmedName)) {
                        reject(new Error('Name must be between 2 and 50 characters and contain only letters and spaces'));
                        return;
                    }
                    validatedUpdates.name = trimmedName;
                }

                if (updates.email !== undefined) {
                    const trimmedEmail = updates.email.trim().toLowerCase();
                    if (!User.isValidEmail(trimmedEmail)) {
                        reject(new Error('Invalid email format'));
                        return;
                    }

                    // Check email uniqueness
                    const existingUser = await User.findByEmail(trimmedEmail);
                    if (existingUser && existingUser.id !== userId) {
                        reject(new Error('This email is already registered to another account'));
                        return;
                    }
                    validatedUpdates.email = trimmedEmail;
                }

                if (updates.profile_picture !== undefined) {
                    if (updates.profile_picture && !User.profilePictureExists(updates.profile_picture)) {
                        reject(new Error('Profile picture file does not exist'));
                        return;
                    }

                    // Delete old profile picture if updating
                    const currentUser = await User.findById(userId);
                    if (currentUser && currentUser.profile_picture && updates.profile_picture !== currentUser.profile_picture) {
                        try {
                            await User.deleteProfilePicture(currentUser.profile_picture);
                        } catch (error) {
                            // Log error but don't fail the update
                            console.error('Failed to delete old profile picture:', error);
                        }
                    }
                    validatedUpdates.profile_picture = updates.profile_picture;
                }

                if (Object.keys(validatedUpdates).length === 0) {
                    resolve({ success: true, changes: 0 });
                    return;
                }

                // Update database
                const result = await User.updateById(userId, validatedUpdates);
                resolve({ success: true, changes: result.changes });

            } catch (error) {
                reject(error);
            }
        });
    }

    // Update user password
    static async updatePassword(userId, currentPassword, newPassword) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!userId || typeof userId !== 'number') {
                    reject(new Error('Invalid user ID'));
                    return;
                }

                if (!currentPassword || typeof currentPassword !== 'string') {
                    reject(new Error('Current password is required'));
                    return;
                }

                if (!newPassword || typeof newPassword !== 'string') {
                    reject(new Error('New password is required'));
                    return;
                }

                // Validate new password strength
                if (!User.isValidPassword(newPassword)) {
                    reject(new Error('New password must be 6-128 characters with at least one uppercase letter, one lowercase letter, and one number'));
                    return;
                }

                // Get current user
                const user = await User.findById(userId);
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                // Validate current password
                const isCurrentPasswordValid = await User.validatePassword(currentPassword, user.password);
                if (!isCurrentPasswordValid) {
                    reject(new Error('Current password is incorrect'));
                    return;
                }

                // Hash new password
                const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

                // Update password in database
                const result = await User.updateById(userId, { password: hashedNewPassword });
                resolve({ success: true, changes: result.changes });

            } catch (error) {
                reject(error);
            }
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