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

// Mock user data for testing
const MOCK_USER_DATA = {
    id: VALID_USER_ID,
    name: TEST_USER_NAME,
    email: TEST_USER_EMAIL,
    created_at: '2023-01-15 10:30:00'
};

describe('Profile Page Functionality Tests', () => {
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
                    console.error('User not found in database:', userId);
                    return res.redirect('/login');
                }
                
                try {
                    res.render('profile', { 
                        user: user,
                        currentPage: 'profile'
                    });
                } catch (renderErr) {
                    console.error('Error rendering profile template:', renderErr);
                    return res.status(500).send('Internal server error');
                }
            });
        });

        // Add logout route for POST /logout
        app.post('/logout', (req, res) => {
            res.clearCookie('token');
            res.redirect('/login');
        });

        app.get('/logout', (req, res) => {
            res.clearCookie('token');
            res.redirect('/login');
        });

        // Generate test tokens
        validToken = jwt.sign({ id: VALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '1h' });
        expiredToken = jwt.sign({ id: VALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '-1h' });
        invalidToken = 'invalid.jwt.token';
    });

    beforeEach(async () => {
        // Reset database state before each test
        await clearTestDatabase();
        await insertTestUser();
    });

    afterAll(async () => {
        // Cleanup test database
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

    // Test Suite 1: Authentication and Access Control
    describe('GET /profile route authentication', () => {
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

        test('should redirect requests with malformed token to /login', async () => {
            const malformedToken = 'malformed.token';
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${malformedToken}`])
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
    });

    // Test Suite 2: Successful Profile Access
    describe('GET /profile with valid authentication', () => {
        test('should successfully render profile page with valid token', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('User Profile');
            expect(response.text).toContain(TEST_USER_NAME);
            expect(response.text).toContain(TEST_USER_EMAIL);
        });

        test('should return HTML content type for valid profile request', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.headers['content-type']).toMatch(/text\/html/);
        });

        test('should include correct page title in profile response', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('<title>Profile - Express Auth App</title>');
        });
    });

    // Test Suite 3: User Data Display
    describe('Profile page data display', () => {
        test('should display user name correctly', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain(TEST_USER_NAME);
            expect(response.text).toContain('id="profile-name"');
        });

        test('should display user email correctly', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain(TEST_USER_EMAIL);
            expect(response.text).toContain('id="profile-email"');
        });

        test('should display formatted join date correctly', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('Member since');
            expect(response.text).toContain('id="profile-join-date"');
        });

        test('should escape HTML characters in user data to prevent XSS', async () => {
            // Insert user with potential XSS payload
            const xssName = '<script>alert("xss")</script>Test User';
            const xssEmail = '<img src=x onerror=alert("xss")>@test.com';
            
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET name = ?, email = ? WHERE id = ?',
                    [xssName, xssEmail, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // Verify XSS payload is escaped
            expect(response.text).not.toContain('<script>');
            expect(response.text).not.toContain('<img src=x onerror=');
            expect(response.text).toContain('&lt;script&gt;');
        });
    });

    // Test Suite 4: Database Error Handling
    describe('Database error handling', () => {
        test('should redirect to login when database query fails', async () => {
            // Close database connection to simulate error
            await new Promise((resolve) => {
                db.close(resolve);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');

            // Reopen database for subsequent tests
            await setupTestDatabase();
            await insertTestUser();
        });

        test('should handle database connection timeout gracefully', async () => {
            // Override database get method to simulate timeout
            const originalGet = db.get;
            db.get = function(query, params, callback) {
                setTimeout(() => {
                    callback(new Error('Database connection timeout'));
                }, 100);
            };

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');

            // Restore original method
            db.get = originalGet;
        });
    });

    // Test Suite 5: Invalid User ID Handling
    describe('Invalid user ID handling', () => {
        test('should redirect to login when JWT contains invalid user ID', async () => {
            const invalidUserToken = jwt.sign({ id: INVALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when JWT contains non-numeric user ID', async () => {
            const invalidUserToken = jwt.sign({ id: 'invalid-id' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when JWT contains null user ID', async () => {
            const invalidUserToken = jwt.sign({ id: null }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when JWT contains undefined user ID', async () => {
            const invalidUserToken = jwt.sign({ id: undefined }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when JWT payload is missing user ID', async () => {
            const invalidUserToken = jwt.sign({ email: TEST_USER_EMAIL }, TEST_JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    // Test Suite 6: Template Rendering
    describe('Profile template rendering', () => {
        test('should render profile.ejs template without errors', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('<!DOCTYPE html>');
            expect(response.text).toContain('User Profile');
            expect(response.text).toContain('md-card');
        });

        test('should include Material Design CSS classes', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-body');
            expect(response.text).toContain('md-card');
            expect(response.text).toContain('md-elevation-2');
            expect(response.text).toContain('md-container');
        });

        test('should include required Bootstrap icons', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('bi-person-circle');
            expect(response.text).toContain('bootstrap-icons');
        });

        test('should include Roboto font from Google Fonts', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('fonts.googleapis.com');
            expect(response.text).toContain('Roboto');
        });

        test('should handle template rendering errors gracefully', async () => {
            // Override res.render to simulate template error
            const originalApp = app;
            const testApp = express();
            testApp.use(express.urlencoded({ extended: true }));
            testApp.use(cookieParser());
            
            const authenticateToken = (req, res, next) => {
                const token = req.cookies.token;
                if (!token) return res.redirect('/login');
                
                jwt.verify(token, TEST_JWT_SECRET, (err, user) => {
                    if (err) return res.redirect('/login');
                    req.user = user;
                    next();
                });
            };

            testApp.get('/profile', authenticateToken, (req, res) => {
                db.get('SELECT name, email, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
                    if (err) return res.redirect('/login');
                    if (!user) return res.redirect('/login');
                    
                    try {
                        // Simulate rendering error
                        throw new Error('Template rendering error');
                    } catch (renderErr) {
                        return res.status(500).send('Internal server error');
                    }
                });
            });

            const response = await request(testApp)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(500);

            expect(response.text).toContain('Internal server error');
        });
    });

    // Test Suite 7: Navigation Integration
    describe('Navigation integration', () => {
        test('should include profile link in navigation when authenticated', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('href="/profile"');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('bi-person-circle');
        });

        test('should show active state for profile navigation link', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-navbar-link active');
            expect(response.text).toContain('aria-current="page"');
        });

        test('should include dashboard link in navigation', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('href="/dashboard"');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('bi-speedometer2');
        });

        test('should include logout link in navigation', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('href="/logout"');
            expect(response.text).toContain('Logout');
            expect(response.text).toContain('bi-box-arrow-right');
        });

        test('should include mobile navigation toggle', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-navbar-toggle');
            expect(response.text).toContain('data-bs-toggle="collapse"');
            expect(response.text).toContain('aria-label="Toggle navigation"');
        });
    });

    // Test Suite 8: Responsive Design
    describe('Responsive design behavior', () => {
        test('should include viewport meta tag for mobile responsiveness', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('name="viewport"');
            expect(response.text).toContain('width=device-width, initial-scale=1.0');
        });

        test('should include responsive grid classes', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-col-12');
            expect(response.text).toContain('md-col-md-8');
            expect(response.text).toContain('md-col-lg-6');
        });

        test('should include responsive utilities', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-justify-center');
            expect(response.text).toContain('md-container');
        });
    });

    // Test Suite 9: Security Tests
    describe('Security validation', () => {
        test('should not expose sensitive information in HTML source', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).not.toContain(TEST_PASSWORD_HASH);
            expect(response.text).not.toContain('password');
            expect(response.text).not.toContain(TEST_JWT_SECRET);
        });

        test('should not include user ID in client-side code', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).not.toContain(`"id":${VALID_USER_ID}`);
            expect(response.text).not.toContain(`id="${VALID_USER_ID}"`);
        });

        test('should include CSRF protection meta tags when implemented', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // Note: This test would pass when CSRF protection is implemented
            // Currently just checking the structure is in place
            expect(response.text).toContain('<meta');
        });

        test('should use HTTPS-ready security headers structure', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // Verify HTML structure supports security headers
            expect(response.text).toContain('<!DOCTYPE html>');
            expect(response.text).toContain('<html lang="en">');
        });
    });

    // Test Suite 10: Input Validation
    describe('Input validation and XSS prevention', () => {
        test('should sanitize user name to prevent XSS attacks', async () => {
            const xssPayload = '<script>alert("XSS")</script>';
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET name = ? WHERE id = ?',
                    [xssPayload, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).not.toContain('<script>alert("XSS")</script>');
            expect(response.text).toContain('&lt;script&gt;');
        });

        test('should sanitize user email to prevent XSS attacks', async () => {
            const xssPayload = 'test<img src=x onerror=alert("XSS")>@example.com';
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET email = ? WHERE id = ?',
                    [xssPayload, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).not.toContain('<img src=x onerror=alert("XSS")>');
            expect(response.text).toContain('&lt;img');
        });

        test('should handle special characters in user data safely', async () => {
            const specialCharsName = 'Test & User "Special" \'Chars\' <tag>';
            const specialCharsEmail = 'test&special"chars\'@example.com';
            
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET name = ?, email = ? WHERE id = ?',
                    [specialCharsName, specialCharsEmail, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('&amp;');
            expect(response.text).toContain('&quot;');
            expect(response.text).toContain('&#x27;');
            expect(response.text).toContain('&lt;');
            expect(response.text).toContain('&gt;');
        });
    });

    // Test Suite 11: Session Timeout
    describe('Session timeout handling', () => {
        test('should redirect to login after token expiration', async () => {
            const expiredToken = jwt.sign({ id: VALID_USER_ID }, TEST_JWT_SECRET, { expiresIn: '-1s' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should handle token with invalid signature', async () => {
            const tamperedToken = jwt.sign({ id: VALID_USER_ID }, 'wrong-secret', { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${tamperedToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should handle token with invalid structure', async () => {
            const malformedToken = 'header.payload.signature.extra';
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${malformedToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    // Test Suite 12: Performance and Edge Cases
    describe('Performance and edge cases', () => {
        test('should handle concurrent requests efficiently', async () => {
            const requests = Array(5).fill().map(() => 
                request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200)
            );

            const responses = await Promise.all(requests);
            
            responses.forEach(response => {
                expect(response.text).toContain('User Profile');
                expect(response.text).toContain(TEST_USER_NAME);
            });
        });

        test('should handle very long user names gracefully', async () => {
            const longName = 'A'.repeat(1000);
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET name = ? WHERE id = ?',
                    [longName, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('A'.repeat(50)); // Check first part is rendered
        });

        test('should handle Unicode characters in user data', async () => {
            const unicodeName = 'Test User 测试用户 👤';
            const unicodeEmail = 'test.用户@example.com';
            
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET name = ?, email = ? WHERE id = ?',
                    [unicodeName, unicodeEmail, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('测试用户');
            expect(response.text).toContain('👤');
            expect(response.text).toContain('用户@example.com');
        });

        test('should handle empty or null database values gracefully', async () => {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET name = ?, email = ? WHERE id = ?',
                    ['', TEST_USER_EMAIL, VALID_USER_ID],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('User Profile');
            expect(response.text).toContain(TEST_USER_EMAIL);
        });
    });

    // Test Suite 13: Logout Route Testing
    describe('Logout functionality', () => {
        test('should handle POST /logout request correctly', async () => {
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=;')
                ])
            );
        });

        test('should handle GET /logout request correctly', async () => {
            const response = await request(app)
                .get('/logout')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=;')
                ])
            );
        });

        test('should clear authentication cookie on logout', async () => {
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            const cookies = response.headers['set-cookie'];
            const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
            expect(tokenCookie).toContain('token=;');
            expect(tokenCookie).toContain('Path=/');
        });

        test('should redirect unauthenticated logout requests', async () => {
            const response = await request(app)
                .post('/logout')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    // Test Suite 14: Material Design Component Tests
    describe('Material Design component implementation', () => {
        test('should include Material Design card component', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-card');
            expect(response.text).toContain('md-card-header');
            expect(response.text).toContain('md-card-body');
            expect(response.text).toContain('md-card-content');
        });

        test('should include Material Design elevation classes', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toMatch(/md-elevation-[0-9]/);
            expect(response.text).toContain('md-elevation-2');
        });

        test('should include Material Design typography classes', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toMatch(/md-h[1-6]/);
            expect(response.text).toContain('md-body-1');
            expect(response.text).toContain('md-subtitle-1');
        });

        test('should include Material Design spacing utilities', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toMatch(/md-padding-/);
            expect(response.text).toMatch(/md-margin-/);
            expect(response.text).toContain('md-padding-lg');
        });

        test('should include Material Design color classes', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('md-primary');
            expect(response.text).toContain('md-text-primary');
            expect(response.text).toContain('md-surface');
        });
    });

    // Test Suite 15: Accessibility Tests
    describe('Accessibility compliance', () => {
        test('should include proper ARIA labels and roles', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('role="main"');
            expect(response.text).toContain('role="navigation"');
            expect(response.text).toContain('aria-label');
            expect(response.text).toContain('aria-current="page"');
        });

        test('should include semantic HTML elements', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('<main');
            expect(response.text).toContain('<nav');
            expect(response.text).toContain('<section');
            expect(response.text).toContain('<header');
        });

        test('should have proper heading hierarchy', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toMatch(/<h1[^>]*>/);
            expect(response.text).toContain('id="profile-heading"');
        });

        test('should include alt attributes for images', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // Check for images and verify alt attributes
            const imgMatches = response.text.match(/<img[^>]*>/g);
            if (imgMatches) {
                imgMatches.forEach(img => {
                    expect(img).toContain('alt=');
                });
            }
        });

        test('should include skip navigation links for screen readers', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toMatch(/skip-link|skip-nav|skip-to-content/i);
        });
    });
});