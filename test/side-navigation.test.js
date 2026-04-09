const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const ejs = require('ejs');

// Test constants
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const TEST_DB_PATH = path.join(__dirname, '../database/test_users.db');
const SIDEBAR_WIDTH = 250;
const MOBILE_BREAKPOINT = 768;

// Mock user data
const MOCK_USER = {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    created_at: new Date().toISOString()
};

const XSS_USER = {
    id: 2,
    name: '<script>alert("xss")</script>',
    email: 'xss@test.com'
};

// Test app setup
function createTestApp() {
    const app = express();
    
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.use(express.static(path.join(__dirname, '../public')));
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock authentication middleware
    const authenticateToken = (req, res, next) => {
        const token = req.cookies.token;
        
        if (!token) {
            return res.redirect('/login');
        }
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (err) {
            res.clearCookie('token');
            return res.redirect('/login');
        }
    };
    
    // Dashboard route
    app.get('/dashboard', authenticateToken, (req, res) => {
        res.render('dashboard', { 
            title: 'Dashboard',
            user: req.user,
            currentPath: '/dashboard'
        });
    });
    
    // Profile route
    app.get('/profile', authenticateToken, (req, res) => {
        res.render('profile', { 
            title: 'Profile',
            user: req.user,
            currentPath: '/profile'
        });
    });
    
    // Settings route
    app.get('/settings', authenticateToken, (req, res) => {
        res.render('settings', { 
            title: 'Settings',
            user: req.user,
            currentPath: '/settings'
        });
    });
    
    // Logout route
    app.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.redirect('/');
    });
    
    return app;
}

function generateValidToken(user) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

function generateExpiredToken(user) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '-1h' });
}

function extractSidebarElements(html) {
    return {
        hasSidebar: html.includes('class="sidebar"'),
        hasHamburgerBtn: html.includes('hamburger-btn'),
        hasMainContent: html.includes('main-content'),
        hasOverlay: html.includes('sidebar-overlay'),
        sidebarWidth: html.includes('250px'),
        hasBootstrapIcons: html.includes('bi-')
    };
}

function extractNavigationLinks(html) {
    const links = [];
    const linkRegex = /<a[^>]+class="[^"]*nav-link[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
        links.push({
            href: match[1],
            content: match[2].replace(/<[^>]*>/g, '').trim()
        });
    }
    
    return links;
}

function checkActiveStates(html) {
    const activeElements = [];
    const activeRegex = /<[^>]+class="[^"]*nav-link[^"]*active[^"]*"[^>]*>/g;
    let match;
    
    while ((match = activeRegex.exec(html)) !== null) {
        activeElements.push(match[0]);
    }
    
    return activeElements;
}

