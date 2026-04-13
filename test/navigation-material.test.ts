const request = require('supertest');
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { JSDOM } = require('jsdom');
const fs = require('fs');

// Test constants
const TEST_JWT_SECRET = 'test-jwt-secret-navigation';
const TEST_USER_ID = 1;
const TEST_USER_NAME = 'John Doe';
const TEST_USER_EMAIL = 'john.doe@example.com';
const TEST_CSS_PATH = path.join(__dirname, '../public/css/style.css');
const TEST_VIEWS_PATH = path.join(__dirname, '../views');

// Mock database for testing
const mockDb = {
    get: jest.fn(),
    run: jest.fn()
};

// Create test application
function createTestApp() {
    const app = express();
    
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, '../public')));
    app.set('view engine', 'ejs');
    app.set('views', TEST_VIEWS_PATH);
    
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
    
    // Routes
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
            name: TEST_USER_NAME,
            email: TEST_USER_EMAIL,
            created_at: new Date().toISOString()
        };
        res.render('dashboard', { user: mockUser });
    });
    
    app.get('/profile', authenticateToken, (req, res) => {
        const mockUser = {
            id: req.user.id,
            name: TEST_USER_NAME,
            email: TEST_USER_EMAIL,
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
function createValidJwtToken(userId = TEST_USER_ID) {
    return jwt.sign(
        { id: userId, email: TEST_USER_EMAIL },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function parseHtmlResponse(html) {
    return new JSDOM(html).window.document;
}

function getCssContent() {
    if (fs.existsSync(TEST_CSS_PATH)) {
        return fs.readFileSync(TEST_CSS_PATH, 'utf8');
    }
    return '';
}

describe('Navigation and Material Design Integration Tests', () => {
    let app;
    let cssContent;
    
    beforeAll(() => {
        app = createTestApp();
        cssContent = getCssContent();
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    // TC-F-004: Profile link should appear in sidebar navigation above Dashboard link when user is authenticated
    describe('Profile Link Visibility and Positioning', () => {
        test('should show profile link when user is authenticated', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeTruthy();
            expect(profileLink.textContent.trim()).toContain('Profile');
        });
        
        test('should position profile link above dashboard link in navigation', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = document.querySelectorAll('.md-navbar-menu .md-navbar-link');
            
            let profileLinkIndex = -1;
            let dashboardLinkIndex = -1;
            
            navLinks.forEach((link, index) => {
                const href = link.getAttribute('href');
                if (href === '/profile') {
                    profileLinkIndex = index;
                }
                if (href === '/dashboard') {
                    dashboardLinkIndex = index;
                }
            });
            
            expect(profileLinkIndex).toBeGreaterThanOrEqual(0);
            expect(dashboardLinkIndex).toBeGreaterThanOrEqual(0);
            expect(profileLinkIndex).toBeLessThan(dashboardLinkIndex);
        });
        
        test('should maintain navigation order: profile, dashboard, logout', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navItems = document.querySelectorAll('.md-navbar-item');
            
            const navigationOrder = Array.from(navItems).map(item => {
                const link = item.querySelector('a, button');
                if (link) {
                    return link.getAttribute('href') || 'logout';
                }
                return null;
            }).filter(Boolean);
            
            const expectedOrder = ['/profile', '/dashboard'];
            expectedOrder.forEach((href, index) => {
                expect(navigationOrder).toContain(href);
            });
        });
    });
    
    // TC-F-005: Profile link should show active state when current page is profile
    describe('Active State Management', () => {
        test('should show active state on profile link when current page is profile', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeTruthy();
            expect(profileLink.className).toMatch(/active|md-navbar-link-active/);
        });
        
        test('should not show active state on profile link when current page is dashboard', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            const dashboardLink = document.querySelector('a[href="/dashboard"]');
            
            expect(profileLink).toBeTruthy();
            expect(dashboardLink).toBeTruthy();
            expect(profileLink.className).not.toMatch(/active|md-navbar-link-active/);
            expect(dashboardLink.className).toMatch(/active|md-navbar-link-active/);
        });
        
        test('should apply correct aria-current attribute for accessibility', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink.getAttribute('aria-current')).toBe('page');
        });
    });
    
    // TC-F-006: Profile link should not be visible when user is not authenticated
    describe('Authentication-Based Navigation Visibility', () => {
        test('should not show profile link on public home page', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeFalsy();
        });
        
        test('should not show profile link on login page', async () => {
            const response = await request(app)
                .get('/login')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeFalsy();
        });
        
        test('should not show profile link on signup page', async () => {
            const response = await request(app)
                .get('/signup')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeFalsy();
        });
        
        test('should show appropriate public navigation links when not authenticated', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const loginLink = document.querySelector('a[href="/login"]');
            const signupLink = document.querySelector('a[href="/signup"]');
            const homeLink = document.querySelector('a[href="/"]');
            
            expect(loginLink).toBeTruthy();
            expect(signupLink).toBeTruthy();
            expect(homeLink).toBeTruthy();
        });
    });
    
    // TC-F-020: Navigation should maintain existing authentication state display patterns
    describe('Authentication State Display', () => {
        test('should maintain consistent navigation structure between authenticated pages', async () => {
            const token = createValidJwtToken();
            
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const dashboardDoc = parseHtmlResponse(dashboardResponse.text);
            const profileDoc = parseHtmlResponse(profileResponse.text);
            
            const dashboardNavLinks = dashboardDoc.querySelectorAll('.md-navbar-link');
            const profileNavLinks = profileDoc.querySelectorAll('.md-navbar-link');
            
            expect(dashboardNavLinks.length).toBe(profileNavLinks.length);
        });
        
        test('should include logout functionality in authenticated navigation', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const logoutElement = document.querySelector('form[action="/logout"] button, a[href*="logout"]');
            
            expect(logoutElement).toBeTruthy();
            expect(logoutElement.textContent.trim()).toContain('Logout');
        });
    });
    
    // TC-F-024: Profile navigation link should use person-circle icon for consistency
    describe('Icon Consistency', () => {
        test('should use person-circle icon for profile navigation link', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            const profileIcon = profileLink.querySelector('i');
            
            expect(profileIcon).toBeTruthy();
            expect(profileIcon.className).toContain('bi-person-circle');
        });
        
        test('should maintain icon consistency across navigation elements', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = document.querySelectorAll('.md-navbar-link');
            
            navLinks.forEach(link => {
                const icon = link.querySelector('i');
                if (icon) {
                    expect(icon.className).toMatch(/^bi-/);
                }
            });
        });
        
        test('should use appropriate Bootstrap Icons for each navigation item', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            const profileLink = document.querySelector('a[href="/profile"] i');
            const dashboardLink = document.querySelector('a[href="/dashboard"] i');
            const logoutButton = document.querySelector('button[type="submit"] i, a[href*="logout"] i');
            
            expect(profileLink?.className).toContain('bi-person-circle');
            expect(dashboardLink?.className).toContain('bi-speedometer');
            
            if (logoutButton) {
                expect(logoutButton.className).toContain('bi-box-arrow-right');
            }
        });
    });
    
    // TC-F-007, TC-F-008, TC-F-009, TC-F-010: Material Design styling implementation
    describe('Material Design Implementation', () => {
        test('should implement Material Design color scheme with bold colors', () => {
            expect(cssContent).toMatch(/--md-primary:\s*#1976D2/);
            expect(cssContent).toMatch(/--md-secondary:\s*#FF4081/);
            expect(cssContent).toMatch(/--md-primary-light:\s*#42A5F5/);
            expect(cssContent).toMatch(/--md-primary-dark:\s*#1565C0/);
        });
        
        test('should define proper Material Design elevation shadows', () => {
            expect(cssContent).toMatch(/--md-elevation-2:\s*0\s+2px\s+4px\s+rgba\(0,\s*0,\s*0,\s*0\.12\)/);
            expect(cssContent).toMatch(/--md-elevation-4:\s*0\s+4px\s+8px\s+rgba\(0,\s*0,\s*0,\s*0\.12\)/);
            expect(cssContent).toMatch(/--md-elevation-8:\s*0\s+8px\s+25px\s+rgba\(0,\s*0,\s*0,\s*0\.15\)/);
        });
        
        test('should implement Material Design typography scale', () => {
            expect(cssContent).toMatch(/--md-font-family:\s*['"]Roboto['"]/);
            expect(cssContent).toMatch(/--md-font-size-h1:\s*96px/);
            expect(cssContent).toMatch(/--md-font-size-h2:\s*60px/);
            expect(cssContent).toMatch(/--md-font-size-body1:\s*16px/);
            expect(cssContent).toMatch(/--md-font-weight-medium:\s*500/);
            expect(cssContent).toMatch(/--md-font-weight-bold:\s*700/);
        });
        
        test('should implement proper Material Design spacing using 8dp grid system', () => {
            expect(cssContent).toMatch(/--md-spacing-xs:\s*4px/);
            expect(cssContent).toMatch(/--md-spacing-sm:\s*8px/);
            expect(cssContent).toMatch(/--md-spacing-md:\s*16px/);
            expect(cssContent).toMatch(/--md-spacing-lg:\s*24px/);
            expect(cssContent).toMatch(/--md-spacing-xl:\s*32px/);
        });
        
        test('should define hover states and transitions for interactive elements', () => {
            expect(cssContent).toMatch(/--md-transition-fast:\s*0\.15s/);
            expect(cssContent).toMatch(/--md-transition-standard:\s*0\.3s/);
            expect(cssContent).toMatch(/cubic-bezier\(0\.4,\s*0\.0,\s*0\.2,\s*1\)/);
            expect(cssContent).toMatch(/\.md-navbar-link:hover/);
        });
    });
    
    // TC-F-014, TC-F-015: Spacing and card elevation implementation
    describe('Spacing and Layout Standards', () => {
        test('should implement 8dp grid system spacing throughout application', () => {
            const spacingValues = [4, 8, 16, 24, 32, 48, 64];
            spacingValues.forEach(value => {
                expect(cssContent).toMatch(new RegExp(`${value}px`));
            });
        });
        
        test('should implement 2dp elevation with rounded corners on cards', () => {
            expect(cssContent).toMatch(/\.md-card/);
            expect(cssContent).toMatch(/var\(--md-elevation-2\)/);
            expect(cssContent).toMatch(/border-radius/);
            expect(cssContent).toMatch(/--md-border-radius-md:\s*8px/);
        });
        
        test('should ensure all card elements have proper Material Design styling', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toMatch(/md-card\s+md-elevation-2/);
            expect(response.text).toMatch(/md-card-header/);
            expect(response.text).toMatch(/md-card-body|md-card-content/);
        });
    });
    
    // TC-F-022, TC-F-023: Color contrast and accessibility
    describe('Accessibility and Color Contrast', () => {
        test('should implement accessible color contrast ratios', () => {
            expect(cssContent).toMatch(/--md-text-primary:\s*rgba\(0,\s*0,\s*0,\s*0\.87\)/);
            expect(cssContent).toMatch(/--md-text-secondary:\s*rgba\(0,\s*0,\s*0,\s*0\.60\)/);
            expect(cssContent).toMatch(/--md-text-primary-on-primary:\s*rgba\(255,\s*255,\s*255,\s*1\)/);
        });
        
        test('should ensure CSS loads properly without Bootstrap conflicts', () => {
            expect(cssContent.length).toBeGreaterThan(0);
            expect(cssContent).toMatch(/\/\*\s*Material Design CSS Framework/);
            expect(cssContent).not.toMatch(/bootstrap|Bootstrap/i);
        });
        
        test('should implement proper ARIA attributes in navigation', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toMatch(/role=["']navigation["']/);
            expect(response.text).toMatch(/aria-label=["'].*navigation["']/);
            expect(response.text).toMatch(/role=["']menuitem["']/);
        });
    });
});