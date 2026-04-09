const request = require('supertest');
const app = require('../app');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

// Test constants
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';
const INVALID_EMAIL = 'invalid-email';
const SHORT_PASSWORD = '123';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '1h';
const COOKIE_MAX_AGE = 3600000; // 1 hour

// Test database setup
const TEST_DB_PATH = path.join(__dirname, 'test.sqlite');
let testDb;

// Mock database for tests
const db = {
    query: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            if (sql.includes('SELECT') && sql.includes('users')) {
                testDb.all(sql.replace(/\$\d+/g, '?'), params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else if (sql.includes('INSERT') && sql.includes('RETURNING')) {
                // Handle INSERT with RETURNING for PostgreSQL compatibility
                const insertSql = sql.split(' RETURNING')[0].replace(/\$\d+/g, '?');
                testDb.run(insertSql, params, function(err) {
                    if (err) reject(err);
                    else {
                        testDb.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [this.lastID], (err, row) => {
                            if (err) reject(err);
                            else resolve({ rows: [row] });
                        });
                    }
                });
            } else {
                testDb.run(sql.replace(/\$\d+/g, '?'), params, function(err) {
                    if (err) reject(err);
                    else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
                });
            }
        });
    },
    end: () => {
        return new Promise((resolve) => {
            if (testDb) {
                testDb.close(resolve);
            } else {
                resolve();
            }
        });
    }
};

// Helper function to create test user
async function createTestUser() {
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
    const result = await db.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?) RETURNING id, name, email, created_at',
        [TEST_NAME, TEST_EMAIL, hashedPassword]
    );
    return result.rows[0];
}

// Helper function to clean up test data
async function cleanupTestData() {
    await db.query('DELETE FROM users WHERE email = ?', [TEST_EMAIL]);
}

// Helper function to get authenticated cookie
async function getAuthenticatedCookie() {
    const user = await createTestUser();
    const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
    return `token=${token}`;
}

// Helper function to create XSS test payload
const XSS_PAYLOAD = '<script>alert("xss")</script>';
const SQL_INJECTION_PAYLOAD = "'; DROP TABLE users; --";

