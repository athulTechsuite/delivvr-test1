const { JSDOM } = require('jsdom');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Constants for test data
const TEST_USER = {
    id: 1,
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00.000Z'
};

const TEST_TITLES = {
    HOME: 'Home',
    DASHBOARD: 'Dashboard',
    LOGIN: 'Login',
    SIGNUP: 'Sign Up'
};

const SIDEBAR_SELECTORS = {
    TOGGLE_BUTTON: '[data-bs-toggle="offcanvas"][data-bs-target="#sidebar"]',
    SIDEBAR: '#sidebar',
    SIDEBAR_HEADER: '.offcanvas-header',
    SIDEBAR_TITLE: '.offcanvas-title',
    CLOSE_BUTTON: '.btn-close',
    NAV_LINKS: '.nav-link',
    USER_SECTION: '.px-3.py-2.border-bottom',
    LOGOUT_FORM: 'form[action="/auth/logout"]',
    HOME_LINK: 'a[href="/"]',
    DASHBOARD_LINK: 'a[href="/dashboard"]',
    LOGIN_LINK: 'a[href="/login"]',
    SIGNUP_LINK: 'a[href="/signup"]'
};

const BOOTSTRAP_CLASSES = {
    OFFCANVAS_LG: 'offcanvas-lg',
    OFFCANVAS_START: 'offcanvas-start',
    BG_PRIMARY: 'bg-primary',
    TEXT_WHITE: 'text-white',
    ACTIVE: 'active',
    BG_PRIMARY_DARK: 'bg-primary-dark'
};

