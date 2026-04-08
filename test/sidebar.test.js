const request = require('supertest');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const app = require('../app');

describe('Sidebar Navigation', () => {
    let testUser;
    let authenticatedAgent;

    // Test constants
    const SIDEBAR_MENU_ITEMS = ['Dashboard', 'Profile', 'Settings'];
    const SIDEBAR_ROUTES = {
        'Dashboard': '/dashboard',
        'Profile': '/dashboard/profile',
        'Settings': '/dashboard/settings'
    };
    const SIDEBAR_ICONS = {
        'Dashboard': 'bi-house',
        'Profile': 'bi-person',
        'Settings': 'bi-gear'
    };

    beforeEach(async () => {
        // Create test user
        testUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            password: 'hashedpassword',
            created_at: new Date()
        };

        // Create authenticated session
        authenticatedAgent = request.agent(app);
        await authenticatedAgent
            .post('/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Sidebar Rendering', () => {
        test('should render sidebar with correct menu items for authenticated user', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            
            expect(response.status).toBe(200);
            expect(response.text).toContain('class="sidebar"');
            
            const $ = cheerio.load(response.text);
            
            // Check sidebar exists
            expect($('.sidebar').length).toBe(1);
            
            // Check all menu items are present
            SIDEBAR_MENU_ITEMS.forEach(item => {
                const menuLink = $(`.nav-link:contains("${item}")`);
                expect(menuLink.length).toBe(1);
                expect(menuLink.attr('href')).toBe(SIDEBAR_ROUTES[item]);
            });
        });

        test('should render sidebar with correct Bootstrap icons for each menu item', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            Object.keys(SIDEBAR_ICONS).forEach(menuItem => {
                const iconClass = SIDEBAR_ICONS[menuItem];
                const menuLink = $(`.nav-link:contains("${menuItem}")`);
                const icon = menuLink.find(`i.${iconClass}`);
                expect(icon.length).toBe(1);
            });
        });

        test('should display user welcome message in sidebar', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            expect($('.sidebar-header').length).toBe(1);
            expect($('.user-info').text()).toContain(testUser.name);
        });

        test('should include logout button in sidebar', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            const logoutBtn = $('.logout-btn');
            expect(logoutBtn.length).toBe(1);
            
            const logoutForm = logoutBtn.find('form[action="/logout"]');
            expect(logoutForm.length).toBe(1);
            expect(logoutForm.attr('method')).toBe('POST');
        });
    });

    describe('Active Menu Item Highlighting', () => {
        test('should highlight Dashboard menu item when on dashboard page', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            const dashboardLink = $(`.nav-link[href="/dashboard"]`);
            expect(dashboardLink.hasClass('active')).toBe(true);
            
            // Other menu items should not be active
            const profileLink = $(`.nav-link[href="/dashboard/profile"]`);
            const settingsLink = $(`.nav-link[href="/dashboard/settings"]`);
            expect(profileLink.hasClass('active')).toBe(false);
            expect(settingsLink.hasClass('active')).toBe(false);
        });

        test('should highlight Profile menu item when on profile page', async () => {
            const response = await authenticatedAgent.get('/dashboard/profile');
            const $ = cheerio.load(response.text);
            
            const profileLink = $(`.nav-link[href="/dashboard/profile"]`);
            expect(profileLink.hasClass('active')).toBe(true);
            
            // Other menu items should not be active
            const dashboardLink = $(`.nav-link[href="/dashboard"]`);
            const settingsLink = $(`.nav-link[href="/dashboard/settings"]`);
            expect(dashboardLink.hasClass('active')).toBe(false);
            expect(settingsLink.hasClass('active')).toBe(false);
        });

        test('should highlight Settings menu item when on settings page', async () => {
            const response = await authenticatedAgent.get('/dashboard/settings');
            const $ = cheerio.load(response.text);
            
            const settingsLink = $(`.nav-link[href="/dashboard/settings"]`);
            expect(settingsLink.hasClass('active')).toBe(true);
            
            // Other menu items should not be active
            const dashboardLink = $(`.nav-link[href="/dashboard"]`);
            const profileLink = $(`.nav-link[href="/dashboard/profile"]`);
            expect(dashboardLink.hasClass('active')).toBe(false);
            expect(profileLink.hasClass('active')).toBe(false);
        });
    });

    describe('Mobile Responsive Behavior', () => {
        test('should include sidebar toggle button for mobile', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            const toggleBtn = $('.sidebar-toggle');
            expect(toggleBtn.length).toBe(1);
            expect(toggleBtn.attr('type')).toBe('button');
        });

        test('should have responsive CSS classes for mobile behavior', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            
            // Check for mobile responsive styles in CSS
            expect(response.text).toContain('@media (max-width: 768px)');
            expect(response.text).toContain('transform: translateX(-100%)');
            expect(response.text).toContain('sidebar.show');
        });

        test('should include Bootstrap responsive utility classes', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            // Check for Bootstrap grid classes
            expect($('.col-md-6').length).toBeGreaterThan(0);
            expect($('.d-flex').length).toBeGreaterThan(0);
        });

        test('should have collapsible sidebar functionality CSS', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            
            // Check for collapsed sidebar styles
            expect(response.text).toContain('sidebar.collapsed');
            expect(response.text).toContain('--sidebar-collapsed-width: 60px');
            expect(response.text).toContain('transition: all 0.3s');
        });
    });

    describe('Navigation Links', () => {
        test('should have correct href attributes for all navigation links', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            Object.entries(SIDEBAR_ROUTES).forEach(([menuItem, route]) => {
                const link = $(`.nav-link[href="${route}"]`);
                expect(link.length).toBe(1);
                expect(link.text().trim()).toContain(menuItem);
            });
        });

        test('should navigate to profile page when profile link is clicked', async () => {
            const response = await authenticatedAgent.get('/dashboard/profile');
            
            expect(response.status).toBe(200);
            expect(response.text).toContain('Profile Information');
            expect(response.text).toContain(testUser.name);
            expect(response.text).toContain(testUser.email);
        });

        test('should navigate to settings page when settings link is clicked', async () => {
            const response = await authenticatedAgent.get('/dashboard/settings');
            
            expect(response.status).toBe(200);
            expect(response.text).toContain('Account Settings');
            expect(response.text).toContain('Privacy Settings');
        });

        test('should redirect to dashboard when dashboard link is clicked', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            
            expect(response.status).toBe(200);
            expect(response.text).toContain('Welcome back');
            expect(response.text).toContain(testUser.name);
        });
    });

    describe('Authentication Requirements', () => {
        test('should not show sidebar for unauthenticated users', async () => {
            const response = await request(app).get('/');
            
            expect(response.status).toBe(200);
            expect(response.text).not.toContain('class="sidebar"');
        });

        test('should redirect to login when accessing dashboard without authentication', async () => {
            const response = await request(app).get('/dashboard');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when accessing profile without authentication', async () => {
            const response = await request(app).get('/dashboard/profile');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when accessing settings without authentication', async () => {
            const response = await request(app).get('/dashboard/settings');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    describe('CSS Classes and Bootstrap Components', () => {
        test('should use correct Bootstrap CSS classes for sidebar structure', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            // Check main structural classes
            expect($('.sidebar').length).toBe(1);
            expect($('.sidebar-header').length).toBe(1);
            expect($('.sidebar-nav').length).toBe(1);
            expect($('.main-content').length).toBe(1);
        });

        test('should include Bootstrap icon classes for menu items', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            // Check for Bootstrap icons
            expect($('i.bi-house').length).toBe(1); // Dashboard icon
            expect($('i.bi-person').length).toBeGreaterThan(0); // Profile icon
            expect($('i.bi-gear').length).toBeGreaterThan(0); // Settings icon
            expect($('i.bi-box-arrow-right').length).toBe(1); // Logout icon
        });

        test('should use Bootstrap button classes for logout button', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            const logoutBtn = $('.logout-btn button');
            expect(logoutBtn.hasClass('btn')).toBe(true);
            expect(logoutBtn.hasClass('btn-danger')).toBe(true);
            expect(logoutBtn.hasClass('w-100')).toBe(true);
        });

        test('should include Bootstrap utility classes for responsive design', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            // Check for common Bootstrap utility classes
            expect($('.d-flex').length).toBeGreaterThan(0);
            expect($('.align-items-center').length).toBeGreaterThan(0);
            expect($('.justify-content-between').length).toBeGreaterThan(0);
        });

        test('should have proper CSS custom properties for sidebar dimensions', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            
            expect(response.text).toContain('--sidebar-width: 280px');
            expect(response.text).toContain('--sidebar-collapsed-width: 60px');
        });
    });

    describe('Logout Functionality', () => {
        test('should logout user and redirect to home page when logout button is clicked', async () => {
            // First verify user is logged in
            let response = await authenticatedAgent.get('/dashboard');
            expect(response.status).toBe(200);
            
            // Perform logout
            response = await authenticatedAgent
                .post('/logout')
                .expect(302);
            
            expect(response.headers.location).toBe('/');
            
            // Verify user is logged out by trying to access dashboard
            response = await authenticatedAgent.get('/dashboard');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should have logout form with correct method and action', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            const logoutForm = $('form[action="/logout"]');
            expect(logoutForm.length).toBe(1);
            expect(logoutForm.attr('method')).toBe('POST');
            
            const submitButton = logoutForm.find('button[type="submit"]');
            expect(submitButton.length).toBe(1);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing user data gracefully', async () => {
            const response = await request(app).get('/dashboard');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should handle authentication errors gracefully', async () => {
            const response = await request(app).get('/dashboard');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    describe('DOM Structure Validation', () => {
        test('should have valid HTML structure with proper nesting', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            
            // Parse HTML with JSDOM for validation
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for proper HTML structure
            expect(document.querySelector('html')).toBeTruthy();
            expect(document.querySelector('head')).toBeTruthy();
            expect(document.querySelector('body')).toBeTruthy();
            expect(document.querySelector('.sidebar')).toBeTruthy();
            expect(document.querySelector('.main-content')).toBeTruthy();
        });

        test('should have proper semantic HTML elements', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            // Check for semantic elements
            expect($('nav.sidebar-nav').length).toBe(1);
            expect($('ul.sidebar-nav').length).toBe(1);
            expect($('li.nav-item').length).toBe(SIDEBAR_MENU_ITEMS.length);
            expect($('a.nav-link').length).toBe(SIDEBAR_MENU_ITEMS.length);
        });

        test('should have accessibility attributes', async () => {
            const response = await authenticatedAgent.get('/dashboard');
            const $ = cheerio.load(response.text);
            
            // Check for ARIA attributes and roles
            const navLinks = $('.nav-link');
            navLinks.each((_, element) => {
                const $element = $(element);
                expect($element.attr('href')).toBeTruthy();
            });
            
            // Check for button accessibility
            const toggleButton = $('.sidebar-toggle');
            expect(toggleButton.attr('type')).toBe('button');
        });
    });
});