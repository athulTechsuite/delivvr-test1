const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Constants for validation
const VALIDATION_CONSTANTS = {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 50,
    BIO_MAX_LENGTH: 500,
    PHONE_MAX_LENGTH: 20,
    AVATAR_URL_MAX_LENGTH: 255
};

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        avatar_url VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

class User {
    constructor(name, email, password, phone = null, bio = null, avatar_url = null) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.bio = bio;
        this.avatar_url = avatar_url;
    }

    // Create a new user
    async save() {
        return new Promise(async (resolve, reject) => {
            try {
                // Validate required fields
                if (!this.name || typeof this.name !== 'string' || this.name.trim().length < VALIDATION_CONSTANTS.NAME_MIN_LENGTH || this.name.trim().length > VALIDATION_CONSTANTS.NAME_MAX_LENGTH) {
                    reject(new Error(`Name must be between ${VALIDATION_CONSTANTS.NAME_MIN_LENGTH} and ${VALIDATION_CONSTANTS.NAME_MAX_LENGTH} characters`));
                    return;
                }

                if (!this.email || typeof this.email !== 'string' || !this.validateEmail(this.email)) {
                    reject(new Error('Valid email address is required'));
                    return;
                }

                if (!this.password || typeof this.password !== 'string') {
                    reject(new Error('Password is required'));
                    return;
                }

                // Validate optional fields
                if (this.phone && !User.validatePhone(this.phone)) {
                    reject(new Error('Invalid phone number format'));
                    return;
                }

                if (this.bio && !User.validateBio(this.bio)) {
                    reject(new Error(`Bio must not exceed ${VALIDATION_CONSTANTS.BIO_MAX_LENGTH} characters`));
                    return;
                }

                // Hash the password
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(this.password, saltRounds);

                const stmt = db.prepare('INSERT INTO users (name, email, password, phone, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?)');
                stmt.run([this.name.trim(), this.email.trim(), hashedPassword, this.phone, this.bio, this.avatar_url], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            name: this.name.trim(),
                            email: this.email.trim(),
                            phone: this.phone,
                            bio: this.bio,
                            avatar_url: this.avatar_url
                        });
                    }
                });
                stmt.finalize();
            } catch (error) {
                reject(error);
            }
        });
    }

    // Validate email format
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    // Validate phone format - digits, spaces, dashes, parentheses only
    static validatePhone(phone) {
        if (!phone) {
            return true; // Phone is optional
        }
        
        if (typeof phone !== 'string') {
            return false;
        }

        if (phone.length > VALIDATION_CONSTANTS.PHONE_MAX_LENGTH) {
            return false;
        }

        // Allow digits, spaces, dashes, parentheses only
        const phoneRegex = /^[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone.trim());
    }

    // Validate bio length - 500 character maximum
    static validateBio(bio) {
        if (!bio) {
            return true; // Bio is optional
        }
        
        if (typeof bio !== 'string') {
            return false;
        }

        return bio.length <= VALIDATION_CONSTANTS.BIO_MAX_LENGTH;
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

    // Find user by ID - returns all fields including profile fields
    static findById(id) {
        return new Promise((resolve, reject) => {
            if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                reject(new Error('Invalid user ID parameter'));
                return;
            }

            const numericId = parseInt(id, 10);
            if (isNaN(numericId)) {
                reject(new Error('User ID must be a valid number'));
                return;
            }

            db.get('SELECT id, name, email, phone, bio, avatar_url, created_at FROM users WHERE id = ?', [numericId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Update user profile - updates phone, bio, avatar_url fields
    static updateProfile(id, profileData) {
        return new Promise((resolve, reject) => {
            try {
                if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                    reject(new Error('Invalid user ID parameter'));
                    return;
                }

                const numericId = parseInt(id, 10);
                if (isNaN(numericId)) {
                    reject(new Error('User ID must be a valid number'));
                    return;
                }

                if (!profileData || typeof profileData !== 'object') {
                    reject(new Error('Invalid profile data'));
                    return;
                }

                // Validate required fields
                if (profileData.name !== undefined) {
                    if (!profileData.name || typeof profileData.name !== 'string' || 
                        profileData.name.trim().length < VALIDATION_CONSTANTS.NAME_MIN_LENGTH || 
                        profileData.name.trim().length > VALIDATION_CONSTANTS.NAME_MAX_LENGTH) {
                        reject(new Error(`Name must be between ${VALIDATION_CONSTANTS.NAME_MIN_LENGTH} and ${VALIDATION_CONSTANTS.NAME_MAX_LENGTH} characters`));
                        return;
                    }
                }

                if (profileData.email !== undefined) {
                    if (!profileData.email || typeof profileData.email !== 'string') {
                        reject(new Error('Email is required'));
                        return;
                    }
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(profileData.email.trim())) {
                        reject(new Error('Invalid email format'));
                        return;
                    }
                }

                // Validate optional fields
                if (profileData.phone !== undefined && profileData.phone !== null && !User.validatePhone(profileData.phone)) {
                    reject(new Error('Invalid phone number format. Use only digits, spaces, dashes, and parentheses'));
                    return;
                }

                if (profileData.bio !== undefined && profileData.bio !== null && !User.validateBio(profileData.bio)) {
                    reject(new Error(`Bio must not exceed ${VALIDATION_CONSTANTS.BIO_MAX_LENGTH} characters`));
                    return;
                }

                if (profileData.avatar_url !== undefined && profileData.avatar_url !== null && 
                    (typeof profileData.avatar_url !== 'string' || profileData.avatar_url.length > VALIDATION_CONSTANTS.AVATAR_URL_MAX_LENGTH)) {
                    reject(new Error(`Avatar URL must not exceed ${VALIDATION_CONSTANTS.AVATAR_URL_MAX_LENGTH} characters`));
                    return;
                }

                // Build dynamic query based on provided fields
                const allowedFields = ['name', 'email', 'phone', 'bio', 'avatar_url'];
                const updateFields = [];
                const updateValues = [];

                allowedFields.forEach(field => {
                    if (profileData.hasOwnProperty(field)) {
                        updateFields.push(`${field} = ?`);
                        updateValues.push(field === 'name' || field === 'email' ? 
                            (profileData[field] ? profileData[field].trim() : profileData[field]) : 
                            profileData[field]);
                    }
                });

                if (updateFields.length === 0) {
                    reject(new Error('No valid fields to update'));
                    return;
                }

                updateValues.push(numericId);
                const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

                const stmt = db.prepare(query);
                stmt.run(updateValues, function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('User not found or no changes made'));
                    } else {
                        resolve({ 
                            changes: this.changes,
                            updatedFields: Object.keys(profileData)
                        });
                    }
                });
                stmt.finalize();

            } catch (error) {
                reject(error);
            }
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
            db.all('SELECT id, name, email, phone, bio, avatar_url, created_at FROM users', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Update user (legacy method for backward compatibility)
    static updateById(id, updates) {
        return new Promise((resolve, reject) => {
            try {
                if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                    reject(new Error('Invalid user ID parameter'));
                    return;
                }

                const numericId = parseInt(id, 10);
                if (isNaN(numericId)) {
                    reject(new Error('User ID must be a valid number'));
                    return;
                }

                if (!updates || typeof updates !== 'object') {
                    reject(new Error('Invalid updates object'));
                    return;
                }

                const fields = Object.keys(updates);
                const values = Object.values(updates);
                
                if (fields.length === 0) {
                    reject(new Error('No fields to update'));
                    return;
                }

                const setClause = fields.map(field => `${field} = ?`).join(', ');
                const query = `UPDATE users SET ${setClause} WHERE id = ?`;
                values.push(numericId);

                const stmt = db.prepare(query);
                stmt.run(values, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
                stmt.finalize();

            } catch (error) {
                reject(error);
            }
        });
    }

    // Delete user
    static deleteById(id) {
        return new Promise((resolve, reject) => {
            if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                reject(new Error('Invalid user ID parameter'));
                return;
            }

            const numericId = parseInt(id, 10);
            if (isNaN(numericId)) {
                reject(new Error('User ID must be a valid number'));
                return;
            }

            const stmt = db.prepare('DELETE FROM users WHERE id = ?');
            stmt.run([numericId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
            stmt.finalize();
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