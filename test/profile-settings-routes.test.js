const request = require('supertest');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = require('../app');

// Test constants
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
const TEST_USER = {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    created_at: '2023-01-15 10:30:00'
};

// Mock sqlite3 database
let mockDb;

// Helper functions
function createValidToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function createExpiredToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        TEST_JWT_SECRET,
        { expiresIn: '-1h' }
    );
}

function createInvalidToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        'wrong-secret',
        { expiresIn: '1h' }
    );
}

describe('Profile and Settings Routes Authentication and Content Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock database
        mockDb = {
            get: jest.fn(),
            run: jest.fn(),
            serialize: jest.fn((callback) => callback()),
            close: jest.fn()
        };
        
        // Mock successful user lookup by default
        mockDb.get.mockImplementation((sql, params, callback) => {
            callback(null, TEST_USER);
        });
        
        // Mock the Database constructor
        sqlite3.Database = jest.fn(() => mockDb);
    });

    describe('TC-09: Profile Route Authentication Requirements', () => {
        test('should require authentication and redirect to login when no token provided', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);

            // AC-15: /profile route requires authentication and redirects to /login if not authenticated
            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login with expired JWT token', async () => {
            const expiredToken = createExpiredToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login with invalid JWT token', async () => {
            const invalidToken = createInvalidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${invalidToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login with malformed JWT token', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', ['token=malformed.token'])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when user not found in database', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null); // User not found
            });

            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    describe('TC-10: Settings Route Authentication Requirements', () => {
        test('should require authentication and redirect to login when no token provided', async () => {
            const response = await request(app)
                .get('/settings')
                .expect(302);

            // AC-16: /settings route requires authentication and redirects to /login if not authenticated
            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login with expired JWT token', async () => {
            const expiredToken = createExpiredToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login with invalid JWT token', async () => {
            const invalidToken = createInvalidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${invalidToken}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when user not found in database', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null); // User not found
            });

            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    describe('TC-11: Profile Page Content Display', () => {
        test('should display user name and email from database', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-11: Profile page displays user name and email from database
            // AC-21: User context (req.user) is properly passed to all new templates
            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain(TEST_USER.email);
            expect(response.text).toContain('Personal Information');
            expect(response.text).toContain('Profile');
        });

        test('should display formatted account creation date', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('Account Created');
            // Should contain formatted date
            expect(response.text).toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
        });

        test('should include profile-specific static content', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('Profile Picture');
            expect(response.text).toContain('Recent Activity');
            expect(response.text).toContain('Account Preferences');
            expect(response.text).toContain('Security & Privacy');
        });

        test('should set correct page title for Profile page', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-23: Page titles are set correctly for Profile and Settings pages
            expect(response.text).toContain('<title>Profile | Auth App</title>');
        });
    });

    describe('TC-12: Settings Page Content Display', () => {
        test('should display static placeholder content', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-12: Settings page displays static placeholder content
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Account Settings');
            expect(response.text).toContain('Privacy Settings');
            expect(response.text).toContain('Notification Preferences');
            expect(response.text).toContain('read-only placeholders');
        });

        test('should display user information in settings form fields', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain(TEST_USER.email);
            expect(response.text).toContain('Display Name');
            expect(response.text).toContain('Email Address');
        });

        test('should include disabled form controls indicating read-only state', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('readonly');
            expect(response.text).toContain('disabled');
        });

        test('should set correct page title for Settings page', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-23: Page titles are set correctly for Profile and Settings pages
            expect(response.text).toContain('<title>Settings | Auth App</title>');
        });
    });

    describe('TC-13: Dashboard Page Content Preservation', () => {
        test('should retain existing welcome message and user profile information', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-13: Dashboard page retains existing user information display
            expect(response.text).toContain('Welcome to your dashboard');
            expect(response.text).toContain('successfully logged in');
            expect(response.text).toContain('Profile Information');
            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain(TEST_USER.email);
        });

        test('should display user ID and member since date on dashboard', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('User ID');
            expect(response.text).toContain(TEST_USER.id.toString());
            expect(response.text).toContain('Member Since');
        });
    });

    describe('TC-14: Consistent Layout Usage', () => {
        test('should use consistent layout with side navigation across all authenticated pages', async () => {
            const token = createValidToken();
            
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-14: All pages use consistent layout with side navigation
            [dashboardResponse, profileResponse, settingsResponse].forEach(response => {
                expect(response.text).toContain('sidebar');
                expect(response.text).toContain('Dashboard');
                expect(response.text).toContain('Profile');
                expect(response.text).toContain('Settings');
                expect(response.text).toContain('Logout');
                expect(response.text).toContain('bootstrap');
            });
        });
    });

    describe('TC-15: Database Error Handling', () => {
        test('should handle database query errors for profile route', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(new Error('Database connection failed'), null);
            });

            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(302);

            // AC-22: Error handling for database queries works same as existing dashboard
            expect(response.headers.location).toBe('/login');
        });

        test('should handle database query errors for settings route', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(new Error('Database connection failed'), null);
            });

            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });
    });

    describe('TC-16: User Context Validation', () => {
        test('should verify JWT token payload contains correct user information', async () => {
            const token = createValidToken();
            
            await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Verify database query was called with correct user ID from token
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [TEST_USER.id],
                expect.any(Function)
            );
        });

        test('should pass user object with all required properties to templates', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Verify all user properties are accessible in template
            expect(response.text).toContain(TEST_USER.id.toString());
            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain(TEST_USER.email);
        });
    });

    describe('TC-17: Route Security Validation', () => {
        test('should verify authenticateToken middleware is applied to profile route', async () => {
            // Test without token
            const response = await request(app)
                .get('/profile')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should verify authenticateToken middleware is applied to settings route', async () => {
            // Test without token
            const response = await request(app)
                .get('/settings')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        test('should reject requests with tampered JWT tokens', async () => {
            const validToken = createValidToken();
            const tamperedToken = validToken.slice(0, -5) + 'XXXXX'; // Tamper with signature
            
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${tamperedToken}`])
                .expect(302);

            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${tamperedToken}`])
                .expect(302);

            expect(profileResponse.headers.location).toBe('/login');
            expect(settingsResponse.headers.location).toBe('/login');
        });
    });
});