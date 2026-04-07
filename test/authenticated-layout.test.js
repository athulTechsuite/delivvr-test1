const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

describe('Authenticated Layout System', () => {
  let db;
  let testUserId;
  let validToken;
  
  beforeAll(async () => {
    // Setup test database
    const testDbPath = path.join(__dirname, '../test-database.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    db = new sqlite3.Database(testDbPath);
    
    // Create users table
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
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
    
    // Insert test user
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
        ['Test User', 'test@example.com', 'hashedpassword'],
        function(err) {
          if (err) reject(err);
          else {
            testUserId = this.lastID;
            resolve();
          }
        }
      );
    });
    
    // Create valid JWT token
    validToken = jwt.sign(
      { userId: testUserId }, 
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
  });
  
  afterAll(async () => {
    if (db) {
      await new Promise(resolve => db.close(resolve));
    }
    const testDbPath = path.join(__dirname, '../test-database.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  describe('AC1: Authenticated users see layout with header, sidebar, and main content', () => {
    test('should display authenticated layout on /dashboard', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('sidebar');
      expect(response.text).toContain('main-content');
      expect(response.text).toContain('header');
      expect(response.text).toContain('LinkFolio');
    });
    
    test('should display authenticated layout on /dashboard/profile', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('sidebar');
      expect(response.text).toContain('Profile Information');
      expect(response.text).toContain('nav-link');
    });
    
    test('should display authenticated layout on /dashboard/settings', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('sidebar');
      expect(response.text).toContain('Account Settings');
      expect(response.text).toContain('nav-link');
    });
  });
  
  describe('AC2: Sidebar navigation contains required links', () => {
    test('should show Dashboard, Profile, Settings, and Logout links in sidebar', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('href="/dashboard"');
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('href="/dashboard/profile"');
      expect(response.text).toContain('Profile');
      expect(response.text).toContain('href="/dashboard/settings"');
      expect(response.text).toContain('Settings');
      expect(response.text).toContain('href="/logout"');
      expect(response.text).toContain('Logout');
    });
    
    test('should highlight active navigation item', async () => {
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(dashboardResponse.text).toContain('nav-link active');
      expect(dashboardResponse.text).toMatch(/dashboard["'].*active/);
      
      const profileResponse = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(profileResponse.text).toContain('currentPage: \'profile\'');
    });
  });
  
  describe('AC3: Navigation links work correctly', () => {
    test('should navigate to static Dashboard page', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('Welcome to your dashboard!');
      expect(response.text).toContain('Profile Information');
    });
    
    test('should navigate to static Profile page', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('User Profile Information');
      expect(response.text).toContain('placeholder profile page');
    });
    
    test('should navigate to static Settings page', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('Account Settings');
      expect(response.text).toContain('placeholder settings page');
    });
  });
  
  describe('AC4: Layout separation from public layout', () => {
    test('should use authenticated-layout.ejs template', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Check for authenticated layout specific elements
      expect(response.text).toContain('sidebar');
      expect(response.text).toContain('min-height: 100vh');
      expect(response.text).toContain('Bootstrap');
    });
    
    test('should maintain Bootstrap styling', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('bootstrap@5.3.0');
      expect(response.text).toContain('bootstrap-icons');
      expect(response.text).toContain('container-fluid');
      expect(response.text).toContain('nav-link');
    });
    
    test('should be separate from public layout', async () => {
      // Test public route (assuming it exists)
      const publicResponse = await request(app)
        .get('/')
        .expect(200);
      
      const authenticatedResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Public layout should not have sidebar
      expect(publicResponse.text).not.toContain('sidebar');
      // Authenticated layout should have sidebar
      expect(authenticatedResponse.text).toContain('sidebar');
    });
  });
  
  describe('AC5: Unauthenticated users redirected', () => {
    test('should redirect to login when no token provided', async () => {
      await request(app)
        .get('/dashboard')
        .expect(302)
        .expect('Location', '/login');
    });
    
    test('should redirect to login with invalid token', async () => {
      await request(app)
        .get('/dashboard')
        .set('Cookie', ['token=invalid-token'])
        .expect(302)
        .expect('Location', '/login');
    });
    
    test('should redirect to login with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUserId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '-1h' }
      );
      
      await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(302)
        .expect('Location', '/login');
    });
    
    test('should not show sidebar layout for unauthenticated users', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(302);
      
      expect(response.text).not.toContain('sidebar');
    });
  });
  
  describe('AC6: Profile and Settings show placeholder content', () => {
    test('Profile page should show placeholder content', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('placeholder profile page');
      expect(response.text).toContain('functionality has not been implemented yet');
      expect(response.text).toContain('disabled');
    });
    
    test('Settings page should show placeholder content', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('placeholder settings page');
      expect(response.text).toContain('No functionality has been implemented yet');
      expect(response.text).toContain('disabled');
    });
    
    test('Form elements should be disabled in placeholder pages', async () => {
      const profileResponse = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(profileResponse.text).toMatch(/<input[^>]+disabled[^>]*>/g);
      
      const settingsResponse = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(settingsResponse.text).toMatch(/<(?:input|select)[^>]+disabled[^>]*>/g);
    });
  });
});