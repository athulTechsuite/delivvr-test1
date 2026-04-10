import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Test data and configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z'
};

const INVALID_USER = {
  id: 999,
  username: 'invaliduser',
  name: 'Invalid User',
  email: 'invalid@example.com'
};

// Mock authentication middleware
const mockAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.locals.user = decoded.user;
    } catch (error) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  
  next();
};

// Mock route protection middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!res.locals.user) {
    return res.status(401).redirect('/login');
  }
  next();
};

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Flash message middleware
  app.use((req, res, next) => {
    res.locals.success = null;
    res.locals.error = null;
    next();
  });
  
  // Authentication middleware
  app.use(mockAuthMiddleware);
  
  // Routes
  app.get('/', (req, res) => {
    res.render('layout', { 
      title: 'Home', 
      user: res.locals.user,
      body: '<h1>Home Page</h1>'
    });
  });
  
  app.get('/login', (req, res) => {
    res.render('layout', { 
      title: 'Login', 
      user: res.locals.user,
      body: '<h1>Login Page</h1>'
    });
  });
  
  app.get('/signup', (req, res) => {
    res.render('layout', { 
      title: 'Sign Up', 
      user: res.locals.user,
      body: '<h1>Sign Up Page</h1>'
    });
  });
  
  app.get('/dashboard', requireAuth, (req, res) => {
    res.render('layout', { 
      title: 'Dashboard', 
      user: res.locals.user,
      body: '<div><%- include(\'dashboard\') %></div>'
    });
  });
  
  // Mock login endpoint
  app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === TEST_USER.username && password === 'password') {
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });
      res.redirect('/dashboard');
    } else {
      res.locals.error = 'Invalid credentials';
      res.render('layout', { 
        title: 'Login', 
        user: null,
        error: 'Invalid credentials',
        success: null,
        body: '<h1>Login Page</h1>'
      });
    }
  });
  
  // Mock logout endpoint
  app.post('/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
  });
  
  return app;
};

