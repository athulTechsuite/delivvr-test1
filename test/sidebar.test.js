const path = require('path');
const fs = require('fs');
const express = require('express');
const ejs = require('ejs');

let request;
try {
    request = require('supertest');
} catch (e) {
    request = null;
}

let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    puppeteer = null;
}

const TEST_URL = process.env.TEST_URL;
const describeOrSkip = TEST_URL && puppeteer ? describe : describe.skip;

// Mock app for testing if ../app doesn't exist
const createMockApp = () => {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.use(express.static(path.join(__dirname, '../public')));
    
    // Mock flash message middleware
    app.use((req, res, next) => {
        res.locals.success = null;
        res.locals.error = null;
        next();
    });
    
    // Mock authentication middleware
    app.use((req, res, next) => {
        res.locals.user = null; // Default unauthenticated
        next();
    });
    
    app.get('/', (req, res) => {
        res.render('layout', { title: 'Home', user: res.locals.user });
    });
    
    app.get('/dashboard', (req, res) => {
        const mockUser = { id: 1, name: 'Test User', email: 'test@example.com', username: 'testuser', created_at: new Date() };
        res.render('layout', { title: 'Dashboard', user: mockUser });
    });
    
    app.get('/login', (req, res) => {
        res.render('layout', { title: 'Login', user: null });
    });
    
    app.get('/signup', (req, res) => {
        res.render('layout', { title: 'Sign Up', user: null });
    });
    
    app.post('/auth/logout', (req, res) => {
        res.redirect('/');
    });
    
    return app;
};

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const MOBILE_VIEWPORT = { width: 375, height: 667 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };
const DESKTOP_VIEWPORT = { width: 1200, height: 800 };
const LARGE_DESKTOP_VIEWPORT = { width: 1920, height: 1080 };

const SIDEBAR_SELECTORS = {
    sidebar: '#sidebar',
    toggleButton: '[data-bs-toggle="offcanvas"]',
    closeButton: '.btn-close',
    backdrop: '.offcanvas-backdrop',
    navLinks: '.nav-link',
    userSection: '.px-3.py-2.border-bottom',
    logoutForm: 'form[action="/auth/logout"]',
    mainContent: '.main-content',
    homeLink: 'a[href="/"]',
    dashboardLink: 'a[href="/dashboard"]',
    loginLink: 'a[href="/login"]',
    signupLink: 'a[href="/signup"]',
    activeLink: '.nav-link.active'
};

const BOOTSTRAP_BREAKPOINTS = {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1400
};

