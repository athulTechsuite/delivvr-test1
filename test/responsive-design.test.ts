const puppeteer = require('puppeteer');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

// Test configuration constants
const TEST_JWT_SECRET = 'test-jwt-secret-responsive';
const TEST_PORT = 3002;
const BASE_URL = `http://localhost:${TEST_PORT}`;

const VIEWPORTS = {
    mobile: { width: 375, height: 667, isMobile: true, hasTouch: true },
    tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
    desktop: { width: 1200, height: 800, isMobile: false, hasTouch: false },
    largeMobile: { width: 414, height: 896, isMobile: true, hasTouch: true }
};

const MIN_TOUCH_TARGET_SIZE = 44;
const PERFORMANCE_THRESHOLD = 3000;

// Create test application
function createTestApp() {
    const app = express();
    
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, '../public')));
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    
    const authenticateToken = (req, res, next) => {
        const token = req.cookies.token;
        
        if (!token) {
            return res.redirect('/login');
        }
        
        jwt.verify(token, TEST_JWT_SECRET, (err, user) => {
            if (err) {
                return res.redirect('/login');
            }
            req.user = user;
            next();
        });
    };
    
    // Routes for testing
    app.get('/', (req, res) => {
        res.render('index');
    });
    
    app.get('/login', (req, res) => {
        res.render('login', { error: null });
    });
    
    app.get('/signup', (req, res) => {
        res.render('signup', { error: null });
    });
    
    app.get('/dashboard', authenticateToken, (req, res) => {
        const mockUser = {
            id: req.user.id,
            name: 'Test User',
            email: 'test@example.com',
            created_at: new Date().toISOString()
        };
        res.render('dashboard', { user: mockUser });
    });
    
    app.get('/profile', authenticateToken, (req, res) => {
        const mockUser = {
            id: req.user.id,
            name: 'Test User',
            email: 'test@example.com',
            created_at: new Date().toISOString()
        };
        res.render('profile', { user: mockUser });
    });
    
    app.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.redirect('/');
    });
    
    return app;
}

