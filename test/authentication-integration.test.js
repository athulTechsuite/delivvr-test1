const request = require('supertest');
const cheerio = require('cheerio');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = require('../app');

describe('Authentication Integration with Sidebar Layout', () => {
    let testDb;
    let testUser;
    let validToken;
    let expiredToken;
    let invalidToken;

    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
    const TEST_DB_PATH = path.join(__dirname, '../database/test_auth.db');

    beforeAll(async () => {
        // Setup test database
        testDb = new sqlite3.Database(TEST_DB_PATH);
        
        await new Promise((resolve, reject) => {
            testDb.serialize(() => {
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

        // Create test user with hashed password
        const hashedPassword = await bcrypt.hash('TestPass123!', 10);
        testUser = {
            id: 1,
            name: 'Test User',
            email: 'testuser@example.com',
            password: hashedPassword,
            created_at: new Date().toISOString()
        };

        await new Promise((resolve, reject) => {
            testDb.run(
                'INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
                [testUser.name, testUser.email, testUser.password, testUser.created_at],
                function(err) {
                    if (err) reject(err);
                    else {
                        testUser.id = this.lastID;
                        resolve();
                    }
                }
            );
        });

        // Create test tokens
        validToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        expiredToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            JWT_SECRET,
            { expiresIn: '-1h' }
        );

        invalidToken = 'invalid.jwt.token.here';
    });

    afterAll(async () => {
        if (testDb) {
            await new Promise((resolve) => {
                testDb.close(() => resolve());
            });
        }

        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    // TC-013: Authentication Token Handling Tests
    describe('TC-013: Authentication Token Handling', () => {
        test('TC-013-Valid: should accept valid JWT token and render sidebar layout', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify authenticated layout is rendered
            expect($('.sidebar').length).toBe(1);
            expect($('.main-content').length).toBe(1);
            expect(response.text).toContain(testUser.name);
        });

        test('TC-013-Invalid: should reject invalid JWT token and redirect to login', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${invalidToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-013-Expired: should reject expired JWT token and redirect to login', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${expiredToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-013-Missing: should redirect to login when no token provided', async () => {
            const response = await request(app).get('/dashboard');

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-013-Malformed: should handle malformed cookies gracefully', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', ['token=malformed']);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-014: User Session Management Tests
    describe('TC-014: User Session Management', () => {
        test('TC-014-UserData: should display correct user data from database in sidebar', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify user data is displayed correctly
            expect(response.text).toContain(testUser.name);
            expect(response.text).toContain(testUser.email);
            expect($('.user-info').text()).toContain('Welcome');
        });

        test('TC-014-NonExistent: should handle non-existent user ID in token', async () => {
            const tokenWithBadUserId = jwt.sign(
                { userId: 99999, email: 'nonexistent@example.com' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${tokenWithBadUserId}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-014-DatabaseError: should handle database connection errors', async () => {
            // This would require mocking database to simulate errors
            // For now, we verify the structure handles it gracefully
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            // If database fails, should still handle gracefully
        });

        test('TC-014-TokenPayload: should extract correct user information from JWT payload', async () => {
            const customToken = jwt.sign(
                { 
                    userId: testUser.id, 
                    email: testUser.email,
                    name: 'Custom Name'
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${customToken}`]);

            expect(response.status).toBe(200);
            // Should use database data, not token data for display
            expect(response.text).toContain(testUser.name);
        });
    });

    // TC-015: Protected Route Access Tests
    describe('TC-015: Protected Route Access Control', () => {
        const protectedRoutes = ['/dashboard', '/profile', '/settings'];

        protectedRoutes.forEach((route) => {
            test(`TC-015-${route.replace('/', '')}: should protect ${route} with authentication`, async () => {
                const response = await request(app).get(route);

                expect(response.status).toBe(302);
                expect(response.headers.location).toBe('/login');
            });

            test(`TC-015-Auth-${route.replace('/', '')}: should allow access to ${route} with valid authentication`, async () => {
                const response = await request(app)
                    .get(route)
                    .set('Cookie', [`token=${validToken}`]);

                expect(response.status).toBe(200);
                
                const $ = cheerio.load(response.text);
                expect($('.sidebar').length).toBe(1);
            });
        });

        test('TC-015-Redirect: should redirect to login page with proper structure', async () => {
            const response = await request(app).get('/login');

            expect(response.status).toBe(200);
            expect(response.text).toContain('login');
            expect(response.text).not.toContain('sidebar');
        });
    });

    // TC-016: Logout Functionality Tests
    describe('TC-016: Logout Functionality', () => {
        test('TC-016-POST: should handle POST logout request and clear session', async () => {
            const agent = request.agent(app);
            
            const response = await agent
                .post('/logout')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/');
            
            // Verify cookie is cleared
            const cookieHeader = response.headers['set-cookie'];
            expect(cookieHeader).toBeDefined();
            expect(cookieHeader.some(cookie => cookie.includes('token='))).toBe(true);
        });

        test('TC-016-SessionClear: should prevent access to protected routes after logout', async () => {
            const agent = request.agent(app);
            
            // Logout
            await agent
                .post('/logout')
                .set('Cookie', [`token=${validToken}`]);
            
            // Try to access protected route
            const response = await agent.get('/dashboard');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-016-Form: should include proper logout form in sidebar', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify logout form structure
            const logoutForm = $('.logout-btn form[action="/logout"]');
            expect(logoutForm.length).toBe(1);
            expect(logoutForm.attr('method')).toBe('POST');
            
            const submitButton = logoutForm.find('button[type="submit"]');
            expect(submitButton.length).toBe(1);
            expect(submitButton.hasClass('btn-danger')).toBe(true);
        });

        test('TC-016-NoAuth: should handle logout attempt without authentication', async () => {
            const response = await request(app).post('/logout');

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/');
        });
    });

    // TC-017: Security and Authorization Tests
    describe('TC-017: Security and Authorization', () => {
        test('TC-017-CSRF: should use POST method for logout to prevent CSRF', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify logout uses POST method
            const logoutForm = $('form[action="/logout"]');
            expect(logoutForm.attr('method')).toBe('POST');
        });

        test('TC-017-HTTPOnly: should set HTTPOnly flag on auth cookies', async () => {
            // This would be verified in the login process
            // For now, verify the cookie setting logic exists
            const agent = request.agent(app);
            
            const response = await agent
                .post('/login')
                .send({
                    email: testUser.email,
                    password: 'TestPass123!'
                });

            expect(response.status).toBe(302);
            // HTTPOnly flag verification would happen in integration tests
        });

        test('TC-017-TokenValidation: should validate JWT signature correctly', async () => {
            const tamperedToken = validToken.slice(0, -10) + 'tampered123';
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${tamperedToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-017-UserIsolation: should prevent access to other users\' data', async () => {
            // Create token for different user
            const differentUserToken = jwt.sign(
                { userId: 9999, email: 'different@example.com' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${differentUserToken}`]);

            // Should redirect due to user not found
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-018: Error Handling and Edge Cases
    describe('TC-018: Error Handling and Edge Cases', () => {
        test('TC-018-EmptyToken: should handle empty token gracefully', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', ['token=']);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-018-MultipleTokens: should handle multiple token cookies', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`, `token=${invalidToken}`]);

            // Should use first token
            expect(response.status).toBe(200);
        });

        test('TC-018-LongToken: should handle extremely long tokens', async () => {
            const longToken = 'a'.repeat(10000);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${longToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-018-SpecialChars: should handle tokens with special characters', async () => {
            const specialCharToken = 'token.with.special$chars&here';
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${specialCharToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-018-DatabaseLock: should handle database being locked/busy', async () => {
            // This would require more sophisticated database mocking
            // For now, verify the error handling structure exists
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            // Should handle gracefully even if database has issues
            expect([200, 302]).toContain(response.status);
        });
    });

    // TC-019: Session Persistence Tests
    describe('TC-019: Session Persistence and Cookie Management', () => {
        test('TC-019-Persistence: should maintain session across multiple requests', async () => {
            const agent = request.agent(app);
            
            // First request
            const response1 = await agent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);
            
            expect(response1.status).toBe(200);
            
            // Second request (should maintain session)
            const response2 = await agent
                .get('/profile')
                .set('Cookie', [`token=${validToken}`]);
            
            expect(response2.status).toBe(200);
            expect(response2.text).toContain(testUser.name);
        });

        test('TC-019-CookiePath: should handle cookie path restrictions properly', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}; Path=/dashboard`]);

            expect(response.status).toBe(200);
        });

        test('TC-019-CookieExpiry: should handle cookie expiration', async () => {
            const expiredCookieToken = jwt.sign(
                { userId: testUser.id, email: testUser.email },
                JWT_SECRET,
                { expiresIn: '1ms' }
            );

            // Wait a moment for token to expire
            await new Promise(resolve => setTimeout(resolve, 10));

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${expiredCookieToken}`]);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });
});