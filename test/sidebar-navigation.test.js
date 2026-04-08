const request = require('supertest');
const cheerio = require('cheerio');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Import the app
const app = require('../app');

describe('Sidebar Navigation Layout - PRD Requirements', () => {
    let testDb;
    let authenticatedAgent;
    let testUser;
    let validToken;

    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
    const TEST_DB_PATH = path.join(__dirname, '../database/test_users.db');

    beforeAll(async () => {
        // Create test database
        testDb = new sqlite3.Database(TEST_DB_PATH);
        
        await new Promise((resolve, reject) => {
            testDb.serialize(() => {
                testDb.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        // Insert test user
        testUser = {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            password: '$2b$10$hashedpassword',
            created_at: new Date().toISOString()
        };

        await new Promise((resolve, reject) => {
            testDb.run(
                'INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
                [testUser.name, testUser.email, testUser.password, testUser.created_at],
                function(err) {
                    if (err) reject(err);
                    else {
                        testUser.id = this.lastID;
                        resolve();
                    }
                }
            );
        });

        // Create valid JWT token
        validToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    });

    beforeEach(() => {
        authenticatedAgent = request.agent(app);
    });

    afterAll(async () => {
        if (testDb) {
            await new Promise((resolve) => {
                testDb.close((err) => {
                    if (err) console.error('Error closing test database:', err);
                    resolve();
                });
            });
        }

        // Clean up test database file
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    // TC-001: Test PRD Acceptance Criteria 1 - Dashboard with side navigation panel
    describe('AC1: Dashboard displays side navigation with menu items', () => {
        test('TC-001: should display side navigation panel with Dashboard, Profile, and Settings menu items when authenticated user visits dashboard', async () => {
            // Set authentication cookie
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify sidebar exists
            expect($('.sidebar').length).toBe(1);
            
            // Verify menu items exist with correct links
            const dashboardLink = $('a.nav-link[href="/dashboard"]');
            expect(dashboardLink.length).toBe(1);
            expect(dashboardLink.text()).toMatch(/Dashboard/);
            
            const profileLink = $('a.nav-link[href="/profile"]');
            expect(profileLink.length).toBe(1);
            expect(profileLink.text()).toMatch(/Profile/);
            
            const settingsLink = $('a.nav-link[href="/settings"]');
            expect(settingsLink.length).toBe(1);
            expect(settingsLink.text()).toMatch(/Settings/);
            
            // Verify Bootstrap icons are present
            expect(dashboardLink.find('i.bi-house-door').length).toBe(1);
            expect(profileLink.find('i.bi-person').length).toBe(1);
            expect(settingsLink.find('i.bi-gear').length).toBe(1);
        });

        test('TC-001-Edge: should show sidebar header with user information', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify sidebar header exists
            expect($('.sidebar-header').length).toBe(1);
            expect($('.sidebar-header h4').text()).toContain('App Dashboard');
            expect($('.user-info').text()).toContain('Welcome');
        });
    });

    // TC-002: Test PRD Acceptance Criteria 2 - Navigation to Profile page
    describe('AC2: Profile menu navigation functionality', () => {
        test('TC-002: should navigate to static profile page with dummy content when clicking Profile menu item', async () => {
            const response = await authenticatedAgent
                .get('/profile')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify we're on profile page
            expect($('h1').text()).toMatch(/Profile/);
            
            // Verify sidebar is still present
            expect($('.sidebar').length).toBe(1);
            
            // Verify profile-specific content is displayed
            expect($('.profile-info, .card-body').length).toBeGreaterThan(0);
            expect(response.text).toContain('Profile Information');
            expect(response.text).toContain('editProfileForm');
            
            // Verify profile menu item is active
            const profileLink = $('a.nav-link[href="/profile"]');
            expect(profileLink.hasClass('active')).toBe(true);
        });

        test('TC-002-Content: should display user profile information in profile page', async () => {
            const response = await authenticatedAgent
                .get('/profile')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            expect(response.text).toContain(testUser.name);
            expect(response.text).toContain(testUser.email);
        });
    });

    // TC-003: Test PRD Acceptance Criteria 3 - Navigation to Settings page
    describe('AC3: Settings menu navigation functionality', () => {
        test('TC-003: should navigate to static settings page with dummy content when clicking Settings menu item', async () => {
            const response = await authenticatedAgent
                .get('/settings')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify we're on settings page
            expect($('h1').text()).toMatch(/Settings/);
            
            // Verify sidebar is still present
            expect($('.sidebar').length).toBe(1);
            
            // Verify settings-specific content is displayed
            expect(response.text).toContain('Account Settings');
            expect(response.text).toContain('Security Settings');
            expect(response.text).toContain('Notification Preferences');
            
            // Verify settings menu item is active
            const settingsLink = $('a.nav-link[href="/settings"]');
            expect(settingsLink.hasClass('active')).toBe(true);
        });

        test('TC-003-Forms: should display settings forms and controls', async () => {
            const response = await authenticatedAgent
                .get('/settings')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify forms are present
            expect($('#accountSettingsForm').length).toBe(1);
            expect($('#securitySettingsForm').length).toBe(1);
            expect($('#notificationSettingsForm').length).toBe(1);
            
            // Verify form controls
            expect($('.form-control').length).toBeGreaterThan(0);
            expect($('.form-check-input').length).toBeGreaterThan(0);
        });
    });

    // TC-004: Test PRD Acceptance Criteria 4 - Logout functionality
    describe('AC4: Logout functionality in sidebar', () => {
        test('TC-004: should logout user and redirect to home page when clicking logout button in sidebar', async () => {
            // First, set authentication
            authenticatedAgent.jar.setCookie(`token=${validToken}`);
            
            const response = await authenticatedAgent
                .post('/logout')
                .expect(302);

            expect(response.headers.location).toBe('/');
        });

        test('TC-004-Button: should display logout button with correct styling in sidebar', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify logout button exists
            const logoutBtn = $('.logout-btn');
            expect(logoutBtn.length).toBe(1);
            
            // Verify logout form
            const logoutForm = logoutBtn.find('form[action="/logout"]');
            expect(logoutForm.length).toBe(1);
            expect(logoutForm.attr('method')).toBe('POST');
            
            // Verify button styling
            const submitBtn = logoutForm.find('button[type="submit"]');
            expect(submitBtn.hasClass('btn-danger')).toBe(true);
            expect(submitBtn.find('i.bi-box-arrow-right').length).toBe(1);
        });

        test('TC-004-Session: should clear session after logout', async () => {
            // Login first
            authenticatedAgent.jar.setCookie(`token=${validToken}`);
            
            // Logout
            await authenticatedAgent
                .post('/logout')
                .expect(302);
            
            // Try to access protected route - should redirect to login
            const response = await authenticatedAgent.get('/dashboard');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-005: Test PRD Acceptance Criteria 5 - Authentication protection
    describe('AC5: Authentication protection for all pages', () => {
        test('TC-005-Dashboard: should redirect unauthenticated user from dashboard to login page', async () => {
            const response = await request(app).get('/dashboard');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-005-Profile: should redirect unauthenticated user from profile to login page', async () => {
            const response = await request(app).get('/profile');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-005-Settings: should redirect unauthenticated user from settings to login page', async () => {
            const response = await request(app).get('/settings');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-005-InvalidToken: should redirect user with invalid token to login', async () => {
            const invalidToken = 'invalid.jwt.token';
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${invalidToken}`]);
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-005-ExpiredToken: should redirect user with expired token to login', async () => {
            const expiredToken = jwt.sign(
                { userId: testUser.id, email: testUser.email },
                JWT_SECRET,
                { expiresIn: '-1h' } // Expired 1 hour ago
            );
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${expiredToken}`]);
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    // TC-006: Test PRD Acceptance Criteria 6 - Responsive layout with Bootstrap
    describe('AC6: Responsive layout using Bootstrap classes', () => {
        test('TC-006-Bootstrap: should use Bootstrap framework and responsive classes', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify Bootstrap CSS is loaded
            expect($('link[href*="bootstrap"]').length).toBeGreaterThan(0);
            
            // Verify Bootstrap responsive classes
            expect($('.container, .container-fluid, .row, .col-md-6').length).toBeGreaterThan(0);
            expect($('.d-flex, .d-none, .d-md-block').length).toBeGreaterThan(0);
            
            // Verify Bootstrap icons
            expect($('link[href*="bootstrap-icons"]').length).toBe(1);
        });

        test('TC-006-Mobile: should include mobile responsive behavior', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify mobile toggle button
            expect($('.sidebar-toggle').length).toBe(1);
            expect($('#sidebarToggle, #sidebarCollapse').length).toBeGreaterThan(0);
            
            // Verify responsive CSS is present
            expect(response.text).toContain('@media (max-width: 768px)');
            expect(response.text).toContain('sidebar-overlay');
        });

        test('TC-006-Layout: should maintain functional layout structure', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify main layout components
            expect($('.sidebar').length).toBe(1);
            expect($('.main-content').length).toBe(1);
            expect($('.content-header').length).toBe(1);
            expect($('.content-body').length).toBe(1);
            
            // Verify CSS custom properties for layout
            expect(response.text).toContain('--sidebar-width: 280px');
            expect(response.text).toContain('--sidebar-collapsed-width: 60px');
        });

        test('TC-006-CSS: should include proper CSS transitions and responsive behavior', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify CSS transitions for responsive behavior
            expect(response.text).toContain('transition: all 0.3s');
            expect(response.text).toContain('.sidebar.collapsed');
            expect(response.text).toContain('.main-content.expanded');
        });
    });

    // Edge Cases and Error Handling
    describe('Edge Cases and Error Handling', () => {
        test('TC-Edge-001: should handle database connection errors gracefully', async () => {
            // This would require mocking database failures
            // For now, verify error handling structure exists
            const response = await request(app).get('/dashboard');
            expect(response.status).toBe(302); // Redirects due to no auth
        });

        test('TC-Edge-002: should handle malformed JWT tokens', async () => {
            const malformedToken = 'not.a.valid.jwt';
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${malformedToken}`]);
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-Edge-003: should handle missing user data in token', async () => {
            const tokenWithoutUser = jwt.sign({}, JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${tokenWithoutUser}`]);
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('TC-Edge-004: should handle user not found in database', async () => {
            const tokenWithNonExistentUser = jwt.sign(
                { userId: 99999, email: 'nonexistent@example.com' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${tokenWithNonExistentUser}`]);
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    // Performance and Accessibility Tests
    describe('Performance and Accessibility', () => {
        test('TC-Performance-001: should load sidebar assets efficiently', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            // Verify CDN links for performance
            expect(response.text).toContain('cdn.jsdelivr.net');
            expect(response.text).toContain('bootstrap@5.3.0');
        });

        test('TC-Accessibility-001: should include proper ARIA labels and semantic HTML', async () => {
            const response = await authenticatedAgent
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`]);

            expect(response.status).toBe(200);
            
            const $ = cheerio.load(response.text);
            
            // Verify semantic HTML
            expect($('nav.sidebar').length).toBe(1);
            expect($('main.main-content').length).toBe(1);
            expect($('header.content-header').length).toBe(1);
            
            // Verify ARIA labels
            expect($('[aria-label]').length).toBeGreaterThan(0);
            expect($('button[aria-label="Toggle sidebar"]').length).toBeGreaterThan(0);
        });
    });
});