// Helper functions
function createValidJwtToken() {
    return jwt.sign(
        { id: 1, email: 'test@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

describe('Responsive Design and Material Design Implementation', () => {
    let server;
    let browser;
    let app;
    
    beforeAll(async () => {
        app = createTestApp();
        server = app.listen(TEST_PORT);
        
        browser = await puppeteer.launch({
            headless: process.env.CI === 'true',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
    });
    
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.close();
        }
    });
    
    // TC-F-011: Responsive design should be maintained on mobile and desktop devices
    describe('Mobile Responsive Design Tests', () => {
        let page;
        
        beforeEach(async () => {
            page = await browser.newPage();
            await page.setViewport(VIEWPORTS.mobile);
        });
        
        afterEach(async () => {
            if (page) {
                await page.close();
            }
        });
        
        test('should display login page correctly on mobile viewport', async () => {
            const startTime = Date.now();
            await page.goto(`${BASE_URL}/login`);
            const loadTime = Date.now() - startTime;
            
            expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            
            // Check Material Design card layout exists
            const card = await page.$('.md-card');
            expect(card).toBeTruthy();
            
            // Verify card styling
            const cardStyles = await page.evaluate(() => {
                const card = document.querySelector('.md-card');
                const styles = window.getComputedStyle(card);
                return {
                    borderRadius: styles.borderRadius,
                    boxShadow: styles.boxShadow,
                    width: styles.width
                };
            });
            
            expect(cardStyles.borderRadius).toMatch(/8px/);
            expect(cardStyles.boxShadow).toMatch(/rgba/);
        });
        
        test('should ensure touch targets meet minimum size requirements on mobile', async () => {
            await page.goto(`${BASE_URL}/login`);
            
            const touchTargets = await page.$$('.md-button, .md-input, .md-navbar-link, button, input[type="submit"]');
            
            for (const target of touchTargets) {
                const box = await target.boundingBox();
                if (box) {
                    expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
                    expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
                }
            }
        });
        
        test('should adapt navigation for mobile screens with proper touch interaction', async () => {
            const token = createValidJwtToken();
            await page.setCookie({
                name: 'token',
                value: token,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/profile`);
            
            // Check if mobile navigation toggle exists
            const navToggle = await page.$('.md-navbar-toggle, .navbar-toggler');
            if (navToggle) {
                const toggleVisible = await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    const styles = window.getComputedStyle(element);
                    return styles.display !== 'none' && styles.visibility !== 'hidden';
                }, '.md-navbar-toggle, .navbar-toggler');
                
                expect(toggleVisible).toBe(true);
            }
        });
        
        test('should maintain Material Design typography scaling on mobile', async () => {
            await page.goto(`${BASE_URL}/`);
            
            const typographyElements = await page.evaluate(() => {
                const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .md-display-small, .md-headline-small, p');
                return Array.from(elements).map(el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        tagName: el.tagName,
                        fontSize: parseFloat(styles.fontSize),
                        lineHeight: parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.5
                    };
                });
            });
            
            typographyElements.forEach(element => {
                expect(element.fontSize).toBeGreaterThanOrEqual(14);
                expect(element.lineHeight).toBeGreaterThanOrEqual(element.fontSize * 1.2);
            });
        });
    });
    
    // TC-F-011: Desktop responsive behavior
    describe('Desktop Responsive Design Tests', () => {
        let page;
        
        beforeEach(async () => {
            page = await browser.newPage();
            await page.setViewport(VIEWPORTS.desktop);
        });
        
        afterEach(async () => {
            if (page) {
                await page.close();
            }
        });
        
        test('should display profile page with proper desktop layout', async () => {
            const token = createValidJwtToken();
            await page.setCookie({
                name: 'token',
                value: token,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/profile`);
            
            // Check desktop navigation visibility
            const navMenu = await page.$('.md-navbar-nav, .navbar-nav');
            expect(navMenu).toBeTruthy();
            
            const navMenuVisible = await page.evaluate(() => {
                const menu = document.querySelector('.md-navbar-nav, .navbar-nav');
                const styles = window.getComputedStyle(menu);
                return styles.display !== 'none';
            });
            
            expect(navMenuVisible).toBe(true);
        });
        
        test('should maintain proper card layouts on desktop screens', async () => {
            const token = createValidJwtToken();
            await page.setCookie({
                name: 'token',
                value: token,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/dashboard`);
            
            const cardLayout = await page.evaluate(() => {
                const cards = document.querySelectorAll('.md-card');
                const container = document.querySelector('.md-container');
                const containerStyles = window.getComputedStyle(container);
                
                return {
                    cardCount: cards.length,
                    containerWidth: parseFloat(containerStyles.width),
                    maxWidth: containerStyles.maxWidth
                };
            });
            
            expect(cardLayout.cardCount).toBeGreaterThan(0);
            expect(cardLayout.containerWidth).toBeGreaterThan(800);
        });
    });
    
    // TC-F-016, TC-F-017, TC-F-018, TC-F-19: Form styling with Material Design
    describe('Material Design Form Implementation', () => {
        let page;
        
        beforeEach(async () => {
            page = await browser.newPage();
            await page.setViewport(VIEWPORTS.desktop);
        });
        
        afterEach(async () => {
            if (page) {
                await page.close();
            }
        });
        
        test('should implement Material Design form styling with floating labels on login page', async () => {
            await page.goto(`${BASE_URL}/login`);
            
            // Check for Material Design input containers
            const inputContainers = await page.$$('.md-input-container, .md-form-field');
            expect(inputContainers.length).toBeGreaterThan(0);
            
            // Check for floating labels
            const labels = await page.$$('.md-input-label, .md-label');
            expect(labels.length).toBeGreaterThan(0);
            
            // Verify input styling
            const inputStyles = await page.evaluate(() => {
                const input = document.querySelector('input[type="email"], input[type="password"]');
                if (!input) return null;
                
                const styles = window.getComputedStyle(input);
                return {
                    borderRadius: styles.borderRadius,
                    padding: styles.padding,
                    fontSize: styles.fontSize
                };
            });
            
            if (inputStyles) {
                expect(inputStyles.fontSize).toMatch(/14px|16px/);
                expect(inputStyles.padding).toBeTruthy();
            }
        });
        
        test('should implement Material Design form styling with validation states on signup page', async () => {
            await page.goto(`${BASE_URL}/signup`);
            
            // Check for form validation elements
            const validationElements = await page.$$('.md-helper-text, .md-error-text, .form-text, .invalid-feedback');
            const formFields = await page.$$('.md-form-field, .form-group');
            
            expect(formFields.length).toBeGreaterThan(0);
            
            // Test form interaction
            const nameInput = await page.$('input[name="name"]');
            if (nameInput) {
                await nameInput.click();
                await nameInput.type('Test User');
                
                const inputValue = await page.evaluate(() => {
                    const input = document.querySelector('input[name="name"]');
                    return input ? input.value : null;
                });
                
                expect(inputValue).toBe('Test User');
            }
        });
        
        test('should maintain form functionality with Material Design appearance', async () => {
            await page.goto(`${BASE_URL}/login`);
            
            // Test form submission preparation
            const form = await page.$('form');
            const submitButton = await page.$('button[type="submit"], input[type="submit"]');
            
            expect(form).toBeTruthy();
            expect(submitButton).toBeTruthy();
            
            // Check Material Design button styling
            const buttonStyles = await page.evaluate(() => {
                const button = document.querySelector('button[type="submit"], input[type="submit"]');
                if (!button) return null;
                
                const styles = window.getComputedStyle(button);
                return {
                    backgroundColor: styles.backgroundColor,
                    borderRadius: styles.borderRadius,
                    padding: styles.padding
                };
            });
            
            if (buttonStyles) {
                expect(buttonStyles.borderRadius).toMatch(/4px|8px/);
                expect(buttonStyles.padding).toBeTruthy();
            }
        });
        
        test('should implement Material Design hero section and feature cards on home page', async () => {
            await page.goto(`${BASE_URL}/`);
            
            // Check for hero section
            const heroSection = await page.$('.md-hero, .hero, .jumbotron');
            expect(heroSection).toBeTruthy();
            
            // Check for feature cards
            const featureCards = await page.$$('.md-card-feature, .card, .feature-card');
            expect(featureCards.length).toBeGreaterThan(0);
            
            // Verify Material Design styling
            const heroStyles = await page.evaluate(() => {
                const hero = document.querySelector('.md-hero, .hero, .jumbotron');
                if (!hero) return null;
                
                const styles = window.getComputedStyle(hero);
                return {
                    padding: styles.padding,
                    textAlign: styles.textAlign,
                    backgroundColor: styles.backgroundColor
                };
            });
            
            if (heroStyles) {
                expect(heroStyles.padding).toBeTruthy();
                expect(heroStyles.textAlign).toBeTruthy();
            }
        });
    });
    
    // TC-F-011: Cross-device compatibility
    describe('Cross-Device Compatibility Tests', () => {
        test('should maintain responsive behavior across different viewport sizes', async () => {
            const viewportSizes = [
                VIEWPORTS.mobile,
                VIEWPORTS.tablet,
                VIEWPORTS.desktop,
                VIEWPORTS.largeMobile
            ];
            
            for (const viewport of viewportSizes) {
                const page = await browser.newPage();
                await page.setViewport(viewport);
                
                await page.goto(`${BASE_URL}/login`);
                
                // Check that content is visible and accessible
                const pageContent = await page.$('main, .main, .container, .md-container');
                expect(pageContent).toBeTruthy();
                
                // Check that no horizontal scrolling is needed
                const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
                const viewportWidth = viewport.width;
                
                expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // 20px tolerance
                
                await page.close();
            }
        });
        
        test('should maintain Material Design spacing consistency across devices', async () => {
            const viewportSizes = [VIEWPORTS.mobile, VIEWPORTS.desktop];
            
            for (const viewport of viewportSizes) {
                const page = await browser.newPage();
                await page.setViewport(viewport);
                
                const token = createValidJwtToken();
                await page.setCookie({
                    name: 'token',
                    value: token,
                    domain: 'localhost',
                    path: '/'
                });
                
                await page.goto(`${BASE_URL}/profile`);
                
                // Check spacing follows 8dp grid system
                const spacingValues = await page.evaluate(() => {
                    const elements = document.querySelectorAll('.md-margin-bottom-sm, .md-margin-bottom-md, .md-padding-md');
                    return Array.from(elements).map(el => {
                        const styles = window.getComputedStyle(el);
                        return {
                            marginBottom: parseFloat(styles.marginBottom) || 0,
                            paddingTop: parseFloat(styles.paddingTop) || 0,
                            paddingBottom: parseFloat(styles.paddingBottom) || 0
                        };
                    });
                });
                
                spacingValues.forEach(spacing => {
                    Object.values(spacing).forEach(value => {
                        if (value > 0) {
                            expect(value % 8).toBe(0);
                        }
                    });
                });
                
                await page.close();
            }
        });
        
        test('should ensure profile page displays correctly across all device sizes', async () => {
            const token = createValidJwtToken();
            
            for (const [deviceName, viewport] of Object.entries(VIEWPORTS)) {
                const page = await browser.newPage();
                await page.setViewport(viewport);
                
                await page.setCookie({
                    name: 'token',
                    value: token,
                    domain: 'localhost',
                    path: '/'
                });
                
                await page.goto(`${BASE_URL}/profile`);
                
                // Check that profile content is visible
                const profileCard = await page.$('.md-card');
                const userInfo = await page.$('.md-profile-item, .profile-info');
                
                expect(profileCard).toBeTruthy();
                
                // Verify card elevation is present
                const cardElevation = await page.evaluate(() => {
                    const card = document.querySelector('.md-card');
                    if (!card) return null;
                    
                    const styles = window.getComputedStyle(card);
                    return styles.boxShadow;
                });
                
                expect(cardElevation).toBeTruthy();
                expect(cardElevation).not.toBe('none');
                
                await page.close();
            }
        });
    });
});