const request = require('supertest');
const app = require('../app');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

describe('Fixed Side Navigation Layout Implementation', () => {
    let agent;
    
    beforeEach(() => {
        agent = request.agent(app);
    });

    afterEach(() => {
        // Clear any test data
        if (agent.jar) {
            agent.jar.removeAllCookies();
        }
    });

    describe('AC1: Fixed-width side navigation replaces top navbar', () => {
        // TC-ID: AC1-SIDEBAR-DISPLAY
        it('should display a fixed-width side navigation bar on the left side instead of top navbar', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify sidebar exists with correct structure
            const sidebar = $('.sidebar');
            expect(sidebar).toHaveLength(1);
            expect(sidebar.hasClass('bg-primary')).toBe(true);
            expect(sidebar.hasClass('text-white')).toBe(true);
            expect(sidebar.hasClass('d-flex')).toBe(true);
            expect(sidebar.hasClass('flex-column')).toBe(true);
            
            // Verify no top navbar exists
            const topNavbar = $('.navbar:not(.sidebar)');
            expect(topNavbar).toHaveLength(0);
            
            // Check CSS styles for fixed positioning and width
            const headContent = $('head').html();
            expect(headContent).toContain('width: 250px');
            expect(headContent).toContain('position: fixed');
            expect(headContent).toContain('top: 0');
            expect(headContent).toContain('left: 0');
        });

        // TC-ID: AC1-SIDEBAR-PAGES
        it('should display sidebar on all application pages', async () => {
            const pages = ['/', '/login', '/signup', '/logout'];
            
            for (const page of pages) {
                const response = await agent
                    .get(page)
                    .expect(200);
                
                const $ = cheerio.load(response.text);
                const sidebar = $('.sidebar');
                expect(sidebar).toHaveLength(1);
                expect(sidebar.attr('role')).toBe('navigation');
                expect(sidebar.attr('aria-label')).toBe('Main navigation');
            }
        });
    });

    describe('AC2: Side navigation remains always visible', () => {
        // TC-ID: AC2-SIDEBAR-ALWAYS-VISIBLE
        it('should ensure sidebar remains always visible and does not collapse on any screen size', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const headContent = $('head').html();
            
            // Check media queries prevent collapse at all breakpoints
            expect(headContent).toContain('@media (max-width: 768px)');
            expect(headContent).toContain('@media (max-width: 576px)');
            expect(headContent).toMatch(/display:\s*flex\s*!\s*important/);
            expect(headContent).toMatch(/width:\s*250px\s*!\s*important/);
            expect(headContent).toMatch(/position:\s*fixed\s*!\s*important/);
            
            // Verify no Bootstrap collapse classes
            const sidebar = $('.sidebar');
            expect(sidebar.hasClass('collapse')).toBe(false);
            expect(sidebar.hasClass('navbar-collapse')).toBe(false);
        });

        // TC-ID: AC2-SIDEBAR-Z-INDEX
        it('should have proper z-index to remain always on top', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const headContent = $('head').html();
            expect(headContent).toContain('z-index: 1000');
        });
    });

    describe('AC3: Main content shifted right for fixed-width sidebar', () => {
        // TC-ID: AC3-MAIN-CONTENT-SHIFT
        it('should shift main content to the right to accommodate fixed-width sidebar', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const mainWrapper = $('.main-wrapper');
            expect(mainWrapper).toHaveLength(1);
            
            // Check CSS for main content offset
            const headContent = $('head').html();
            expect(headContent).toContain('margin-left: 250px');
            expect(headContent).toContain('min-height: 100vh');
            expect(headContent).toContain('display: flex');
            expect(headContent).toContain('flex-direction: column');
        });

        // TC-ID: AC3-RESPONSIVE-OFFSET
        it('should maintain main content offset across all screen sizes', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const headContent = $('head').html();
            
            // Check responsive breakpoints maintain margin
            const mediaQueries = [
                '@media (max-width: 768px)',
                '@media (max-width: 576px)'
            ];
            
            mediaQueries.forEach(query => {
                expect(headContent).toContain(query);
                const queryIndex = headContent.indexOf(query);
                const nextQueryIndex = headContent.indexOf('}', queryIndex + query.length + 100);
                const queryBlock = headContent.substring(queryIndex, nextQueryIndex);
                expect(queryBlock).toContain('margin-left: 250px');
            });
        });
    });

    describe('AC4: Dashboard page with dummy content and proper layout', () => {
        let authenticatedAgent;

        beforeEach(async () => {
            authenticatedAgent = request.agent(app);
            // Create test user and authenticate
            await authenticatedAgent
                .post('/signup')
                .send({
                    name: 'Test Dashboard User',
                    email: 'dashboard@test.com',
                    password: 'TestPass123'
                });
            
            await authenticatedAgent
                .post('/login')
                .send({
                    email: 'dashboard@test.com',
                    password: 'TestPass123'
                });
        });

        // TC-ID: AC4-DASHBOARD-CLICK
        it('should display static dashboard page when Dashboard link is clicked', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify dashboard page title and structure
            expect($('title').text()).toContain('Dashboard');
            expect($('h1').text().trim()).toBe('Dashboard');
            expect(response.text).toContain('Welcome back');
            
            // Verify dummy content elements
            expect(response.text).toContain('Account Status');
            expect(response.text).toContain('Member Since');
            expect(response.text).toContain('Login Sessions');
            expect(response.text).toContain('Last Login');
            expect(response.text).toContain('Profile Information');
            expect(response.text).toContain('Quick Actions');
            expect(response.text).toContain('Recent Activity');
        });

        // TC-ID: AC4-DASHBOARD-LAYOUT
        it('should have proper layout structure with sidebar and main content', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify sidebar exists
            const sidebar = $('.sidebar');
            expect(sidebar).toHaveLength(1);
            
            // Verify main content wrapper
            const mainWrapper = $('.main-wrapper');
            expect(mainWrapper).toHaveLength(1);
            
            // Verify content area
            const contentArea = $('.content-area');
            expect(contentArea).toHaveLength(1);
            
            // Verify main element
            const mainElement = $('main[role="main"]');
            expect(mainElement).toHaveLength(1);
            expect(mainElement.hasClass('container-fluid')).toBe(true);
        });

        // TC-ID: AC4-DASHBOARD-DUMMY-CONTENT
        it('should display comprehensive dummy content for dashboard', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check stats cards
            const statsCards = $('.card.border-left-primary, .card.border-left-success, .card.border-left-info, .card.border-left-warning');
            expect(statsCards.length).toBe(4);
            
            // Check profile information table
            const profileTable = $('.table tbody tr');
            expect(profileTable.length).toBeGreaterThan(5);
            
            // Check quick actions buttons
            const quickActionButtons = $('.btn');
            expect(quickActionButtons.length).toBeGreaterThan(4);
            
            // Check activity list
            const activityList = $('.list-group-item');
            expect(activityList.length).toBeGreaterThan(0);
        });
    });

    describe('AC5: Logout page with dummy content and proper layout', () => {
        // TC-ID: AC5-LOGOUT-CLICK
        it('should display static logout page when Logout link is clicked', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify logout page title and structure
            expect($('title').text()).toContain('Logout');
            expect($('h1').text().trim()).toBe('Logout');
            expect(response.text).toContain('Successfully logged out!');
            expect(response.text).toContain('Your session has been terminated');
        });

        // TC-ID: AC5-LOGOUT-LAYOUT
        it('should have proper layout structure with sidebar and main content', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify sidebar exists
            const sidebar = $('.sidebar');
            expect(sidebar).toHaveLength(1);
            
            // Verify main content wrapper
            const mainWrapper = $('.main-wrapper');
            expect(mainWrapper).toHaveLength(1);
            
            // Verify main element
            const mainElement = $('main[role="main"]');
            expect(mainElement).toHaveLength(1);
            expect(mainElement.hasClass('container-fluid')).toBe(true);
        });

        // TC-ID: AC5-LOGOUT-DUMMY-CONTENT
        it('should display comprehensive dummy content for logout page', async () => {
            const response = await agent
                .get('/logout')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check main content card
            const mainCard = $('.card.shadow.border-0');
            expect(mainCard).toHaveLength(1);
            
            // Check information cards
            const infoCards = $('.card.h-100.border-0.shadow-sm');
            expect(infoCards.length).toBe(3);
            
            // Check action buttons
            const actionButtons = $('.btn.btn-primary, .btn.btn-outline-secondary');
            expect(actionButtons.length).toBe(2);
            
            // Check security information
            expect(response.text).toContain('Security Notice');
            expect(response.text).toContain('Session Duration');
            expect(response.text).toContain('Quick Return');
        });
    });

    describe('AC6: Bootstrap styling approach consistency', () => {
        // TC-ID: AC6-BOOTSTRAP-CDN
        it('should maintain existing Bootstrap CDN links and classes', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify Bootstrap CSS CDN
            const bootstrapCssLink = $('link[href*="bootstrap"][href*="css"]');
            expect(bootstrapCssLink).toHaveLength(1);
            expect(bootstrapCssLink.attr('href')).toContain('5.3.0');
            
            // Verify Bootstrap Icons CDN
            const bootstrapIconsLink = $('link[href*="bootstrap-icons"]');
            expect(bootstrapIconsLink).toHaveLength(1);
            
            // Verify Bootstrap JS CDN
            const bootstrapJsScript = $('script[src*="bootstrap"]');
            expect(bootstrapJsScript).toHaveLength(1);
        });

        // TC-ID: AC6-BOOTSTRAP-CLASSES
        it('should use consistent Bootstrap classes throughout the layout', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check sidebar Bootstrap classes
            const sidebar = $('.sidebar');
            expect(sidebar.hasClass('bg-primary')).toBe(true);
            expect(sidebar.hasClass('text-white')).toBe(true);
            expect(sidebar.hasClass('d-flex')).toBe(true);
            expect(sidebar.hasClass('flex-column')).toBe(true);
            
            // Check navigation Bootstrap classes
            const navList = $('.nav.nav-pills.flex-column');
            expect(navList).toHaveLength(1);
            
            const navLinks = $('.nav-link.d-flex.align-items-center');
            expect(navLinks.length).toBeGreaterThan(0);
            
            // Check container classes
            const containerFluid = $('.container-fluid');
            expect(containerFluid.length).toBeGreaterThan(0);
        });

        // TC-ID: AC6-BOOTSTRAP-ICONS
        it('should consistently use Bootstrap Icons throughout navigation', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check brand icon
            const brandIcon = $('.navbar-brand i.bi-shield-lock');
            expect(brandIcon).toHaveLength(1);
            
            // Check navigation icons
            const navIcons = $('.nav-link i[class^="bi-"]');
            expect(navIcons.length).toBeGreaterThan(0);
            
            // Verify specific icon classes
            const loginIcon = $('i.bi-box-arrow-in-right');
            const signupIcon = $('i.bi-person-plus');
            expect(loginIcon.length + signupIcon.length).toBeGreaterThan(0);
        });
    });

    describe('AC7: Flash messages positioning with new layout', () => {
        // TC-ID: AC7-ERROR-MESSAGES
        it('should display error messages correctly positioned relative to new layout structure', async () => {
            const response = await agent
                .post('/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'wrongpassword'
                })
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Check error message exists
            const errorAlert = $('.alert-danger');
            if (errorAlert.length > 0) {
                // Flash message should be in main content area, not sidebar
                const mainWrapper = $('.main-wrapper');
                const flashInMain = mainWrapper.find('.alert-danger');
                expect(flashInMain.length).toBeGreaterThan(0);
                
                // Flash message should not be in sidebar
                const sidebar = $('.sidebar');
                const flashInSidebar = sidebar.find('.alert-danger');
                expect(flashInSidebar).toHaveLength(0);
                
                // Check positioning classes
                expect(errorAlert.hasClass('alert')).toBe(true);
                expect(errorAlert.hasClass('alert-danger')).toBe(true);
            }
        });

        // TC-ID: AC7-SUCCESS-MESSAGES
        it('should display success messages correctly positioned relative to new layout structure', async () => {
            // Create a successful action to generate success message
            const response = await agent
                .post('/signup')
                .send({
                    name: 'Success Test User',
                    email: 'success@test.com',
                    password: 'TestPass123'
                })
                .expect(302);

            // Follow redirect to see success message
            const followUp = await agent
                .get('/login')
                .expect(200);
            
            const $ = cheerio.load(followUp.text);
            
            const successAlert = $('.alert-success');
            if (successAlert.length > 0) {
                // Success message should be in main content area, not sidebar
                const mainWrapper = $('.main-wrapper');
                const flashInMain = mainWrapper.find('.alert-success');
                expect(flashInMain.length).toBeGreaterThan(0);
                
                // Success message should not be in sidebar
                const sidebar = $('.sidebar');
                const flashInSidebar = sidebar.find('.alert-success');
                expect(flashInSidebar).toHaveLength(0);
            }
        });

        // TC-ID: AC7-FLASH-CONTAINER
        it('should have proper container structure for flash messages', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify main wrapper contains content area
            const mainWrapper = $('.main-wrapper');
            expect(mainWrapper).toHaveLength(1);
            
            const contentArea = mainWrapper.find('.content-area');
            expect(contentArea).toHaveLength(1);
            
            // Check that flash message containers are properly positioned
            const alertContainers = $('.container-fluid');
            expect(alertContainers.length).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        // TC-ID: EDGE-UNAUTHENTICATED-DASHBOARD
        it('should redirect to login when accessing dashboard without authentication', async () => {
            const response = await agent
                .get('/dashboard')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });

        // TC-ID: EDGE-LAYOUT-RENDER-ERROR
        it('should handle layout rendering errors gracefully', async () => {
            const response = await agent
                .get('/non-existent-route')
                .expect(404);
            
            // Should still render basic layout structure
            const $ = cheerio.load(response.text);
            const sidebar = $('.sidebar');
            const mainWrapper = $('.main-wrapper');
            
            // Layout should still be present even on error pages
            expect(sidebar.length + mainWrapper.length).toBeGreaterThan(0);
        });

        // TC-ID: EDGE-RESPONSIVE-BEHAVIOR
        it('should maintain layout integrity across different viewport sizes', async () => {
            const response = await agent
                .get('/')
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const headContent = $('head').html();
            
            // Check that responsive breakpoints are defined
            const responsiveBreakpoints = [
                '@media (max-width: 768px)',
                '@media (max-width: 576px)',
                '@media (max-width: 400px)'
            ];
            
            responsiveBreakpoints.forEach(breakpoint => {
                expect(headContent).toContain(breakpoint);
            });
        });
    });
});