const request = require('supertest');
const jwt = require('jsonwebtoken');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const path = require('path');

// Import the actual app
const app = require('../app');

// Test constants
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const DESKTOP_WIDTH = 1200;
const TABLET_WIDTH = 768;
const MOBILE_WIDTH = 375;
const SIDEBAR_WIDTH = 250;

// Mock user for testing
const MOCK_USER = {
    userId: 1,
    name: 'Test User',
    email: 'test@example.com'
};

function generateTestToken() {
    return jwt.sign(MOCK_USER, JWT_SECRET, { expiresIn: '1h' });
}

function extractCSSRules(html) {
    const $ = cheerio.load(html);
    const styleTags = $('style').text();
    const linkTags = $('link[rel="stylesheet"]');
    
    return {
        inlineStyles: styleTags,
        externalStylesheets: linkTags.length,
        hasBootstrap: html.includes('bootstrap@5.3.0'),
        hasCustomStyles: html.includes('/css/style.css')
    };
}

function checkResponsiveElements(html) {
    return {
        hasSidebar: html.includes('class="sidebar"'),
        hasHamburgerBtn: html.includes('hamburger-btn'),
        hasMainContent: html.includes('main-content'),
        hasOverlay: html.includes('sidebar-overlay'),
        hasMediaQueries: html.includes('@media'),
        hasBootstrapClasses: html.includes('col-') && html.includes('row')
    };
}

function validateBootstrapIntegration(html) {
    const $ = cheerio.load(html);
    
    return {
        hasBootstrap5: html.includes('bootstrap@5.3.0'),
        hasBootstrapIcons: html.includes('bootstrap-icons'),
        hasCards: $('.card').length > 0,
        hasButtons: $('.btn').length > 0,
        hasAlerts: $('.alert').length > 0,
        hasNavigation: $('.nav-link').length > 0,
        hasFormControls: $('.form-control').length > 0
    };
}

function checkAccessibility(html) {
    const $ = cheerio.load(html);
    
    return {
        hasAriaLabels: $('[aria-label]').length > 0,
        hasProperHeadings: $('h1').length > 0 && $('h2').length > 0,
        hasFormLabels: $('label').length > 0,
        hasRoleAttributes: $('[role]').length > 0,
        hasSemanticHTML: $('nav').length > 0 && $('main').length > 0,
        hasFocusStyles: html.includes(':focus')
    };
}

