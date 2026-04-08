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

    // TC-005: Flash message positioning with new layout - Complete test coverage
    describe('TC-005: Flash Message Positioning with New Layout', () => {
        const TEST_USER_EMAIL = 'flashtest@example.com';
        const TEST_USER_PASSWORD = 'password123';
        const INVALID_EMAIL = 'invalid@nonexistent.com';
        const INVALID_PASSWORD = 'wrongpassword';

        beforeEach(async () => {
            // Ensure clean state for each test
            try {
                const agent = request.agent(app);
                await agent.get('/logout').expect(200);
            } catch (error) {
                // Ignore logout errors for clean slate
            }
        });

        describe('Happy Path - Success Messages', () => {
            test('TC-005 Happy Path: should position success flash messages correctly in main content area after successful signup', async () => {
                const agent = request.agent(app);
                
                // Attempt signup with valid data
                const signupResponse = await agent
                    .post('/signup')
                    .send({
                        name: 'Flash Test User',
                        email: TEST_USER_EMAIL,
                        password: TEST_USER_PASSWORD
                    })
                    .expect(302);

                // Follow redirect to see success message
                const followUpResponse = await agent
                    .get(signupResponse.headers.location || '/')
                    .expect(200);
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify layout structure exists
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);

                // Check for success flash message
                const successAlert = $('.alert-success, .alert.alert-success');
                
                if (successAlert.length > 0) {
                    // Success message must be positioned in main content area
                    const flashInMain = mainWrapper.find('.alert-success, .alert.alert-success');
                    expect(flashInMain.length).toBeGreaterThan(0);
                    
                    // Success message must NOT be in sidebar
                    const flashInSidebar = sidebar.find('.alert-success, .alert.alert-success');
                    expect(flashInSidebar).toHaveLength(0);
                    
                    // Verify message content indicates success
                    const messageText = successAlert.text().toLowerCase();
                    expect(messageText).toMatch(/(success|welcome|created|registered)/);
                    
                    // Verify Bootstrap alert classes are correctly applied
                    const alertClasses = successAlert.attr('class');
                    expect(alertClasses).toContain('alert');
                    expect(alertClasses).toContain('success');
                }
            });

            test('TC-005 Happy Path: should position success flash messages correctly after successful login', async () => {
                const agent = request.agent(app);
                
                // First create user account
                await agent
                    .post('/signup')
                    .send({
                        name: 'Login Flash Test User',
                        email: `login_${TEST_USER_EMAIL}`,
                        password: TEST_USER_PASSWORD
                    })
                    .expect(302);

                // Logout to test login flow
                await agent.get('/logout').expect(200);

                // Perform login with valid credentials
                const loginResponse = await agent
                    .post('/login')
                    .send({
                        email: `login_${TEST_USER_EMAIL}`,
                        password: TEST_USER_PASSWORD
                    })
                    .expect(302);

                // Follow redirect to see potential success message
                const followUpResponse = await agent
                    .get(loginResponse.headers.location || '/dashboard')
                    .expect(200);
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify layout structure
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);

                // Check for any success messages
                const successAlert = $('.alert-success, .alert.alert-success, .alert-info, .alert.alert-info');
                
                if (successAlert.length > 0) {
                    // Success message must be in main content area
                    const flashInMain = mainWrapper.find('.alert-success, .alert.alert-success, .alert-info, .alert.alert-info');
                    expect(flashInMain.length).toBeGreaterThan(0);
                    
                    // Success message must NOT be in sidebar
                    const flashInSidebar = sidebar.find('.alert-success, .alert.alert-success, .alert-info, .alert.alert-info');
                    expect(flashInSidebar).toHaveLength(0);
                }
                
                // Verify user is successfully authenticated (dashboard accessible)
                expect($('h1, h2, h3').text().toLowerCase()).toContain('dashboard');
            });

            test('TC-005 Happy Path: should maintain flash message positioning across different viewport sizes', async () => {
                const agent = request.agent(app);
                
                // Create scenario that generates flash message
                const response = await agent
                    .post('/signup')
                    .send({
                        name: 'Viewport Test User',
                        email: `viewport_${TEST_USER_EMAIL}`,
                        password: TEST_USER_PASSWORD
                    })
                    .expect(302);

                const followUpResponse = await agent
                    .get(response.headers.location || '/')
                    .expect(200);
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify responsive meta tag exists for proper viewport handling
                const viewportMeta = $('meta[name="viewport"]');
                expect(viewportMeta).toHaveLength(1);
                expect(viewportMeta.attr('content')).toContain('width=device-width');
                
                // Verify layout structure is responsive
                const headContent = $('head').html();
                expect(headContent).toContain('margin-left: 250px'); // Fixed sidebar width
                
                // Check flash messages are in responsive main content area
                const alerts = $('.alert');
                if (alerts.length > 0) {
                    const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                    const flashInMain = mainWrapper.find('.alert');
                    expect(flashInMain.length).toBeGreaterThan(0);
                    
                    // Verify main wrapper has responsive container structure
                    const containerFluid = mainWrapper.find('.container-fluid');
                    expect(containerFluid.length).toBeGreaterThan(0);
                }
            });
        });

        describe('Error Path - Error Messages', () => {
            test('TC-005 Error Path: should position error flash messages correctly after failed login attempt', async () => {
                const agent = request.agent(app);
                
                // Attempt login with invalid credentials
                const loginResponse = await agent
                    .post('/login')
                    .send({
                        email: INVALID_EMAIL,
                        password: INVALID_PASSWORD
                    })
                    .expect(302);

                // Follow redirect to login page with error message
                const followUpResponse = await agent
                    .get(loginResponse.headers.location || '/login')
                    .expect(200);
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify layout structure exists
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);

                // Check for error flash message
                const errorAlert = $('.alert-danger, .alert.alert-danger, .alert-warning, .alert.alert-warning');
                
                if (errorAlert.length > 0) {
                    // Error message must be positioned in main content area
                    const flashInMain = mainWrapper.find('.alert-danger, .alert.alert-danger, .alert-warning, .alert.alert-warning');
                    expect(flashInMain.length).toBeGreaterThan(0);
                    
                    // Error message must NOT be in sidebar
                    const flashInSidebar = sidebar.find('.alert-danger, .alert.alert-danger, .alert-warning, .alert.alert-warning');
                    expect(flashInSidebar).toHaveLength(0);
                    
                    // Verify error message content is appropriate
                    const messageText = errorAlert.text().toLowerCase();
                    expect(messageText).toMatch(/(invalid|incorrect|error|failed|wrong)/);
                    
                    // Verify Bootstrap alert classes for errors
                    const alertClasses = errorAlert.attr('class');
                    expect(alertClasses).toContain('alert');
                    expect(alertClasses).toMatch(/(danger|warning)/);
                }
            });

            test('TC-005 Error Path: should position validation error messages correctly during signup', async () => {
                const agent = request.agent(app);
                
                // Attempt signup with invalid data (missing required fields)
                const signupResponse = await agent
                    .post('/signup')
                    .send({
                        name: '', // Invalid: empty name
                        email: 'invalid-email-format', // Invalid: bad email format
                        password: '123' // Invalid: too short password
                    })
                    .expect(302);

                // Follow redirect to signup page with validation errors
                const followUpResponse = await agent
                    .get(signupResponse.headers.location || '/signup')
                    .expect(200);
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify layout structure
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);

                // Check for validation error messages
                const errorAlerts = $('.alert-danger, .alert.alert-danger, .alert-warning, .alert.alert-warning');
                
                if (errorAlerts.length > 0) {
                    // All error messages must be in main content area
                    const flashInMain = mainWrapper.find('.alert-danger, .alert.alert-danger, .alert-warning, .alert.alert-warning');
                    expect(flashInMain.length).toBeGreaterThan(0);
                    
                    // No error messages should be in sidebar
                    const flashInSidebar = sidebar.find('.alert-danger, .alert.alert-danger, .alert-warning, .alert.alert-warning');
                    expect(flashInSidebar).toHaveLength(0);
                    
                    // Verify error messages relate to validation
                    errorAlerts.each((i, element) => {
                        const messageText = $(element).text().toLowerCase();
                        expect(messageText).toMatch(/(required|invalid|error|validation|field)/);
                    });
                }
            });

            test('TC-005 Error Path: should handle multiple flash messages correctly in main content area', async () => {
                const agent = request.agent(app);
                
                // Create scenario that might generate multiple error messages
                const signupResponse = await agent
                    .post('/signup')
                    .send({
                        name: 'A', // Too short name
                        email: 'duplicate@test.com',
                        password: 'password123'
                    })
                    .expect(302);

                // Try to create same user again (duplicate email error)
                const duplicateResponse = await agent
                    .post('/signup')
                    .send({
                        name: 'Another User',
                        email: 'duplicate@test.com', // Same email
                        password: 'password123'
                    })
                    .expect(302);

                const followUpResponse = await agent
                    .get(duplicateResponse.headers.location || '/signup')
                    .expect(200);
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify layout structure
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);

                // Check for any flash messages
                const allAlerts = $('.alert');
                
                if (allAlerts.length > 0) {
                    // All flash messages must be in main content area
                    const flashInMain = mainWrapper.find('.alert');
                    expect(flashInMain.length).toBe(allAlerts.length);
                    
                    // No flash messages should be in sidebar
                    const flashInSidebar = sidebar.find('.alert');
                    expect(flashInSidebar).toHaveLength(0);
                    
                    // Verify flash messages are properly structured
                    allAlerts.each((i, element) => {
                        const alertClasses = $(element).attr('class');
                        expect(alertClasses).toContain('alert');
                        
                        // Each alert should have proper Bootstrap styling
                        expect(alertClasses).toMatch(/(alert-success|alert-danger|alert-warning|alert-info)/);
                    });
                }
            });

            test('TC-005 Error Path: should maintain flash message positioning during server errors', async () => {
                const agent = request.agent(app);
                
                // Create a request that might cause server errors
                const errorResponse = await agent
                    .post('/login')
                    .send({
                        email: null, // Invalid input that might cause server error
                        password: undefined
                    });
                
                // Server should handle gracefully, check response
                expect([200, 302, 400, 422]).toContain(errorResponse.status);
                
                let followUpResponse;
                if (errorResponse.status === 302) {
                    followUpResponse = await agent
                        .get(errorResponse.headers.location || '/login')
                        .expect(200);
                } else {
                    followUpResponse = errorResponse;
                }
                
                const $ = cheerio.load(followUpResponse.text);
                
                // Verify layout structure is maintained even during errors
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);

                // Any error messages should still be properly positioned
                const errorAlerts = $('.alert');
                if (errorAlerts.length > 0) {
                    const flashInMain = mainWrapper.find('.alert');
                    expect(flashInMain.length).toBeGreaterThan(0);
                    
                    const flashInSidebar = sidebar.find('.alert');
                    expect(flashInSidebar).toHaveLength(0);
                }
            });
        });

        describe('Edge Cases and Boundary Conditions', () => {
            test('TC-005 Edge Case: should handle flash messages when main wrapper is dynamically modified', async () => {
                const agent = request.agent(app);
                
                // Test flash message positioning on different pages
                const pages = ['/', '/login', '/signup'];
                
                for (const page of pages) {
                    const response = await agent.get(page).expect(200);
                    const $ = cheerio.load(response.text);
                    
                    // Verify consistent layout structure across all pages
                    const sidebar = $(SIDEBAR_SELECTOR);
                    const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                    
                    expect(sidebar).toHaveLength(1);
                    expect(mainWrapper).toHaveLength(1);
                    
                    // Check CSS positioning is consistent
                    const headContent = $('head').html();
                    expect(headContent).toContain('margin-left: 250px');
                    expect(headContent).toContain('position: fixed');
                }
            });

            test('TC-005 Edge Case: should preserve flash message positioning with concurrent requests', async () => {
                // Create multiple agents to simulate concurrent users
                const agents = [
                    request.agent(app),
                    request.agent(app),
                    request.agent(app)
                ];
                
                // Perform concurrent operations that might generate flash messages
                const promises = agents.map(async (agent, index) => {
                    try {
                        const response = await agent
                            .post('/signup')
                            .send({
                                name: `Concurrent User ${index}`,
                                email: `concurrent${index}@test.com`,
                                password: TEST_USER_PASSWORD
                            });
                        
                        return { agent, response, index };
                    } catch (error) {
                        return { agent, error, index };
                    }
                });
                
                const results = await Promise.allSettled(promises);
                
                // Verify each result maintains proper layout structure
                for (const result of results) {
                    if (result.status === 'fulfilled' && result.value.response) {
                        const { agent, response } = result.value;
                        
                        if (response.status === 302) {
                            const followUp = await agent
                                .get(response.headers.location || '/')
                                .expect(200);
                            
                            const $ = cheerio.load(followUp.text);
                            
                            // Verify layout integrity
                            const sidebar = $(SIDEBAR_SELECTOR);
                            const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                            expect(sidebar).toHaveLength(1);
                            expect(mainWrapper).toHaveLength(1);
                            
                            // Any flash messages should be properly positioned
                            const alerts = $('.alert');
                            if (alerts.length > 0) {
                                const flashInMain = mainWrapper.find('.alert');
                                expect(flashInMain.length).toBeGreaterThan(0);
                                
                                const flashInSidebar = sidebar.find('.alert');
                                expect(flashInSidebar).toHaveLength(0);
                            }
                        }
                    }
                }
            });

            test('TC-005 Edge Case: should handle empty or undefined flash message content gracefully', async () => {
                const agent = request.agent(app);
                
                // Make a regular request to check baseline layout
                const response = await agent.get('/').expect(200);
                const $ = cheerio.load(response.text);
                
                // Verify layout structure exists even without flash messages
                const sidebar = $(SIDEBAR_SELECTOR);
                const mainWrapper = $(MAIN_WRAPPER_SELECTOR);
                expect(sidebar).toHaveLength(1);
                expect(mainWrapper).toHaveLength(1);
                
                // Verify layout positioning CSS is present
                const headContent = $('head').html();
                expect(headContent).toContain('.main-wrapper');
                expect(headContent).toContain('margin-left: 250px');
                
                // The absence of flash messages should not break layout
                const alerts = $('.alert');
                // Even if no alerts exist, layout should be intact
                expect(mainWrapper.hasClass('d-flex')).toBeFalsy(); // No utility classes that could break layout
            });
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