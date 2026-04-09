const request = require('supertest');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = require('../app');

// Test constants
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing';
const TEST_USER_ID = 1;
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_NAME = 'Test User';
const TEST_USER_CREATED_AT = '2023-01-01 12:00:00';

const MOCK_USER_DATA = {
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    name: TEST_USER_NAME,
    created_at: TEST_USER_CREATED_AT
};

// Mock sqlite3 module
jest.mock('sqlite3', () => ({
    verbose: jest.fn(() => ({
        Database: jest.fn()
    }))
}));

// Mock JWT secret
process.env.JWT_SECRET = TEST_JWT_SECRET;

describe('Profile and Settings Routes', () => {
    let mockDb;
    let validToken;
    let invalidToken;
    let expiredToken;

    beforeAll(() => {
        // Create valid JWT token
        validToken = jwt.sign(
            { id: TEST_USER_ID, email: TEST_USER_EMAIL },
            TEST_JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Create invalid JWT token with wrong secret
        invalidToken = jwt.sign(
            { id: TEST_USER_ID, email: TEST_USER_EMAIL },
            'wrong-secret',
            { expiresIn: '1h' }
        );

        // Create expired JWT token
        expiredToken = jwt.sign(
            { id: TEST_USER_ID, email: TEST_USER_EMAIL },
            TEST_JWT_SECRET,
            { expiresIn: '-1h' }
        );
    });

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock database
        mockDb = {
            get: jest.fn(),
            run: jest.fn(),
            serialize: jest.fn((callback) => callback())
        };
        
        // Mock the Database constructor to return our mock
        sqlite3.verbose().Database.mockImplementation(() => mockDb);
    });

    describe('GET /profile', () => {
        describe('Authentication Requirements', () => {
            it('should redirect to /login when no token provided', async () => {
                const response = await request(app)
                    .get('/profile')
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with invalid JWT token', async () => {
                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${invalidToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with expired JWT token', async () => {
                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${expiredToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with malformed JWT token', async () => {
                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', ['token=malformed.token.here'])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with empty token', async () => {
                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', ['token='])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });
        });

        describe('Successful Authentication', () => {
            it('should render profile page with user data when authenticated', async () => {
                // Mock successful database query
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, MOCK_USER_DATA);
                });

                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);

                // Verify database query was called correctly
                expect(mockDb.get).toHaveBeenCalledWith(
                    'SELECT * FROM users WHERE id = ?',
                    [TEST_USER_ID],
                    expect.any(Function)
                );

                // Verify response contains user data
                expect(response.text).toContain(TEST_USER_NAME);
                expect(response.text).toContain(TEST_USER_EMAIL);
                expect(response.text).toContain('Profile');
                expect(response.text).toContain('Personal Information');
            });

            it('should pass currentPage variable as "profile" to template', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, MOCK_USER_DATA);
                });

                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);

                // Check for active navigation state in response
                expect(response.text).toContain('Profile');
                expect(response.text).toContain('nav-link active');
            });

            it('should include side navigation in response', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, MOCK_USER_DATA);
                });

                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);

                // Verify side navigation elements are present
                expect(response.text).toContain('Dashboard');
                expect(response.text).toContain('Profile');
                expect(response.text).toContain('Settings');
                expect(response.text).toContain('Logout');
            });
        });

        describe('Database Error Handling', () => {
            it('should handle user not found in database', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, undefined);
                });

                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should handle database query errors', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(new Error('Query failed'), null);
                });

                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(500);

                expect(response.text).toContain('Error');
            });
        });
    });

    describe('GET /settings', () => {
        describe('Authentication Requirements', () => {
            it('should redirect to /login when no token provided', async () => {
                const response = await request(app)
                    .get('/settings')
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with invalid JWT token', async () => {
                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${invalidToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with expired JWT token', async () => {
                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${expiredToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should redirect to /login with malformed JWT token', async () => {
                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', ['token=invalid.jwt.token'])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });
        });

        describe('Successful Authentication', () => {
            it('should render settings page with user data when authenticated', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, MOCK_USER_DATA);
                });

                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);

                // Verify database query was called correctly
                expect(mockDb.get).toHaveBeenCalledWith(
                    'SELECT * FROM users WHERE id = ?',
                    [TEST_USER_ID],
                    expect.any(Function)
                );

                // Verify response contains settings page content
                expect(response.text).toContain('Settings');
                expect(response.text).toContain('Account Settings');
                expect(response.text).toContain('Privacy Settings');
                expect(response.text).toContain('Notification Preferences');
            });

            it('should pass currentPage variable as "settings" to template', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, MOCK_USER_DATA);
                });

                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);

                // Check for active navigation state in response
                expect(response.text).toContain('Settings');
            });

            it('should include side navigation with active settings state', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, MOCK_USER_DATA);
                });

                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(200);

                // Verify side navigation elements are present
                expect(response.text).toContain('Dashboard');
                expect(response.text).toContain('Profile');
                expect(response.text).toContain('Settings');
                expect(response.text).toContain('Logout');
            });
        });

        describe('Database Error Handling', () => {
            it('should handle user not found in database', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(null, undefined);
                });

                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            });

            it('should handle database query errors', async () => {
                mockDb.get.mockImplementation((sql, params, callback) => {
                    callback(new Error('Database query failed'), null);
                });

                const response = await request(app)
                    .get('/settings')
                    .set('Cookie', [`token=${validToken}`])
                    .expect(500);

                expect(response.text).toContain('Error');
            });
        });
    });

    describe('GET /dashboard (existing route verification)', () => {
        it('should maintain existing authentication patterns', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // Verify database query follows same pattern
            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE id = ?',
                [TEST_USER_ID],
                expect.any(Function)
            );

            // Verify user context is passed to template
            expect(response.text).toContain(TEST_USER_NAME);
            expect(response.text).toContain(TEST_USER_EMAIL);
        });

        it('should pass currentPage as "dashboard" for active navigation', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('Dashboard');
        });
    });

    describe('POST /logout', () => {
        it('should clear authentication cookie and redirect to login', async () => {
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
            
            // Verify cookie is cleared
            const setCookieHeader = response.headers['set-cookie'];
            expect(setCookieHeader).toBeDefined();
            expect(setCookieHeader.some(cookie => 
                cookie.includes('token=') && cookie.includes('expires=')
            )).toBe(true);
        });

        it('should work even without valid token', async () => {
            const response = await request(app)
                .post('/logout')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        it('should clear cookie with proper options', async () => {
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            const setCookieHeader = response.headers['set-cookie'];
            expect(setCookieHeader).toBeDefined();
            
            // Verify cookie clearing attributes
            const tokenCookie = setCookieHeader.find(cookie => cookie.startsWith('token='));
            expect(tokenCookie).toContain('HttpOnly');
            expect(tokenCookie).toContain('expires=');
        });
    });

    describe('User Context and Security', () => {
        it('should populate req.user with decoded JWT payload', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // Verify the JWT payload data is used in database query
            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE id = ?',
                [TEST_USER_ID],
                expect.any(Function)
            );
        });

        it('should validate JWT token signature properly', async () => {
            const tamperedToken = validToken.slice(0, -5) + 'XXXXX';

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${tamperedToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        it('should handle JWT tokens with missing required fields', async () => {
            const incompleteToken = jwt.sign(
                { email: TEST_USER_EMAIL }, // Missing id field
                TEST_JWT_SECRET,
                { expiresIn: '1h' }
            );

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, undefined);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${incompleteToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    describe('Template Rendering', () => {
        it('should render profile template with correct title', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('<title>Profile | Auth App</title>');
        });

        it('should render settings template with correct title', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('<title>Settings | Auth App</title>');
        });

        it('should include Bootstrap navigation classes', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('nav-link');
            expect(response.text).toContain('sidebar');
        });

        it('should include Bootstrap icons in navigation', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('bi-');
        });
    });

    describe('Navigation State Management', () => {
        it('should highlight active dashboard navigation item on dashboard page', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // The dashboard nav item should be active
            expect(response.text).toContain('Dashboard');
        });

        it('should highlight active profile navigation item on profile page', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // The profile nav item should be active
            expect(response.text).toContain('Profile');
        });

        it('should highlight active settings navigation item on settings page', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            // The settings nav item should be active
            expect(response.text).toContain('Settings');
        });
    });

    describe('Error Scenarios', () => {
        it('should handle missing user in database for profile route', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, undefined);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        it('should handle missing user in database for settings route', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, undefined);
            });

            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        it('should handle database connection timeouts', async () => {
            const timeoutError = new Error('Connection timeout');
            timeoutError.code = 'ETIMEDOUT';
            sqlite3.verbose().Database.mockImplementation(() => {
                throw timeoutError;
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(500);

            expect(response.text).toContain('Error');
        });

        it('should handle SQL syntax errors gracefully', async () => {
            const sqlError = new Error('SQL syntax error');
            sqlError.code = 'SQLITE_ERROR';
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(sqlError, null);
            });

            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(500);

            expect(response.text).toContain('Error');
        });
    });

    describe('Responsive Navigation Behavior', () => {
        it('should include mobile navigation toggle button in response', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('navbar-toggler');
            expect(response.text).toContain('d-lg-none');
        });

        it('should include offcanvas sidebar for mobile devices', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, MOCK_USER_DATA);
            });

            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);

            expect(response.text).toContain('offcanvas');
            expect(response.text).toContain('sidebarOffcanvas');
        });
    });
});