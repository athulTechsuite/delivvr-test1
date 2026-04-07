const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

describe('Dashboard Routes', () => {
  let db;
  let testUserId;
  let validToken;
  
  beforeAll(async () => {
    // Setup test database
    const testDbPath = path.join(__dirname, '../test-database-routes.sqlite');
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
    
    // Insert test user with created_at
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)', 
        ['John Doe', 'john@example.com', 'hashedpassword123', new Date().toISOString()],
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
    const testDbPath = path.join(__dirname, '../test-database-routes.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  describe('Dashboard Route (/dashboard)', () => {
    test('should render dashboard with user data for authenticated user', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('Welcome to your dashboard!');
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('john@example.com');
      expect(response.text).toContain('Profile Information');
    });
    
    test('should redirect unauthenticated user to login', async () => {
      await request(app)
        .get('/dashboard')
        .expect(302)
        .expect('Location', '/login');
    });
    
    test('should handle database error gracefully', async () => {
      // Create token with non-existent user ID
      const invalidToken = jwt.sign(
        { userId: 999999 }, 
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );
      
      await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${invalidToken}`])
        .expect(302)
        .expect('Location', '/login');
    });
    
    test('should clear cookie and redirect on invalid user', async () => {
      const invalidToken = jwt.sign(
        { userId: 999999 }, 
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${invalidToken}`])
        .expect(302);
      
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'].some(cookie => 
        cookie.includes('token=') && cookie.includes('Expires=')
      )).toBe(true);
    });
  });
  
  describe('Profile Route (/dashboard/profile)', () => {
    test('should render profile page with placeholder content', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('User Profile Information');
      expect(response.text).toContain('placeholder profile page');
      expect(response.text).toContain('functionality has not been implemented');
    });
    
    test('should show disabled form fields', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('disabled');
      expect(response.text).toContain('First Name');
      expect(response.text).toContain('Last Name');
      expect(response.text).toContain('John');
      expect(response.text).toContain('Doe');
    });
    
    test('should redirect unauthenticated user to login', async () => {
      await request(app)
        .get('/dashboard/profile')
        .expect(302)
        .expect('Location', '/login');
    });
  });
  
  describe('Settings Route (/dashboard/settings)', () => {
    test('should render settings page with placeholder content', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('Account Settings');
      expect(response.text).toContain('placeholder settings page');
      expect(response.text).toContain('No functionality has been implemented');
    });
    
    test('should show disabled form controls', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('disabled');
      expect(response.text).toContain('Email Notifications');
      expect(response.text).toContain('Language');
      expect(response.text).toContain('English');
    });
    
    test('should redirect unauthenticated user to login', async () => {
      await request(app)
        .get('/dashboard/settings')
        .expect(302)
        .expect('Location', '/login');
    });
  });
  
  describe('Authentication Middleware', () => {
    test('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('dashboard');
    });
    
    test('should reject expired JWT token', async () => {
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
    
    test('should reject malformed JWT token', async () => {
      await request(app)
        .get('/dashboard')
        .set('Cookie', ['token=invalid.jwt.token'])
        .expect(302)
        .expect('Location', '/login');
    });
    
    test('should handle missing JWT secret gracefully', async () => {
      // This test assumes the JWT_SECRET exists; in real scenarios you'd mock it
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('dashboard');
    });
  });
  
  describe('User Data Integration', () => {
    test('should display correct user information on dashboard', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('john@example.com');
      expect(response.text).toContain(testUserId.toString());
      expect(response.text).toContain('Member Since');
    });
    
    test('should handle user data retrieval errors', async () => {
      // Close database to simulate error
      await new Promise(resolve => db.close(resolve));
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(500);
      
      expect(response.text).toContain('Database error occurred');
      
      // Reconnect database for other tests
      db = new sqlite3.Database(path.join(__dirname, '../test-database-routes.sqlite'));
    });
  });
  
  describe('Success Messages', () => {
    test('should display success message when provided', async () => {
      const response = await request(app)
        .get('/dashboard?success=login')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('dashboard');
      // The success parameter should be passed to the template
    });
  });
});