describe('Express Auth App Integration Tests', () => {
    beforeAll(async () => {
        // Create test database
        testDb = new sqlite3.Database(TEST_DB_PATH);
        
        // Create users table
        await new Promise((resolve, reject) => {
            testDb.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    beforeEach(async () => {
        await cleanupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
        await db.end();
    });

    describe('Public Pages', () => {
        test('should render home page without side navigation', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.text).toContain('Auth App');
            expect(response.text).not.toContain('sidebar');
            expect(response.text).toContain('Login');
            expect(response.text).toContain('Sign Up');
        });

        test('should render login page without side navigation', async () => {
            const response = await request(app)
                .get('/login')
                .expect(200);

            expect(response.text).toContain('Login');
            expect(response.text).not.toContain('sidebar');
            expect(response.text).toContain('email');
            expect(response.text).toContain('password');
        });

        test('should render signup page without side navigation', async () => {
            const response = await request(app)
                .get('/signup')
                .expect(200);

            expect(response.text).toContain('Sign Up');
            expect(response.text).not.toContain('sidebar');
            expect(response.text).toContain('name');
            expect(response.text).toContain('email');
            expect(response.text).toContain('password');
        });
    });

    describe('Authentication Flow', () => {
        test('should register new user successfully', async () => {
            const response = await request(app)
                .post('/signup')
                .send({
                    name: TEST_NAME,
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                })
                .expect(302);

            expect(response.headers.location).toBe('/dashboard');
            expect(response.headers['set-cookie']).toBeDefined();
            
            // Verify user was created in database
            const result = await db.query('SELECT * FROM users WHERE email = ?', [TEST_EMAIL]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe(TEST_NAME);
            expect(result.rows[0].email).toBe(TEST_EMAIL);
        });

        test('should reject signup with invalid email', async () => {
            const response = await request(app)
                .post('/signup')
                .send({
                    name: TEST_NAME,
                    email: INVALID_EMAIL,
                    password: TEST_PASSWORD
                })
                .expect(400);

            expect(response.text).toContain('Invalid email format');
            
            // Verify user was not created
            const result = await db.query('SELECT * FROM users WHERE email = ?', [INVALID_EMAIL]);
            expect(result.rows).toHaveLength(0);
        });

        test('should reject signup with short password', async () => {
            const response = await request(app)
                .post('/signup')
                .send({
                    name: TEST_NAME,
                    email: TEST_EMAIL,
                    password: SHORT_PASSWORD
                })
                .expect(400);

            expect(response.text).toContain('Password must be at least 6 characters');
        });

        test('should login existing user successfully', async () => {
            await createTestUser();

            const response = await request(app)
                .post('/login')
                .send({
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                })
                .expect(302);

            expect(response.headers.location).toBe('/dashboard');
            expect(response.headers['set-cookie']).toBeDefined();
            
            const cookieString = response.headers['set-cookie'][0];
            expect(cookieString).toContain('token=');
            expect(cookieString).toContain('HttpOnly');
            expect(cookieString).toContain('Max-Age');
        });

        test('should reject login with incorrect password', async () => {
            await createTestUser();

            const response = await request(app)
                .post('/login')
                .send({
                    email: TEST_EMAIL,
                    password: 'WrongPassword123!'
                })
                .expect(400);

            expect(response.text).toContain('Invalid email or password');
        });

        test('should reject login with non-existent user', async () => {
            const response = await request(app)
                .post('/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: TEST_PASSWORD
                })
                .expect(400);

            expect(response.text).toContain('Invalid email or password');
        });

        test('should validate password complexity requirements', async () => {
            const weakPasswords = [
                'password',
                '12345678',
                'PASSWORD',
                'Password',
                'Pass123'
            ];

            for (const weakPassword of weakPasswords) {
                const response = await request(app)
                    .post('/signup')
                    .send({
                        name: TEST_NAME,
                        email: TEST_EMAIL,
                        password: weakPassword
                    })
                    .expect(400);

                expect(response.text).toContain('Password must contain at least one lowercase letter, one uppercase letter, and one number');
            }
        });
    });

    describe('Protected Routes Authentication', () => {
        test('should redirect unauthenticated user from dashboard to login', async () => {
            const response = await request(app)
                .get('/dashboard')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect unauthenticated user from profile to login', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect unauthenticated user from settings to login', async () => {
            const response = await request(app)
                .get('/settings')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should reject invalid JWT token', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', 'token=invalid-token')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should reject expired JWT token', async () => {
            const user = await createTestUser();
            const expiredToken = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '-1h' } // Expired token
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', `token=${expiredToken}`)
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    describe('Side Navigation Layout', () => {
        test('should render dashboard with side navigation for authenticated user', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', cookie)
                .expect(200);

            // Verify side navigation is present
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Logout');

            // Verify dashboard is active
            expect(response.text).toContain('nav-link active');
            expect(response.text).toContain('Dashboard Content');
            expect(response.text).toContain('Welcome to your dashboard!');
            
            // Verify user information is displayed
            expect(response.text).toContain(TEST_NAME);
            expect(response.text).toContain(TEST_EMAIL);
        });

        test('should render profile page with side navigation and correct active state', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/profile')
                .set('Cookie', cookie)
                .expect(200);

            // Verify side navigation is present
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Logout');

            // Verify profile content and active state
            expect(response.text).toContain('Profile Content');
            expect(response.text).toContain('Personal Information');
            expect(response.text).toContain(TEST_NAME);
            expect(response.text).toContain(TEST_EMAIL);
            
            // Verify profile navigation is active
            const profileLinkRegex = /<a[^>]*href="\/profile"[^>]*class="[^"]*nav-link active[^"]*"/;
            expect(response.text).toMatch(profileLinkRegex);
        });

        test('should render settings page with side navigation and correct active state', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/settings')
                .set('Cookie', cookie)
                .expect(200);

            // Verify side navigation is present
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Logout');

            // Verify settings content
            expect(response.text).toContain('Settings Content');
            expect(response.text).toContain('Account Settings');
            
            // Verify settings navigation is active
            const settingsLinkRegex = /<a[^>]*href="\/settings"[^>]*class="[^"]*nav-link active[^"]*"/;
            expect(response.text).toMatch(settingsLinkRegex);
        });
    });

    describe('Navigation Flow Between Pages', () => {
        let authCookie;

        beforeEach(async () => {
            authCookie = await getAuthenticatedCookie();
        });

        test('should navigate from dashboard to profile maintaining authentication', async () => {
            // Start at dashboard
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', authCookie)
                .expect(200);

            expect(dashboardResponse.text).toContain('Dashboard Content');

            // Navigate to profile
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', authCookie)
                .expect(200);

            expect(profileResponse.text).toContain('Profile Content');
            expect(profileResponse.text).toContain(TEST_NAME);
            expect(profileResponse.text).toContain(TEST_EMAIL);
        });

        test('should navigate from profile to settings maintaining authentication', async () => {
            // Start at profile
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', authCookie)
                .expect(200);

            expect(profileResponse.text).toContain('Profile Content');

            // Navigate to settings
            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', authCookie)
                .expect(200);

            expect(settingsResponse.text).toContain('Settings Content');
            expect(settingsResponse.text).toContain('Account Settings');
        });

        test('should navigate from settings back to dashboard maintaining authentication', async () => {
            // Start at settings
            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', authCookie)
                .expect(200);

            expect(settingsResponse.text).toContain('Settings Content');

            // Navigate back to dashboard
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', authCookie)
                .expect(200);

            expect(dashboardResponse.text).toContain('Dashboard Content');
            expect(dashboardResponse.text).toContain('Welcome to your dashboard!');
        });
    });

    describe('Logout Functionality', () => {
        test('should logout user and redirect to login', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/logout')
                .set('Cookie', cookie)
                .expect(302);

            expect(response.headers.location).toBe('/login');
            
            // Verify cookie is cleared
            const setCookieHeaders = response.headers['set-cookie'];
            expect(setCookieHeaders).toBeDefined();
            const tokenCookie = setCookieHeaders.find(cookie => cookie.startsWith('token='));
            expect(tokenCookie).toContain('Max-Age=0');
        });

        test('should redirect to login after logout when accessing protected route', async () => {
            const cookie = await getAuthenticatedCookie();

            // Logout
            const logoutResponse = await request(app)
                .get('/logout')
                .set('Cookie', cookie)
                .expect(302);

            // Try to access dashboard after logout
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', logoutResponse.headers['set-cookie'])
                .expect(302);

            expect(dashboardResponse.headers.location).toBe('/login');
        });
    });

    describe('Responsive Navigation', () => {
        test('should include mobile navigation toggle in authenticated pages', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', cookie)
                .expect(200);

            // Check for mobile navigation elements
            expect(response.text).toContain('navbar-toggler');
            expect(response.text).toContain('d-lg-none');
            expect(response.text).toContain('offcanvas');
            expect(response.text).toContain('sidebarOffcanvas');
        });

        test('should include Bootstrap responsive classes', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', cookie)
                .expect(200);

            // Check for responsive Bootstrap classes
            expect(response.text).toContain('col-lg-');
            expect(response.text).toContain('d-none d-lg-');
            expect(response.text).toContain('container-fluid');
        });
    });

    describe('Security Tests', () => {
        test('should prevent XSS in user name display', async () => {
            const hashedPassword = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
            await db.query(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [XSS_PAYLOAD, TEST_EMAIL, hashedPassword]
            );

            const token = jwt.sign(
                { id: 1, email: TEST_EMAIL },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', `token=${token}`)
                .expect(200);

            // XSS payload should be escaped
            expect(response.text).not.toContain('<script>');
            expect(response.text).toContain('&lt;script&gt;');
        });

        test('should prevent XSS in user email display', async () => {
            const maliciousEmail = `test+${XSS_PAYLOAD}@example.com`;
            const hashedPassword = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
            
            // Note: This would normally be rejected by email validation, but testing XSS prevention
            await db.query(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [TEST_NAME, maliciousEmail, hashedPassword]
            );

            const token = jwt.sign(
                { id: 1, email: maliciousEmail },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${token}`)
                .expect(200);

            // XSS payload should be escaped
            expect(response.text).not.toContain('<script>');
            expect(response.text).toContain('&lt;script&gt;');
        });

        test('should use parameterized queries to prevent SQL injection', async () => {
            // This test verifies that the database query structure prevents SQL injection
            const maliciousName = SQL_INJECTION_PAYLOAD;
            
            try {
                const hashedPassword = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
                await db.query(
                    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                    [maliciousName, TEST_EMAIL, hashedPassword]
                );

                // If we reach here, the parameterized query properly escaped the input
                const result = await db.query('SELECT name FROM users WHERE email = ?', [TEST_EMAIL]);
                expect(result.rows[0].name).toBe(maliciousName);
                
                // Verify users table still exists (wasn't dropped)
                const tableCheck = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
                expect(tableCheck.rows).toHaveLength(1);
            } catch (error) {
                // If error occurs, it should be a validation error, not SQL injection
                expect(error.message).not.toContain('syntax error');
            }
        });

        test('should validate JWT token signature', async () => {
            const user = await createTestUser();
            
            // Create token with wrong secret
            const invalidToken = jwt.sign(
                { id: user.id, email: user.email },
                'wrong-secret',
                { expiresIn: JWT_EXPIRES_IN }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', `token=${invalidToken}`)
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should set secure cookie attributes in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            try {
                await createTestUser();

                const response = await request(app)
                    .post('/login')
                    .send({
                        email: TEST_EMAIL,
                        password: TEST_PASSWORD
                    })
                    .expect(302);

                const cookieString = response.headers['set-cookie'][0];
                expect(cookieString).toContain('HttpOnly');
                expect(cookieString).toContain('Secure');
                expect(cookieString).toContain('SameSite=Strict');
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle database connection errors gracefully', async () => {
            // Mock database error
            const originalQuery = db.query;
            db.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

            try {
                const response = await request(app)
                    .post('/signup')
                    .send({
                        name: TEST_NAME,
                        email: TEST_EMAIL,
                        password: TEST_PASSWORD
                    })
                    .expect(500);

                expect(response.text).toContain('Internal server error');
            } finally {
                db.query = originalQuery;
            }
        });

        test('should handle database errors on dashboard', async () => {
            const user = await createTestUser();
            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // Mock database error for user lookup
            const originalQuery = db.query;
            db.query = jest.fn()
                .mockResolvedValueOnce({ rows: [user] }) // First call succeeds (token validation)
                .mockRejectedValue(new Error('Database error')); // Second call fails (user lookup)

            try {
                const response = await request(app)
                    .get('/dashboard')
                    .set('Cookie', `token=${token}`)
                    .expect(500);

                expect(response.text).toContain('Internal server error');
            } finally {
                db.query = originalQuery;
            }
        });

        test('should handle missing user in database after token validation', async () => {
            const token = jwt.sign(
                { id: 99999, email: 'nonexistent@example.com' }, // Non-existent user ID
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', `token=${token}`)
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should handle malformed JWT tokens', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', 'token=malformed.token.here')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    describe('Template Rendering', () => {
        test('should render templates with correct page titles', async () => {
            const cookie = await getAuthenticatedCookie();

            // Dashboard
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', cookie)
                .expect(200);
            expect(dashboardResponse.text).toContain('<title>Dashboard | Auth App</title>');

            // Profile
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', cookie)
                .expect(200);
            expect(profileResponse.text).toContain('<title>Profile | Auth App</title>');

            // Settings
            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', cookie)
                .expect(200);
            expect(settingsResponse.text).toContain('<title>Settings | Auth App</title>');
        });

        test('should pass user context to all authenticated templates', async () => {
            const cookie = await getAuthenticatedCookie();

            const pages = ['/dashboard', '/profile', '/settings'];
            
            for (const page of pages) {
                const response = await request(app)
                    .get(page)
                    .set('Cookie', cookie)
                    .expect(200);

                expect(response.text).toContain(TEST_NAME);
                expect(response.text).toContain(TEST_EMAIL);
                expect(response.text).toContain('bi bi-person-circle');
            }
        });

        test('should render Bootstrap icons correctly', async () => {
            const cookie = await getAuthenticatedCookie();

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', cookie)
                .expect(200);

            // Check for Bootstrap icon classes
            expect(response.text).toContain('bi bi-speedometer2');
            expect(response.text).toContain('bi bi-person-circle');
            expect(response.text).toContain('bi bi-gear');
            expect(response.text).toContain('bi bi-box-arrow-right');
        });
    });

    describe('Session Management', () => {
        test('should maintain session across multiple requests', async () => {
            const cookie = await getAuthenticatedCookie();

            // Make multiple requests with same cookie
            const requests = ['/dashboard', '/profile', '/settings'];
            
            for (const route of requests) {
                const response = await request(app)
                    .get(route)
                    .set('Cookie', cookie)
                    .expect(200);

                expect(response.text).toContain(TEST_NAME);
                expect(response.text).toContain(TEST_EMAIL);
            }
        });

        test('should handle concurrent requests with same session', async () => {
            const cookie = await getAuthenticatedCookie();

            const requests = ['/dashboard', '/profile', '/settings'].map(route =>
                request(app)
                    .get(route)
                    .set('Cookie', cookie)
                    .expect(200)
            );

            const responses = await Promise.all(requests);
            
            responses.forEach(response => {
                expect(response.text).toContain(TEST_NAME);
                expect(response.text).toContain(TEST_EMAIL);
            });
        });
    });

    describe('Input Validation Edge Cases', () => {
        test('should handle empty form submissions', async () => {
            const response = await request(app)
                .post('/signup')
                .send({})
                .expect(400);

            expect(response.text).toContain('Name must be between 2 and 50 characters');
        });

        test('should handle whitespace-only inputs', async () => {
            const response = await request(app)
                .post('/signup')
                .send({
                    name: '   ',
                    email: '   ',
                    password: '   '
                })
                .expect(400);

            expect(response.text).toContain('Name must be between 2 and 50 characters');
        });

        test('should handle extremely long inputs', async () => {
            const longString = 'a'.repeat(1000);
            
            const response = await request(app)
                .post('/signup')
                .send({
                    name: longString,
                    email: `${longString}@example.com`,
                    password: TEST_PASSWORD
                })
                .expect(400);

            expect(response.text).toContain('Name must be between 2 and 50 characters');
        });

        test('should handle special characters in name', async () => {
            const specialCharsName = "John O'Connor-Smith Jr.";
            
            const response = await request(app)
                .post('/signup')
                .send({
                    name: specialCharsName,
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                })
                .expect(400);

            expect(response.text).toContain('Name can only contain letters and spaces');
        });
    });

    describe('Content Security', () => {
        test('should set proper content-type headers', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/html');
        });

        test('should not expose sensitive information in error messages', async () => {
            const response = await request(app)
                .post('/login')
                .send({
                    email: TEST_EMAIL,
                    password: 'wrong-password'
                })
                .expect(400);

            // Should not reveal whether user exists
            expect(response.text).toContain('Invalid email or password');
            expect(response.text).not.toContain('user not found');
            expect(response.text).not.toContain('incorrect password');
        });
    });
});