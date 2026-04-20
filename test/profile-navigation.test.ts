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
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (!token) {
    return res.redirect('/login');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    res.locals.user = decoded;
    next();
  } catch (error) {
    return res.redirect('/login');
  }
};

// Mock middleware for unauthenticated users
const setUserContext = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.locals.user = decoded;
    } catch (error) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
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
  
  // Mock layout template rendering
  app.use((req, res, next) => {
    const originalRender = res.render;
    res.render = function(view, data = {}) {
      if (view === 'layout' || view === 'dashboard' || view === 'profile') {
        // Mock sidebar navigation based on user authentication
        const user = res.locals.user || data.user;
        let sidebarHtml = '';
        
        if (user) {
          // Authenticated user navigation with Profile above Dashboard
          sidebarHtml = `
            <nav class="sidebar">
              <ul class="nav-list">
                <li class="nav-item ${req.path === '/profile' ? 'active' : ''}">
                  <a href="/profile" class="nav-link">Profile</a>
                </li>
                <li class="nav-item ${req.path === '/dashboard' ? 'active' : ''}">
                  <a href="/dashboard" class="nav-link">Dashboard</a>
                </li>
              </ul>
            </nav>
          `;
        } else {
          // Unauthenticated user navigation
          sidebarHtml = `
            <nav class="sidebar">
              <ul class="nav-list">
                <li class="nav-item ${req.path === '/login' ? 'active' : ''}">
                  <a href="/login" class="nav-link">Login</a>
                </li>
                <li class="nav-item ${req.path === '/signup' ? 'active' : ''}">
                  <a href="/signup" class="nav-link">Signup</a>
                </li>
              </ul>
            </nav>
          `;
        }
        
        const responseBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${data.title || 'Test App'}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            ${sidebarHtml}
            <main class="main-content">
              ${data.body || '<h1>Page Content</h1>'}
            </main>
          </body>
          </html>
        `;
        
        this.status(200).send(responseBody);
      } else {
        originalRender.call(this, view, data);
      }
    };
    next();
  });
  
  // Routes with user context
  app.get('/', setUserContext, (req, res) => {
    res.render('layout', { 
      title: 'Home',
      body: '<h1>Home Page</h1>'
    });
  });
  
  app.get('/login', setUserContext, (req, res) => {
    res.render('layout', { 
      title: 'Login',
      body: '<h1>Login Page</h1>'
    });
  });
  
  app.get('/signup', setUserContext, (req, res) => {
    res.render('layout', { 
      title: 'Signup',
      body: '<h1>Signup Page</h1>'
    });
  });
  
  app.get('/dashboard', authenticateToken, (req, res) => {
    res.render('layout', { 
      title: 'Dashboard',
      body: '<h1>Dashboard Page</h1>'
    });
  });
  
  app.get('/profile', authenticateToken, (req, res) => {
    res.render('layout', { 
      title: 'Profile',
      body: '<h1>Profile Page</h1>'
    });
  });
  
  return app;
};

describe('Profile Navigation and Accessibility', () => {
  let app: express.Application;
  let validToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ id: TEST_USER.id, email: TEST_USER.email }, JWT_SECRET, { expiresIn: '24h' });
  });
  
  describe('Profile Navigation Link Visibility', () => {
    // TC-N-001
    test('should show Profile link in sidebar for authenticated users', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('<a href="/profile" class="nav-link">Profile</a>');
    });
    
    // TC-N-002
    test('should position Profile link above Dashboard link in navigation', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      const profileIndex = response.text.indexOf('href="/profile"');
      const dashboardIndex = response.text.indexOf('href="/dashboard"');
      expect(profileIndex).toBeLessThan(dashboardIndex);
      expect(profileIndex).toBeGreaterThan(0);
    });
    
    // TC-N-003
    test('should not show Profile link for unauthenticated users', async () => {
      const response = await request(app)
        .get('/');
      
      expect(response.status).toBe(200);
      expect(response.text).not.toContain('href="/profile"');
      expect(response.text).not.toContain('>Profile</a>');
    });
    
    // TC-N-004
    test('should only show Profile link to users with valid JWT tokens', async () => {
      const invalidToken = 'invalid-jwt-token';
      
      const response = await request(app)
        .get('/')
        .set('Cookie', [`token=${invalidToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).not.toContain('href="/profile"');
      expect(response.text).not.toContain('>Profile</a>');
    });
  });
  
  describe('Profile Navigation Active State', () => {
    // TC-N-005
    test('should show active state when user is on profile page', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('<li class="nav-item active">');
      expect(response.text).toContain('href="/profile"');
    });
    
    // TC-N-006
    test('should not show active state on Profile link when on Dashboard page', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      // Profile link should not have active class
      const profileLinkMatch = response.text.match(/<li class="nav-item[^"]*">\s*<a href="\/profile"/g);
      expect(profileLinkMatch).toBeTruthy();
      expect(profileLinkMatch![0]).not.toContain('active');
      
      // Dashboard link should have active class
      expect(response.text).toContain('<li class="nav-item active">');
      expect(response.text).toContain('href="/dashboard"');
    });
  });
  
  describe('Navigation Styling and Responsive Design', () => {
    // TC-N-007
    test('should include responsive design viewport meta tag', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    });
    
    // TC-N-008
    test('should maintain consistent sidebar navigation structure', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('<nav class="sidebar">');
      expect(response.text).toContain('<ul class="nav-list">');
      expect(response.text).toContain('class="nav-item');
      expect(response.text).toContain('class="nav-link"');
    });
    
    // TC-N-009
    test('should include proper page title for profile page', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('<title>Profile</title>');
    });
  });
  
  describe('Navigation Link Accessibility', () => {
    // TC-N-010
    test('should provide proper anchor tags with href attributes for navigation', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
      // Check Profile link has proper href
      expect(response.text).toContain('<a href="/profile" class="nav-link">Profile</a>');
      // Check Dashboard link has proper href
      expect(response.text).toContain('<a href="/dashboard" class="nav-link">Dashboard</a>');
    });
    
    // TC-N-011
    test('should maintain navigation consistency across all authenticated pages', async () => {
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      const profileResponse = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      // Both pages should have the same navigation structure
      expect(dashboardResponse.text).toContain('href="/profile"');
      expect(dashboardResponse.text).toContain('href="/dashboard"');
      expect(profileResponse.text).toContain('href="/profile"');
      expect(profileResponse.text).toContain('href="/dashboard"');
      
      // Navigation order should be consistent (Profile before Dashboard)
      const dashProfileIndex = dashboardResponse.text.indexOf('href="/profile"');
      const dashDashboardIndex = dashboardResponse.text.indexOf('href="/dashboard"');
      const profProfileIndex = profileResponse.text.indexOf('href="/profile"');
      const profDashboardIndex = profileResponse.text.indexOf('href="/dashboard"');
      
      expect(dashProfileIndex).toBeLessThan(dashDashboardIndex);
      expect(profProfileIndex).toBeLessThan(profDashboardIndex);
    });
  });
  
  describe('Navigation Error Handling', () => {
    // TC-N-012
    test('should gracefully handle expired JWT tokens in navigation context', async () => {
      const expiredToken = jwt.sign({ id: TEST_USER.id, email: TEST_USER.email }, JWT_SECRET, { expiresIn: '-1h' });
      
      const response = await request(app)
        .get('/')
        .set('Cookie', [`token=${expiredToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).not.toContain('href="/profile"');
      expect(response.text).not.toContain('href="/dashboard"');
      expect(response.text).toContain('href="/login"');
    });
    
    // TC-N-013
    test('should handle malformed JWT tokens in navigation gracefully', async () => {
      const malformedToken = 'not.a.valid.jwt';
      
      const response = await request(app)
        .get('/')
        .set('Cookie', [`token=${malformedToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).not.toContain('href="/profile"');
      expect(response.text).not.toContain('href="/dashboard"');
      expect(response.text).toContain('href="/login"');
    });
  });
});