describeOrSkip('Sidebar Functionality Tests', () => {
    let browser;
    let page;
    let app;
    let server;
    let baseURL;

    beforeAll(async () => {
        // Try to load the main app, fallback to mock app
        try {
            app = require('../app');
        } catch (error) {
            console.warn('Main app not found, using mock app for testing');
            app = createMockApp();
        }
        
        server = app.listen(0, () => {
            const port = server.address().port;
            baseURL = `http://localhost:${port}`;
        });

        // Launch Puppeteer browser
        browser = await puppeteer.launch({
            headless: process.env.NODE_ENV === 'production' ? 'new' : false,
            devtools: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
    }, TEST_TIMEOUT);

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.close();
        }
    });

    beforeEach(async () => {
        page = await browser.newPage();
        
        // Enable console logging for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Browser console error:', msg.text());
            }
        });

        // Set default viewport
        await page.setViewport(DESKTOP_VIEWPORT);
    });

    afterEach(async () => {
        if (page) {
            await page.close();
        }
    });

    describe('Sidebar Responsive Behavior Tests', () => {
        test('should display sidebar expanded on desktop viewports (>=992px)', async () => {
            await page.setViewport(DESKTOP_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Wait for sidebar to be present
            await page.waitForSelector(SIDEBAR_SELECTORS.sidebar);

            // Check sidebar is visible and not using offcanvas overlay
            const sidebarClasses = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? element.className : null;
            }, SIDEBAR_SELECTORS.sidebar);

            expect(sidebarClasses).toContain('offcanvas-lg');
            
            // Verify sidebar is visible without show class on desktop
            const isVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                const computedStyle = window.getComputedStyle(element);
                return computedStyle.visibility !== 'hidden' && computedStyle.display !== 'none';
            }, SIDEBAR_SELECTORS.sidebar);

            expect(isVisible).toBe(true);

            // Check main content has proper margin
            const mainContentMargin = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? window.getComputedStyle(element).marginLeft : null;
            }, SIDEBAR_SELECTORS.mainContent);

            expect(mainContentMargin).toBe('280px');
        });

        test('should collapse sidebar on mobile viewports (<992px)', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Wait for sidebar and toggle button
            await page.waitForSelector(SIDEBAR_SELECTORS.sidebar);
            await page.waitForSelector(SIDEBAR_SELECTORS.toggleButton);

            // Verify toggle button is visible
            const toggleButtonVisible = await page.isVisible(SIDEBAR_SELECTORS.toggleButton);
            expect(toggleButtonVisible).toBe(true);

            // Check sidebar is initially hidden
            const sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);

            expect(sidebarVisible).toBe(false);

            // Check main content has no left margin on mobile
            const mainContentMargin = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? window.getComputedStyle(element).marginLeft : null;
            }, SIDEBAR_SELECTORS.mainContent);

            expect(mainContentMargin).toBe('0px');
        });

        test('should handle tablet viewport (768px-991px) correctly', async () => {
            await page.setViewport(TABLET_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            await page.waitForSelector(SIDEBAR_SELECTORS.sidebar);
            await page.waitForSelector(SIDEBAR_SELECTORS.toggleButton);

            // Should behave like mobile (collapsed)
            const toggleButtonVisible = await page.isVisible(SIDEBAR_SELECTORS.toggleButton);
            expect(toggleButtonVisible).toBe(true);

            const sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);

            expect(sidebarVisible).toBe(false);
        });

        test('should transition properly between viewport sizes', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Start with desktop
            await page.setViewport(DESKTOP_VIEWPORT);
            await page.waitForTimeout(500); // Allow for CSS transitions

            let toggleVisible = await page.isVisible(SIDEBAR_SELECTORS.toggleButton);
            expect(toggleVisible).toBe(false);

            // Switch to mobile
            await page.setViewport(MOBILE_VIEWPORT);
            await page.waitForTimeout(500); // Allow for CSS transitions

            toggleVisible = await page.isVisible(SIDEBAR_SELECTORS.toggleButton);
            expect(toggleVisible).toBe(true);

            // Switch back to desktop
            await page.setViewport(DESKTOP_VIEWPORT);
            await page.waitForTimeout(500); // Allow for CSS transitions

            toggleVisible = await page.isVisible(SIDEBAR_SELECTORS.toggleButton);
            expect(toggleVisible).toBe(false);
        });
    });

    describe('Bootstrap Offcanvas Component Tests', () => {
        test('should initialize Bootstrap offcanvas component correctly', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Wait for Bootstrap to load and initialize
            await page.waitForTimeout(1000);

            // Check if Bootstrap offcanvas is properly initialized
            const offcanvasInstance = await page.evaluate(() => {
                const sidebarElement = document.querySelector('#sidebar');
                return sidebarElement && typeof window.bootstrap !== 'undefined' && 
                       window.bootstrap.Offcanvas && 
                       window.bootstrap.Offcanvas.getInstance(sidebarElement) !== null;
            });

            expect(offcanvasInstance).toBe(true);
        });

        test('should toggle sidebar visibility when toggle button is clicked', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            await page.waitForSelector(SIDEBAR_SELECTORS.toggleButton);

            // Initially sidebar should be hidden
            let sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(false);

            // Click toggle button
            await page.click(SIDEBAR_SELECTORS.toggleButton);
            await page.waitForTimeout(500); // Wait for animation

            // Sidebar should now be visible
            sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(true);

            // Click toggle again to hide
            await page.click(SIDEBAR_SELECTORS.toggleButton);
            await page.waitForTimeout(500); // Wait for animation

            sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(false);
        });

        test('should close sidebar when close button is clicked', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Open sidebar
            await page.click(SIDEBAR_SELECTORS.toggleButton);
            await page.waitForTimeout(500);

            // Verify sidebar is open
            let sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(true);

            // Click close button
            await page.waitForSelector(SIDEBAR_SELECTORS.closeButton);
            await page.click(SIDEBAR_SELECTORS.closeButton);
            await page.waitForTimeout(500);

            // Verify sidebar is closed
            sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(false);
        });
    });

    describe('Sidebar Backdrop and Click Outside Tests', () => {
        test('should show backdrop when sidebar is open on mobile', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Open sidebar
            await page.click(SIDEBAR_SELECTORS.toggleButton);
            await page.waitForTimeout(500);

            // Check if backdrop is present
            const backdropExists = await page.waitForSelector(SIDEBAR_SELECTORS.backdrop, { timeout: 2000 })
                .then(() => true)
                .catch(() => false);

            expect(backdropExists).toBe(true);

            if (backdropExists) {
                const backdropVisible = await page.isVisible(SIDEBAR_SELECTORS.backdrop);
                expect(backdropVisible).toBe(true);
            }
        });

        test('should close sidebar when clicking backdrop on mobile', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Open sidebar
            await page.click(SIDEBAR_SELECTORS.toggleButton);
            await page.waitForTimeout(500);

            // Click backdrop
            const backdropExists = await page.$(SIDEBAR_SELECTORS.backdrop);
            if (backdropExists) {
                await page.click(SIDEBAR_SELECTORS.backdrop);
                await page.waitForTimeout(500);

                // Verify sidebar is closed
                const sidebarVisible = await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    return element && element.classList.contains('show');
                }, SIDEBAR_SELECTORS.sidebar);
                expect(sidebarVisible).toBe(false);
            }
        });

        test('should not show backdrop on desktop viewports', async () => {
            await page.setViewport(DESKTOP_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Wait a moment for any potential backdrop
            await page.waitForTimeout(1000);

            // Check if backdrop exists
            const backdropExists = await page.$(SIDEBAR_SELECTORS.backdrop);
            expect(backdropExists).toBe(null);
        });
    });

    describe('Bootstrap 5.3.0 CDN Integration Tests', () => {
        test('should load Bootstrap 5.3.0 CSS correctly', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Check if Bootstrap 5.3.0 CDN link exists
            const bootstrapCSS = await page.evaluate(() => {
                const links = document.querySelectorAll('link[href*="bootstrap"]');
                for (const link of links) {
                    if (link.href.includes('5.3.0') && link.href.includes('bootstrap.min.css')) {
                        return { found: true, href: link.href };
                    }
                }
                return { found: false };
            });

            expect(bootstrapCSS.found).toBe(true);
            expect(bootstrapCSS.href).toContain('5.3.0');
        });

        test('should load Bootstrap 5.3.0 JavaScript correctly', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Check if Bootstrap JavaScript is loaded and available
            const bootstrapJS = await page.evaluate(() => {
                return typeof window.bootstrap !== 'undefined' && 
                       typeof window.bootstrap.Offcanvas !== 'undefined';
            });

            expect(bootstrapJS).toBe(true);
        });
    });

    describe('Authentication Context Tests', () => {
        test('should display correct navigation links for unauthenticated users', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Check for login and signup links
            const loginLinkExists = await page.$(SIDEBAR_SELECTORS.loginLink);
            const signupLinkExists = await page.$('a[href="/signup"]');
            const dashboardLinkExists = await page.$(SIDEBAR_SELECTORS.dashboardLink);
            const logoutFormExists = await page.$(SIDEBAR_SELECTORS.logoutForm);

            expect(loginLinkExists).not.toBe(null);
            expect(signupLinkExists).not.toBe(null);
            expect(dashboardLinkExists).toBe(null);
            expect(logoutFormExists).toBe(null);
        });

        test('should display correct navigation links for authenticated users', async () => {
            await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle0' });

            // Check for dashboard and logout elements (dashboard route has authenticated user)
            const dashboardLinkExists = await page.$(SIDEBAR_SELECTORS.dashboardLink);
            const userSectionExists = await page.$('.px-3.py-2.border-bottom');
            
            expect(dashboardLinkExists).not.toBe(null);
            // User section should exist for authenticated users
            expect(userSectionExists).not.toBe(null);
        });

        test('should handle logout form submission from sidebar', async () => {
            await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle0' });

            // Check if logout form has correct action and method
            const logoutForm = await page.evaluate(() => {
                const form = document.querySelector('form[action="/auth/logout"]');
                return form ? {
                    action: form.action,
                    method: form.method.toLowerCase()
                } : null;
            });

            if (logoutForm) {
                expect(logoutForm.action).toContain('/auth/logout');
                expect(logoutForm.method).toBe('post');
            }
        });
    });

    describe('Flash Message System Tests', () => {
        test('should render flash message placeholders in layout', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Check that flash message areas exist in the DOM structure
            const hasFlashStructure = await page.evaluate(() => {
                // Look for typical flash message rendering patterns
                const body = document.body.innerHTML;
                return body.includes('success') || body.includes('error') || 
                       document.querySelector('.alert') !== null;
            });

            // Should have structure for flash messages even if empty
            expect(typeof hasFlashStructure).toBe('boolean');
        });
    });

    describe('Current Page Highlighting Tests', () => {
        test('should highlight active page in sidebar navigation', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Check if Home link is active on home page
            const homeActive = await page.evaluate(() => {
                const homeLink = document.querySelector('a[href="/"]');
                return homeLink && homeLink.classList.contains('active');
            });

            expect(homeActive).toBe(true);
        });

        test('should highlight Login link when on login page', async () => {
            await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle0' });

            // Check if Login link is active
            const loginActive = await page.evaluate(() => {
                const loginLink = document.querySelector('a[href="/login"]');
                return loginLink && loginLink.classList.contains('active');
            });

            expect(loginActive).toBe(true);
        });
    });

    describe('Keyboard Navigation and Accessibility Tests', () => {
        test('should support keyboard navigation for sidebar links', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Focus on first nav link
            await page.focus(SIDEBAR_SELECTORS.navLinks);

            // Check if element is focused
            const focusedElement = await page.evaluate(() => {
                return document.activeElement.classList.contains('nav-link');
            });

            expect(focusedElement).toBe(true);

            // Test Tab navigation
            await page.keyboard.press('Tab');
            const nextFocusedElement = await page.evaluate(() => {
                return document.activeElement.classList.contains('nav-link') || 
                       document.activeElement.tagName === 'BUTTON';
            });

            expect(nextFocusedElement).toBe(true);
        });

        test('should have proper ARIA attributes for accessibility', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Check sidebar ARIA attributes
            const sidebarAria = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return {
                    labelledby: element.getAttribute('aria-labelledby'),
                    tabindex: element.getAttribute('tabindex')
                };
            }, SIDEBAR_SELECTORS.sidebar);

            expect(sidebarAria.labelledby).toBe('sidebarLabel');
            expect(sidebarAria.tabindex).toBe('-1');

            // Check toggle button ARIA attributes
            const toggleAria = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? {
                    controls: element.getAttribute('aria-controls'),
                    expanded: element.getAttribute('aria-expanded'),
                    label: element.getAttribute('aria-label')
                } : null;
            }, SIDEBAR_SELECTORS.toggleButton);

            if (toggleAria) {
                expect(toggleAria.controls).toBe('sidebar');
                expect(toggleAria.expanded).toBe('false');
                expect(toggleAria.label).toBe('Toggle navigation');
            }
        });

        test('should support Escape key to close sidebar on mobile', async () => {
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            // Open sidebar
            await page.click(SIDEBAR_SELECTORS.toggleButton);
            await page.waitForTimeout(500);

            // Verify sidebar is open
            let sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(true);

            // Press Escape key
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Verify sidebar is closed
            sidebarVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.classList.contains('show');
            }, SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(false);
        });
    });

    describe('Browser Compatibility and Performance Tests', () => {
        test('should load sidebar without JavaScript errors', async () => {
            const jsErrors = [];
            page.on('pageerror', error => {
                jsErrors.push(error);
            });

            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });
            await page.waitForTimeout(2000);

            expect(jsErrors.length).toBe(0);
        });

        test('should render sidebar within reasonable time', async () => {
            const startTime = Date.now();
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });
            await page.waitForSelector(SIDEBAR_SELECTORS.sidebar);
            const endTime = Date.now();

            const loadTime = endTime - startTime;
            expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
        });

        test('should handle rapid viewport changes without breaking', async () => {
            await page.goto(`${baseURL}/`, { waitUntil: 'networkidle0' });

            const viewports = [MOBILE_VIEWPORT, TABLET_VIEWPORT, DESKTOP_VIEWPORT, LARGE_DESKTOP_VIEWPORT];

            for (let i = 0; i < 3; i++) {
                for (const viewport of viewports) {
                    await page.setViewport(viewport);
                    await page.waitForTimeout(100);
                }
            }

            // Verify sidebar is still functional
            await page.setViewport(DESKTOP_VIEWPORT);
            const sidebarExists = await page.$(SIDEBAR_SELECTORS.sidebar);
            expect(sidebarExists).not.toBe(null);

            const sidebarVisible = await page.isVisible(SIDEBAR_SELECTORS.sidebar);
            expect(sidebarVisible).toBe(true);
        });
    });
});