describe('Authentication Integration with Sidebar', () => {
  let layoutTemplate: string;
  let dashboardTemplate: string;
  let app: express.Application;
  
  beforeAll(() => {
    layoutTemplate = fs.readFileSync(
      path.join(__dirname, '../views/layout.ejs'),
      'utf-8'
    );
    dashboardTemplate = fs.readFileSync(
      path.join(__dirname, '../views/dashboard.ejs'),
      'utf-8'
    );
    app = createTestApp();
  });
  
  describe('Authentication State Detection', () => {
    test('should display authenticated navigation when user is present', async () => {
      // TC-019: Authenticated users see Dashboard and Logout options in sidebar
      // TC-008: Authentication state determines which navigation links are visible in sidebar
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: TEST_USER,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should show authenticated user links
      expect(document.querySelector('a[href="/dashboard"]')).toBeTruthy();
      expect(document.querySelector('form[action="/auth/logout"]')).toBeTruthy();
      
      // Should not show unauthenticated links
      expect(document.querySelector('a[href="/login"]')).toBeFalsy();
      expect(document.querySelector('a[href="/signup"]')).toBeFalsy();
      
      // Should show user profile section
      const userSection = document.querySelector('.px-3.py-2.border-bottom');
      expect(userSection).toBeTruthy();
      expect(userSection?.textContent).toContain(TEST_USER.username);
    });
    
    test('should display unauthenticated navigation when user is null', async () => {
      // TC-018: Unauthenticated users see Login and Sign Up links in sidebar
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: null,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should show unauthenticated user links
      expect(document.querySelector('a[href="/login"]')).toBeTruthy();
      expect(document.querySelector('a[href="/signup"]')).toBeTruthy();
      
      // Should not show authenticated links
      expect(document.querySelector('a[href="/dashboard"]')).toBeFalsy();
      expect(document.querySelector('form[action="/auth/logout"]')).toBeFalsy();
      
      // Should not show user profile section
      expect(document.querySelector('.px-3.py-2.border-bottom')).toBeFalsy();
    });
    
    test('should handle undefined user gracefully', async () => {
      // TC-010: User context variable remains available in all EJS templates for authentication checks
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: undefined,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should default to unauthenticated state
      expect(document.querySelector('a[href="/login"]')).toBeTruthy();
      expect(document.querySelector('a[href="/signup"]')).toBeTruthy();
      expect(document.querySelector('a[href="/dashboard"]')).toBeFalsy();
    });
  });
  
  describe('JWT Token Authentication Flow', () => {
    test('should protect dashboard route and redirect unauthenticated users', async () => {
      // TC-020: Existing authentication middleware continues to work without modification
      // TC-012: Dashboard link in sidebar redirects to '/dashboard' and requires authentication
      const response = await request(app)
        .get('/dashboard')
        .expect(302);
      
      expect(response.headers.location).toBe('/login');
    });
    
    test('should allow authenticated users to access dashboard', async () => {
      // TC-021: JWT token validation remains unchanged for protected routes
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);
      
      expect(response.text).toContain('Dashboard');
    });
    
    test('should reject invalid JWT tokens', async () => {
      // TC-021: JWT token validation remains unchanged for protected routes
      const invalidToken = 'invalid.jwt.token';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${invalidToken}`])
        .expect(302);
      
      expect(response.headers.location).toBe('/login');
    });
    
    test('should reject expired JWT tokens', async () => {
      // TC-021: JWT token validation remains unchanged for protected routes
      const expiredToken = jwt.sign(
        { user: TEST_USER },
        JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(302);
      
      expect(response.headers.location).toBe('/login');
    });
  });
  
  describe('Cookie-Based Session Management', () => {
    test('should set authentication cookie on successful login', async () => {
      // TC-022: Cookie-based session management functions properly with new layout
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: TEST_USER.username,
          password: 'password'
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/dashboard');
      expect(response.headers['set-cookie']).toBeDefined();
      
      const cookies = response.headers['set-cookie'] as string[];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      expect(tokenCookie).toBeTruthy();
      expect(tokenCookie).toContain('HttpOnly');
    });
    
    test('should clear authentication cookie on logout', async () => {
      // TC-022: Cookie-based session management functions properly with new layout
      // TC-004: Logout link in sidebar triggers POST request to existing /auth/logout endpoint
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', [`token=${token}`])
        .expect(302);
      
      expect(response.headers.location).toBe('/');
      
      const cookies = response.headers['set-cookie'] as string[];
      const tokenCookie = cookies?.find(cookie => cookie.startsWith('token='));
      expect(tokenCookie).toContain('token=;'); // Cookie cleared
    });
    
    test('should handle logout POST request from sidebar form', async () => {
      // TC-004: Logout link in sidebar triggers POST request to existing /auth/logout endpoint
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(302);
      
      expect(response.headers.location).toBe('/');
    });
  });
  
  describe('Route Continuity and Navigation', () => {
    test('should maintain all existing routes with updated template structure', async () => {
      // TC-023: All existing routes continue to work with updated template structure
      const routes = [
        { path: '/', expectedStatus: 200 },
        { path: '/login', expectedStatus: 200 },
        { path: '/signup', expectedStatus: 200 }
      ];
      
      for (const route of routes) {
        const response = await request(app)
          .get(route.path)
          .expect(route.expectedStatus);
        
        // Verify sidebar is present in response
        expect(response.text).toContain('id="sidebar"');
        expect(response.text).toContain('offcanvas-lg');
      }
    });
    
    test('should preserve user context across different routes', async () => {
      // TC-010: User context variable remains available in all EJS templates for authentication checks
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      
      const routes = ['/', '/dashboard'];
      
      for (const route of routes) {
        const response = await request(app)
          .get(route)
          .set('Cookie', [`token=${token}`])
          .expect(200);
        
        // Check that authenticated navigation is present
        expect(response.text).toContain('Dashboard');
        expect(response.text).toContain('Logout');
        expect(response.text).toContain(TEST_USER.username);
        expect(response.text).not.toContain('Login');
        expect(response.text).not.toContain('Sign Up');
      }
    });
  });
  
  describe('Authentication Error Handling', () => {
    test('should handle authentication failures gracefully', async () => {
      // Test with invalid credentials
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: INVALID_USER.username,
          password: 'wrongpassword'
        })
        .expect(200);
      
      expect(response.text).toContain('Invalid credentials');
      expect(response.text).toContain('Login'); // Should show login page
      expect(response.text).not.toContain('Dashboard'); // Should not show authenticated nav
    });
    
    test('should handle malformed user data', async () => {
      // TC-010: User context variable remains available in all EJS templates for authentication checks
      const malformedUser = {
        id: null,
        username: null,
        name: '',
        email: undefined
      };
      
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: malformedUser,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should still render authenticated navigation but handle missing data
      expect(document.querySelector('a[href="/dashboard"]')).toBeTruthy();
      expect(document.querySelector('form[action="/auth/logout"]')).toBeTruthy();
      
      const userSection = document.querySelector('.px-3.py-2.border-bottom');
      expect(userSection?.textContent).toContain('Unknown User');
    });
    
    test('should handle authentication state changes during session', async () => {
      // TC-020: Existing authentication middleware continues to work without modification
      const validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      
      // First request with valid token should succeed
      await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Request after logout should redirect
      await request(app)
        .post('/auth/logout')
        .set('Cookie', [`token=${validToken}`])
        .expect(302);
      
      // Subsequent request should require authentication again
      await request(app)
        .get('/dashboard')
        .expect(302)
        .expect('Location', '/login');
    });
  });
  
  describe('User Profile Section Functionality', () => {
    test('should display complete user information in sidebar', async () => {
      // TC-003: Sidebar includes user profile section showing username when authenticated
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: TEST_USER,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const userSection = document.querySelector('.px-3.py-2.border-bottom');
      expect(userSection).toBeTruthy();
      
      // Check content structure
      expect(userSection?.textContent).toContain('Signed in as:');
      expect(userSection?.textContent).toContain(TEST_USER.username);
      
      // Check Bootstrap icons
      expect(userSection?.querySelector('.bi-person-circle')).toBeTruthy();
      
      // Check styling classes
      expect(userSection?.querySelector('.text-white-50')).toBeTruthy();
      expect(userSection?.querySelector('.text-white.fw-bold')).toBeTruthy();
    });
    
    test('should handle missing username in user object', async () => {
      const userWithoutUsername = {
        ...TEST_USER,
        username: undefined
      };
      
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: userWithoutUsername,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const userSection = document.querySelector('.px-3.py-2.border-bottom');
      expect(userSection?.textContent).toContain('Unknown User');
    });
  });
  
  describe('Security and Data Validation', () => {
    test('should escape user data to prevent XSS attacks', async () => {
      const maliciousUser = {
        ...TEST_USER,
        username: '<script>alert("xss")</script>'
      };
      
      const html = await ejs.render(layoutTemplate, {
        title: 'Home',
        user: maliciousUser,
        error: null,
        success: null,
        body: '<h1>Home</h1>'
      });
      
      // EJS should escape the malicious script
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });
    
    test('should validate JWT token structure and content', async () => {
      // TC-021: JWT token validation remains unchanged for protected routes
      const malformedToken = 'not.a.valid.jwt.structure.at.all';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${malformedToken}`])
        .expect(302);
      
      expect(response.headers.location).toBe('/login');
    });
    
    test('should handle concurrent authentication requests', async () => {
      const validCredentials = {
        username: TEST_USER.username,
        password: 'password'
      };
      
      // Send multiple login requests simultaneously
      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post('/auth/login')
          .send(validCredentials)
      );
      
      const responses = await Promise.all(promises);
      
      // All requests should be handled correctly
      responses.forEach(response => {
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/dashboard');
      });
    });
  });
});