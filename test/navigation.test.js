const request = require('supertest');
const app = require('../app');

// Test constants
const TEST_USER = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: new Date('2023-01-01')
};

const EXPECTED_SIDEBAR_ELEMENTS = {
    authenticated: ['Dashboard', 'Logout'],
    unauthenticated: ['Login', 'Sign Up']
};

const EXPECTED_ROUTES = {
    dashboard: '/dashboard',
    logout: '/logout',
    login: '/login',
    signup: '/signup',
    home: '/'
};

const SECURITY_HEADERS = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection'
];

describe('Navigation Functionality Tests', () => {
    let agent;

    beforeEach(() => {
        agent = request.agent(app);
    });

    describe('GET /logout - Route Rendering', () => {
        it('should render logout page with correct template variables when not authenticated', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);

            expect(response.text).toContain('Successfully logged out!');
            expect(response.text).toContain('Your session has been terminated');
            expect(response.text).toContain('Logout | Auth App');
            expect(response.text).toContain('Login');
            expect(response.text).toContain('Sign Up');
            expect(response.text).not.toContain('Dashboard');
        });

        it('should render logout page with all required template variables', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);

            // Check for title variable
            expect(response.text).toContain('<title>Logout | Auth App</title>');
            
            // Check for proper sidebar navigation based on authentication state
            expect(response.text).toContain('sidebar bg-primary');
            expect(response.text).toContain('Auth App');
            
            // Check for main content area
            expect(response.text).toContain('main-wrapper');
            expect(response.text).toContain('content-area');
        });

        it('should include security headers on logout route', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);

            SECURITY_HEADERS.forEach(header => {
                expect(response.headers).toHaveProperty(header);
            });
        });
    });

    describe('Dashboard Authentication and Redirect', () => {
        it('should redirect to login when accessing dashboard without authentication', async () => {
            const response = await agent
                .get('/dashboard')
                .expect(302);

            expect(response.headers.location).toBe('/login');
        });

        it('should render dashboard page when authenticated', async () => {
            // Mock authentication by setting session
            const authenticatedAgent = request.agent(app);
            
            // First login to establish session
            await authenticatedAgent
                .post('/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Then access dashboard
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);

            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Welcome back');
            expect(response.text).toContain('Dashboard | Auth App');
        });
    });

    describe('Navigation Link Visibility - Authenticated State', () => {
        let authenticatedAgent;

        beforeEach(async () => {
            authenticatedAgent = request.agent(app);
            // Mock successful login
            await authenticatedAgent
                .post('/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });
        });

        it('should show Dashboard and Logout links when authenticated', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);

            EXPECTED_SIDEBAR_ELEMENTS.authenticated.forEach(linkText => {
                expect(response.text).toContain(linkText);
            });

            // Should not show login/signup links
            expect(response.text).not.toContain('href="/login"');
            expect(response.text).not.toContain('href="/signup"');
        });

        it('should have correct href attributes for authenticated navigation links', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);

            expect(response.text).toContain('href="/dashboard"');
            expect(response.text).toContain('href="/logout"');
        });
    });

    describe('Navigation Link Visibility - Unauthenticated State', () => {
        it('should show Login and Sign Up links when not authenticated', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            EXPECTED_SIDEBAR_ELEMENTS.unauthenticated.forEach(linkText => {
                expect(response.text).toContain(linkText);
            });

            // Should not show dashboard/logout links
            expect(response.text).not.toContain('href="/dashboard"');
            expect(response.text).not.toContain('href="/logout"');
        });

        it('should have correct href attributes for unauthenticated navigation links', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            expect(response.text).toContain('href="/login"');
            expect(response.text).toContain('href="/signup"');
        });
    });

    describe('Navigation Link Href Attributes', () => {
        it('should have correct href attributes for all navigation routes', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Check brand link
            expect(response.text).toContain('href="/"');
            
            // Check navigation links
            expect(response.text).toContain('href="/login"');
            expect(response.text).toContain('href="/signup"');
        });

        it('should have accessible navigation attributes', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Check for ARIA attributes
            expect(response.text).toContain('role="navigation"');
            expect(response.text).toContain('aria-label="Main navigation"');
            expect(response.text).toContain('role="menubar"');
            expect(response.text).toContain('role="menuitem"');
            expect(response.text).toContain('aria-label="Auth App Home"');
        });
    });

    describe('User Context Middleware', () => {
        it('should set res.locals.user correctly when authenticated', async () => {
            const authenticatedAgent = request.agent(app);
            
            await authenticatedAgent
                .post('/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);

            // Check that user-specific content is rendered
            expect(response.text).toContain('Welcome back');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Logout');
        });

        it('should handle undefined user context gracefully', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Should show unauthenticated navigation
            expect(response.text).toContain('Login');
            expect(response.text).toContain('Sign Up');
            expect(response.text).not.toContain('Dashboard');
            expect(response.text).not.toContain('Logout');
        });
    });

    describe('Error Handling for Invalid Routes', () => {
        it('should handle 404 for non-existent routes', async () => {
            const response = await agent
                .get('/non-existent-route')
                .expect(404);

            expect(response.text).toContain('404') || expect(response.text).toContain('Not Found');
        });

        it('should maintain sidebar layout on error pages', async () => {
            const response = await agent
                .get('/non-existent-route')
                .expect(404);

            // Should still render the sidebar layout
            expect(response.text).toContain('sidebar bg-primary');
            expect(response.text).toContain('main-wrapper');
        });
    });

    describe('Security Headers on Navigation Routes', () => {
        const routes = ['/', '/login', '/signup', '/logout'];

        routes.forEach(route => {
            it(`should include security headers on ${route}`, async () => {
                const response = await agent
                    .get(route)
                    .expect(res => {
                        expect(res.status).toBeLessThan(500);
                    });

                SECURITY_HEADERS.forEach(header => {
                    expect(response.headers).toHaveProperty(header);
                });
            });
        });
    });

    describe('Template Rendering - Required Variables', () => {
        it('should render layout with all required variables for logout page', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);

            // Check title variable
            expect(response.text).toContain('<title>Logout | Auth App</title>');
            
            // Check that template renders without errors
            expect(response.text).not.toContain('ReferenceError');
            expect(response.text).not.toContain('TypeError');
            
            // Check sidebar structure
            expect(response.text).toContain('class="sidebar bg-primary text-white');
            expect(response.text).toContain('class="main-wrapper"');
        });

        it('should handle flash message variables correctly', async () => {
            // Test with potential error/success messages
            const response = await agent
                .get('/logout')
                .expect(200);

            // Should not throw errors when error/success variables are undefined
            expect(response.text).not.toContain('ReferenceError');
            expect(response.text).not.toContain('TypeError');
            
            // Should contain the flash message container structure
            expect(response.text).toContain('content-area');
        });

        it('should render navigation with proper Bootstrap classes', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Check for Bootstrap navigation classes
            expect(response.text).toContain('nav nav-pills flex-column');
            expect(response.text).toContain('nav-item');
            expect(response.text).toContain('nav-link');
            expect(response.text).toContain('d-flex align-items-center');
        });
    });

    describe('Layout Structure Validation', () => {
        it('should maintain proper CSS classes and layout structure', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Check sidebar CSS
            expect(response.text).toContain('width: 250px');
            expect(response.text).toContain('position: fixed');
            expect(response.text).toContain('margin-left: 250px');
            
            // Check layout structure
            expect(response.text).toContain('class="d-flex"');
            expect(response.text).toContain('class="sidebar bg-primary text-white d-flex flex-column"');
            expect(response.text).toContain('class="main-wrapper"');
            expect(response.text).toContain('class="content-area"');
        });

        it('should include Bootstrap and Bootstrap Icons CDN links', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            expect(response.text).toContain('bootstrap@5.3.0/dist/css/bootstrap.min.css');
            expect(response.text).toContain('bootstrap-icons@1.10.0/font/bootstrap-icons.css');
        });

        it('should have proper viewport and responsive meta tags', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            expect(response.text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
            expect(response.text).toContain('<meta charset="UTF-8">');
        });
    });

    describe('Sidebar Visibility and Collapsing Behavior', () => {
        it('should maintain sidebar visibility on all screen sizes', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Check that sidebar has fixed positioning and no media queries for hiding
            expect(response.text).toContain('position: fixed');
            expect(response.text).toContain('width: 250px');
            
            // Verify there are no Bootstrap collapse classes that would hide the sidebar
            expect(response.text).not.toContain('collapse');
            expect(response.text).not.toContain('d-none');
            expect(response.text).not.toContain('d-md-block');
        });

        it('should not contain responsive breakpoint classes that hide sidebar', async () => {
            const response = await agent
                .get('/')
                .expect(200);

            // Ensure sidebar doesn't use Bootstrap's responsive display utilities
            const sidebarSection = response.text.substring(
                response.text.indexOf('class="sidebar'),
                response.text.indexOf('</nav>')
            );
            
            expect(sidebarSection).not.toContain('d-none');
            expect(sidebarSection).not.toContain('d-sm-none');
            expect(sidebarSection).not.toContain('d-md-none');
            expect(sidebarSection).not.toContain('d-lg-none');
        });
    });
});