describe('Side Navigation Implementation Tests', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
    });
    
    describe('AC1: Side navigation appears on left side with 250px width on desktop', () => {
        test('TC-001: Should render sidebar with correct width and positioning', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const elements = extractSidebarElements(response.text);
            expect(elements.hasSidebar).toBe(true);
            expect(elements.sidebarWidth).toBe(true);
            expect(response.text).toContain('position: fixed');
            expect(response.text).toContain('left: 0');
        });
        
        test('TC-002: Main content should have margin-left adjustment for desktop', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('margin-left: 250px');
        });
    });
    
    describe('AC2: Navigation includes exactly 4 menu items: Dashboard, Profile, Settings, Logout', () => {
        test('TC-003: Should display all 4 navigation items with correct labels', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const links = extractNavigationLinks(response.text);
            const linkTexts = links.map(link => link.content);
            
            expect(linkTexts).toContain('Dashboard');
            expect(linkTexts).toContain('Profile');
            expect(linkTexts).toContain('Settings');
            expect(response.text).toContain('Logout');
            expect(links.length).toBeGreaterThanOrEqual(3); // Logout is a form button
        });
        
        test('TC-004: Navigation items should have correct href attributes', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const links = extractNavigationLinks(response.text);
            const hrefs = links.map(link => link.href);
            
            expect(hrefs).toContain('/dashboard');
            expect(hrefs).toContain('/profile');
            expect(hrefs).toContain('/settings');
            expect(response.text).toContain('action="/logout"');
        });
    });
    
    describe('AC3: Hamburger menu button appears only on mobile screens', () => {
        test('TC-005: Hamburger button should be present with mobile-only display', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const elements = extractSidebarElements(response.text);
            expect(elements.hasHamburgerBtn).toBe(true);
            expect(response.text).toContain('id="hamburgerBtn"');
            expect(response.text).toContain('display: none');
        });
        
        test('TC-006: Hamburger button should have proper accessibility attributes', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('aria-label="Toggle navigation"');
            expect(response.text).toContain('hamburger-btn');
        });
    });
    
    describe('AC4: Clicking hamburger button toggles side navigation visibility on mobile', () => {
        test('TC-007: Should include JavaScript for hamburger toggle functionality', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('hamburgerBtn');
            expect(response.text).toContain('addEventListener');
            expect(response.text).toContain('toggleSidebar');
            expect(response.text).toContain('sidebar.classList');
        });
        
        test('TC-008: Should include JavaScript for overlay click handling', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('sidebarOverlay');
            expect(response.text).toContain('click');
            expect(response.text).toContain('toggleSidebar');
        });
    });
    
    describe('AC5: Side navigation overlays content on mobile with proper z-index layering', () => {
        test('TC-009: Should have sidebar overlay with correct z-index', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const elements = extractSidebarElements(response.text);
            expect(elements.hasOverlay).toBe(true);
            expect(response.text).toContain('z-index: 1050');
            expect(response.text).toContain('z-index: 1040');
        });
        
        test('TC-010: Mobile navigation should use transform for show/hide', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('transform: translateX(-100%)');
            expect(response.text).toContain('transform: translateX(0)');
        });
    });
    
    describe('AC6: Dashboard route renders new dashboard content with side navigation layout', () => {
        test('TC-011: Dashboard should render with side navigation structure', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('main-content');
            expect(response.text).toContain('Welcome to your dashboard');
        });
        
        test('TC-012: Dashboard should display user profile information', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain(MOCK_USER.name);
            expect(response.text).toContain(MOCK_USER.email);
            expect(response.text).toContain('Profile Information');
        });
    });
    
    describe('AC7: Profile route displays static dummy content with user name and email', () => {
        test('TC-013: Profile should render with user information', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('User Information');
            expect(response.text).toContain(MOCK_USER.name);
            expect(response.text).toContain(MOCK_USER.email);
        });
        
        test('TC-014: Profile should include dummy personal information fields', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('Personal Information');
            expect(response.text).toContain('Phone Number');
            expect(response.text).toContain('Date of Birth');
            expect(response.text).toContain('Bio');
        });
    });
    
    describe('AC8: Settings route displays static dummy content with placeholder settings options', () => {
        test('TC-015: Settings should render with placeholder content', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('General Settings');
            expect(response.text).toContain('Security Settings');
            expect(response.text).toContain('Notification Preferences');
        });
        
        test('TC-016: Settings should include various setting options', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('Language');
            expect(response.text).toContain('Dark Mode');
            expect(response.text).toContain('Two-Factor Authentication');
            expect(response.text).toContain('Email Notifications');
        });
    });
    
    describe('AC9: Logout functionality clears JWT cookie and redirects to home page', () => {
        test('TC-017: Logout should clear cookie and redirect', async () => {
            const response = await request(app)
                .post('/logout')
                .expect(302);
            
            expect(response.headers.location).toBe('/');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });
        
        test('TC-018: Logout form should be present in navigation', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('method="POST"');
            expect(response.text).toContain('action="/logout"');
            expect(response.text).toContain('Logout');
        });
    });
    
    describe('AC10: Active navigation item highlights with Bootstrap active class', () => {
        test('TC-019: Dashboard should have active class when on dashboard', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            const activeElements = checkActiveStates(response.text);
            expect(activeElements.length).toBeGreaterThan(0);
            expect(response.text).toContain('/dashboard');
        });
        
        test('TC-020: Profile should have active class when on profile', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('nav-link active');
            expect(response.text).toContain('/profile');
        });
        
        test('TC-021: Settings should have active class when on settings', async () => {
            const token = generateValidToken(MOCK_USER);
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);
            
            expect(response.text).toContain('nav-link active');
            expect(response.text).toContain('/settings');
        });
    });
});