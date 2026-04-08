const request = require('supertest');
const cheerio = require('cheerio');
const jwt = require('jsonwebtoken');
const app = require('../app');

describe('Responsive Sidebar Layout - Bootstrap Integration', () => {
    let authenticatedAgent;
    let validToken;

    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

    beforeEach(() => {
        authenticatedAgent = request.agent(app);
        
        // Create valid JWT token
        validToken = jwt.sign(
            { userId: 1, email: 'test@example.com' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    });

    // TC-007: Bootstrap Framework Integration Tests
    describe('TC-007: Bootstrap Framework Integration', () => {
        test('TC-007-CSS: should load Bootstrap 5.3.0 CSS framework', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify Bootstrap CSS is loaded from CDN
            expect(response.text).toContain('bootstrap@5.3.0/dist/css/bootstrap.min.css');
            expect(response.text).toContain('cdn.jsdelivr.net');
        });

        test('TC-007-Icons: should load Bootstrap Icons library', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify Bootstrap Icons are loaded
            expect(response.text).toContain('bootstrap-icons@1.10.0/font/bootstrap-icons.css');
            
            const $ = cheerio.load(response.text);
            
            // Verify specific icons are used
            expect($('i.bi-house-door').length).toBe(1); // Dashboard icon
            expect($('i.bi-person').length).toBe(1); // Profile icon
            expect($('i.bi-gear').length).toBe(1); // Settings icon
            expect($('i.bi-box-arrow-right').length).toBe(1); // Logout icon
        });

        test('TC-007-Grid: should use Bootstrap grid system properly', async () => {
            const response = await authenticatedAgent
                .get('/profile')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify Bootstrap grid classes are used
            expect($('.row').length).toBeGreaterThan(0);
            expect($('.col-md-6').length).toBeGreaterThan(0);
            expect($('.col-md-12, .col-12').length).toBeGreaterThan(0);
        });

        test('TC-007-Components: should use Bootstrap components (cards, forms, buttons)', async () => {
            const response = await authenticatedAgent
                .get('/settings')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify Bootstrap components
            expect($('.card').length).toBeGreaterThan(0);
            expect($('.card-header').length).toBeGreaterThan(0);
            expect($('.card-body').length).toBeGreaterThan(0);
            expect($('.btn').length).toBeGreaterThan(0);
            expect($('.form-control').length).toBeGreaterThan(0);
            expect($('.form-select').length).toBeGreaterThan(0);
            expect($('.form-check').length).toBeGreaterThan(0);
        });
    });

    // TC-008: Mobile Responsive Behavior Tests
    describe('TC-008: Mobile Responsive Behavior', () => {
        test('TC-008-Toggle: should include mobile sidebar toggle functionality', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify mobile toggle button exists
            const mobileToggle = $('.sidebar-toggle.d-md-none');
            expect(mobileToggle.length).toBe(1);
            expect(mobileToggle.attr('id')).toBe('sidebarToggle');
            
            // Verify desktop collapse button exists
            const desktopToggle = $('.sidebar-toggle.d-none.d-md-block');
            expect(desktopToggle.length).toBe(1);
            expect(desktopToggle.attr('id')).toBe('sidebarCollapse');
        });

        test('TC-008-Overlay: should include sidebar overlay for mobile', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify sidebar overlay exists
            const overlay = $('.sidebar-overlay');
            expect(overlay.length).toBe(1);
            expect(overlay.attr('id')).toBe('sidebarOverlay');
        });

        test('TC-008-CSS: should contain mobile-responsive CSS media queries', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify mobile media query exists
            expect(response.text).toContain('@media (max-width: 768px)');
            
            // Verify mobile-specific CSS rules
            expect(response.text).toContain('transform: translateX(-100%)');
            expect(response.text).toContain('sidebar.show');
            expect(response.text).toContain('sidebar-overlay.show');
            expect(response.text).toContain('margin-left: 0');
        });

        test('TC-008-Breakpoints: should use Bootstrap responsive utilities', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify Bootstrap responsive display utilities
            expect($('.d-md-none').length).toBeGreaterThan(0);
            expect($('.d-none.d-md-block').length).toBeGreaterThan(0);
            expect($('.d-flex').length).toBeGreaterThan(0);
        });
    });

    // TC-009: Sidebar Layout Structure Tests
    describe('TC-009: Sidebar Layout Structure', () => {
        test('TC-009-Variables: should define CSS custom properties for layout dimensions', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify CSS custom properties
            expect(response.text).toContain('--sidebar-width: 280px');
            expect(response.text).toContain('--sidebar-collapsed-width: 60px');
            expect(response.text).toContain(':root');
        });

        test('TC-009-Positioning: should use fixed positioning for sidebar', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify sidebar positioning CSS
            expect(response.text).toContain('position: fixed');
            expect(response.text).toContain('height: 100vh');
            expect(response.text).toContain('z-index: 1000');
        });

        test('TC-009-Margins: should adjust main content margin based on sidebar state', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify main content margin adjustments
            expect(response.text).toContain('margin-left: var(--sidebar-width)');
            expect(response.text).toContain('main-content.expanded');
            expect(response.text).toContain('margin-left: var(--sidebar-collapsed-width)');
        });

        test('TC-009-Transitions: should include smooth transitions for responsive behavior', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify CSS transitions
            expect(response.text).toContain('transition: all 0.3s');
            expect(response.text).toContain('cubic-bezier(0.4, 0, 0.2, 1)');
        });
    });

    // TC-010: Cross-Browser Compatibility Tests
    describe('TC-010: Cross-Browser Compatibility', () => {
        test('TC-010-Viewport: should include proper viewport meta tag', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify viewport meta tag
            const viewport = $('meta[name="viewport"]');
            expect(viewport.length).toBe(1);
            expect(viewport.attr('content')).toContain('width=device-width');
            expect(viewport.attr('content')).toContain('initial-scale=1.0');
        });

        test('TC-010-Flexbox: should use modern CSS flexbox for layout', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify flexbox usage
            expect(response.text).toContain('display: flex');
            expect(response.text).toContain('align-items: center');
            expect(response.text).toContain('justify-content:');
        });

        test('TC-010-Fallbacks: should include CSS fallbacks for older browsers', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify fallback colors and styles
            expect(response.text).toContain('background-color: #');
            expect(response.text).toContain('border-radius:');
        });
    });

    // TC-011: Layout Consistency Tests
    describe('TC-011: Layout Consistency Across Pages', () => {
        const protectedPages = ['/dashboard', '/profile', '/settings'];

        protectedPages.forEach((page) => {
            test(`TC-011-${page.replace('/', '')}: should maintain consistent sidebar layout on ${page}`, async () => {
                const response = await authenticatedAgent
                    .get(page)
                    .set('Cookie', [`token=${validToken}`]);

                expect(response.status).toBe(200);
                
                const $ = cheerio.load(response.text);
                
                // Verify consistent layout elements
                expect($('.sidebar').length).toBe(1);
                expect($('.main-content').length).toBe(1);
                expect($('.content-header').length).toBe(1);
                expect($('.content-body').length).toBe(1);
                
                // Verify navigation menu is present
                expect($('.sidebar-nav').length).toBe(1);
                expect($('.nav-link').length).toBeGreaterThanOrEqual(3);
                
                // Verify logout button is present
                expect($('.logout-btn').length).toBe(1);
            });
        });

        test('TC-011-ActiveState: should highlight correct active menu item per page', async () => {
            const pageTestCases = [
                { path: '/dashboard', activeHref: '/dashboard' },
                { path: '/profile', activeHref: '/profile' },
                { path: '/settings', activeHref: '/settings' }
            ];

            for (const testCase of pageTestCases) {
                const response = await authenticatedAgent
                    .get(testCase.path)
                    .set('Cookie', [`token=${validToken}`]);

                expect(response.status).toBe(200);
                
                const $ = cheerio.load(response.text);
                
                // Verify correct active state
                const activeLink = $(`.nav-link[href="${testCase.activeHref}"]`);
                expect(activeLink.hasClass('active')).toBe(true);
                
                // Verify other links are not active
                const otherLinks = $('.nav-link').not(`[href="${testCase.activeHref}"]`);
                otherLinks.each((_, element) => {
                    expect($(element).hasClass('active')).toBe(false);
                });
            }
        });
    });

    // TC-012: Performance and Optimization Tests
    describe('TC-012: Performance and Optimization', () => {
        test('TC-012-CDN: should load Bootstrap from CDN for performance', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify CDN usage
            expect(response.text).toContain('cdn.jsdelivr.net');
            expect(response.text).toContain('bootstrap@5.3.0');
            expect(response.text).toContain('bootstrap-icons@1.10.0');
        });

        test('TC-012-CSS: should minimize custom CSS and reuse Bootstrap classes', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify Bootstrap utility classes are used
            expect($('.d-flex').length).toBeGreaterThan(0);
            expect($('.justify-content-between').length).toBeGreaterThan(0);
            expect($('.align-items-center').length).toBeGreaterThan(0);
            expect($('.mb-0, .mb-2, .mb-3, .mb-4').length).toBeGreaterThan(0);
        });

        test('TC-012-Layout: should use efficient layout techniques', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify efficient CSS selectors and properties
            expect(response.text).toContain('transform: translateX');
            expect(response.text).toContain('will-change: transform');
            expect(response.text).not.toContain('!important'); // Minimize !important usage
        });
    });
});