describe('View Templates', () => {
    let layoutTemplate;
    let dashboardTemplate;

    beforeAll(() => {
        // Load template files
        layoutTemplate = fs.readFileSync(
            path.join(__dirname, '../views/layout.ejs'),
            'utf-8'
        );
        dashboardTemplate = fs.readFileSync(
            path.join(__dirname, '../views/dashboard.ejs'),
            'utf-8'
        );
    });

    describe('Layout Template - Sidebar Navigation', () => {
        describe('Authenticated User Context', () => {
            let dom;
            let document;

            beforeEach(async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                dom = new JSDOM(html);
                document = dom.window.document;
            });

            test('should render sidebar with correct Bootstrap structure', () => {
                const sidebar = document.querySelector(SIDEBAR_SELECTORS.SIDEBAR);
                expect(sidebar).toBeTruthy();
                expect(sidebar.classList.contains(BOOTSTRAP_CLASSES.OFFCANVAS_LG)).toBe(true);
                expect(sidebar.classList.contains(BOOTSTRAP_CLASSES.OFFCANVAS_START)).toBe(true);
                expect(sidebar.classList.contains(BOOTSTRAP_CLASSES.BG_PRIMARY)).toBe(true);
                expect(sidebar.getAttribute('tabindex')).toBe('-1');
                expect(sidebar.getAttribute('aria-labelledby')).toBe('sidebarLabel');
            });

            test('should display correct navigation links for authenticated user', () => {
                const homeLink = document.querySelector(SIDEBAR_SELECTORS.HOME_LINK);
                const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);
                const loginLink = document.querySelector(SIDEBAR_SELECTORS.LOGIN_LINK);
                const signupLink = document.querySelector(SIDEBAR_SELECTORS.SIGNUP_LINK);
                const logoutForm = document.querySelector(SIDEBAR_SELECTORS.LOGOUT_FORM);

                expect(homeLink).toBeTruthy();
                expect(dashboardLink).toBeTruthy();
                expect(logoutForm).toBeTruthy();
                expect(loginLink).toBeFalsy();
                expect(signupLink).toBeFalsy();
            });

            test('should display user profile section with correct information', () => {
                const userSection = document.querySelector(SIDEBAR_SELECTORS.USER_SECTION);
                expect(userSection).toBeTruthy();
                expect(userSection.textContent).toContain('Signed in as:');
                expect(userSection.textContent).toContain(TEST_USER.username);

                const userIcon = userSection.querySelector('.bi-person-circle');
                expect(userIcon).toBeTruthy();
            });

            test('should render logout form with correct action and method', () => {
                const logoutForm = document.querySelector(SIDEBAR_SELECTORS.LOGOUT_FORM);
                expect(logoutForm.getAttribute('action')).toBe('/auth/logout');
                expect(logoutForm.getAttribute('method')).toBe('POST');

                const logoutButton = logoutForm.querySelector('button[type="submit"]');
                expect(logoutButton).toBeTruthy();
                expect(logoutButton.textContent.trim()).toContain('Logout');
            });

            test('should highlight active page in navigation', async () => {
                const dashboardHtml = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.DASHBOARD,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                
                const dashboardDom = new JSDOM(dashboardHtml);
                const dashboardDocument = dashboardDom.window.document;
                const dashboardLink = dashboardDocument.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);
                
                expect(dashboardLink).toBeTruthy();
                expect(dashboardLink.classList.contains(BOOTSTRAP_CLASSES.ACTIVE)).toBe(true);
                expect(dashboardLink.classList.contains(BOOTSTRAP_CLASSES.BG_PRIMARY_DARK)).toBe(true);
            });

            test('should render Bootstrap icons for all navigation items', () => {
                const homeLink = document.querySelector(SIDEBAR_SELECTORS.HOME_LINK);
                const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);
                const logoutButton = document.querySelector('form[action="/auth/logout"] button');

                expect(homeLink.querySelector('.bi-house')).toBeTruthy();
                expect(dashboardLink.querySelector('.bi-speedometer2')).toBeTruthy();
                expect(logoutButton.querySelector('.bi-box-arrow-right')).toBeTruthy();
            });
        });

        describe('Unauthenticated User Context', () => {
            let dom;
            let document;

            beforeEach(async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.LOGIN,
                    user: null,
                    error: null,
                    success: null
                });
                dom = new JSDOM(html);
                document = dom.window.document;
            });

            test('should display correct navigation links for unauthenticated user', () => {
                const homeLink = document.querySelector(SIDEBAR_SELECTORS.HOME_LINK);
                const loginLink = document.querySelector(SIDEBAR_SELECTORS.LOGIN_LINK);
                const signupLink = document.querySelector(SIDEBAR_SELECTORS.SIGNUP_LINK);
                const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);
                const logoutForm = document.querySelector(SIDEBAR_SELECTORS.LOGOUT_FORM);
                const userSection = document.querySelector(SIDEBAR_SELECTORS.USER_SECTION);

                expect(homeLink).toBeTruthy();
                expect(loginLink).toBeTruthy();
                expect(signupLink).toBeTruthy();
                expect(dashboardLink).toBeFalsy();
                expect(logoutForm).toBeFalsy();
                expect(userSection).toBeFalsy();
            });

            test('should render login and signup links with correct routes', () => {
                const loginLink = document.querySelector(SIDEBAR_SELECTORS.LOGIN_LINK);
                const signupLink = document.querySelector(SIDEBAR_SELECTORS.SIGNUP_LINK);

                expect(loginLink.getAttribute('href')).toBe('/login');
                expect(signupLink.getAttribute('href')).toBe('/signup');
                expect(loginLink.textContent.trim()).toContain('Login');
                expect(signupLink.textContent.trim()).toContain('Sign Up');
            });

            test('should render Bootstrap icons for unauthenticated navigation items', () => {
                const homeLink = document.querySelector(SIDEBAR_SELECTORS.HOME_LINK);
                const loginLink = document.querySelector(SIDEBAR_SELECTORS.LOGIN_LINK);
                const signupLink = document.querySelector(SIDEBAR_SELECTORS.SIGNUP_LINK);

                expect(homeLink.querySelector('.bi-house')).toBeTruthy();
                expect(loginLink.querySelector('.bi-box-arrow-in-right')).toBeTruthy();
                expect(signupLink.querySelector('.bi-person-plus')).toBeTruthy();
            });

            test('should highlight active login page', () => {
                const loginLink = document.querySelector(SIDEBAR_SELECTORS.LOGIN_LINK);
                expect(loginLink.classList.contains(BOOTSTRAP_CLASSES.ACTIVE)).toBe(true);
                expect(loginLink.classList.contains(BOOTSTRAP_CLASSES.BG_PRIMARY_DARK)).toBe(true);
            });
        });

        describe('Mobile Responsive Elements', () => {
            let dom;
            let document;

            beforeEach(async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                dom = new JSDOM(html);
                document = dom.window.document;
            });

            test('should render mobile toggle button with correct attributes', () => {
                const toggleButton = document.querySelector(SIDEBAR_SELECTORS.TOGGLE_BUTTON);
                expect(toggleButton).toBeTruthy();
                expect(toggleButton.getAttribute('data-bs-toggle')).toBe('offcanvas');
                expect(toggleButton.getAttribute('data-bs-target')).toBe('#sidebar');
                expect(toggleButton.getAttribute('aria-controls')).toBe('sidebar');
                expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
                expect(toggleButton.getAttribute('aria-label')).toBe('Toggle navigation');
            });

            test('should render mobile toggle button with responsive classes', () => {
                const toggleContainer = document.querySelector('.d-lg-none');
                expect(toggleContainer).toBeTruthy();
                expect(toggleContainer.classList.contains(BOOTSTRAP_CLASSES.BG_PRIMARY)).toBe(true);

                const toggleButton = toggleContainer.querySelector('button');
                expect(toggleButton.classList.contains('btn')).toBe(true);
                expect(toggleButton.classList.contains('btn-primary')).toBe(true);
            });

            test('should render close button in sidebar header', () => {
                const closeButton = document.querySelector(SIDEBAR_SELECTORS.CLOSE_BUTTON);
                expect(closeButton).toBeTruthy();
                expect(closeButton.classList.contains('btn-close')).toBe(true);
                expect(closeButton.classList.contains('btn-close-white')).toBe(true);
                expect(closeButton.classList.contains('d-lg-none')).toBe(true);
                expect(closeButton.getAttribute('data-bs-dismiss')).toBe('offcanvas');
                expect(closeButton.getAttribute('data-bs-target')).toBe('#sidebar');
            });

            test('should render menu icon in toggle button', () => {
                const toggleButton = document.querySelector(SIDEBAR_SELECTORS.TOGGLE_BUTTON);
                const menuIcon = toggleButton.querySelector('.bi-list');
                expect(menuIcon).toBeTruthy();
                expect(toggleButton.textContent).toContain('Menu');
            });
        });

        describe('Sidebar Header and Branding', () => {
            let dom;
            let document;

            beforeEach(async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                dom = new JSDOM(html);
                document = dom.window.document;
            });

            test('should render sidebar header with correct structure', () => {
                const sidebarHeader = document.querySelector(SIDEBAR_SELECTORS.SIDEBAR_HEADER);
                expect(sidebarHeader).toBeTruthy();
                expect(sidebarHeader.classList.contains('offcanvas-header')).toBe(true);
                expect(sidebarHeader.classList.contains('border-bottom')).toBe(true);
                expect(sidebarHeader.classList.contains('border-light')).toBe(true);
            });

            test('should render sidebar title with app branding', () => {
                const sidebarTitle = document.querySelector(SIDEBAR_SELECTORS.SIDEBAR_TITLE);
                expect(sidebarTitle).toBeTruthy();
                expect(sidebarTitle.classList.contains('offcanvas-title')).toBe(true);
                expect(sidebarTitle.classList.contains(BOOTSTRAP_CLASSES.TEXT_WHITE)).toBe(true);
                expect(sidebarTitle.getAttribute('id')).toBe('sidebarLabel');
                expect(sidebarTitle.textContent).toContain('Auth App');

                const brandIcon = sidebarTitle.querySelector('.bi-shield-lock');
                expect(brandIcon).toBeTruthy();
            });
        });

        describe('Flash Messages Integration', () => {
            test('should render error flash message correctly with sidebar layout', async () => {
                const errorMessage = 'Test error message';
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: errorMessage,
                    success: null
                });
                
                const dom = new JSDOM(html);
                const document = dom.window.document;
                
                const errorAlert = document.querySelector('.alert-danger');
                expect(errorAlert).toBeTruthy();
                expect(errorAlert.textContent).toContain(errorMessage);
                expect(errorAlert.querySelector('.bi-exclamation-triangle')).toBeTruthy();
                expect(errorAlert.querySelector('.btn-close')).toBeTruthy();
            });

            test('should render success flash message correctly with sidebar layout', async () => {
                const successMessage = 'Test success message';
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: successMessage
                });
                
                const dom = new JSDOM(html);
                const document = dom.window.document;
                
                const successAlert = document.querySelector('.alert-success');
                expect(successAlert).toBeTruthy();
                expect(successAlert.textContent).toContain(successMessage);
                expect(successAlert.querySelector('.bi-check-circle')).toBeTruthy();
                expect(successAlert.querySelector('.btn-close')).toBeTruthy();
            });

            test('should not render flash messages when none are provided', async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                
                const dom = new JSDOM(html);
                const document = dom.window.document;
                
                const errorAlert = document.querySelector('.alert-danger');
                const successAlert = document.querySelector('.alert-success');
                expect(errorAlert).toBeFalsy();
                expect(successAlert).toBeFalsy();
            });
        });

        describe('Main Content Wrapper', () => {
            let dom;
            let document;

            beforeEach(async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                dom = new JSDOM(html);
                document = dom.window.document;
            });

            test('should render main content wrapper with correct structure', () => {
                const mainContent = document.querySelector('.main-content');
                expect(mainContent).toBeTruthy();
            });

            test('should include required Bootstrap and custom CSS links', () => {
                const bootstrapCSS = document.querySelector('link[href*="bootstrap@5.3.0"]');
                const bootstrapIcons = document.querySelector('link[href*="bootstrap-icons"]');
                const customCSS = document.querySelector('link[href="/css/style.css"]');

                expect(bootstrapCSS).toBeTruthy();
                expect(bootstrapIcons).toBeTruthy();
                expect(customCSS).toBeTruthy();
            });

            test('should include Bootstrap JavaScript', () => {
                const bootstrapJS = document.querySelector('script[src*="bootstrap@5.3.0"]');
                expect(bootstrapJS).toBeTruthy();
            });
        });
    });

    describe('Dashboard Template', () => {
        let dom;
        let document;

        beforeEach(async () => {
            // Render dashboard template within layout
            const dashboardContent = await ejs.render(dashboardTemplate, {
                user: TEST_USER
            });
            
            const fullHtml = await ejs.render(layoutTemplate, {
                title: TEST_TITLES.DASHBOARD,
                user: TEST_USER,
                error: null,
                success: null
            });
            
            // Insert dashboard content into layout body
            const layoutWithDashboard = fullHtml.replace(
                '<%- body %>',
                dashboardContent
            );
            
            dom = new JSDOM(layoutWithDashboard);
            document = dom.window.document;
        });

        test('should render dashboard without duplicate navbar', () => {
            // Check that there's only one navigation element (the sidebar)
            const navElements = document.querySelectorAll('nav');
            expect(navElements.length).toBe(1);

            // Verify the navigation is the sidebar navigation
            const sidebar = document.querySelector(SIDEBAR_SELECTORS.SIDEBAR);
            const sidebarNav = sidebar.querySelector('nav');
            expect(sidebarNav).toBeTruthy();
            expect(navElements[0]).toBe(sidebarNav);
        });

        test('should render dashboard content correctly with user context', () => {
            const dashboardCard = document.querySelector('.card-header.bg-success');
            expect(dashboardCard).toBeTruthy();
            expect(dashboardCard.textContent).toContain('Dashboard');

            const welcomeAlert = document.querySelector('.alert-success');
            expect(welcomeAlert).toBeTruthy();
            expect(welcomeAlert.textContent).toContain('Welcome to your dashboard!');
        });

        test('should display user profile information correctly', () => {
            const profileTable = document.querySelector('.table');
            expect(profileTable).toBeTruthy();
            
            expect(document.body.textContent).toContain(TEST_USER.name);
            expect(document.body.textContent).toContain(TEST_USER.email);
            expect(document.body.textContent).toContain(TEST_USER.id.toString());
        });

        test('should render dashboard with active navigation state', () => {
            const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);
            expect(dashboardLink.classList.contains(BOOTSTRAP_CLASSES.ACTIVE)).toBe(true);
            expect(dashboardLink.classList.contains(BOOTSTRAP_CLASSES.BG_PRIMARY_DARK)).toBe(true);
        });

        test('should render quick action buttons', () => {
            const editProfileBtn = document.querySelector('button:contains("Edit Profile")') ||
                                 Array.from(document.querySelectorAll('button')).find(btn => 
                                     btn.textContent.includes('Edit Profile')
                                 );
            const changePasswordBtn = document.querySelector('button:contains("Change Password")') ||
                                    Array.from(document.querySelectorAll('button')).find(btn => 
                                        btn.textContent.includes('Change Password')
                                    );
            const accountSettingsBtn = document.querySelector('button:contains("Account Settings")') ||
                                     Array.from(document.querySelectorAll('button')).find(btn => 
                                         btn.textContent.includes('Account Settings')
                                     );

            expect(editProfileBtn).toBeTruthy();
            expect(changePasswordBtn).toBeTruthy();
            expect(accountSettingsBtn).toBeTruthy();
        });

        test('should use inherited sidebar layout from layout.ejs', () => {
            // Verify sidebar is present and functional
            const sidebar = document.querySelector(SIDEBAR_SELECTORS.SIDEBAR);
            const toggleButton = document.querySelector(SIDEBAR_SELECTORS.TOGGLE_BUTTON);
            const userSection = document.querySelector(SIDEBAR_SELECTORS.USER_SECTION);
            
            expect(sidebar).toBeTruthy();
            expect(toggleButton).toBeTruthy();
            expect(userSection).toBeTruthy();
            expect(userSection.textContent).toContain(TEST_USER.username);
        });
    });

    describe('Navigation Link Validation', () => {
        describe('All Navigation Routes', () => {
            let dom;
            let document;

            beforeEach(async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    user: TEST_USER,
                    error: null,
                    success: null
                });
                dom = new JSDOM(html);
                document = dom.window.document;
            });

            test('should have correct href attributes for all navigation links', () => {
                const homeLink = document.querySelector(SIDEBAR_SELECTORS.HOME_LINK);
                const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);

                expect(homeLink.getAttribute('href')).toBe('/');
                expect(dashboardLink.getAttribute('href')).toBe('/dashboard');
            });

            test('should render all navigation links with proper Bootstrap classes', () => {
                const navLinks = document.querySelectorAll(SIDEBAR_SELECTORS.NAV_LINKS);
                
                navLinks.forEach(link => {
                    expect(link.classList.contains('nav-link')).toBe(true);
                    expect(link.classList.contains(BOOTSTRAP_CLASSES.TEXT_WHITE)).toBe(true);
                });
            });

            test('should handle undefined title gracefully', async () => {
                const html = await ejs.render(layoutTemplate, {
                    user: TEST_USER,
                    error: null,
                    success: null
                    // title is intentionally undefined
                });
                
                const testDom = new JSDOM(html);
                const testDocument = testDom.window.document;
                
                // Should not throw error and should render without active states
                const navLinks = testDocument.querySelectorAll(SIDEBAR_SELECTORS.NAV_LINKS);
                const activeLinks = testDocument.querySelectorAll('.nav-link.active');
                
                expect(navLinks.length).toBeGreaterThan(0);
                expect(activeLinks.length).toBe(0);
            });

            test('should handle undefined user gracefully', async () => {
                const html = await ejs.render(layoutTemplate, {
                    title: TEST_TITLES.HOME,
                    error: null,
                    success: null
                    // user is intentionally undefined
                });
                
                const testDom = new JSDOM(html);
                const testDocument = testDom.window.document;
                
                // Should render unauthenticated navigation
                const loginLink = testDocument.querySelector(SIDEBAR_SELECTORS.LOGIN_LINK);
                const signupLink = testDocument.querySelector(SIDEBAR_SELECTORS.SIGNUP_LINK);
                const dashboardLink = testDocument.querySelector(SIDEBAR_SELECTORS.DASHBOARD_LINK);
                
                expect(loginLink).toBeTruthy();
                expect(signupLink).toBeTruthy();
                expect(dashboardLink).toBeFalsy();
            });
        });
    });

    describe('Accessibility and Semantic HTML', () => {
        let dom;
        let document;

        beforeEach(async () => {
            const html = await ejs.render(layoutTemplate, {
                title: TEST_TITLES.HOME,
                user: TEST_USER,
                error: null,
                success: null
            });
            dom = new JSDOM(html);
            document = dom.window.document;
        });

        test('should include proper ARIA attributes for offcanvas', () => {
            const sidebar = document.querySelector(SIDEBAR_SELECTORS.SIDEBAR);
            const toggleButton = document.querySelector(SIDEBAR_SELECTORS.TOGGLE_BUTTON);
            
            expect(sidebar.getAttribute('aria-labelledby')).toBe('sidebarLabel');
            expect(toggleButton.getAttribute('aria-controls')).toBe('sidebar');
            expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
            expect(toggleButton.getAttribute('aria-label')).toBe('Toggle navigation');
        });

        test('should use semantic HTML elements', () => {
            const nav = document.querySelector('nav');
            const main = document.querySelector('.main-content');
            
            expect(nav).toBeTruthy();
            expect(main).toBeTruthy();
        });

        test('should include proper viewport meta tag', () => {
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            expect(viewportMeta).toBeTruthy();
            expect(viewportMeta.getAttribute('content')).toContain('width=device-width');
        });

        test('should have proper document title structure', () => {
            const title = document.querySelector('title');
            expect(title.textContent).toBe(`${TEST_TITLES.HOME} | Auth App`);
        });
    });
});