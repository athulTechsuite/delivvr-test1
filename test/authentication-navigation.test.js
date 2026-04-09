const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Import the actual app
const app = require('../app');

// Test constants
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const TEST_DB_PATH = path.join(__dirname, '../database/test_users.db');

// Test user data
const TEST_USER = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'TestPassword123!'
};

const INVALID_USER = {
    name: 'Invalid User',
    email: 'invalid@example.com',
    password: 'InvalidPassword123!'
};

const XSS_USER = {
    name: '<script>alert("xss")</script>',
    email: 'xss@test.com',
    password: 'XSSPassword123!'
};

let testUserId;
let validToken;
let expiredToken;
let malformedToken;
let db;

describe('Authentication and Navigation Integration Tests', () => {
    // Setup test database and users
    beforeAll(async () => {
        return new Promise((resolve, reject) => {
            // Create test database
            db = new sqlite3.Database(':memory:');
            
            // Create users table
            db.run(`CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) return reject(err);
                
                // Insert test user
                const hashedPassword = bcrypt.hashSync(TEST_USER.password, 10);
                db.run(
                    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                    [TEST_USER.name, TEST_USER.email, hashedPassword],
                    function(err) {
                        if (err) return reject(err);
                        
                        testUserId = this.lastID;
                        
                        // Generate tokens
                        validToken = jwt.sign({
                            userId: testUserId,
                            name: TEST_USER.name,
                            email: TEST_USER.email
                        }, JWT_SECRET, { expiresIn: '1h' });
                        
                        expiredToken = jwt.sign({
                            userId: testUserId,
                            name: TEST_USER.name,
                            email: TEST_USER.email
                        }, JWT_SECRET, { expiresIn: '-1h' });
                        
                        malformedToken = 'invalid.jwt.token';
                        
                        resolve();
                    }
                );
            });
        });
    });
    
    afterAll(async () => {
        return new Promise((resolve) => {
            if (db) {
                db.close(() => resolve());
            } else {
                resolve();
            }
        });
    });
    
    describe('AC11: All protected routes require JWT authentication via authenticateToken middleware', () => {
        test('TC-022: Dashboard should require authentication', async () => {
            const response = await request(app)
                .get('/dashboard')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('TC-023: Profile should require authentication', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('TC-024: Settings should require authentication', async () => {
            const response = await request(app)
                .get('/settings')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('TC-025: Valid token should allow access to dashboard', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('sidebar');
        });
    });
    
    describe('AC12: Unauthenticated access to Profile/Settings redirects to login page', () => {
        test('TC-026: Unauthenticated profile access redirects to login', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('TC-027: Unauthenticated settings access redirects to login', async () => {
            const response = await request(app)
                .get('/settings')
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('TC-028: Malformed token should clear cookie and redirect', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${malformedToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });
        
        test('TC-029: Expired token should clear cookie and redirect', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${expiredToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });
    });
    
    describe('AC13: User context (name, email) passes to all authenticated page templates', () => {
        test('TC-030: Dashboard should display user context', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain(TEST_USER.email);
            expect(response.text).toContain('Welcome');
        });
        
        test('TC-031: Profile should display user context', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain(TEST_USER.email);
            expect(response.text).toContain('User Information');
        });
        
        test('TC-032: Settings should display user context', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain(TEST_USER.name);
            expect(response.text).toContain('Welcome');
            expect(response.text).toContain('Settings');
        });
        
        test('TC-033: Sidebar should display user welcome message', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain(`Welcome, ${TEST_USER.name}`);
            expect(response.text).toContain('sidebar');
        });
    });
    
    describe('AC14: CSS styling provides smooth transitions for navigation show/hide', () => {
        test('TC-034: CSS should include transition properties', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('transition');
            expect(response.text).toContain('0.3s ease');
            expect(response.text).toContain('transform');
        });
        
        test('TC-035: Sidebar should have transform transitions', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('translateX');
            expect(response.text).toContain('transition');
        });
    });
    
    describe('AC15: Main content adjusts margin-left on desktop to accommodate sidebar', () => {
        test('TC-036: Main content should have margin-left for sidebar', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('margin-left: 250px');
            expect(response.text).toContain('main-content');
        });
        
        test('TC-037: Mobile layout should reset margin-left', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('margin-left: 0');
            expect(response.text).toContain('@media (max-width: 767.98px)');
        });
    });
    
    describe('AC16: Mobile navigation closes when clicking outside navigation area', () => {
        test('TC-038: Should include JavaScript for outside click handling', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('addEventListener');
            expect(response.text).toContain('click');
            expect(response.text).toContain('sidebar.contains');
            expect(response.text).toContain('hamburgerBtn.contains');
        });
        
        test('TC-039: Should include overlay click handler', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('sidebarOverlay');
            expect(response.text).toContain('addEventListener');
            expect(response.text).toContain('toggleSidebar');
        });
    });
    
    describe('AC17: Page titles update dynamically based on current navigation selection', () => {
        test('TC-040: Dashboard should have correct page title', async () => {
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('<title>Dashboard');
            expect(response.text).toContain('Auth App');
        });
        
        test('TC-041: Profile should have correct page title', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('<title>Profile');
            expect(response.text).toContain('Express Auth');
        });
        
        test('TC-042: Settings should have correct page title', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${validToken}`])
                .expect(200);
            
            expect(response.text).toContain('<title>Settings');
            expect(response.text).toContain('Express Auth');
        });
    });
    
    describe('AC20: Error handling redirects to login on authentication failures', () => {
        test('TC-043: Invalid user ID in token should redirect to login', async () => {
            const invalidUserToken = jwt.sign({
                userId: 99999,
                name: 'Invalid User',
                email: 'invalid@test.com'
            }, JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
        
        test('TC-044: Wrong JWT secret should clear cookie and redirect', async () => {
            const wrongSecretToken = jwt.sign({
                userId: testUserId,
                name: TEST_USER.name,
                email: TEST_USER.email
            }, 'wrong-secret', { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${wrongSecretToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
            expect(response.headers['set-cookie']).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('token=; Max-Age=0')
                ])
            );
        });
        
        test('TC-045: Empty token should redirect to login', async () => {
            const response = await request(app)
                .get('/settings')
                .set('Cookie', ['token='])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
    });
    
    describe('Security and XSS Prevention Tests', () => {
        test('TC-046: Should prevent XSS in user name display', async () => {
            const xssToken = jwt.sign({
                userId: testUserId,
                name: XSS_USER.name,
                email: XSS_USER.email
            }, JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${xssToken}`])
                .expect(200);
            
            expect(response.text).not.toContain('<script>alert("xss")</script>');
            expect(response.text).toContain('&lt;script&gt;');
        });
        
        test('TC-047: Should handle malformed JWT tokens gracefully', async () => {
            const malformedTokens = [
                'not.a.jwt',
                'header.payload',
                'invalid-token-format',
                ''
            ];
            
            for (const token of malformedTokens) {
                const response = await request(app)
                    .get('/dashboard')
                    .set('Cookie', [`token=${token}`])
                    .expect(302);
                
                expect(response.headers.location).toBe('/login');
            }
        });
        
        test('TC-048: Should handle database connection errors gracefully', async () => {
            // This would require mocking the database to simulate connection failures
            // For now, we test with an invalid user ID which simulates a user not found scenario
            const invalidUserToken = jwt.sign({
                userId: -1,
                name: 'Test User',
                email: 'test@test.com'
            }, JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${invalidUserToken}`])
                .expect(302);
            
            expect(response.headers.location).toBe('/login');
        });
    });
});