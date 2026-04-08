const request = require('supertest');
const app = require('../app');
const cheerio = require('cheerio');

describe('Static Page Content and Layout Integration', () => {
    let agent;

    beforeEach(() => {
        agent = request.agent(app);
    });

    afterEach(() => {
        if (agent.jar) {
            agent.jar.removeAllCookies();
        }
    });

    describe('Dashboard Page Static Content Validation', () => {
        let authenticatedAgent;

        beforeEach(async () => {
            authenticatedAgent = request.agent(app);
            
            // Create and authenticate test user
            await authenticatedAgent
                .post('/signup')
                .send({
                    name: 'Dashboard Content User',
                    email: 'content@test.com',
                    password: 'ContentPass123'
                });
            
            await authenticatedAgent
                .post('/login')
                .send({
                    email: 'content@test.com',
                    password: 'ContentPass123'
                });
        });

        // TC-ID: DASHBOARD-HEADER-CONTENT
        it('should display dashboard page header with welcome message and user context', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify page header structure
            expect($('h1.h3').text().trim()).toBe('Dashboard');
            expect(response.text).toContain('Welcome back, Dashboard Content User!');
            expect(response.text).toContain("Here's an overview of your account");
            
            // Check welcome alert
            const welcomeAlert = $('.alert.alert-success');
            expect(welcomeAlert).toHaveLength(1);
            expect(welcomeAlert.text()).toContain('Welcome to your dashboard!');
            expect(welcomeAlert.text()).toContain('You have successfully logged in');
        });

        // TC-ID: DASHBOARD-STATS-CARDS
        it('should display all four statistics cards with proper dummy data', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check for all four stat cards
            const accountStatusCard = $('.border-left-primary');
            const memberSinceCard = $('.border-left-success');
            const loginSessionsCard = $('.border-left-info');
            const lastLoginCard = $('.border-left-warning');
            
            expect(accountStatusCard).toHaveLength(1);
            expect(memberSinceCard).toHaveLength(1);
            expect(loginSessionsCard).toHaveLength(1);
            expect(lastLoginCard).toHaveLength(1);
            
            // Verify card content
            expect(response.text).toContain('Account Status');
            expect(response.text).toContain('Active');
            expect(response.text).toContain('Member Since');
            expect(response.text).toContain('Login Sessions');
            expect(response.text).toContain('24');
            expect(response.text).toContain('Last Login');
            
            // Check Bootstrap icons in cards
            expect($('i.bi-person-check')).toHaveLength(1);
            expect($('i.bi-calendar-check')).toHaveLength(1);
            expect($('i.bi-graph-up')).toHaveLength(1);
            expect($('i.bi-clock')).toHaveLength(1);
        });

        // TC-ID: DASHBOARD-PROFILE-INFO
        it('should display comprehensive profile information table with user data', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check profile information card
            const profileCard = $('.card:contains("Profile Information")');
            expect(profileCard).toHaveLength(1);
            
            // Verify table structure and content
            const profileTable = profileCard.find('.table tbody tr');
            expect(profileTable.length).toBeGreaterThanOrEqual(7);
            
            // Check specific profile fields
            expect(response.text).toContain('Dashboard Content User');
            expect(response.text).toContain('content@test.com');
            expect(response.text).toContain('Standard User');
            expect(response.text).toContain('Verified');
            expect(response.text).toContain('User ID:');
            expect(response.text).toContain('Account Type:');
            expect(response.text).toContain('Status:');
            expect(response.text).toContain('Created:');
            expect(response.text).toContain('Last Updated:');
        });

        // TC-ID: DASHBOARD-QUICK-ACTIONS
        it('should display quick actions card with proper button states', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check quick actions card
            const actionsCard = $('.card:contains("Quick Actions")');
            expect(actionsCard).toHaveLength(1);
            
            // Verify disabled buttons (placeholder functionality)
            const disabledButtons = actionsCard.find('.btn[disabled]');
            expect(disabledButtons.length).toBeGreaterThanOrEqual(4);
            
            // Check button content and icons
            expect(response.text).toContain('Edit Profile');
            expect(response.text).toContain('Change Password');
            expect(response.text).toContain('Account Settings');
            expect(response.text).toContain('Security Settings');
            
            // Verify logout button is active
            const logoutButton = actionsCard.find('a[href="/logout"]');
            expect(logoutButton).toHaveLength(1);
            expect(logoutButton.hasClass('btn-outline-danger')).toBe(true);
            
            // Check Bootstrap icons
            expect($('i.bi-person-gear')).toHaveLength(1);
            expect($('i.bi-key')).toHaveLength(1);
            expect($('i.bi-gear')).toHaveLength(1);
            expect($('i.bi-shield-check')).toHaveLength(1);
        });

        // TC-ID: DASHBOARD-RECENT-ACTIVITY
        it('should display recent activity section with dummy activity entries', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check recent activity card
            const activityCard = $('.card:contains("Recent Activity")');
            expect(activityCard).toHaveLength(1);
            
            // Verify activity list structure
            const activityList = activityCard.find('.list-group-item');
            expect(activityList.length).toBeGreaterThanOrEqual(1);
            
            // Check activity content
            expect(response.text).toContain('Successful Login');
            expect(response.text).toContain('You logged in successfully');
            
            // Verify activity icons
            expect($('i.bi-box-arrow-in-right')).toHaveLength(1);
        });

        // TC-ID: DASHBOARD-BOOTSTRAP-INTEGRATION
        it('should properly integrate Bootstrap styling throughout dashboard content', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check container structure
            const containerFluid = $('.container-fluid');
            expect(containerFluid.length).toBeGreaterThan(0);
            
            // Verify Bootstrap grid system
            const rows = $('.row');
            expect(rows.length).toBeGreaterThanOrEqual(4);
            
            const cols = $('[class*="col-"]');
            expect(cols.length).toBeGreaterThan(0);
            
            // Check Bootstrap components
            const cards = $('.card');
            expect(cards.length).toBeGreaterThanOrEqual(6);
            
            const badges = $('.badge');
            expect(badges.length).toBeGreaterThanOrEqual(3);
            
            const alerts = $('.alert');
            expect(alerts.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Logout Page Static Content Validation', () => {
        // TC-ID: LOGOUT-HEADER-CONTENT
        it('should display logout page header with confirmation message', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify page header
            expect($('h1.h3').text().trim()).toBe('Logout');
            expect(response.text).toContain('You have been successfully logged out');
            
            // Check logout confirmation alert
            const confirmationAlert = $('.alert.alert-success');
            expect(confirmationAlert).toHaveLength(1);
            expect(confirmationAlert.text()).toContain('Successfully logged out!');
            expect(confirmationAlert.text()).toContain('Your session has been terminated');
        });

        // TC-ID: LOGOUT-MAIN-CARD
        it('should display main logout card with session termination information', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check main card structure
            const mainCard = $('.card.shadow.border-0');
            expect(mainCard).toHaveLength(1);
            
            const cardHeader = mainCard.find('.card-header');
            expect(cardHeader).toHaveLength(1);
            expect(cardHeader.text()).toContain('Session Terminated');
            
            // Verify main content
            expect(response.text).toContain('Thank you for using Auth App');
            expect(response.text).toContain('Your account data is secure');
            expect(response.text).toContain('authentication cookies have been cleared');
            
            // Check large logout icon
            const logoutIcon = $('i.bi-box-arrow-right[style*="4rem"]');
            expect(logoutIcon).toHaveLength(1);
        });

        // TC-ID: LOGOUT-SECURITY-NOTICE
        it('should display security information and notice', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check security notice alert
            const securityAlert = $('.alert.alert-info');
            expect(securityAlert).toHaveLength(1);
            expect(securityAlert.text()).toContain('Security Notice:');
            expect(securityAlert.text()).toContain('closing your browser');
            expect(securityAlert.text()).toContain('shared computer');
            expect(securityAlert.text()).toContain('no personal information is stored locally');
            
            // Verify security info icon
            expect($('i.bi-info-circle-fill')).toHaveLength(1);
        });

        // TC-ID: LOGOUT-ACTION-BUTTONS
        it('should display action buttons with proper styling and links', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check login again button
            const loginButton = $('a[href="/login"].btn.btn-primary');
            expect(loginButton).toHaveLength(1);
            expect(loginButton.text()).toContain('Login Again');
            expect(loginButton.find('i.bi-box-arrow-in-right')).toHaveLength(1);
            
            // Check homepage button
            const homepageButton = $('a[href="/"].btn.btn-outline-secondary');
            expect(homepageButton).toHaveLength(1);
            expect(homepageButton.text()).toContain('Go to Homepage');
            expect(homepageButton.find('i.bi-house')).toHaveLength(1);
            
            // Verify button sizing
            expect(loginButton.hasClass('btn-lg')).toBe(true);
            expect(homepageButton.hasClass('btn-lg')).toBe(true);
        });

        // TC-ID: LOGOUT-INFO-CARDS
        it('should display three information cards with proper icons and content', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check for three info cards
            const infoCards = $('.card.h-100.border-0.shadow-sm');
            expect(infoCards).toHaveLength(3);
            
            // Verify card content
            expect(response.text).toContain('Secure Session');
            expect(response.text).toContain('Your session was encrypted');
            expect(response.text).toContain('industry best practices');
            
            expect(response.text).toContain('Session Duration');
            expect(response.text).toContain('2 hours and 34 minutes');
            
            expect(response.text).toContain('Quick Return');
            expect(response.text).toContain('Use the login button above');
            expect(response.text).toContain('sign back in');
            
            // Check card icons
            expect($('i.bi-shield-lock[style*="2.5rem"]')).toHaveLength(1);
            expect($('i.bi-clock-history[style*="2.5rem"]')).toHaveLength(1);
            expect($('i.bi-arrow-clockwise[style*="2.5rem"]')).toHaveLength(1);
        });

        // TC-ID: LOGOUT-FOOTER-MESSAGE
        it('should display footer message with heart icon', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check footer message
            expect(response.text).toContain('Thank you for choosing Auth App');
            expect(response.text).toContain('authentication needs');
            
            // Verify heart icon
            const heartIcon = $('i.bi-heart-fill.text-danger');
            expect(heartIcon).toHaveLength(1);
        });

        // TC-ID: LOGOUT-BOOTSTRAP-INTEGRATION
        it('should properly integrate Bootstrap styling throughout logout content', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check container structure
            const containerFluid = $('.container-fluid');
            expect(containerFluid.length).toBeGreaterThan(0);
            
            // Verify Bootstrap grid system
            const rows = $('.row');
            expect(rows.length).toBeGreaterThanOrEqual(4);
            
            const cols = $('[class*="col-"]');
            expect(cols.length).toBeGreaterThan(0);
            
            // Check Bootstrap components
            const cards = $('.card');
            expect(cards.length).toBeGreaterThanOrEqual(4);
            
            const alerts = $('.alert');
            expect(alerts.length).toBeGreaterThanOrEqual(2);
            
            const buttons = $('.btn');
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Cross-page Layout Consistency', () => {
        // TC-ID: LAYOUT-CONSISTENCY
        it('should maintain consistent layout structure across all static pages', async () => {
            const pages = [
                { url: '/', title: 'Home' },
                { url: '/login', title: 'Login' },
                { url: '/signup', title: 'Sign Up' },
                { url: '/logout', title: 'Logout' }
            ];

            for (const page of pages) {
                const response = await agent
                    .get(page.url)
                    .expect(200);
                
                const $ = cheerio.load(response.text);
                
                // Check consistent layout elements
                expect($('.sidebar')).toHaveLength(1);
                expect($('.main-wrapper')).toHaveLength(1);
                expect($('.content-area')).toHaveLength(1);
                expect($('main[role="main"]')).toHaveLength(1);
                expect($('footer[role="contentinfo"]')).toHaveLength(1);
                
                // Check title format
                expect($('title').text()).toContain(`${page.title} | Auth App`);
                
                // Verify sidebar brand
                expect($('.navbar-brand').text().trim()).toBe('Auth App');
                expect($('.navbar-brand i.bi-shield-lock')).toHaveLength(1);
            }
        });

        // TC-ID: NAVIGATION-STATE-CONSISTENCY
        it('should show consistent navigation links based on authentication state across pages', async () => {
            const unauthenticatedPages = ['/', '/login', '/signup', '/logout'];
            
            for (const page of unauthenticatedPages) {
                const response = await agent
                    .get(page)
                    .expect(200);
                
                const $ = cheerio.load(response.text);
                
                // Should show unauthenticated links
                expect($('a[href="/login"]')).toHaveLength(1);
                expect($('a[href="/signup"]')).toHaveLength(1);
                
                // Should not show authenticated links
                expect($('a[href="/dashboard"]')).toHaveLength(0);
            }
        });

        // TC-ID: FOOTER-CONSISTENCY
        it('should display consistent footer across all pages', async () => {
            const pages = ['/', '/login', '/signup', '/logout'];
            
            for (const page of pages) {
                const response = await agent
                    .get(page)
                    .expect(200);
                
                const $ = cheerio.load(response.text);
                
                const footer = $('footer[role="contentinfo"]');
                expect(footer).toHaveLength(1);
                expect(footer.hasClass('bg-light')).toBe(true);
                expect(footer.text()).toContain('2024 Auth App');
                expect(footer.text()).toContain('Express.js & Bootstrap');
            }
        });
    });

    describe('Content Accessibility and Semantic Structure', () => {
        // TC-ID: SEMANTIC-STRUCTURE
        it('should use proper semantic HTML structure for all content', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check semantic elements
            expect($('nav[role="navigation"]')).toHaveLength(1);
            expect($('main[role="main"]')).toHaveLength(1);
            expect($('footer[role="contentinfo"]')).toHaveLength(1);
            
            // Check ARIA attributes
            expect($('[aria-label]').length).toBeGreaterThan(0);
            expect($('[role]').length).toBeGreaterThan(0);
            
            // Check heading hierarchy
            const h1Elements = $('h1');
            expect(h1Elements).toHaveLength(1);
            
            const headings = $('h1, h2, h3, h4, h5, h6');
            expect(headings.length).toBeGreaterThan(0);
        });

        // TC-ID: ACCESSIBILITY-ATTRIBUTES
        it('should include proper accessibility attributes on interactive elements', async () => {
            const pages = ['/dashboard', '/logout'];
            
            for (const page of pages) {
                let response;
                if (page === '/dashboard') {
                    const authenticatedAgent = request.agent(app);
                    await authenticatedAgent.post('/signup').send({
                        name: 'Accessibility Test',
                        email: 'access@test.com',
                        password: 'AccessPass123'
                    });
                    await authenticatedAgent.post('/login').send({
                        email: 'access@test.com',
                        password: 'AccessPass123'
                    });
                    response = await authenticatedAgent.get(page).expect(200);
                } else {
                    response = await agent.get(page).expect(200);
                }
                
                const $ = cheerio.load(response.text);
                
                // Check button accessibility
                const buttons = $('button, .btn');
                buttons.each((i, element) => {
                    const $el = $(element);
                    const hasAriaLabel = $el.attr('aria-label');
                    const hasText = $el.text().trim().length > 0;
                    const hasIcon = $el.find('i').length > 0;
                    
                    // Should have either aria-label or visible text
                    expect(hasAriaLabel || hasText || hasIcon).toBe(true);
                });
                
                // Check link accessibility
                const links = $('a[href]');
                links.each((i, element) => {
                    const $el = $(element);
                    const href = $el.attr('href');
                    const hasText = $el.text().trim().length > 0;
                    const hasAriaLabel = $el.attr('aria-label');
                    
                    if (href && href !== '#') {
                        expect(hasText || hasAriaLabel).toBe(true);
                    }
                });
            }
        });
    });
});