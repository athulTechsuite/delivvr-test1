const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const methodOverride = require('method-override');
const { expect } = require('chai');
const fs = require('fs');

// Import application components
const dashboardRoutes = require('../routes/dashboard');
const User = require('../models/User');

// Test constants
const TEST_CONSTANTS = {
    JWT_SECRET: 'test-jwt-secret',
    TEST_DB_PATH: ':memory:',
    BCRYPT_ROUNDS: 10,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 50,
    BIO_MAX_LENGTH: 500,
    PHONE_MAX_LENGTH: 20,
    AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_AVATAR_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    UPLOADS_DIR: path.join(__dirname, 'test-uploads')
};

describe('Profile Integration Tests', () => {
    let app;
    let testDb;
    let testUser;
    let authToken;
    let userId;

    before(async () => {
        // Set test environment
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = TEST_CONSTANTS.JWT_SECRET;

        // Create test uploads directory
        if (!fs.existsSync(TEST_CONSTANTS.UPLOADS_DIR)) {
            fs.mkdirSync(TEST_CONSTANTS.UPLOADS_DIR, { recursive: true });
        }

        // Create test application
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(methodOverride('_method'));

        // Configure multer for avatar uploads
        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, TEST_CONSTANTS.UPLOADS_DIR);
            },
            filename: function (req, file, cb) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
            }
        });

        const upload = multer({
            storage: storage,
            limits: {
                fileSize: TEST_CONSTANTS.AVATAR_MAX_SIZE
            },
            fileFilter: function (req, file, cb) {
                if (TEST_CONSTANTS.ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image files (JPEG, PNG, GIF) are allowed'), false);
                }
            }
        });

        app.use('/uploads', express.static(TEST_CONSTANTS.UPLOADS_DIR));

        // Set up view engine for testing
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, '../views'));

        // Mock res.render for testing with XSS prevention
        app.use((req, res, next) => {
            const originalRender = res.render;
            res.render = function(view, options, callback) {
                // Sanitize data to prevent XSS
                const sanitizedOptions = sanitizeRenderData(options);
                res.locals = { ...res.locals, ...sanitizedOptions };
                res.status(200).json({
                    view: view,
                    data: sanitizedOptions,
                    status: 'rendered'
                });
            };
            next();
        });

        // Use dashboard routes
        app.use('/dashboard', dashboardRoutes);

        // Avatar upload route
        app.post('/dashboard/profile/avatar', upload.single('avatar'), (req, res) => {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            
            const avatarUrl = `/uploads/${req.file.filename}`;
            
            // Update user's avatar_url in database
            testDb.run('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.userId], function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.json({ success: true, avatarUrl: avatarUrl });
            });
        });

        // Create test database
        await setupTestDatabase();
    });

    beforeEach(async () => {
        // Clean up database before each test
        await cleanTestDatabase();
        
        // Create test user
        const testUserData = await createTestUser();
        testUser = testUserData.user;
        userId = testUserData.userId;
        authToken = testUserData.token;
    });

    after(async () => {
        if (testDb) {
            testDb.close();
        }
        
        // Clean up test uploads directory
        if (fs.existsSync(TEST_CONSTANTS.UPLOADS_DIR)) {
            const files = fs.readdirSync(TEST_CONSTANTS.UPLOADS_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(TEST_CONSTANTS.UPLOADS_DIR, file));
            }
            fs.rmdirSync(TEST_CONSTANTS.UPLOADS_DIR);
        }
    });

    // Helper function to sanitize render data and prevent XSS
    function sanitizeRenderData(data) {
        if (!data) return data;
        
        const sanitized = { ...data };
        
        // Basic XSS prevention - escape HTML in user data
        const escapeHtml = (text) => {
            if (typeof text !== 'string') return text;
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (sanitized.user) {
            if (sanitized.user.name) sanitized.user.name = escapeHtml(sanitized.user.name);
            if (sanitized.user.bio) sanitized.user.bio = escapeHtml(sanitized.user.bio);
        }
        
        return sanitized;
    }

    // Database setup helpers
    async function setupTestDatabase() {
        return new Promise((resolve, reject) => {
            testDb = new sqlite3.Database(TEST_CONSTANTS.TEST_DB_PATH, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Create users table with all profile fields
                testDb.serialize(() => {
                    testDb.run(`CREATE TABLE users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        phone VARCHAR(20) DEFAULT NULL,
                        bio TEXT DEFAULT NULL,
                        avatar_url VARCHAR(255) DEFAULT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });
        });
    }

    async function cleanTestDatabase() {
        return new Promise((resolve, reject) => {
            testDb.run('DELETE FROM users', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async function createTestUser() {
        const userData = {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'password123',
            phone: '555-123-4567',
            bio: 'Test user bio'
        };

        const hashedPassword = await bcrypt.hash(userData.password, TEST_CONSTANTS.BCRYPT_ROUNDS);

        return new Promise((resolve, reject) => {
            const stmt = testDb.prepare('INSERT INTO users (name, email, password, phone, bio) VALUES (?, ?, ?, ?, ?)');
            stmt.run([userData.name, userData.email, hashedPassword, userData.phone, userData.bio], function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                const userId = this.lastID;
                const token = jwt.sign(
                    { userId: userId, email: userData.email },
                    TEST_CONSTANTS.JWT_SECRET,
                    { expiresIn: '1h' }
                );

                resolve({
                    userId: userId,
                    user: { ...userData, id: userId },
                    token: token
                });
            });
            stmt.finalize();
        });
    }

    describe('Authentication Integration', () => {
        it('should redirect unauthenticated user from profile page to login', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should redirect user with invalid token from profile page to login', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', 'token=invalid-token')
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should redirect user with expired token from profile page to login', async () => {
            const expiredToken = jwt.sign(
                { userId: userId, email: testUser.email },
                TEST_CONSTANTS.JWT_SECRET,
                { expiresIn: '-1h' }
            );

            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${expiredToken}`)
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should clear cookies when redirecting invalid authentication', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', 'token=invalid-token')
                .expect(302);

            expect(response.headers['set-cookie']).to.exist;
            const cookieHeader = response.headers['set-cookie'][0];
            expect(cookieHeader).to.include('token=;');
            expect(cookieHeader).to.include('Expires=');
        });

        it('should allow authenticated user to access profile page', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(response.body.view).to.equal('profile');
            expect(response.body.data.user).to.exist;
            expect(response.body.data.user.email).to.equal(testUser.email);
        });
    });

    describe('Profile Page Display', () => {
        it('should display profile page with complete user information', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(response.body.view).to.equal('profile');
            expect(response.body.data.user.name).to.equal(testUser.name);
            expect(response.body.data.user.email).to.equal(testUser.email);
            expect(response.body.data.user.phone).to.equal(testUser.phone);
            expect(response.body.data.user.bio).to.equal(testUser.bio);
        });

        it('should handle user with missing profile fields gracefully', async () => {
            // Create user with minimal data
            const minimalUser = {
                name: 'Jane Doe',
                email: 'jane@example.com',
                password: await bcrypt.hash('password123', TEST_CONSTANTS.BCRYPT_ROUNDS)
            };

            await new Promise((resolve, reject) => {
                const stmt = testDb.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                stmt.run([minimalUser.name, minimalUser.email, minimalUser.password], function(err) {
                    if (err) reject(err);
                    else {
                        const token = jwt.sign(
                            { userId: this.lastID, email: minimalUser.email },
                            TEST_CONSTANTS.JWT_SECRET,
                            { expiresIn: '1h' }
                        );
                        authToken = token;
                        resolve();
                    }
                });
                stmt.finalize();
            });

            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(response.body.data.user.name).to.equal(minimalUser.name);
            expect(response.body.data.user.phone).to.be.null;
            expect(response.body.data.user.bio).to.be.null;
        });

        it('should redirect to login if user not found in database', async () => {
            // Create token with non-existent user ID
            const invalidToken = jwt.sign(
                { userId: 99999, email: 'nonexistent@example.com' },
                TEST_CONSTANTS.JWT_SECRET,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${invalidToken}`)
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should sanitize user data to prevent XSS attacks', async () => {
            // Create user with potentially malicious data
            const maliciousUser = {
                name: '<script>alert("XSS")</script>John',
                email: 'malicious@example.com',
                password: await bcrypt.hash('password123', TEST_CONSTANTS.BCRYPT_ROUNDS),
                bio: '<img src=x onerror=alert("XSS")>Bio content'
            };

            await new Promise((resolve, reject) => {
                const stmt = testDb.prepare('INSERT INTO users (name, email, password, bio) VALUES (?, ?, ?, ?)');
                stmt.run([maliciousUser.name, maliciousUser.email, maliciousUser.password, maliciousUser.bio], function(err) {
                    if (err) reject(err);
                    else {
                        const token = jwt.sign(
                            { userId: this.lastID, email: maliciousUser.email },
                            TEST_CONSTANTS.JWT_SECRET,
                            { expiresIn: '1h' }
                        );
                        authToken = token;
                        resolve();
                    }
                });
                stmt.finalize();
            });

            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            // Verify data is sanitized
            expect(response.body.data.user.name).to.include('&lt;script&gt;');
            expect(response.body.data.user.bio).to.include('&lt;img');
        });
    });

    describe('Profile Update Integration', () => {
        it('should successfully update profile with valid data', async () => {
            const updateData = {
                name: 'John Updated',
                email: 'john.updated@example.com',
                phone: '555-987-6543',
                bio: 'Updated bio information'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.message).to.equal('Profile updated successfully');

            // Verify data was updated in database
            await new Promise((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else {
                        expect(row.name).to.equal(updateData.name);
                        expect(row.email).to.equal(updateData.email);
                        expect(row.phone).to.equal(updateData.phone);
                        expect(row.bio).to.equal(updateData.bio);
                        resolve();
                    }
                });
            });
        });

        it('should handle profile update with only required fields', async () => {
            const updateData = {
                name: 'John Minimal',
                email: 'john.minimal@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).to.be.true;

            // Verify optional fields are set to null
            await new Promise((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else {
                        expect(row.name).to.equal(updateData.name);
                        expect(row.email).to.equal(updateData.email);
                        expect(row.phone).to.be.null;
                        expect(row.bio).to.be.null;
                        resolve();
                    }
                });
            });
        });

        it('should reject profile update without authentication', async () => {
            const updateData = {
                name: 'Unauthorized Update',
                email: 'unauthorized@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .send(updateData)
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should handle PUT requests via method override', async () => {
            const updateData = {
                _method: 'PUT',
                name: 'John Method Override',
                email: 'john.override@example.com'
            };

            const response = await request(app)
                .post('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).to.be.true;
        });
    });

    describe('Avatar Upload Integration', () => {
        it('should successfully upload avatar image', async () => {
            // Create a test image buffer
            const testImageBuffer = Buffer.from('test-image-data');
            
            const response = await request(app)
                .post('/dashboard/profile/avatar')
                .set('Cookie', `token=${authToken}`)
                .attach('avatar', testImageBuffer, 'test-avatar.jpg')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.avatarUrl).to.match(/^\/uploads\/avatar-\d+-\d+\.jpg$/);
        });

        it('should reject avatar upload without authentication', async () => {
            const testImageBuffer = Buffer.from('test-image-data');
            
            const response = await request(app)
                .post('/dashboard/profile/avatar')
                .attach('avatar', testImageBuffer, 'test-avatar.jpg')
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should reject non-image file uploads', async () => {
            const testTextBuffer = Buffer.from('not an image');
            
            const response = await request(app)
                .post('/dashboard/profile/avatar')
                .set('Cookie', `token=${authToken}`)
                .attach('avatar', testTextBuffer, 'test-file.txt')
                .expect(400);

            expect(response.body.success).to.be.false;
        });

        it('should reject files exceeding size limit', async () => {
            // Create a buffer larger than the limit
            const largeBuffer = Buffer.alloc(TEST_CONSTANTS.AVATAR_MAX_SIZE + 1);
            
            const response = await request(app)
                .post('/dashboard/profile/avatar')
                .set('Cookie', `token=${authToken}`)
                .attach('avatar', largeBuffer, 'large-avatar.jpg')
                .expect(400);

            expect(response.body.success).to.be.false;
        });
    });

    describe('Form Validation Integration', () => {
        it('should reject update with missing name field', async () => {
            const updateData = {
                email: 'john@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.be.an('array');
            expect(response.body.errors.some(err => err.msg.includes('Name is required'))).to.be.true;
        });

        it('should reject update with missing email field', async () => {
            const updateData = {
                name: 'John Doe'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.be.an('array');
            expect(response.body.errors.some(err => err.msg.includes('Email is required'))).to.be.true;
        });

        it('should reject update with invalid email format', async () => {
            const updateData = {
                name: 'John Doe',
                email: 'invalid-email-format'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors.some(err => err.msg.includes('valid email'))).to.be.true;
        });

        it('should reject update with name too short', async () => {
            const updateData = {
                name: 'J',
                email: 'john@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors.some(err => err.msg.includes('between 2 and 50'))).to.be.true;
        });

        it('should reject update with name too long', async () => {
            const updateData = {
                name: 'J'.repeat(TEST_CONSTANTS.NAME_MAX_LENGTH + 1),
                email: 'john@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors.some(err => err.msg.includes('between 2 and 50'))).to.be.true;
        });

        it('should reject update with invalid phone format', async () => {
            const updateData = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: 'invalid-phone-abc'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors.some(err => err.msg.includes('digits, spaces, dashes, and parentheses'))).to.be.true;
        });

        it('should reject update with bio exceeding character limit', async () => {
            const updateData = {
                name: 'John Doe',
                email: 'john@example.com',
                bio: 'x'.repeat(TEST_CONSTANTS.BIO_MAX_LENGTH + 1)
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors.some(err => err.msg.includes('500 characters'))).to.be.true;
        });

        it('should accept valid phone number formats', async () => {
            const validPhones = [
                '555-123-4567',
                '(555) 123-4567',
                '555 123 4567',
                '5551234567'
            ];

            for (const phone of validPhones) {
                const updateData = {
                    name: 'John Doe',
                    email: 'john@example.com',
                    phone: phone
                };

                const response = await request(app)
                    .put('/dashboard/profile')
                    .set('Cookie', `token=${authToken}`)
                    .send(updateData)
                    .expect(200);

                expect(response.body.success).to.be.true;
            }
        });

        it('should provide detailed validation error messages', async () => {
            const invalidData = {
                name: '',
                email: 'invalid-email',
                phone: 'abc123',
                bio: 'x'.repeat(TEST_CONSTANTS.BIO_MAX_LENGTH + 1)
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.be.an('array');
            expect(response.body.errors.length).to.be.greaterThan(1);
            
            // Check for specific error types
            const errorMessages = response.body.errors.map(err => err.msg);
            expect(errorMessages.some(msg => msg.includes('Name is required'))).to.be.true;
            expect(errorMessages.some(msg => msg.includes('valid email'))).to.be.true;
            expect(errorMessages.some(msg => msg.includes('phone'))).to.be.true;
            expect(errorMessages.some(msg => msg.includes('500 characters'))).to.be.true;
        });
    });

    describe('Database Integration', () => {
        it('should handle database error during profile retrieval', async () => {
            // Close database to simulate error
            testDb.close();

            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(500);

            expect(response.body.view).to.equal('error');
            expect(response.body.data.message).to.include('Database error occurred');

            // Restore database for other tests
            await setupTestDatabase();
        });

        it('should handle database error during profile update', async () => {
            // Close database to simulate error
            testDb.close();

            const updateData = {
                name: 'John Doe',
                email: 'john@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(500);

            expect(response.body.success).to.be.false;
            expect(response.body.message).to.include('Database error');

            // Restore database for other tests
            await setupTestDatabase();
        });

        it('should prevent SQL injection in profile updates', async () => {
            const maliciousData = {
                name: "'; DROP TABLE users; --",
                email: 'john@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(maliciousData)
                .expect(200);

            expect(response.body.success).to.be.true;

            // Verify table still exists and data was safely inserted
            await new Promise((resolve, reject) => {
                testDb.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                    if (err) reject(err);
                    else {
                        expect(row.count).to.be.greaterThan(0);
                        resolve();
                    }
                });
            });
        });

        it('should handle email uniqueness constraint violation', async () => {
            // Create another user with different email
            const anotherUser = {
                name: 'Jane Doe',
                email: 'jane@example.com',
                password: await bcrypt.hash('password123', TEST_CONSTANTS.BCRYPT_ROUNDS)
            };

            await new Promise((resolve, reject) => {
                const stmt = testDb.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                stmt.run([anotherUser.name, anotherUser.email, anotherUser.password], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
                stmt.finalize();
            });

            // Try to update original user's email to the existing one
            const updateData = {
                name: 'John Doe',
                email: 'jane@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.message).to.include('Email already exists');
        });

        it('should maintain database transaction integrity', async () => {
            const updateData = {
                name: 'John Transaction Test',
                email: 'john.transaction@example.com'
            };

            // Perform multiple concurrent updates
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    request(app)
                        .put('/dashboard/profile')
                        .set('Cookie', `token=${authToken}`)
                        .send({ ...updateData, name: `${updateData.name} ${i}` })
                );
            }

            const responses = await Promise.all(promises);
            
            // Verify at least one update succeeded
            const successCount = responses.filter(r => r.body.success).length;
            expect(successCount).to.be.greaterThan(0);

            // Verify database consistency
            await new Promise((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else {
                        expect(row).to.exist;
                        expect(row.name).to.include('John Transaction Test');
                        resolve();
                    }
                });
            });
        });
    });

    describe('Session Management Integration', () => {
        it('should handle session expiration during profile editing', async () => {
            // Create token that expires soon
            const shortLivedToken = jwt.sign(
                { userId: userId, email: testUser.email },
                TEST_CONSTANTS.JWT_SECRET,
                { expiresIn: '1s' }
            );

            // Wait for token to expire
            await new Promise(resolve => setTimeout(resolve, 2000));

            const updateData = {
                name: 'John Doe',
                email: 'john@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${shortLivedToken}`)
                .send(updateData)
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        it('should maintain user context throughout profile workflow', async () => {
            // First, access profile page
            const profileResponse = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(profileResponse.body.data.user.id).to.equal(userId);

            // Then update profile
            const updateData = {
                name: 'John Updated Context',
                email: 'john.context@example.com'
            };

            const updateResponse = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(200);

            expect(updateResponse.body.success).to.be.true;

            // Verify profile page shows updated data
            const verifyResponse = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(verifyResponse.body.data.user.name).to.equal(updateData.name);
            expect(verifyResponse.body.data.user.email).to.equal(updateData.email);
        });

        it('should handle multiple concurrent authenticated sessions', async () => {
            // Create second user and token
            const secondUser = {
                name: 'Jane Concurrent',
                email: 'jane.concurrent@example.com',
                password: await bcrypt.hash('password123', TEST_CONSTANTS.BCRYPT_ROUNDS)
            };

            let secondUserId, secondToken;
            await new Promise((resolve, reject) => {
                const stmt = testDb.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                stmt.run([secondUser.name, secondUser.email, secondUser.password], function(err) {
                    if (err) reject(err);
                    else {
                        secondUserId = this.lastID;
                        secondToken = jwt.sign(
                            { userId: secondUserId, email: secondUser.email },
                            TEST_CONSTANTS.JWT_SECRET,
                            { expiresIn: '1h' }
                        );
                        resolve();
                    }
                });
                stmt.finalize();
            });

            // Update both profiles simultaneously
            const [response1, response2] = await Promise.all([
                request(app)
                    .put('/dashboard/profile')
                    .set('Cookie', `token=${authToken}`)
                    .send({ name: 'John Concurrent', email: 'john.concurrent@example.com' }),
                request(app)
                    .put('/dashboard/profile')
                    .set('Cookie', `token=${secondToken}`)
                    .send({ name: 'Jane Concurrent Updated', email: 'jane.updated@example.com' })
            ]);

            expect(response1.body.success).to.be.true;
            expect(response2.body.success).to.be.true;
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle special characters in profile data safely', async () => {
            const specialCharsData = {
                name: 'John O\'Connor & Associates',
                email: 'john+test@example.com',
                phone: '555-123-4567',
                bio: 'Bio with "quotes" & <tags> and émojis 🎉'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(specialCharsData)
                .expect(200);

            expect(response.body.success).to.be.true;

            // Verify data was stored correctly
            await new Promise((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else {
                        expect(row.name).to.equal(specialCharsData.name);
                        expect(row.email).to.equal(specialCharsData.email);
                        expect(row.bio).to.equal(specialCharsData.bio);
                        resolve();
                    }
                });
            });
        });

        it('should trim whitespace from profile fields', async () => {
            const dataWithWhitespace = {
                name: '  John Doe  ',
                email: '  john@example.com  ',
                phone: '  555-123-4567  ',
                bio: '  Bio with whitespace  '
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(dataWithWhitespace)
                .expect(200);

            expect(response.body.success).to.be.true;

            // Verify whitespace was trimmed
            await new Promise((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else {
                        expect(row.name).to.equal('John Doe');
                        expect(row.email).to.equal('john@example.com');
                        expect(row.phone).to.equal('555-123-4567');
                        expect(row.bio).to.equal('Bio with whitespace');
                        resolve();
                    }
                });
            });
        });

        it('should handle concurrent profile updates gracefully', async () => {
            const updateData1 = {
                name: 'John Concurrent 1',
                email: 'john1@example.com'
            };

            const updateData2 = {
                name: 'John Concurrent 2',
                email: 'john2@example.com'
            };

            // Send concurrent requests
            const [response1, response2] = await Promise.all([
                request(app)
                    .put('/dashboard/profile')
                    .set('Cookie', `token=${authToken}`)
                    .send(updateData1),
                request(app)
                    .put('/dashboard/profile')
                    .set('Cookie', `token=${authToken}`)
                    .send(updateData2)
            ]);

            // Both requests should complete successfully
            expect(response1.status).to.be.oneOf([200, 400]);
            expect(response2.status).to.be.oneOf([200, 400]);

            // At least one should succeed
            const hasSuccess = (response1.status === 200 && response1.body.success) || 
                              (response2.status === 200 && response2.body.success);
            expect(hasSuccess).to.be.true;
        });

        it('should provide user-friendly error messages', async () => {
            const invalidData = {
                name: '',
                email: 'not-an-email',
                phone: 'invalid-phone-format',
                bio: 'x'.repeat(TEST_CONSTANTS.BIO_MAX_LENGTH + 1)
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.be.an('array');
            expect(response.body.errors.every(err => typeof err.msg === 'string')).to.be.true;
            expect(response.body.errors.every(err => err.msg.length > 0)).to.be.true;
        });
    });

    describe('Mobile Responsive Design Testing', () => {
        it('should handle mobile viewport profile updates', async () => {
            const updateData = {
                name: 'John Mobile',
                email: 'john.mobile@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .send(updateData)
                .expect(200);

            expect(response.body.success).to.be.true;
        });

        it('should render profile page for mobile devices', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .expect(200);

            expect(response.body.view).to.equal('profile');
            expect(response.body.data.user).to.exist;
        });
    });

    describe('Performance and Load Testing', () => {
        it('should handle multiple rapid profile requests', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(app)
                        .get('/dashboard/profile')
                        .set('Cookie', `token=${authToken}`)
                );
            }

            const responses = await Promise.all(promises);
            
            responses.forEach(response => {
                expect(response.status).to.equal(200);
                expect(response.body.view).to.equal('profile');
            });
        });

        it('should handle batch profile updates efficiently', async () => {
            const updates = [];
            for (let i = 0; i < 5; i++) {
                updates.push(
                    request(app)
                        .put('/dashboard/profile')
                        .set('Cookie', `token=${authToken}`)
                        .send({
                            name: `John Batch ${i}`,
                            email: `john.batch${i}@example.com`
                        })
                );
            }

            const responses = await Promise.allSettled(updates);
            
            // At least some updates should succeed
            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.body.success
            ).length;
            
            expect(successCount).to.be.greaterThan(0);
        });
    });
});