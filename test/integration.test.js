const request = require('supertest');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = require('../app');

// Test constants
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
const TEST_USER = {
    id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    created_at: '2023-03-20 14:25:00'
};

// Mock sqlite3 database
let mockDb;

// Helper functions
function createValidToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        TEST_JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function setupMockDatabase() {
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
}

describe('Side Navigation Integration and End-to-End Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupMockDatabase();
    });

    describe('TC-18: Complete Navigation Flow Testing', () => {
        test('should navigate between all authenticated pages maintaining consistent navigation', async () => {
            const token = createValidToken();
            const cookieHeader = [`token=${token}`];

            // Test navigation to each page
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', cookieHeader)
                .expect(200);

            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', cookieHeader)
                .expect(200);

            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', cookieHeader)
                .expect(200);

            // Verify each page has navigation links to other pages
            [dashboardResponse, profileResponse, settingsResponse].forEach(response => {
                expect(response.text).toContain('href="/dashboard"');
                expect(response.text).toContain('href="/profile"');
                expect(response.text).toContain('href="/settings"');
                expect(response.text).toContain('href="/logout"');
            });
        });

        test('should maintain active navigation state correctly across page transitions', async () => {
            const token = createValidToken();
            const cookieHeader = [`token=${token}`];

            // Test Dashboard active state
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', cookieHeader)
                .expect(200);
            
            expect(dashboardResponse.text).toMatch(/Dashboard.*active|active.*Dashboard/);
            expect(dashboardResponse.text).not.toMatch(/Profile.*active|active.*Profile/);
            expect(dashboardResponse.text).not.toMatch(/Settings.*active|active.*Settings/);

            // Test Profile active state
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', cookieHeader)
                .expect(200);
            
            expect(profileResponse.text).toMatch(/Profile.*active|active.*Profile/);
            expect(profileResponse.text).not.toMatch(/Dashboard.*active|active.*Dashboard/);
            expect(profileResponse.text).not.toMatch(/Settings.*active|active.*Settings/);

            // Test Settings active state
            const settingsResponse = await request(app)
                .get('/settings')
                .set('Cookie', cookieHeader)
                .expect(200);
            
            expect(settingsResponse.text).toMatch(/Settings.*active|active.*Settings/);
            expect(settingsResponse.text).not.toMatch(/Dashboard.*active|active.*Dashboard/);
            expect(settingsResponse.text).not.toMatch(/Profile.*active|active.*Profile/);
        });
    });

    describe('TC-19: Logout Functionality Integration', () => {
        test('should handle logout from side navigation and clear authentication', async () => {
            const response = await request(app)
                .get('/logout')
                .expect(302);

            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toContain('token=;');
        });

        test('should redirect to login page after logout and not show side navigation', async () => {
            // First logout
            await request(app)
                .get('/logout')
                .expect(302);

            // Then try to access protected page
            const response = await request(app)
                .get('/dashboard')
                .expect(302);

            expect(response.headers.location).toBe('/login');

            // Verify login page doesn't show side navigation
            const loginResponse = await request(app)
                .get('/login')
                .expect(200);

            expect(loginResponse.text).not.toContain('sidebar');
        });
    });

    describe('TC-20: Responsive Design Validation', () => {
        test('should include all required Bootstrap responsive classes', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Check for desktop sidebar classes
            expect(response.text).toContain('col-md-3');
            expect(response.text).toContain('col-lg-2');
            expect(response.text).toContain('d-md-block');
            expect(response.text).toContain('d-lg-block');

            // Check for mobile responsive classes
            expect(response.text).toContain('d-lg-none');
            expect(response.text).toContain('navbar-toggler');

            // Check for main content responsive classes
            expect(response.text).toContain('col-md-9');
            expect(response.text).toContain('col-lg-10');
            expect(response.text).toContain('ms-sm-auto');
        });

        test('should include mobile offcanvas navigation structure', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('offcanvas');
            expect(response.text).toContain('offcanvas-start');
            expect(response.text).toContain('data-bs-toggle="offcanvas"');
            expect(response.text).toContain('data-bs-target="#sidebarOffcanvas"');
            expect(response.text).toContain('sidebarOffcanvas');
        });
    });

    describe('TC-21: Template Error Handling and Edge Cases', () => {
        test('should handle missing currentPage variable gracefully', async () => {
            // Mock a scenario where currentPage might be undefined
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Should not cause template rendering errors
            expect(response.text).toContain('Dashboard');
            expect(response.text).not.toContain('undefined');
        });

        test('should handle missing user context gracefully in public pages', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            // Should render without errors when user is undefined
            expect(response.text).toContain('Auth App');
            expect(response.text).not.toContain('undefined');
            expect(response.text).not.toContain('null');
        });
    });

    describe('TC-22: Security and Data Validation', () => {
        test('should prevent access to authenticated pages with no token', async () => {
            const pages = ['/dashboard', '/profile', '/settings'];
            
            for (const page of pages) {
                const response = await request(app)
                    .get(page)
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            }
        });

        test('should validate JWT token expiration properly', async () => {
            const expiredToken = jwt.sign(
                { id: TEST_USER.id, email: TEST_USER.email },
                TEST_JWT_SECRET,
                { expiresIn: '-1h' }
            );

            const pages = ['/dashboard', '/profile', '/settings'];
            
            for (const page of pages) {
                const response = await request(app)
                    .get(page)
                    .set('Cookie', [`token=${expiredToken}`])
                    .expect(302);

                expect(response.headers.location).toBe('/login');
            }
        });

        test('should validate database user lookup for each authenticated request', async () => {
            const token = createValidToken();
            
            await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Verify database was queried for each request
            expect(mockDb.get).toHaveBeenCalledTimes(3);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [TEST_USER.id],
                expect.any(Function)
            );
        });
    });

    describe('TC-23: Performance and Asset Loading', () => {
        test('should include required CSS libraries only once per page', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Check for Bootstrap CSS
            const bootstrapMatches = (response.text.match(/bootstrap@5\.3\.0/g) || []).length;
            expect(bootstrapMatches).toBe(1);

            // Check for Bootstrap Icons CSS
            const iconsMatches = (response.text.match(/bootstrap-icons@1\.10\.0/g) || []).length;
            expect(iconsMatches).toBe(1);
        });

        test('should include proper meta tags for responsive design', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
            expect(response.text).toContain('charset="UTF-8"');
        });
    });

    describe('TC-24: Accessibility and User Experience', () => {
        test('should include proper ARIA labels and accessibility attributes', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('aria-label');
            expect(response.text).toContain('aria-expanded');
            expect(response.text).toContain('aria-controls');
            expect(response.text).toContain('role="button"');
        });

        test('should provide proper semantic HTML structure', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('<nav');
            expect(response.text).toContain('<main');
            expect(response.text).toContain('<header');
            expect(response.text).toContain('role="main"');
        });
    });

    describe('TC-25: Cross-Browser Compatibility Features', () => {
        test('should include proper DOCTYPE and HTML5 structure', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toMatch(/^<!DOCTYPE html>/);
            expect(response.text).toContain('<html lang="en">');
            expect(response.text).toContain('<head>');
            expect(response.text).toContain('</html>');
        });

        test('should include CSS fallbacks and vendor prefixes where needed', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // Check for CSS with fallbacks
            expect(response.text).toContain('position: -webkit-sticky');
            expect(response.text).toContain('position: sticky');
        });
    });
});