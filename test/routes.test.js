const request = require('supertest');
const app = require('../app');

// Test constants
const TEST_ROUTES = {
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    SETTINGS: '/settings',
    LOGIN: '/login',
    LOGOUT: '/logout',
    HOME: '/'
};

const HTTP_STATUS = {
    OK: 200,
    FOUND: 302,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404
};

const SIDEBAR_NAVIGATION_ITEMS = {
    DASHBOARD: {
        href: '/dashboard',
        icon: 'bi-house',
        text: 'Dashboard'
    },
    PROFILE: {
        href: '/profile',
        icon: 'bi-person',
        text: 'Profile'
    },
    SETTINGS: {
        href: '/settings',
        icon: 'bi-gear',
        text: 'Settings'
    }
};

const MOCK_USER = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: new Date('2023-01-01').toISOString()
};

describe('Sidebar Navigation Routes', () => {
    let agent;

    beforeEach(() => {
        agent = request.agent(app);
    });

    describe('Authentication Requirements', () => {
        test('should redirect unauthenticated user from dashboard to login', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.FOUND);
            expect(response.headers.location).toBe(TEST_ROUTES.LOGIN);
        });

        test('should redirect unauthenticated user from profile to login', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.FOUND);
            expect(response.headers.location).toBe(TEST_ROUTES.LOGIN);
        });

        test('should redirect unauthenticated user from settings to login', async () => {
            const response = await agent.get(TEST_ROUTES.SETTINGS);
            
            expect(response.status).toBe(HTTP_STATUS.FOUND);
            expect(response.headers.location).toBe(TEST_ROUTES.LOGIN);
        });
    });

    describe('Authenticated Dashboard Route', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should render dashboard with sidebar layout for authenticated user', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('main-content');
            expect(response.text).toContain(`Welcome back, ${MOCK_USER.name}!`);
        });

        test('should display navigation menu items in sidebar', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            
            // Check for navigation items
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.DASHBOARD.href);
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.DASHBOARD.icon);
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.DASHBOARD.text);
            
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.PROFILE.href);
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.PROFILE.icon);
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.PROFILE.text);
            
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.SETTINGS.href);
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.SETTINGS.icon);
            expect(response.text).toContain(SIDEBAR_NAVIGATION_ITEMS.SETTINGS.text);
        });

        test('should display user information in dashboard', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain(MOCK_USER.name);
            expect(response.text).toContain(MOCK_USER.email);
            expect(response.text).toContain(`User ID: ${MOCK_USER.id}`);
        });

        test('should contain logout functionality in sidebar', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('logout');
            expect(response.text).toContain('bi-box-arrow-right');
        });

        test('should have active dashboard menu item', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toMatch(/nav-link[^>]*active[^>]*href="\/dashboard"/);
        });
    });

    describe('Authenticated Profile Route', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should render profile page with sidebar layout for authenticated user', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('main-content');
            expect(response.text).toContain('<h1 class="h3 mb-0">');
            expect(response.text).toContain('bi-person-circle');
        });

        test('should display user profile information', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain(MOCK_USER.name);
            expect(response.text).toContain(MOCK_USER.email);
            expect(response.text).toContain(`#${MOCK_USER.id}`);
        });

        test('should have active profile menu item', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toMatch(/nav-link[^>]*active[^>]*href="\/profile"/);
        });

        test('should contain profile editing form', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('editProfileForm');
            expect(response.text).toContain('firstName');
            expect(response.text).toContain('lastName');
        });
    });

    describe('Authenticated Settings Route', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should render settings page with sidebar layout for authenticated user', async () => {
            const response = await agent.get(TEST_ROUTES.SETTINGS);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('main-content');
            expect(response.text).toContain('<h1 class="h3 mb-0">');
            expect(response.text).toContain('bi-gear');
        });

        test('should display account settings sections', async () => {
            const response = await agent.get(TEST_ROUTES.SETTINGS);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('Account Settings');
            expect(response.text).toContain('Privacy Settings');
            expect(response.text).toContain('Notification Preferences');
            expect(response.text).toContain('Security Settings');
        });

        test('should have active settings menu item', async () => {
            const response = await agent.get(TEST_ROUTES.SETTINGS);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toMatch(/nav-link[^>]*active[^>]*href="\/settings"/);
        });

        test('should contain settings forms and controls', async () => {
            const response = await agent.get(TEST_ROUTES.SETTINGS);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('form-control');
            expect(response.text).toContain('form-check');
            expect(response.text).toContain('btn-primary');
        });
    });

    describe('Logout Functionality', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should logout user and redirect to home page', async () => {
            const response = await agent.post(TEST_ROUTES.LOGOUT);
            
            expect(response.status).toBe(HTTP_STATUS.FOUND);
            expect(response.headers.location).toBe(TEST_ROUTES.HOME);
        });

        test('should clear session after logout', async () => {
            // Logout
            await agent.post(TEST_ROUTES.LOGOUT);
            
            // Try to access protected route
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.FOUND);
            expect(response.headers.location).toBe(TEST_ROUTES.LOGIN);
        });
    });

    describe('Navigation Menu Consistency', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should have consistent navigation menu across all pages', async () => {
            const pages = [TEST_ROUTES.DASHBOARD, TEST_ROUTES.PROFILE, TEST_ROUTES.SETTINGS];
            
            for (const page of pages) {
                const response = await agent.get(page);
                
                expect(response.status).toBe(HTTP_STATUS.OK);
                
                // Check all navigation items are present
                Object.values(SIDEBAR_NAVIGATION_ITEMS).forEach(item => {
                    expect(response.text).toContain(item.href);
                    expect(response.text).toContain(item.icon);
                    expect(response.text).toContain(item.text);
                });
            }
        });

        test('should have proper user information in header across all pages', async () => {
            const pages = [TEST_ROUTES.DASHBOARD, TEST_ROUTES.PROFILE, TEST_ROUTES.SETTINGS];
            
            for (const page of pages) {
                const response = await agent.get(page);
                
                expect(response.status).toBe(HTTP_STATUS.OK);
                expect(response.text).toContain(MOCK_USER.name);
                expect(response.text).toContain('sidebar-header');
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid route gracefully', async () => {
            const response = await agent.get('/invalid-route');
            
            expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
        });

        test('should handle malformed authentication data', async () => {
            // Attempt to access protected route with invalid session
            const response = await request(app)
                .get(TEST_ROUTES.DASHBOARD)
                .set('Cookie', 'invalid-session-cookie');
            
            expect(response.status).toBe(HTTP_STATUS.FOUND);
            expect(response.headers.location).toBe(TEST_ROUTES.LOGIN);
        });

        test('should handle missing user data gracefully', async () => {
            // Mock authentication with minimal user data
            await agent
                .post('/login')
                .send({
                    email: 'minimal@example.com',
                    password: 'password123'
                });

            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).not.toContain('undefined');
            expect(response.text).not.toContain('null');
        });
    });

    describe('Responsive Layout', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should include responsive CSS classes', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar-toggle');
            expect(response.text).toContain('collapsed');
            expect(response.text).toContain('@media (max-width: 768px)');
        });

        test('should include Bootstrap responsive classes', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('col-md-');
            expect(response.text).toContain('d-grid');
            expect(response.text).toContain('g-3');
        });
    });

    describe('Security Validation', () => {
        test('should sanitize user input in templates', async () => {
            // Mock authentication with potentially malicious data
            const maliciousUser = {
                ...MOCK_USER,
                name: '<script>alert("xss")</script>Test User'
            };

            await agent
                .post('/login')
                .send({
                    email: maliciousUser.email,
                    password: 'password123'
                });

            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).not.toContain('<script>');
            expect(response.text).not.toContain('alert("xss")');
        });

        test('should protect against session fixation', async () => {
            const firstResponse = await agent.get(TEST_ROUTES.DASHBOARD);
            const initialSessionId = firstResponse.headers['set-cookie'];

            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });

            const secondResponse = await agent.get(TEST_ROUTES.DASHBOARD);
            const newSessionId = secondResponse.headers['set-cookie'];

            // Session should be different after login
            expect(newSessionId).not.toEqual(initialSessionId);
        });
    });

    describe('Template Data Integrity', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should pass correct user data to dashboard template', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain(`Name: ${MOCK_USER.name}`);
            expect(response.text).toContain(`Email: ${MOCK_USER.email}`);
            expect(response.text).toContain(`User ID: ${MOCK_USER.id}`);
        });

        test('should pass correct user data to profile template', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain(MOCK_USER.name);
            expect(response.text).toContain(MOCK_USER.email);
            expect(response.text).toContain(`#${MOCK_USER.id}`);
        });

        test('should handle missing optional user fields', async () => {
            const response = await agent.get(TEST_ROUTES.PROFILE);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('Not provided');
            expect(response.text).toContain('Not specified');
        });
    });

    describe('Mobile Responsive Sidebar', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should include sidebar toggle button for mobile', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar-toggle');
            expect(response.text).toContain('btn-toggle');
            expect(response.text).toContain('bi-list');
        });

        test('should have mobile-specific CSS media queries', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('@media (max-width: 768px)');
            expect(response.text).toMatch(/\.sidebar.*position:.*fixed/);
            expect(response.text).toMatch(/\.sidebar-overlay/);
        });

        test('should include Bootstrap CSS framework integration', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('bootstrap@5.3.0');
            expect(response.text).toContain('bootstrap-icons');
            expect(response.text).toContain('d-none d-md-block');
            expect(response.text).toContain('d-block d-md-none');
        });

        test('should have collapsible sidebar functionality', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar.collapsed');
            expect(response.text).toContain('--sidebar-collapsed-width');
            expect(response.text).toContain('transition: all 0.3s');
        });

        test('should include sidebar overlay for mobile devices', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('sidebar-overlay');
            expect(response.text).toContain('position: fixed');
            expect(response.text).toContain('background-color: rgba(0,0,0,0.5)');
            expect(response.text).toContain('z-index: 999');
        });

        test('should maintain active menu highlighting on mobile', async () => {
            const pages = [
                { route: TEST_ROUTES.DASHBOARD, expectedActive: 'dashboard' },
                { route: TEST_ROUTES.PROFILE, expectedActive: 'profile' },
                { route: TEST_ROUTES.SETTINGS, expectedActive: 'settings' }
            ];

            for (const page of pages) {
                const response = await agent.get(page.route);
                
                expect(response.status).toBe(HTTP_STATUS.OK);
                expect(response.text).toMatch(new RegExp(`nav-link[^>]*active[^>]*href="${page.route}"`));
                expect(response.text).toContain(`currentPage: '${page.expectedActive}'`);
            }
        });
    });

    describe('Sidebar Toggle Functionality', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should include JavaScript for sidebar toggle', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('toggleSidebar');
            expect(response.text).toContain('addEventListener');
            expect(response.text).toContain('classList.toggle');
        });

        test('should handle sidebar state persistence', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('localStorage');
            expect(response.text).toContain('sidebarCollapsed');
            expect(response.text).toContain('JSON.parse');
        });

        test('should include proper ARIA attributes for accessibility', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('aria-expanded');
            expect(response.text).toContain('aria-controls');
            expect(response.text).toContain('role="button"');
            expect(response.text).toContain('aria-label');
        });
    });

    describe('Cross-browser Compatibility', () => {
        beforeEach(async () => {
            // Mock authentication
            await agent
                .post('/login')
                .send({
                    email: MOCK_USER.email,
                    password: 'password123'
                });
        });

        test('should include vendor prefixes for CSS transitions', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('-webkit-transition');
            expect(response.text).toContain('-moz-transition');
            expect(response.text).toContain('-o-transition');
        });

        test('should use fallback fonts for better compatibility', async () => {
            const response = await agent.get(TEST_ROUTES.DASHBOARD);
            
            expect(response.status).toBe(HTTP_STATUS.OK);
            expect(response.text).toContain('font-family');
            expect(response.text).toMatch(/Arial|Helvetica|sans-serif/);
        });
    });
});