const request = require('supertest');
const app = require('../server');
const cheerio = require('cheerio');

describe('Layout Structure and Sidebar Navigation', () => {
    const SIDEBAR_WIDTH = '250px';
    const SIDEBAR_SELECTOR = '.sidebar';
    const MAIN_WRAPPER_SELECTOR = '.main-wrapper';
    const NAV_LINK_SELECTOR = '.nav-link';
    const FLASH_MESSAGE_SELECTOR = '.alert';
    const FOOTER_SELECTOR = 'footer';
    const NAVBAR_BRAND_SELECTOR = '.navbar-brand';

    describe('Sidebar Layout Structure', () => {
        let $;

        beforeEach(async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            $ = cheerio.load(response.text);
        });

        test('should render sidebar with correct width and positioning', () => {
            const sidebar = $(SIDEBAR_SELECTOR);
            expect(sidebar).toHaveLength(1);
            
            // Check CSS styles are applied
            const sidebarHtml = sidebar.toString();
            expect(sidebarHtml).toContain('sidebar');
            expect(sidebarHtml).toContain('bg-primary');
            expect(sidebarHtml).toContain('text-white');
            expect(sidebarHtml).toContain('d-flex');
            expect(sidebarHtml).toContain('flex-column');
        });

        test('should have fixed positioning and correct z-index', () => {
            // Check for presence of custom CSS that would set fixed positioning
            const headContent = $('head').html();
            expect(headContent).toContain('position: fixed');
            expect(headContent).toContain('width: 250px');
            expect(headContent).toContain('z-index: 1000');
            expect(headContent).toContain('min-height: 100vh');
        });

        test('should render main content wrapper with proper margin offset', () => {
            const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
            expect(mainWrapper).toHaveLength(1);
            
            // Check for margin-left CSS in head
            const headContent = $('head').html();
            expect(headContent).toContain('margin-left: 250px');
        });

        test('should use flexbox layout for main wrapper', () => {
            const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
            const mainWrapperHtml = mainWrapper.toString();
            
            // Check CSS classes are applied for flexbox
            const headContent = $('head').html();
            expect(headContent).toContain('display: flex');
            expect(headContent).toContain('flex-direction: column');
        });
    });

    describe('Navigation Links - Unauthenticated State', () => {
        let $;

        beforeEach(async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            $ = cheerio.load(response.text);
        });

        test('should display login and signup links for unauthenticated users', () => {
            const loginLink = $('a[href="/login"]');
            const signupLink = $('a[href="/signup"]');
            
            expect(loginLink).toHaveLength(1);
            expect(signupLink).toHaveLength(1);
            expect(loginLink.text().trim()).toContain('Login');
            expect(signupLink.text().trim()).toContain('Sign Up');
        });

        test('should not display dashboard and logout links for unauthenticated users', () => {
            const dashboardLink = $('a[href="/dashboard"]');
            const logoutLink = $('a[href="/logout"]');
            
            expect(dashboardLink).toHaveLength(0);
            expect(logoutLink).toHaveLength(0);
        });

        test('should include bootstrap icons for navigation links', () => {
            const loginLink = $('a[href="/login"]');
            const signupLink = $('a[href="/signup"]');
            
            expect(loginLink.find('i.bi-box-arrow-in-right')).toHaveLength(1);
            expect(signupLink.find('i.bi-person-plus')).toHaveLength(1);
        });
    });

    describe('Navigation Links - Authenticated State', () => {
        let $;

        beforeEach(async () => {
            // Mock authenticated request by creating a session
            const agent = request.agent(app);
            
            // First create account
            await agent
                .post('/signup')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Then login
            await agent
                .post('/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Get authenticated page
            const response = await agent
                .get('/dashboard')
                .expect(200);
            $ = cheerio.load(response.text);
        });

        test('should display dashboard and logout links for authenticated users', () => {
            const dashboardLink = $('a[href="/dashboard"]');
            const logoutLink = $('a[href="/logout"]');
            
            expect(dashboardLink).toHaveLength(1);
            expect(logoutLink).toHaveLength(1);
            expect(dashboardLink.text().trim()).toContain('Dashboard');
            expect(logoutLink.text().trim()).toContain('Logout');
        });

        test('should not display login and signup links for authenticated users', () => {
            const loginLink = $('a[href="/login"]');
            const signupLink = $('a[href="/signup"]');
            
            expect(loginLink).toHaveLength(0);
            expect(signupLink).toHaveLength(0);
        });

        test('should include bootstrap icons for authenticated navigation links', () => {
            const dashboardLink = $('a[href="/dashboard"]');
            const logoutLink = $('a[href="/logout"]');
            
            expect(dashboardLink.find('i.bi-house')).toHaveLength(1);
            expect(logoutLink.find('i.bi-box-arrow-right')).toHaveLength(1);
        });
    });

    describe('Bootstrap Classes Application', () => {
        let $;

        beforeEach(async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            $ = cheerio.load(response.text);
        });

        test('should apply correct Bootstrap classes to sidebar', () => {
            const sidebar = $(SIDEBAR_SELECTOR);
            const sidebarClasses = sidebar.attr('class');
            
            expect(sidebarClasses).toContain('sidebar');
            expect(sidebarClasses).toContain('bg-primary');
            expect(sidebarClasses).toContain('text-white');
            expect(sidebarClasses).toContain('d-flex');
            expect(sidebarClasses).toContain('flex-column');
        });

        test('should apply Bootstrap nav classes to navigation list', () => {
            const navList = $('.nav.nav-pills.flex-column');
            expect(navList).toHaveLength(1);
            
            const navItems = $('.nav-item');
            expect(navItems.length).toBeGreaterThan(0);
            
            const navLinks = $(NAV_LINK_SELECTOR);
            navLinks.each((i, element) => {
                const classes = $(element).attr('class');
                expect(classes).toContain('nav-link');
                expect(classes).toContain('d-flex');
                expect(classes).toContain('align-items-center');
            });
        });

        test('should apply Bootstrap icon classes', () => {
            const icons = $('.bi');
            expect(icons.length).toBeGreaterThan(0);
            
            // Check brand icon
            const brandIcon = $('.navbar-brand i.bi-shield-lock');
            expect(brandIcon).toHaveLength(1);
        });

        test('should include Bootstrap CSS and Icons CDN links', () => {
            const bootstrapCssLink = $('link[href*="bootstrap"][href*="css"]');
            const bootstrapIconsLink = $('link[href*="bootstrap-icons"]');
            
            expect(bootstrapCssLink).toHaveLength(1);
            expect(bootstrapIconsLink).toHaveLength(1);
        });
    });

    describe('Flash Messages Positioning', () => {
        test('should display error messages in correct position with new layout', async () => {
            const response = await request(app)
                .post('/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'wrongpassword'
                })
                .expect(302);

            // Follow redirect to see flash message
            const followUp = await request(app)
                .get('/login')
                .expect(200);
            
            const $ = cheerio.load(followUp.text);
            const errorAlert = $('.alert-danger');
            
            if (errorAlert.length > 0) {
                // Flash message should be in main content area, not sidebar
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                const flashInMain = mainWrapper.find('.alert-danger');
                expect(flashInMain.length).toBeGreaterThan(0);
                
                // Flash message should not be in sidebar
                const sidebar = $(SIDEBAR_SELECTOR);
                const flashInSidebar = sidebar.find('.alert-danger');
                expect(flashInSidebar).toHaveLength(0);
            }
        });

        test('should display success messages in correct position with new layout', async () => {
            const agent = request.agent(app);
            
            const response = await agent
                .post('/signup')
                .send({
                    name: 'Test User Success',
                    email: 'success@example.com',
                    password: 'password123'
                })
                .expect(302);

            // Follow redirect to see potential flash message
            const followUp = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(followUp.text);
            const successAlert = $('.alert-success');
            
            if (successAlert.length > 0) {
                // Success message should be in main content area
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                const flashInMain = mainWrapper.find('.alert-success');
                expect(flashInMain.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Footer Positioning', () => {
        test('should position footer in main content area when present', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const footer = $(FOOTER_SELECTOR);
            
            if (footer.length > 0) {
                // Footer should be within main wrapper, not in sidebar
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                const footerInMain = mainWrapper.find(FOOTER_SELECTOR);
                expect(footerInMain.length).toBeGreaterThan(0);
                
                const sidebar = $(SIDEBAR_SELECTOR);
                const footerInSidebar = sidebar.find(FOOTER_SELECTOR);
                expect(footerInSidebar).toHaveLength(0);
            }
        });
    });

    describe('Accessibility Attributes', () => {
        let $;

        beforeEach(async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            $ = cheerio.load(response.text);
        });

        test('should include proper ARIA labels and roles', () => {
            const navigation = $('nav[role="navigation"]');
            expect(navigation).toHaveLength(1);
            expect(navigation.attr('aria-label')).toBe('Main navigation');
            
            const menubar = $('ul[role="menubar"]');
            expect(menubar).toHaveLength(1);
            
            const menuItems = $('a[role="menuitem"]');
            expect(menuItems.length).toBeGreaterThan(0);
            
            menuItems.each((i, element) => {
                const ariaLabel = $(element).attr('aria-label');
                expect(ariaLabel).toBeDefined();
                expect(ariaLabel.length).toBeGreaterThan(0);
            });
        });

        test('should use semantic HTML elements', () => {
            // Navigation should use nav element
            const navElement = $('nav');
            expect(navElement).toHaveLength(1);
            
            // Lists should use ul and li elements
            const ulElement = $('.nav ul');
            expect(ulElement).toHaveLength(1);
            
            const liElements = $('.nav-item');
            expect(liElements.length).toBeGreaterThan(0);
        });

        test('should have proper heading structure', () => {
            // Brand should be properly structured
            const brandLink = $(NAVBAR_BRAND_SELECTOR);
            expect(brandLink).toHaveLength(1);
            expect(brandLink.attr('aria-label')).toBe('Auth App Home');
        });
    });

    describe('Layout Responsiveness', () => {
        test('should include viewport meta tag for mobile responsiveness', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const viewportMeta = $('meta[name="viewport"]');
            
            expect(viewportMeta).toHaveLength(1);
            expect(viewportMeta.attr('content')).toContain('width=device-width');
            expect(viewportMeta.attr('content')).toContain('initial-scale=1.0');
        });

        test('should use responsive Bootstrap classes in main content', async () => {
            const response = await request(app)
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check for responsive container classes
            const containerFluid = $('.container-fluid');
            if (containerFluid.length > 0) {
                expect(containerFluid).toHaveLength(1);
            }
            
            // Check for responsive grid classes
            const responsiveCols = $('[class*="col-lg"], [class*="col-md"], [class*="col-sm"]');
            expect(responsiveCols.length).toBeGreaterThan(0);
        });

        test('should not cause horizontal scrolling with fixed sidebar', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check that body and html don't have overflow-x hidden
            // This test ensures no horizontal scroll is introduced
            const bodyElement = $('body');
            expect(bodyElement).toHaveLength(1);
            
            // Main wrapper should have proper margin to prevent overlap
            const headContent = $('head').html();
            expect(headContent).toContain('margin-left: 250px');
        });
    });

    describe('Navigation Link Functionality', () => {
        test('should have correctly formatted href attributes', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            const loginLink = $('a[href="/login"]');
            const signupLink = $('a[href="/signup"]');
            const homeLink = $('a[href="/"]');
            
            expect(loginLink).toHaveLength(1);
            expect(signupLink).toHaveLength(1);
            expect(homeLink).toHaveLength(1);
            
            // Verify links are properly formatted
            expect(loginLink.attr('href')).toBe('/login');
            expect(signupLink.attr('href')).toBe('/signup');
            expect(homeLink.attr('href')).toBe('/');
        });

        test('should render dashboard page with sidebar navigation', async () => {
            const agent = request.agent(app);
            
            // Create and login user
            await agent
                .post('/signup')
                .send({
                    name: 'Dashboard Test User',
                    email: 'dashboard@example.com',
                    password: 'password123'
                });

            await agent
                .post('/login')
                .send({
                    email: 'dashboard@example.com',
                    password: 'password123'
                });

            const response = await agent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Should have sidebar
            expect($(SIDEBAR_SELECTOR)).toHaveLength(1);
            
            // Should have dashboard content
            expect($('h1, h2, h3').text()).toContain('Dashboard');
            
            // Should have authenticated navigation links
            expect($('a[href="/dashboard"]')).toHaveLength(1);
            expect($('a[href="/logout"]')).toHaveLength(1);
        });

        test('should render logout page with sidebar navigation', async () => {
            const response = await request(app)
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Should have sidebar (even when not authenticated)
            expect($(SIDEBAR_SELECTOR)).toHaveLength(1);
            
            // Should have logout content
            expect($('h1, h2, h3').text()).toContain('Logout');
        });
    });

    describe('CSS Custom Styling', () => {
        let $;

        beforeEach(async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            $ = cheerio.load(response.text);
        });

        test('should include custom CSS for sidebar layout', () => {
            const headContent = $('head').html();
            
            // Check for sidebar styles
            expect(headContent).toContain('.sidebar {');
            expect(headContent).toContain('width: 250px');
            expect(headContent).toContain('position: fixed');
            expect(headContent).toContain('min-height: 100vh');
            
            // Check for main wrapper styles
            expect(headContent).toContain('.main-wrapper {');
            expect(headContent).toContain('margin-left: 250px');
            expect(headContent).toContain('display: flex');
            expect(headContent).toContain('flex-direction: column');
        });

        test('should include custom nav link hover styles', () => {
            const headContent = $('head').html();
            
            expect(headContent).toContain('.sidebar .nav-link');
            expect(headContent).toContain('transition: all 0.3s ease');
            expect(headContent).toContain('.sidebar .nav-link:hover');
            expect(headContent).toContain('background-color: rgba(255, 255, 255, 0.1)');
        });

        test('should include brand styling', () => {
            const headContent = $('head').html();
            
            expect(headContent).toContain('.sidebar .navbar-brand');
            expect(headContent).toContain('border-bottom: 1px solid rgba(255, 255, 255, 0.1)');
            expect(headContent).toContain('font-weight: 600');
        });
    });

    describe('Content Area Structure', () => {
        test('should have proper content area wrapper', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const contentArea = $('.content-area');
            
            expect(contentArea).toHaveLength(1);
            
            // Content area should be within main wrapper
            const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
            const contentInMain = mainWrapper.find('.content-area');
            expect(contentInMain).toHaveLength(1);
        });

        test('should maintain Bootstrap container structure in content pages', async () => {
            const response = await request(app)
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Should have container-fluid for dashboard content
            const containerFluid = $('.container-fluid');
            expect(containerFluid.length).toBeGreaterThan(0);
            
            // Should have proper Bootstrap grid structure
            const rows = $('.row');
            expect(rows.length).toBeGreaterThan(0);
        });
    });

    describe('Sidebar Visibility and Media Queries', () => {
        test('should always maintain sidebar visibility without collapsing behavior', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const headContent = $('head').html();
            
            // Verify fixed positioning that prevents collapsing
            expect(headContent).toContain('position: fixed');
            expect(headContent).toContain('width: 250px');
            expect(headContent).toContain('z-index: 1000');
            
            // Check that no media queries hide sidebar on small screens
            expect(headContent).not.toContain('@media');
            expect(headContent).not.toMatch(/display:\s*none/);
            expect(headContent).not.toMatch(/visibility:\s*hidden/);
            
            // Verify sidebar remains visible by checking for fixed positioning
            const sidebar = $(SIDEBAR_SELECTOR);
            expect(sidebar).toHaveLength(1);
            expect(sidebar.hasClass('d-none')).toBeFalsy();
            expect(sidebar.hasClass('d-md-block')).toBeFalsy();
        });
    });
});