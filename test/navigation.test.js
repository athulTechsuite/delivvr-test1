const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Mock app setup for testing
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Test configuration constants
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-navigation-tests';
const TEST_USER_ID = 1;
const TEST_USER_NAME = 'John Doe';
const TEST_USER_EMAIL = 'john.doe@example.com';
const TEST_USER_CREATED_AT = '2024-01-01 00:00:00';

// Mock database
const mockDb = {
    get: jest.fn(),
    run: jest.fn(),
    serialize: jest.fn((callback) => callback())
};

// Mock sqlite3
jest.mock('sqlite3', () => ({
    verbose: () => ({
        Database: jest.fn(() => mockDb)
    })
}));

// Create test app
function createTestApp() {
    const app = express();
    
    // Middleware
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, '../public')));
    
    // View engine setup
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    
    // Authentication middleware
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
        mockDb.get.mockImplementation((query, params, callback) => {
            if (query.includes('SELECT name, email FROM users')) {
                callback(null, {
                    name: TEST_USER_NAME,
                    email: TEST_USER_EMAIL
                });
            } else {
                callback(new Error('User not found'));
            }
        });
        
        mockDb.get('SELECT name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err) {
                console.error(err);
                return res.redirect('/login');
            }
            res.render('dashboard', { user });
        });
    });
    
    app.get('/profile', authenticateToken, (req, res) => {
        const userId = req.user.id;
        
        if (!userId || typeof userId !== 'number') {
            console.error('Invalid user ID in JWT token:', userId);
            return res.redirect('/login');
        }
        
        mockDb.get.mockImplementation((query, params, callback) => {
            if (query.includes('SELECT name, email, created_at FROM users')) {
                callback(null, {
                    name: TEST_USER_NAME,
                    email: TEST_USER_EMAIL,
                    created_at: TEST_USER_CREATED_AT
                });
            } else {
                callback(new Error('User not found'));
            }
        });
        
        mockDb.get('SELECT name, email, created_at FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                console.error('Database error fetching user profile:', err);
                return res.redirect('/login');
            }
            
            if (!user) {
                console.error('User not found for profile:', userId);
                return res.redirect('/login');
            }
            
            res.render('profile', { user });
        });
    });
    
    app.get('/logout', (req, res) => {
        res.clearCookie('token');
        res.redirect('/');
    });
    
    // POST logout route implementation
    app.post('/logout', (req, res) => {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        // Handle AJAX requests
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(200).json({ 
                success: true, 
                message: 'Successfully logged out',
                redirect: '/'
            });
        }
        
        res.redirect('/');
    });
    
    return app;
}