describe('Responsive Design and Bootstrap Integration Tests', () => {
    let browser;
    let page;
    
    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    });
    
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });
    
    beforeEach(async () => {
        page = await browser.newPage();
    });
    
    afterEach(async () => {
        if (page) {
            await page.close();
        }
    });
    
    describe('AC18: Bootstrap 5 framework maintained throughout new navigation structure', () => {
        test('TC-049: Should include Bootstrap 5 CSS and JS', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const bootstrap = validateBootstrapIntegration(response.text);
            expect(bootstrap.hasBootstrap5).toBe(true);
            expect(response.text).toContain('bootstrap@5.3.0');
            expect(response.text).toContain('bootstrap.bundle.min.js');
        });
        
        test('TC-050: Should use Bootstrap 5 components consistently', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const bootstrap = validateBootstrapIntegration(response.text);
            expect(bootstrap.hasCards).toBe(true);
            expect(bootstrap.hasButtons).toBe(true);
            expect(bootstrap.hasAlerts).toBe(true);
            expect(bootstrap.hasNavigation).toBe(true);
        });
        
        test('TC-051: Should use Bootstrap icons throughout navigation', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('bootstrap-icons');
            expect(response.text).toContain('bi-');
            expect(response.text).toContain('bi-speedometer2'); // Dashboard icon
            expect(response.text).toContain('bi-person'); // Profile icon
            expect(response.text).toContain('bi-gear'); // Settings icon
        });
    });
    
    describe('AC19: EJS templating patterns consistent across all new pages', () => {
        test('TC-052: All pages should use consistent EJS structure', async () => {
            const token = generateTestToken();
            const pages = ['/dashboard', '/profile', '/settings'];
            
            for (const pagePath of pages) {
                const response = await request(app)
                    .get(pagePath)
                    .set('Cookie', [`token=${token}`])
                    .expect(200);
                
                expect(response.text).toContain('<!DOCTYPE html>');
                expect(response.text).toContain('<%= title %>');
                expect(response.text).toContain('sidebar');
                expect(response.text).toContain('main-content');
            }
        });
        
        test('TC-053: All pages should include user context variables', async () => {
            const token = generateTestToken();
            const pages = ['/dashboard', '/profile', '/settings'];
            
            for (const pagePath of pages) {
                const response = await request(app)
                    .get(pagePath)
                    .set('Cookie', [`token=${token}`])
                    .expect(200);
                
                expect(response.text).toContain(MOCK_USER.name);
                expect(response.text).toContain('user');
                expect(response.text).toContain('currentPath');
            }
        });
        
        test('TC-054: Template should handle missing variables gracefully', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('typeof user !== \'undefined\'');
            expect(response.text).toContain('typeof success !== \'undefined\'');
            expect(response.text).toContain('typeof error !== \'undefined\'');
        });
    });
    
    describe('AC21: Success/error flash messages continue to display in layout', () => {
        test('TC-055: Should display success flash messages', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard?success=Test success message')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('alert-success');
            expect(response.text).toContain('Test success message');
        });
        
        test('TC-056: Should display error flash messages', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/profile?error=Test error message')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('alert-danger');
            expect(response.text).toContain('Test error message');
        });
        
        test('TC-057: Flash messages should be dismissible', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/settings?success=Dismissible message')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('alert-dismissible');
            expect(response.text).toContain('btn-close');
            expect(response.text).toContain('data-bs-dismiss="alert"');
        });
    });
    
    describe('AC22: Responsive design works properly across desktop and mobile breakpoints', () => {
        test('TC-058: Should have proper CSS media queries', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('@media (max-width: 767.98px)');
            expect(response.text).toContain('margin-left: 0');
            expect(response.text).toContain('display: block');
        });
        
        test('TC-059: Desktop layout should show persistent sidebar', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const responsive = checkResponsiveElements(response.text);
            expect(responsive.hasSidebar).toBe(true);
            expect(response.text).toContain('margin-left: 250px');
            expect(response.text).toContain('width: 250px');
        });
        
        test('TC-060: Mobile layout should hide hamburger button by default', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('hamburger-btn');
            expect(response.text).toContain('display: none');
        });
        
        test('TC-061: Should work with Puppeteer browser testing', async () => {
            const token = generateTestToken();
            
            // Start a local server for testing
            const server = app.listen(0);
            const port = server.address().port;
            
            try {
                // Desktop test
                await page.setViewport({ width: DESKTOP_WIDTH, height: 800 });
                await page.setCookie({
                    name: 'token',
                    value: token,
                    url: `http://localhost:${port}`
                });
                
                await page.goto(`http://localhost:${port}/dashboard`);
                await page.waitForSelector('.sidebar');
                
                const sidebarVisible = await page.isVisible('.sidebar');
                const hamburgerVisible = await page.isVisible('.hamburger-btn');
                
                expect(sidebarVisible).toBe(true);
                // Hamburger should be hidden on desktop
                expect(hamburgerVisible).toBe(false);
                
                // Mobile test
                await page.setViewport({ width: MOBILE_WIDTH, height: 800 });
                await page.reload();
                await page.waitForSelector('.sidebar');
                
                const mobileHamburgerVisible = await page.isVisible('.hamburger-btn');
                expect(mobileHamburgerVisible).toBe(true);
                
            } finally {
                server.close();
            }
        });
    });
    
    describe('AC23: Navigation maintains visual consistency with existing app design', () => {
        test('TC-062: Should maintain consistent color scheme', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('#343a40'); // Dark sidebar
            expect(response.text).toContain('#007bff'); // Primary blue
            expect(response.text).toContain('#adb5bd'); // Muted text
        });
        
        test('TC-063: Should use consistent fonts and spacing', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('Segoe UI');
            expect(response.text).toContain('1rem');
            expect(response.text).toContain('1.25rem');
            expect(response.text).toContain('padding');
            expect(response.text).toContain('margin');
        });
        
        test('TC-064: Should maintain consistent button styles', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('btn-primary');
            expect(response.text).toContain('btn-outline-');
            expect(response.text).toContain('border-radius');
            expect(response.text).toContain('transition');
        });
    });
    
    describe('AC24: All navigation links use proper href attributes for routing', () => {
        test('TC-065: Navigation links should have correct href values', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const $ = cheerio.load(response.text);
            const links = $('.nav-link');
            
            const hrefs = [];
            links.each((i, el) => {
                const href = $(el).attr('href');
                if (href) hrefs.push(href);
            });
            
            expect(hrefs).toContain('/dashboard');
            expect(hrefs).toContain('/profile');
            expect(hrefs).toContain('/settings');
        });
        
        test('TC-066: Logout should use POST form action', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('method="POST"');
            expect(response.text).toContain('action="/logout"');
            expect(response.text).toContain('button type="submit"');
        });
        
        test('TC-067: Links should be accessible and semantic', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const accessibility = checkAccessibility(response.text);
            expect(accessibility.hasAriaLabels).toBe(true);
            expect(accessibility.hasSemanticHTML).toBe(true);
            expect(accessibility.hasFocusStyles).toBe(true);
        });
    });
    
    describe('AC25: JavaScript toggle function works reliably for hamburger menu', () => {
        test('TC-068: Should include hamburger toggle JavaScript', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('function toggleSidebar()');
            expect(response.text).toContain('hamburgerBtn');
            expect(response.text).toContain('addEventListener');
            expect(response.text).toContain('preventDefault');
            expect(response.text).toContain('stopPropagation');
        });
        
        test('TC-069: Should include DOM ready event handlers', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('DOMContentLoaded');
            expect(response.text).toContain('getElementById');
            expect(response.text).toContain('classList.contains');
            expect(response.text).toContain('classList.add');
            expect(response.text).toContain('classList.remove');
        });
        
        test('TC-070: Should handle window resize events', async () => {
            const token = generateTestToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('window.addEventListener');
            expect(response.text).toContain('resize');
            expect(response.text).toContain('innerWidth');
            expect(response.text).toContain('767');
        });
        
        test('TC-071: Should test hamburger functionality with Puppeteer', async () => {
            const token = generateTestToken();
            const server = app.listen(0);
            const port = server.address().port;
            
            try {
                await page.setViewport({ width: MOBILE_WIDTH, height: 800 });
                await page.setCookie({
                    name: 'token',
                    value: token,
                    url: `http://localhost:${port}`
                });
                
                await page.goto(`http://localhost:${port}/dashboard`);
                await page.waitForSelector('.hamburger-btn');
                
                // Check initial state
                const initialSidebarVisible = await page.isVisible('.sidebar.show');
                expect(initialSidebarVisible).toBe(false);
                
                // Click hamburger button
                await page.click('.hamburger-btn');
                await page.waitForTimeout(100); // Wait for animation
                
                const sidebarVisible = await page.isVisible('.sidebar.show');
                expect(sidebarVisible).toBe(true);
                
                // Click overlay to close
                await page.click('.sidebar-overlay');
                await page.waitForTimeout(100);
                
                const sidebarHidden = await page.isVisible('.sidebar.show');
                expect(sidebarHidden).toBe(false);
                
            } finally {
                server.close();
            }
        });
    });
});