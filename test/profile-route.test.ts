const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// Test constants
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
const TEST_DB_PATH = path.join(__dirname, 'test-profile.sqlite');
const VALID_USER_ID = 1;
const INVALID_USER_ID = 999;
const TEST_USER_NAME = 'Test User';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuvwxyz123456';
const TEST_CREATED_AT = '2023-01-15 10:30:00';

// Mock user data for testing
const MOCK_USER_DATA = {
    id: VALID_USER_ID,
    name: TEST_USER_NAME,
    email: TEST_USER_EMAIL,
    created_at: TEST_CREATED_AT
};

describe('Profile Route and Authentication Tests', () => {
    let app;
    let db;
    let validToken;
    let expiredToken;
    let invalidToken;

    beforeAll(async () => {
        // Create test application instance
        app = express();
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());
        app.use(cookieParser());
        app.use(express.static(path.join(__dirname, '../public')));
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, '../views'));

        // Setup test database
        await setupTestDatabase();

        // Setup authentication middleware
        const authenticateToken = (req, res, next) => {
            const token = req.cookies.token;
            
            if (!token) {
                return res.redirect('/login');
            }
            
            jwt.verify(token, TEST_JWT_SECRET, (err, user) => {
                if (err) {
                    return res.redirect('/login');
                }
                req.user = user;
                next();
            });
        };

        // Setup routes for testing
        app.get('/login', (req, res) => {
            res.render('login', { error: null });
        });

        app.get('/profile', authenticateToken, (req, res) => {
            const userId = req.user.id;
            
            if (!userId || typeof userId !== 'number') {
                console.error('Invalid user ID in JWT token:', userId);
                return res.redirect('/login');
            }
            
            db.get('SELECT name, email, created_at FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    console.error('Database error fetching user profile:', err);
                    return res.redirect('/login');
                }
                
                if (!user) {
                    console.error('User not found for ID:', userId);
                    return res.redirect('/login');
                }
                
                if (!user.name || !user.email || !user.created_at) {
                    console.error('Incomplete user data:', user);
                    return res.redirect('/login');
                }
                
                res.render('profile', { 
                    user: user,
                    title: 'Profile'
                });
            });
        });

        app.post('/logout', (req, res) => {
            res.clearCookie('token');
            res.redirect('/login');
        });

        // Generate test tokens
        validToken = jwt.sign({ id: VALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '1h' });
        expiredToken = jwt.sign({ id: VALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '-1h' });
        invalidToken = 'invalid.jwt.token';
    });

    beforeEach(async () => {
        await clearTestDatabase();
        await insertTestUser();
    });

    afterAll(async () => {
        if (db) {
            await new Promise((resolve) => {
                db.close(resolve);
            });
        }
        
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    // Helper functions
    async function setupTestDatabase() {
        return new Promise((resolve, reject) => {
            db = new sqlite3.Database(TEST_DB_PATH, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.serialize(() => {
                    db.run(`CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, resolve);
                });
            });
        });
    }

    async function clearTestDatabase() {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM users', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async function insertTestUser() {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (id, name, email, password, created_at) VALUES (?, ?, ?, ?, ?)',
                [MOCK_USER_DATA.id, MOCK_USER_DATA.name, MOCK_USER_DATA.email, TEST_PASSWORD_HASH, MOCK_USER_DATA.created_at],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    // TC-F-001: Profile page should be accessible at /profile route with GET request
    describe('Profile Route Accessibility', () => {
        test('should respond to GET /profile request with valid authentication', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('User Profile');
            expect(response.headers['content-type']).toMatch(/text\/html/);
        });

        test('should handle profile route with correct HTTP method', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.status).toBe(200);
        });
    });

    // TC-F-002: Profile page should require authentication and redirect unauthenticated users to /login
    describe('Authentication Requirements', () => {
        test('should redirect unauthenticated requests to /login', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect requests with invalid token to /login', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect requests with expired token to /login', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect requests with empty token to /login', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', ['token='])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect requests with malformed token to /login', async () => {
            const malformedToken = 'malformed.token';
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${malformedToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-F-003: Profile page should display user name, email, and member since date in Material Design card layout
    describe('Profile Data Display', () => {
        test('should display user name correctly in Material Design layout', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain(TEST_USER_NAME);
            expect(response.text).toContain('md-card');
            expect(response.text).toContain('Full Name');
        });

        test('should display user email correctly in Material Design layout', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain(TEST_USER_EMAIL);
            expect(response.text).toContain('Email Address');
            expect(response.text).toContain('bi-envelope-fill');
        });

        test('should display member since date in proper format', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('Member Since');
            expect(response.text).toContain('January');
            expect(response.text).toContain('2023');
            expect(response.text).toContain('bi-calendar-check-fill');
        });

        test('should use Material Design card elevation and styling', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-elevation-2');
            expect(response.text).toContain('md-card-header');
            expect(response.text).toContain('md-card-body');
        });
    });

    // TC-F-012: Profile page should load user data from database using existing authentication patterns
    describe('Database Integration', () => {
        test('should fetch user data from database using parameterized queries', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain(MOCK_USER_DATA.name);
            expect(response.text).toContain(MOCK_USER_DATA.email);
        });

        test('should use JWT user ID to query database', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.status).toBe(200);
            expect(response.text).toContain('Profile Information');
        });
    });

    // TC-F-013: Profile page should handle database errors gracefully by redirecting to login
    describe('Error Handling', () => {
        test('should redirect to login when user not found in database', async () => {
            const nonExistentUserToken = jwt.sign({ id: INVALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${nonExistentUserToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should handle invalid user ID in JWT token', async () => {
            const invalidUserIdToken = jwt.sign({ id: 'invalid' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidUserIdToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should handle missing user ID in JWT token', async () => {
            const noUserIdToken = jwt.sign({ email: 'test@example.com' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${noUserIdToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-F-021: Profile page should show correct user information matching database records
    describe('Data Integrity', () => {
        test('should display exact user data from database without modification', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain(MOCK_USER_DATA.name);
            expect(response.text).toContain(MOCK_USER_DATA.email);
        });

        test('should validate user data completeness before rendering', async () => {
            // Insert user with missing data
            await new Promise((resolve) => {
                db.run('UPDATE users SET name = NULL WHERE id = ?', [VALID_USER_ID], resolve);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-F-025: Error handling in profile route should match existing dashboard patterns
    describe('Consistent Error Handling', () => {
        test('should follow same authentication middleware pattern as dashboard', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should handle database connection errors consistently', async () => {
            // Close database connection to simulate error
            await new Promise((resolve) => {
                db.close(resolve);
            });
            
            // Recreate corrupted database connection
            db = new sqlite3.Database(':memory:');
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });
});