// Helper functions
function createValidJwtToken(userId = TEST_USER_ID) {
    return jwt.sign(
        { 
            id: userId,
            email: TEST_USER_EMAIL 
        },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function createExpiredJwtToken(userId = TEST_USER_ID) {
    return jwt.sign(
        { 
            id: userId,
            email: TEST_USER_EMAIL 
        },
        TEST_JWT_SECRET,
        { expiresIn: '-1h' }
    );
}

function parseHtmlResponse(html) {
    return new JSDOM(html).window.document;
}

describe('Navigation Integration Tests', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });
    
    describe('Profile Link Visibility Tests', () => {
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
            
            // Verify profile link is visible (not hidden)
            const isVisible = !profileLink.style.display || profileLink.style.display !== 'none';
            expect(isVisible).toBe(true);
        });
        
        test('should not show profile link when user is not authenticated', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            // Profile link should not exist on public pages
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
    });
    
    describe('Profile Link Positioning Tests', () => {
        test('should position profile link above dashboard link in sidebar', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = document.querySelectorAll('.md-navbar-menu .md-navbar-link');
            
            let profileLinkIndex = -1;
            let dashboardLinkIndex = -1;
            
            navLinks.forEach((link, index) => {
                if (link.getAttribute('href') === '/profile') {
                    profileLinkIndex = index;
                }
                if (link.getAttribute('href') === '/dashboard') {
                    dashboardLinkIndex = index;
                }
            });
            
            expect(profileLinkIndex).toBeGreaterThanOrEqual(0);
            expect(dashboardLinkIndex).toBeGreaterThanOrEqual(0);
            expect(profileLinkIndex).toBeLessThan(dashboardLinkIndex);
        });
        
        test('should maintain correct navigation order: profile, dashboard, logout', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = Array.from(document.querySelectorAll('.md-navbar-menu .md-navbar-link'));
            const linkHrefs = navLinks.map(link => link.getAttribute('href'));
            
            expect(linkHrefs).toEqual(['/profile', '/dashboard', '/logout']);
        });
    });
    
    describe('Active State Testing', () => {
        test('should show active state on profile link when current page is profile', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeTruthy();
            expect(profileLink.classList.contains('active')).toBe(true);
            expect(profileLink.getAttribute('aria-current')).toBe('page');
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
            
            expect(profileLink.classList.contains('active')).toBe(false);
            expect(profileLink.getAttribute('aria-current')).toBeFalsy();
            expect(dashboardLink.classList.contains('active')).toBe(true);
        });
        
        test('should show correct active states across all navigation links', async () => {
            const token = createValidJwtToken();
            
            // Test profile page
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const profileDocument = parseHtmlResponse(profileResponse.text);
            const profileActiveLinks = profileDocument.querySelectorAll('.md-navbar-link.active');
            
            expect(profileActiveLinks).toHaveLength(1);
            expect(profileActiveLinks[0].getAttribute('href')).toBe('/profile');
            
            // Test dashboard page
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const dashboardDocument = parseHtmlResponse(dashboardResponse.text);
            const dashboardActiveLinks = dashboardDocument.querySelectorAll('.md-navbar-link.active');
            
            expect(dashboardActiveLinks).toHaveLength(1);
            expect(dashboardActiveLinks[0].getAttribute('href')).toBe('/dashboard');
        });
    });
    
    describe('Navigation Flow Tests', () => {
        test('should navigate from dashboard to profile successfully', async () => {
            const token = createValidJwtToken();
            
            // First visit dashboard
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const dashboardDocument = parseHtmlResponse(dashboardResponse.text);
            const profileLink = dashboardDocument.querySelector('a[href="/profile"]');
            expect(profileLink).toBeTruthy();
            
            // Then visit profile
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const profileDocument = parseHtmlResponse(profileResponse.text);
            expect(profileDocument.querySelector('h1').textContent).toContain('User Profile');
        });
        
        test('should navigate from profile to dashboard successfully', async () => {
            const token = createValidJwtToken();
            
            // First visit profile
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const profileDocument = parseHtmlResponse(profileResponse.text);
            const dashboardLink = profileDocument.querySelector('a[href="/dashboard"]');
            expect(dashboardLink).toBeTruthy();
            
            // Then visit dashboard
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const dashboardDocument = parseHtmlResponse(dashboardResponse.text);
            expect(dashboardDocument.querySelector('h1').textContent).toContain('Dashboard');
        });
        
        test('should handle logout navigation flow correctly', async () => {
            const token = createValidJwtToken();
            
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const profileDocument = parseHtmlResponse(profileResponse.text);
            const logoutLink = profileDocument.querySelector('a[href="/logout"]');
            expect(logoutLink).toBeTruthy();
            
            // Test logout redirect
            const logoutResponse = await request(app)
                .get('/logout')
                .set('Cookie', [`token=${token}`])
                .expect(302);
            
            expect(logoutResponse.headers.location).toBe('/');
        });
        
        test('should handle POST logout route correctly', async () => {
            const token = createValidJwtToken();
            
            // Test POST logout with form submission
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${token}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/');
            
            // Verify cookie is cleared
            const cookieHeader = response.headers['set-cookie'];
            expect(cookieHeader).toBeTruthy();
            expect(cookieHeader[0]).toMatch(/token=;/);
        });
        
        test('should handle AJAX POST logout request', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .post('/logout')
                .set('Cookie', [`token=${token}`])
                .set('X-Requested-With', 'XMLHttpRequest')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Successfully logged out');
            expect(response.body.redirect).toBe('/');
        });
    });
    
    describe('Icon Consistency Tests', () => {
        test('should use person-circle icon for profile link', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const profileLink = document.querySelector('a[href="/profile"]');
            const profileIcon = profileLink.querySelector('i.bi-person-circle');
            
            expect(profileIcon).toBeTruthy();
            expect(profileIcon.getAttribute('aria-hidden')).toBe('true');
        });
        
        test('should maintain consistent icon usage across all navigation links', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = document.querySelectorAll('.md-navbar-link');
            
            navLinks.forEach(link => {
                const icon = link.querySelector('i[class^="bi-"]');
                expect(icon).toBeTruthy();
                expect(icon.getAttribute('aria-hidden')).toBe('true');
            });
        });
    });
    
    describe('Mobile Navigation Tests', () => {
        test('should include profile link in mobile navigation menu', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const mobileMenu = document.querySelector('#navbarNav');
            const profileLinkInMobile = mobileMenu.querySelector('a[href="/profile"]');
            
            expect(mobileMenu).toBeTruthy();
            expect(profileLinkInMobile).toBeTruthy();
            
            // Verify mobile toggle button exists
            const mobileToggle = document.querySelector('.md-navbar-toggle');
            expect(mobileToggle).toBeTruthy();
            expect(mobileToggle.getAttribute('data-bs-target')).toBe('#navbarNav');
        });
        
        test('should maintain proper mobile navigation structure', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const mobileNav = document.querySelector('.md-navbar-nav');
            const mobileMenu = document.querySelector('.md-navbar-menu');
            const menuItems = document.querySelectorAll('.md-navbar-item');
            
            expect(mobileNav).toBeTruthy();
            expect(mobileMenu).toBeTruthy();
            expect(menuItems.length).toBeGreaterThanOrEqual(3); // profile, dashboard, logout
            
            // Verify ARIA roles for accessibility
            expect(mobileMenu.getAttribute('role')).toBe('menubar');
            menuItems.forEach(item => {
                expect(item.getAttribute('role')).toBe('none');
                const link = item.querySelector('.md-navbar-link');
                expect(link.getAttribute('role')).toBe('menuitem');
            });
        });
    });
    
    describe('Authentication State Navigation Tests', () => {
        test('should handle navigation for authenticated users', async () => {
            const token = createValidJwtToken();
            
            // Test all authenticated routes have proper navigation
            const routes = ['/dashboard', '/profile'];
            
            for (const route of routes) {
                const response = await request(app)
                    .get(route)
                    .set('Cookie', [`token=${token}`])
                    .expect(200);
                
                const document = parseHtmlResponse(response.text);
                const navLinks = document.querySelectorAll('.md-navbar-link');
                
                expect(navLinks.length).toBeGreaterThanOrEqual(3);
                expect(document.querySelector('a[href="/profile"]')).toBeTruthy();
                expect(document.querySelector('a[href="/dashboard"]')).toBeTruthy();
                expect(document.querySelector('a[href="/logout"]')).toBeTruthy();
            }
        });
        
        test('should handle navigation for unauthenticated users', async () => {
            const publicRoutes = ['/', '/login', '/signup'];
            
            for (const route of publicRoutes) {
                const response = await request(app)
                    .get(route)
                    .expect(200);
                
                const document = parseHtmlResponse(response.text);
                const profileLink = document.querySelector('a[href="/profile"]');
                const dashboardLink = document.querySelector('a[href="/dashboard"]');
                
                // Public pages should not have authenticated navigation links
                expect(profileLink).toBeFalsy();
                expect(dashboardLink).toBeFalsy();
            }
        });
        
        test('should redirect to login when accessing protected routes without authentication', async () => {
            const protectedRoutes = ['/dashboard', '/profile'];
            
            for (const route of protectedRoutes) {
                const response = await request(app)
                    .get(route)
                    .expect(302);
                
                expect(response.headers.location).toBe('/login');
            }
        });
        
        test('should redirect to login with expired token', async () => {
            const expiredToken = createExpiredJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
    });
    
    describe('Link Functionality Tests', () => {
        test('should verify all navigation links work correctly', async () => {
            const token = createValidJwtToken();
            
            // Get navigation structure from profile page
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(profileResponse.text);
            const navLinks = document.querySelectorAll('.md-navbar-link');
            
            // Test each navigation link
            for (const link of navLinks) {
                const href = link.getAttribute('href');
                
                if (href === '/logout') {
                    // Logout should redirect
                    await request(app)
                        .get(href)
                        .set('Cookie', [`token=${token}`])
                        .expect(302);
                } else {
                    // Other links should render successfully
                    await request(app)
                        .get(href)
                        .set('Cookie', [`token=${token}`])
                        .expect(200);
                }
            }
        });
        
        test('should maintain navigation state across page transitions', async () => {
            const token = createValidJwtToken();
            
            // Navigate through multiple pages and verify consistent navigation
            const pages = ['/dashboard', '/profile', '/dashboard'];
            
            for (const page of pages) {
                const response = await request(app)
                    .get(page)
                    .set('Cookie', [`token=${token}`])
                    .expect(200);
                
                const document = parseHtmlResponse(response.text);
                const navLinks = document.querySelectorAll('.md-navbar-link');
                
                // Verify consistent navigation structure
                expect(navLinks.length).toBe(3);
                
                const linkHrefs = Array.from(navLinks).map(link => link.getAttribute('href'));
                expect(linkHrefs).toEqual(['/profile', '/dashboard', '/logout']);
            }
        });
    });
    
    describe('Responsive Behavior Tests', () => {
        test('should maintain navigation structure across different viewport sizes', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            // Verify responsive navigation elements exist
            const navbar = document.querySelector('.md-navbar');
            const navbarToggle = document.querySelector('.md-navbar-toggle');
            const navbarNav = document.querySelector('.md-navbar-nav');
            
            expect(navbar).toBeTruthy();
            expect(navbarToggle).toBeTruthy();
            expect(navbarNav).toBeTruthy();
            
            // Verify Bootstrap responsive attributes
            expect(navbarToggle.getAttribute('data-bs-toggle')).toBe('collapse');
            expect(navbarToggle.getAttribute('data-bs-target')).toBe('#navbarNav');
            expect(navbarNav.getAttribute('id')).toBe('navbarNav');
        });
        
        test('should include proper responsive classes for navigation', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navbarContainer = document.querySelector('.md-navbar-container');
            
            expect(navbarContainer).toBeTruthy();
            
            // Verify viewport meta tag for mobile responsiveness
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            expect(viewportMeta).toBeTruthy();
            expect(viewportMeta.getAttribute('content')).toContain('width=device-width');
        });
    });
    
    describe('Accessibility Tests', () => {
        test('should provide proper ARIA labels and roles for navigation', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            // Test main navigation ARIA attributes
            const nav = document.querySelector('.md-navbar');
            expect(nav.getAttribute('role')).toBe('navigation');
            expect(nav.getAttribute('aria-label')).toBe('Main navigation');
            
            // Test menu structure ARIA attributes
            const menu = document.querySelector('.md-navbar-menu');
            expect(menu.getAttribute('role')).toBe('menubar');
            
            // Test menu items
            const menuItems = document.querySelectorAll('.md-navbar-item');
            menuItems.forEach(item => {
                expect(item.getAttribute('role')).toBe('none');
                
                const link = item.querySelector('.md-navbar-link');
                expect(link.getAttribute('role')).toBe('menuitem');
            });
            
            // Test active link aria-current
            const activeLink = document.querySelector('.md-navbar-link.active');
            expect(activeLink.getAttribute('aria-current')).toBe('page');
            
            // Test mobile toggle accessibility
            const mobileToggle = document.querySelector('.md-navbar-toggle');
            expect(mobileToggle.getAttribute('aria-label')).toBe('Toggle navigation');
            expect(mobileToggle.getAttribute('aria-expanded')).toBe('false');
        });
        
        test('should provide proper keyboard navigation support', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = document.querySelectorAll('.md-navbar-link');
            
            // All navigation links should be focusable
            navLinks.forEach(link => {
                expect(link.tagName.toLowerCase()).toBe('a');
                expect(link.getAttribute('href')).toBeTruthy();
                // Links should not have tabindex="-1" which would make them unfocusable
                expect(link.getAttribute('tabindex')).not.toBe('-1');
            });
        });
        
        test('should provide proper icon accessibility attributes', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const icons = document.querySelectorAll('.md-navbar-link i[class^="bi-"]');
            
            // All icons should have aria-hidden="true"
            icons.forEach(icon => {
                expect(icon.getAttribute('aria-hidden')).toBe('true');
            });
        });
    });
    
    describe('URL Routing Integration Tests', () => {
        test('should properly integrate profile route with navigation system', async () => {
            const token = createValidJwtToken();
            
            // Test direct access to profile route
            const directResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const directDocument = parseHtmlResponse(directResponse.text);
            expect(directDocument.querySelector('h1').textContent).toContain('User Profile');
            
            // Test navigation link points to correct route
            const dashboardResponse = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const dashboardDocument = parseHtmlResponse(dashboardResponse.text);
            const profileLink = dashboardDocument.querySelector('a[href="/profile"]');
            
            expect(profileLink).toBeTruthy();
            expect(profileLink.getAttribute('href')).toBe('/profile');
        });
        
        test('should handle route resolution correctly for all navigation links', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            const navLinks = document.querySelectorAll('.md-navbar-link');
            
            const expectedRoutes = ['/profile', '/dashboard', '/logout'];
            const actualRoutes = Array.from(navLinks).map(link => link.getAttribute('href'));
            
            expect(actualRoutes).toEqual(expectedRoutes);
            
            // Verify each route is properly configured
            for (const route of expectedRoutes) {
                if (route === '/logout') {
                    // Logout should redirect
                    await request(app)
                        .get(route)
                        .set('Cookie', [`token=${token}`])
                        .expect(302);
                } else {
                    // Other routes should render successfully
                    await request(app)
                        .get(route)
                        .set('Cookie', [`token=${token}`])
                        .expect(200);
                }
            }
        });
        
        test('should maintain consistent routing behavior across browser sessions', async () => {
            const token = createValidJwtToken();
            
            // Simulate multiple requests to verify routing consistency
            for (let i = 0; i < 3; i++) {
                const profileResponse = await request(app)
                    .get('/profile')
                    .set('Cookie', [`token=${token}`])
                    .expect(200);
                
                const profileDocument = parseHtmlResponse(profileResponse.text);
                const profileNavLink = profileDocument.querySelector('a[href="/profile"]');
                
                expect(profileNavLink).toBeTruthy();
                expect(profileNavLink.classList.contains('active')).toBe(true);
                
                const dashboardResponse = await request(app)
                    .get('/dashboard')
                    .set('Cookie', [`token=${token}`])
                    .expect(200);
                
                const dashboardDocument = parseHtmlResponse(dashboardResponse.text);
                const dashboardNavLink = dashboardDocument.querySelector('a[href="/dashboard"]');
                
                expect(dashboardNavLink).toBeTruthy();
                expect(dashboardNavLink.classList.contains('active')).toBe(true);
            }
        });
        
        test('should handle invalid routes appropriately', async () => {
            const token = createValidJwtToken();
            
            // Test non-existent route
            const response = await request(app)
                .get('/nonexistent-route')
                .set('Cookie', [`token=${token}`])
                .expect(404);
            
            // Verify navigation structure is not affected by 404 errors
            const profileResponse = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(profileResponse.text);
            const navLinks = document.querySelectorAll('.md-navbar-link');
            
            expect(navLinks.length).toBe(3);
        });
    });
    
    describe('Material Design CSS Framework Tests', () => {
        test('should include Material Design CSS classes in navigation', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            // Verify Material Design navigation classes
            expect(document.querySelector('.md-navbar')).toBeTruthy();
            expect(document.querySelector('.md-navbar-container')).toBeTruthy();
            expect(document.querySelector('.md-navbar-brand')).toBeTruthy();
            expect(document.querySelector('.md-navbar-nav')).toBeTruthy();
            expect(document.querySelector('.md-navbar-menu')).toBeTruthy();
            expect(document.querySelector('.md-navbar-item')).toBeTruthy();
            expect(document.querySelector('.md-navbar-link')).toBeTruthy();
        });
        
        test('should use proper Material Design typography classes', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            // Verify body has Material Design class
            expect(document.body.classList.contains('md-body')).toBe(true);
            
            // Verify main content wrapper uses MD classes
            const main = document.querySelector('.md-main');
            expect(main).toBeTruthy();
        });
        
        test('should include Roboto font and Material Design icons', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            // Check for Roboto font link
            const robotoFont = document.querySelector('link[href*="fonts.googleapis.com"][href*="Roboto"]');
            expect(robotoFont).toBeTruthy();
            
            // Check for Bootstrap icons
            const bootstrapIcons = document.querySelector('link[href*="bootstrap-icons"]');
            expect(bootstrapIcons).toBeTruthy();
            
            // Check for Material Design CSS
            const mdCSS = document.querySelector('link[href="/css/style.css"]');
            expect(mdCSS).toBeTruthy();
        });
    });
    
    describe('Complete Test Coverage for Profile Functionality', () => {
        test('should display user profile information correctly', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain(TEST_USER_NAME);
            expect(response.text).toContain(TEST_USER_EMAIL);
            expect(response.text).toContain('User Profile');
        });
        
        test('should handle profile page with missing user data gracefully', async () => {
            const token = createValidJwtToken();
            
            // Mock database to return null user
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('should handle profile page with database errors gracefully', async () => {
            const token = createValidJwtToken();
            
            // Mock database to return error
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('Database connection failed'));
            });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('should include proper page structure and metadata', async () => {
            const token = createValidJwtToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const document = parseHtmlResponse(response.text);
            
            // Verify proper HTML structure
            expect(document.doctype).toBeTruthy();
            expect(document.querySelector('html[lang="en"]')).toBeTruthy();
            expect(document.querySelector('meta[name="viewport"]')).toBeTruthy();
            expect(document.querySelector('title')).toBeTruthy();
            
            // Verify semantic HTML structure
            expect(document.querySelector('main[role="main"]')).toBeTruthy();
            expect(document.querySelector('nav[role="navigation"]')).toBeTruthy();
        });
    });
});