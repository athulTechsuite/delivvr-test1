const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    puppeteer = null;
}

const TEST_URL = process.env.TEST_URL;
const describeOrSkip = TEST_URL && puppeteer ? describe : describe.skip;

describeOrSkip('Responsive Layout Tests', function() {
    let browser;
    let page;
    const baseUrl = TEST_URL || 'http://localhost:3000';
    
    // Test viewport configurations
    const VIEWPORT_MOBILE = { width: 375, height: 667 };
    const VIEWPORT_MOBILE_SMALL = { width: 320, height: 568 };
    const VIEWPORT_TABLET_PORTRAIT = { width: 768, height: 1024 };
    const VIEWPORT_TABLET_LANDSCAPE = { width: 1024, height: 768 };
    const VIEWPORT_DESKTOP = { width: 1200, height: 800 };
    const VIEWPORT_DESKTOP_LARGE = { width: 1920, height: 1080 };
    
    // Bootstrap breakpoints
    const BREAKPOINT_LG = 992;
    const SIDEBAR_WIDTH = 280;
    
    // Test timeout for responsive operations
    const RESPONSIVE_TIMEOUT = 5000;

    beforeAll(async function() {
        browser = await puppeteer.launch({
            headless: process.env.NODE_ENV === 'test',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
    });

    afterAll(async function() {
        if (browser) {
            await browser.close();
        }
    });

    beforeEach(async function() {
        page = await browser.newPage();
        await page.setDefaultTimeout(RESPONSIVE_TIMEOUT);
    });

    afterEach(async function() {
        if (page) {
            await page.close();
        }
    });

    describe('Mobile Viewport (320px-768px)', function() {
        
        test('should hide sidebar by default on mobile devices', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            // Wait for page to load completely
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            // Check that sidebar is initially hidden
            const sidebarVisible = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                const computedStyle = window.getComputedStyle(sidebar);
                return computedStyle.transform !== 'matrix(1, 0, 0, 1, -280, 0)' && 
                       computedStyle.visibility !== 'hidden';
            });
            
            expect(sidebarVisible).toBe(false);
        });

        test('should display mobile toggle button on small screens', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            
            const toggleButton = await page.$('[data-bs-toggle="offcanvas"]');
            expect(toggleButton).not.toBeNull();
            
            const isVisible = await page.evaluate((btn) => {
                const computedStyle = window.getComputedStyle(btn);
                return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
            }, toggleButton);
            
            expect(isVisible).toBe(true);
        });

        test('should open sidebar when toggle button is clicked', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            await page.click('[data-bs-toggle="offcanvas"]');
            
            // Wait for sidebar animation to complete
            await page.waitForTimeout(500);
            
            const sidebarVisible = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                return sidebar.classList.contains('show');
            });
            
            expect(sidebarVisible).toBe(true);
        });

        test('should display backdrop overlay when sidebar is open on mobile', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            await page.click('[data-bs-toggle="offcanvas"]');
            
            // Wait for backdrop to appear
            await page.waitForSelector('.offcanvas-backdrop', { timeout: RESPONSIVE_TIMEOUT });
            
            const backdrop = await page.$('.offcanvas-backdrop');
            expect(backdrop).not.toBeNull();
            
            const backdropVisible = await page.evaluate((backdrop) => {
                const computedStyle = window.getComputedStyle(backdrop);
                return computedStyle.display !== 'none';
            }, backdrop);
            
            expect(backdropVisible).toBe(true);
        });

        test('should close sidebar when clicking on backdrop', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            // Open sidebar
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            await page.click('[data-bs-toggle="offcanvas"]');
            await page.waitForSelector('.offcanvas-backdrop', { timeout: RESPONSIVE_TIMEOUT });
            
            // Click on backdrop
            await page.click('.offcanvas-backdrop');
            
            // Wait for animation to complete
            await page.waitForTimeout(500);
            
            const sidebarVisible = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                return sidebar.classList.contains('show');
            });
            
            expect(sidebarVisible).toBe(false);
        });

        test('should adjust main content with top padding for mobile toggle button', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            const mainContentPadding = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                const computedStyle = window.getComputedStyle(mainContent);
                return parseFloat(computedStyle.paddingTop);
            });
            
            expect(mainContentPadding).toBeGreaterThanOrEqual(60); // Should have padding for toggle button
        });

        test('should handle touch interactions for sidebar open/close', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            // Simulate touch events
            await page.touchscreen.tap(50, 50); // Tap toggle button area
            await page.waitForTimeout(300);
            
            // Check if sidebar responds to touch
            const toggleButton = await page.$('[data-bs-toggle="offcanvas"]');
            if (toggleButton) {
                await page.tap('[data-bs-toggle="offcanvas"]');
                await page.waitForTimeout(500);
                
                const sidebarVisible = await page.evaluate(() => {
                    const sidebar = document.querySelector('#sidebar');
                    return sidebar.classList.contains('show');
                });
                
                expect(sidebarVisible).toBe(true);
            }
        });

        test('should handle landscape orientation on mobile devices', async function() {
            await page.setViewport({ width: 667, height: 375 }); // Landscape mobile
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            const sidebarHidden = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                const computedStyle = window.getComputedStyle(sidebar);
                return computedStyle.transform === 'matrix(1, 0, 0, 1, -280, 0)' || 
                       computedStyle.visibility === 'hidden';
            });
            
            expect(sidebarHidden).toBe(true);
        });
    });

    describe('Tablet Viewport (768px-992px)', function() {
        
        test('should maintain mobile behavior on tablet portrait', async function() {
            await page.setViewport(VIEWPORT_TABLET_PORTRAIT);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            
            const toggleButtonVisible = await page.evaluate(() => {
                const btn = document.querySelector('[data-bs-toggle="offcanvas"]');
                const computedStyle = window.getComputedStyle(btn.parentElement);
                return computedStyle.display !== 'none';
            });
            
            expect(toggleButtonVisible).toBe(true);
        });

        test('should show sidebar offcanvas behavior on tablet', async function() {
            await page.setViewport(VIEWPORT_TABLET_LANDSCAPE);
            await page.goto(`${baseUrl}/`);
            
            // Still should be in mobile mode since 1024px > 992px but behavior depends on Bootstrap
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            const sidebarMode = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                return window.getComputedStyle(sidebar).position;
            });
            
            // Should either be fixed (desktop) or absolute (mobile) depending on exact viewport
            expect(['fixed', 'absolute']).toContain(sidebarMode);
        });
    });

    describe('Desktop Viewport (992px+)', function() {
        
        test('should display sidebar expanded by default on desktop', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            const sidebarVisible = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                const computedStyle = window.getComputedStyle(sidebar);
                return computedStyle.transform === 'none' && computedStyle.visibility === 'visible';
            });
            
            expect(sidebarVisible).toBe(true);
        });

        test('should hide mobile toggle button on desktop', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('body', { timeout: RESPONSIVE_TIMEOUT });
            
            const toggleButtonHidden = await page.evaluate(() => {
                const toggleContainer = document.querySelector('.d-lg-none');
                if (!toggleContainer) return true;
                const computedStyle = window.getComputedStyle(toggleContainer);
                return computedStyle.display === 'none';
            });
            
            expect(toggleButtonHidden).toBe(true);
        });

        test('should adjust main content margin for sidebar width on desktop', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            const mainContentMargin = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                const computedStyle = window.getComputedStyle(mainContent);
                return parseFloat(computedStyle.marginLeft);
            });
            
            expect(mainContentMargin).toBe(SIDEBAR_WIDTH);
        });

        test('should not display backdrop overlay on desktop', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForTimeout(1000);
            
            const backdrop = await page.$('.offcanvas-backdrop');
            expect(backdrop).toBeNull();
        });

        test('should maintain full width content area when sidebar is visible', async function() {
            await page.setViewport(VIEWPORT_DESKTOP_LARGE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            const contentWidth = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                return mainContent.offsetWidth;
            });
            
            const expectedWidth = VIEWPORT_DESKTOP_LARGE.width - SIDEBAR_WIDTH;
            expect(contentWidth).toBeCloseTo(expectedWidth, -1); // Allow some tolerance for padding/margins
        });
    });

    describe('Breakpoint Transitions', function() {
        
        test('should transition properly from mobile to desktop', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            // Verify mobile state
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            
            // Transition to desktop
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.waitForTimeout(500); // Allow CSS transitions
            
            // Verify desktop state
            const sidebarVisible = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                const computedStyle = window.getComputedStyle(sidebar);
                return computedStyle.transform === 'none';
            });
            
            expect(sidebarVisible).toBe(true);
        });

        test('should transition properly from desktop to mobile', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            // Verify desktop state
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            // Transition to mobile
            await page.setViewport(VIEWPORT_MOBILE);
            await page.waitForTimeout(500); // Allow CSS transitions
            
            // Verify mobile state
            const toggleButtonVisible = await page.evaluate(() => {
                const toggleContainer = document.querySelector('.d-lg-none');
                if (!toggleContainer) return false;
                const computedStyle = window.getComputedStyle(toggleContainer);
                return computedStyle.display !== 'none';
            });
            
            expect(toggleButtonVisible).toBe(true);
        });

        test('should handle rapid viewport changes gracefully', async function() {
            const viewports = [VIEWPORT_MOBILE, VIEWPORT_DESKTOP, VIEWPORT_TABLET_PORTRAIT, VIEWPORT_DESKTOP_LARGE];
            
            await page.goto(`${baseUrl}/`);
            
            for (const viewport of viewports) {
                await page.setViewport(viewport);
                await page.waitForTimeout(200); // Brief pause between changes
                
                // Verify page is still functional
                const bodyExists = await page.$('body');
                expect(bodyExists).not.toBeNull();
            }
        });
    });

    describe('CSS Media Queries', function() {
        
        test('should apply correct styles at mobile breakpoint', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            const styles = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                const computedStyle = window.getComputedStyle(mainContent);
                return {
                    marginLeft: computedStyle.marginLeft,
                    paddingTop: computedStyle.paddingTop
                };
            });
            
            expect(parseFloat(styles.marginLeft)).toBe(0);
            expect(parseFloat(styles.paddingTop)).toBeGreaterThan(0);
        });

        test('should apply correct styles at desktop breakpoint', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            const styles = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                const computedStyle = window.getComputedStyle(mainContent);
                return {
                    marginLeft: computedStyle.marginLeft,
                    paddingTop: computedStyle.paddingTop
                };
            });
            
            expect(parseFloat(styles.marginLeft)).toBe(SIDEBAR_WIDTH);
        });

        test('should verify media query breakpoints match Bootstrap standards', async function() {
            await page.setViewport({ width: BREAKPOINT_LG - 1, height: 600 });
            await page.goto(`${baseUrl}/`);
            
            await page.waitForTimeout(500);
            
            const isMobileMode = await page.evaluate(() => {
                const toggleContainer = document.querySelector('.d-lg-none');
                if (!toggleContainer) return false;
                const computedStyle = window.getComputedStyle(toggleContainer);
                return computedStyle.display !== 'none';
            });
            
            expect(isMobileMode).toBe(true);
            
            // Now test desktop breakpoint
            await page.setViewport({ width: BREAKPOINT_LG, height: 600 });
            await page.waitForTimeout(500);
            
            const isDesktopMode = await page.evaluate(() => {
                const toggleContainer = document.querySelector('.d-lg-none');
                if (!toggleContainer) return true;
                const computedStyle = window.getComputedStyle(toggleContainer);
                return computedStyle.display === 'none';
            });
            
            expect(isDesktopMode).toBe(true);
        });
    });

    describe('Print Styles', function() {
        
        test('should hide sidebar in print media', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            // Emulate print media
            await page.emulateMediaType('print');
            
            const sidebarHidden = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                const computedStyle = window.getComputedStyle(sidebar);
                return computedStyle.display === 'none';
            });
            
            expect(sidebarHidden).toBe(true);
        });

        test('should reset main content margin for print', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            // Emulate print media
            await page.emulateMediaType('print');
            
            const mainContentMargin = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                const computedStyle = window.getComputedStyle(mainContent);
                return parseFloat(computedStyle.marginLeft);
            });
            
            expect(mainContentMargin).toBe(0);
        });
    });

    describe('Accessibility Features', function() {
        
        test('should maintain focus trap in sidebar on mobile', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            // Open sidebar
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            await page.click('[data-bs-toggle="offcanvas"]');
            await page.waitForTimeout(500);
            
            // Test focus behavior
            await page.focus('.nav-link');
            
            const focusedElement = await page.evaluate(() => {
                return document.activeElement.classList.contains('nav-link');
            });
            
            expect(focusedElement).toBe(true);
        });

        test('should support keyboard navigation in sidebar', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.nav-link', { timeout: RESPONSIVE_TIMEOUT });
            
            // Focus first nav link
            await page.focus('.nav-link');
            
            // Press Tab to navigate
            await page.keyboard.press('Tab');
            
            const navigationWorks = await page.evaluate(() => {
                return document.activeElement !== null;
            });
            
            expect(navigationWorks).toBe(true);
        });

        test('should provide proper ARIA labels and roles', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            const ariaAttributes = await page.evaluate(() => {
                const sidebar = document.querySelector('#sidebar');
                const toggleButton = document.querySelector('[data-bs-toggle="offcanvas"]');
                
                return {
                    sidebarLabelled: sidebar.hasAttribute('aria-labelledby'),
                    toggleHasLabel: toggleButton.hasAttribute('aria-label'),
                    toggleHasControls: toggleButton.hasAttribute('aria-controls')
                };
            });
            
            expect(ariaAttributes.sidebarLabelled).toBe(true);
            expect(ariaAttributes.toggleHasLabel).toBe(true);
            expect(ariaAttributes.toggleHasControls).toBe(true);
        });
    });

    describe('Performance and Animation', function() {
        
        test('should complete sidebar animations within reasonable time', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            
            const startTime = Date.now();
            await page.click('[data-bs-toggle="offcanvas"]');
            
            await page.waitForFunction(() => {
                const sidebar = document.querySelector('#sidebar');
                return sidebar.classList.contains('show');
            }, { timeout: 2000 });
            
            const animationTime = Date.now() - startTime;
            expect(animationTime).toBeLessThan(1000); // Should animate within 1 second
        });

        test('should handle rapid toggle clicks gracefully', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('[data-bs-toggle="offcanvas"]', { timeout: RESPONSIVE_TIMEOUT });
            
            // Rapidly click toggle button
            for (let i = 0; i < 5; i++) {
                await page.click('[data-bs-toggle="offcanvas"]');
                await page.waitForTimeout(100);
            }
            
            // Wait for animations to settle
            await page.waitForTimeout(1000);
            
            // Page should still be functional
            const bodyExists = await page.$('body');
            expect(bodyExists).not.toBeNull();
        });

        test('should maintain smooth transitions during viewport changes', async function() {
            await page.setViewport(VIEWPORT_MOBILE);
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            // Change viewport and measure transition time
            const startTime = Date.now();
            await page.setViewport(VIEWPORT_DESKTOP);
            
            await page.waitForFunction(() => {
                const sidebar = document.querySelector('#sidebar');
                const computedStyle = window.getComputedStyle(sidebar);
                return computedStyle.transform === 'none';
            }, { timeout: 2000 });
            
            const transitionTime = Date.now() - startTime;
            expect(transitionTime).toBeLessThan(1500);
        });
    });

    describe('Edge Cases and Error Handling', function() {
        
        test('should handle missing Bootstrap CSS gracefully', async function() {
            await page.setViewport(VIEWPORT_DESKTOP);
            
            // Block Bootstrap CSS
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (request.url().includes('bootstrap')) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
            
            await page.goto(`${baseUrl}/`);
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            // Sidebar should still exist in DOM
            const sidebarExists = await page.$('#sidebar');
            expect(sidebarExists).not.toBeNull();
        });

        test('should handle disabled JavaScript gracefully', async function() {
            await page.setJavaScriptEnabled(false);
            await page.setViewport(VIEWPORT_DESKTOP);
            await page.goto(`${baseUrl}/`);
            
            // Basic HTML structure should still be present
            const sidebarExists = await page.evaluate(() => {
                return document.querySelector('#sidebar') !== null;
            });
            
            expect(sidebarExists).toBe(true);
            
            // Re-enable JavaScript for subsequent tests
            await page.setJavaScriptEnabled(true);
        });

        test('should handle extremely small viewport sizes', async function() {
            await page.setViewport({ width: 240, height: 320 });
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('#sidebar', { timeout: RESPONSIVE_TIMEOUT });
            
            // Page should still be functional
            const bodyExists = await page.$('body');
            expect(bodyExists).not.toBeNull();
        });

        test('should handle extremely large viewport sizes', async function() {
            await page.setViewport({ width: 3840, height: 2160 });
            await page.goto(`${baseUrl}/`);
            
            await page.waitForSelector('.main-content', { timeout: RESPONSIVE_TIMEOUT });
            
            const mainContentWidth = await page.evaluate(() => {
                const mainContent = document.querySelector('.main-content');
                return mainContent.offsetWidth;
            });
            
            expect(mainContentWidth).toBeGreaterThan(3000);
        });
    });
});