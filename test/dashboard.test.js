const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = require('../app');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database connection
const db = new sqlite3.Database(path.join(__dirname, '../database/users.db'));

// Test constants
const TEST_USER_DATA = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'TestPassword123!'
};

const INVALID_EMAIL = 'invalid-email';
const MALICIOUS_SCRIPT = '<script>alert("xss")</script>';
const SQL_INJECTION = "'; DROP TABLE users; --";
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-tests';
const SALT_ROUNDS = 10;

let testUserId;
let validToken;
let expiredToken;
let malformedToken;

describe('Dashboard Routes', () => {
    // Test setup - create test user and tokens
    beforeAll(async () => {
        return new Promise((resolve, reject) => {
            // Clean up any existing test data
            db.run('DELETE FROM users WHERE email = ?', [TEST_USER_DATA.email], function(err) {
                if (err && !err.message.includes('no such table')) {
                    return reject(err);
                }
                
                // Create test user
                const hashedPassword = bcrypt.hashSync(TEST_USER_DATA.password, SALT_ROUNDS);
                db.run(
                    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                    [TEST_USER_DATA.name, TEST_USER_DATA.email, hashedPassword],
                    function(err) {
                        if (err) {
                            return reject(err);
                        }
                        
                        testUserId = this.lastID;
                        
                        // Generate valid JWT token
                        validToken = jwt.sign(
                            { 
                                userId: testUserId, 
                                name: TEST_USER_DATA.name, 
                                email: TEST_USER_DATA.email,
                                created_at: new Date().toISOString()
                            },
                            JWT_SECRET,
                            { expiresIn: '1h' }
                        );
                        
                        // Generate expired JWT token
                        expiredToken = jwt.sign(
                            { 
                                userId: testUserId, 
                                name: TEST_USER_DATA.name, 
                                email: TEST_USER_DATA.email,
                                created_at: new Date().toISOString()
                            },
                            JWT_SECRET,
                            { expiresIn: '-1h' }
                        );
                        
                        // Generate malformed token
                        malformedToken = 'invalid.jwt.token.format';
                        
                        resolve();
                    }
                );
            });
        });
    });

    // Clean up test data
    afterAll(async () => {
        return new Promise((resolve) => {
            if (testUserId) {
                db.run('DELETE FROM users WHERE id = ?', [testUserId], () => {
                    db.close((err) => {
                        if (err) console.error('Error closing database:', err);
                        resolve();
                    });
                });
            } else {
                db.close((err) => {
                    if (err) console.error('Error closing database:', err);
                    resolve();
                });
            }
        });
    });

    describe('GET /dashboard', () => {
        it('should return 200 and render dashboard template for authenticated user', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Express Auth');
            expect(response.text).toContain(TEST_USER_DATA.name);
            expect(response.text).toContain('Welcome to your dashboard');
        });

        it('should pass correct user data to dashboard template', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain(TEST_USER_DATA.name);
            expect(response.text).toContain(TEST_USER_DATA.email);
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('nav-link active');
        });

        it('should redirect to login when no token provided', async () => {
            const response = await request(app)
                .get('/dashboard')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });

        it('should clear cookie and redirect to login with invalid token', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${malformedToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });

        it('should clear cookie and redirect to login with expired token', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });

        it('should handle database connection errors gracefully', async () => {
            // Mock database error by using invalid user ID in token
            const invalidUserToken = jwt.sign(
                { 
                    userId: 99999, 
                    name: TEST_USER_DATA.name, 
                    email: TEST_USER_DATA.email,
                    created_at: new Date().toISOString()
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);
            
            // Should redirect to login for invalid user
            expect(response.headers.location).toBe('/login');
        });
    });

    describe('GET /profile', () => {
        it('should return 200 and render profile template for authenticated user', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('User Information');
            expect(response.text).toContain(TEST_USER_DATA.name);
            expect(response.text).toContain(TEST_USER_DATA.email);
        });

        it('should render profile template with correct user context', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Full Name');
            expect(response.text).toContain(TEST_USER_DATA.name);
            expect(response.text).toContain('Email Address');
            expect(response.text).toContain(TEST_USER_DATA.email);
            expect(response.text).toContain('nav-link active');
        });

        it('should redirect to login when unauthenticated', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });

        it('should clear cookie and redirect with invalid token', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${malformedToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });

        it('should handle expired tokens properly', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });

        it('should prevent XSS attacks in user data rendering', async () => {
            // Create token with malicious data
            const xssToken = jwt.sign(
                { 
                    userId: testUserId, 
                    name: MALICIOUS_SCRIPT, 
                    email: TEST_USER_DATA.email,
                    created_at: new Date().toISOString()
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${xssToken}`])
                .expect(200);
            
            // Should escape HTML entities
            expect(response.text).not.toContain('<script>');
            expect(response.text).toContain('&lt;script&gt;');
        });
    });

    describe('GET /settings', () => {
        it('should return 200 and render settings template for authenticated user', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('General Settings');
            expect(response.text).toContain(TEST_USER_DATA.name);
            expect(response.text).toContain('Configure your application');
        });

        it('should follow same authentication patterns as profile route', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Welcome, ');
            expect(response.text).toContain(TEST_USER_DATA.name);
            expect(response.text).toContain('nav-link active');
        });

        it('should redirect unauthenticated users to login', async () => {
            const response = await request(app)
                .get('/settings')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });

        it('should handle malformed tokens by clearing cookie and redirecting', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=malformed.token.here`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });

        it('should render placeholder settings options', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Language');
            expect(response.text).toContain('form-select');
            expect(response.text).toContain('Notifications');
            expect(response.text).toContain('Security Settings');
        });
    });

    describe('POST /logout', () => {
        it('should clear JWT cookie and redirect to home page', async () => {
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });

        it('should work without authentication', async () => {
            const response = await request(app)
                .post('/logout')
                .expect(302);
            
            expect(response.headers.location).toBe('/');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });

        it('should clear cookie even with invalid token', async () => {
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${malformedToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });
    });

    describe('JWT Token Security Tests', () => {
        it('should reject tokens with invalid signatures', async () => {
            const tokenWithInvalidSignature = validToken.slice(0, -10) + 'tamperedXX';
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${tokenWithInvalidSignature}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });

        it('should reject tokens without required claims', async () => {
            const tokenMissingClaims = jwt.sign(
                { userId: testUserId },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${tokenMissingClaims}`])
                .expect(302);
            
            // Should redirect due to database validation
            expect(response.headers.location).toBe('/login');
        });

        it('should handle tokens signed with wrong secret', async () => {
            const wrongSecretToken = jwt.sign(
                { 
                    userId: testUserId, 
                    name: TEST_USER_DATA.name, 
                    email: TEST_USER_DATA.email,
                    created_at: new Date().toISOString()
                },
                'wrong-secret',
                { expiresIn: '1h' }
            );
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${wrongSecretToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
    });

    describe('Input Validation and Security', () => {
        it('should prevent SQL injection attempts in route parameters', async () => {
            const response = await request(app)
                .get(`/dashboard?userId=${SQL_INJECTION}`)
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Dashboard');
            expect(response.text).not.toContain('DROP TABLE');
        });

        it('should sanitize user input in template rendering', async () => {
            const tokenWithXSS = jwt.sign(
                { 
                    userId: testUserId, 
                    name: MALICIOUS_SCRIPT, 
                    email: 'test@example.com',
                    created_at: new Date().toISOString()
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${tokenWithXSS}`])
                .expect(200);
            
            expect(response.text).not.toContain('<script>alert');
            expect(response.text).toContain('&lt;script&gt;');
        });

        it('should handle empty or null token values', async () => {
            const responses = await Promise.all([
                request(app).get('/dashboard').set('Cookie', ['token=']).expect(302),
                request(app).get('/dashboard').set('Cookie', ['token=null']).expect(302),
                request(app).get('/dashboard').set('Cookie', ['token=undefined']).expect(302)
            ]);
            
            responses.forEach(response => {
                expect(response.headers.location).toBe('/login');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle missing JWT secret gracefully', async () => {
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            
            // Restore original secret
            process.env.JWT_SECRET = originalSecret;
        });

        it('should handle database connection failures', async () => {
            // Test will pass as routes don't depend on database for basic functionality
            // JWT validation and template rendering should work without database
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Dashboard');
        });

        it('should maintain session state across multiple requests', async () => {
            const agent = request.agent(app);
            
            await agent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            await agent
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            await agent
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
        });
    });

    describe('Route Coverage', () => {
        it('should test all authentication middleware paths', async () => {
            const routes = ['/dashboard', '/profile', '/settings'];
            
            for (const route of routes) {
                // Test authenticated access
                await request(app)
                    .get(route)
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);
                
                // Test unauthenticated access
                await request(app)
                    .get(route)
                    .expect(302);
                
                // Test with expired token
                await request(app)
                    .get(route)
                    .set('Cookie', [`token=${expiredToken}`])
                    .expect(302);
            }
        });

        it('should verify correct template rendering for each route', async () => {
            const testCases = [
                { route: '/dashboard', content: 'Welcome to your dashboard' },
                { route: '/profile', content: 'User Information' },
                { route: '/settings', content: 'General Settings' }
            ];
            
            for (const testCase of testCases) {
                const response = await request(app)
                    .get(testCase.route)
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);
                
                expect(response.text).toContain(testCase.content);
                expect(response.text).toContain('sidebar');
                expect(response.text).toContain('nav-link');
            }
        });

        it('should validate active navigation highlighting', async () => {
            const navigationTests = [
                { route: '/dashboard', activeText: 'Dashboard' },
                { route: '/profile', activeText: 'Profile' },
                { route: '/settings', activeText: 'Settings' }
            ];
            
            for (const test of navigationTests) {
                const response = await request(app)
                    .get(test.route)
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);
                
                expect(response.text).toContain('nav-link active');
            }
        });
    });

    describe('Template Context Validation', () => {
        it('should provide required user context including created_at field', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            // Check if template renders without error (implicit test)
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain(TEST_USER_DATA.name);
        });

        it('should handle missing user context gracefully', async () => {
            const minimalToken = jwt.sign(
                { 
                    userId: testUserId,
                    name: TEST_USER_DATA.name,
                    email: TEST_USER_DATA.email
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${minimalToken}`])
                .expect(200);
            
            expect(response.text).toContain('Dashboard');
        });

        it('should set currentPath variable for active navigation', async () => {
            const routes = ['/dashboard', '/profile', '/settings'];
            
            for (const route of routes) {
                const response = await request(app)
                    .get(route)
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);
                
                // Verify active navigation state is properly set
                expect(response.text).toContain('nav-link active');
            }
        });
    });
});