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
  
  app.get('/profile', requireAuth, (req, res) => {
    res.render('layout', { 
      title: 'Profile', 
      user: res.locals.user,
      body: '<h1>Profile Page</h1>'
    });
  });
  
  app.get('/dashboard', requireAuth, (req, res) => {
    res.render('layout', { 
      title: 'Dashboard', 
      user: res.locals.user,
      body: '<h1>Dashboard Page</h1>'
    });
  });
  
  return app;
};

// Helper function to parse rendered HTML
const parseHTML = (html: string) => {
  const dom = new JSDOM(html);
  return dom.window.document;
};

// Helper function to create valid JWT token
const createValidToken = (user: any) => {
  return jwt.sign({ user }, JWT_SECRET, { expiresIn: '1h' });
};

describe('Layout Template - Navigation and Profile Link Integration', () => {
  let app: express.Application;
  let templatePath: string;

  beforeEach(() => {
    app = createTestApp();
    templatePath = path.join(__dirname, '../views/layout.ejs');
  });

  describe('Profile Navigation Link Visibility and Positioning', () => {
    // TC-AC-10
    it('should display Profile link in sidebar navigation for authenticated users', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink).toBeTruthy();
      expect(profileLink?.textContent?.trim()).toContain('Profile');
      expect(profileLink?.querySelector('i.bi-person-circle')).toBeTruthy();
    });

    // TC-AC-11
    it('should only show Profile link to authenticated users with valid JWT tokens', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink).toBeNull();
    });

    // TC-AC-10
    it('should position Profile link above Dashboard link in sidebar navigation', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const navLinks = document.querySelectorAll('.md-nav-link');
      
      let profileIndex = -1;
      let dashboardIndex = -1;
      
      navLinks.forEach((link, index) => {
        if (link.getAttribute('href') === '/profile') {
          profileIndex = index;
        }
        if (link.getAttribute('href') === '/dashboard') {
          dashboardIndex = index;
        }
      });
      
      expect(profileIndex).toBeGreaterThan(-1);
      expect(dashboardIndex).toBeGreaterThan(-1);
      expect(profileIndex).toBeLessThan(dashboardIndex);
    });

    // TC-AC-20
    it('should show active state when user is on profile page', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink?.classList.contains('md-nav-link-active')).toBeTruthy();
    });

    // TC-AC-24
    it('should maintain consistent styling with existing dashboard navigation', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      const dashboardLink = document.querySelector('a[href="/dashboard"]');
      
      expect(profileLink?.classList.contains('md-nav-link')).toBeTruthy();
      expect(dashboardLink?.classList.contains('md-nav-link')).toBeTruthy();
      
      // Both should have the same base classes
      expect(profileLink?.className).toMatch(/md-nav-link/);
      expect(dashboardLink?.className).toMatch(/md-nav-link/);
    });
  });

  describe('Navigation State Management', () => {
    // TC-AC-11
    it('should hide Profile link when JWT token is invalid', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', ['token=invalid-token'])
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink).toBeNull();
    });

    // TC-AC-11
    it('should hide Profile link when JWT token is expired', async () => {
      const expiredToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '-1h' });
      
      const response = await request(app)
        .get('/')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink).toBeNull();
    });

    it('should display Login and Sign Up links for unauthenticated users', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const document = parseHTML(response.text);
      const loginLink = document.querySelector('a[href="/login"]');
      const signupLink = document.querySelector('a[href="/signup"]');
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(loginLink).toBeTruthy();
      expect(signupLink).toBeTruthy();
      expect(profileLink).toBeNull();
    });

    it('should display user information for authenticated users', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const userInfo = document.querySelector('.md-user-info');
      const userName = document.querySelector('.md-user-name span');
      
      expect(userInfo).toBeTruthy();
      expect(userName?.textContent).toBe(TEST_USER.name);
    });
  });

  describe('Accessibility and User Experience', () => {
    // TC-AC-19
    it('should include proper ARIA labels for Profile navigation link', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink?.getAttribute('role')).toBe('menuitem');
    });

    // TC-AC-18
    it('should maintain responsive design across different viewport sizes', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const sidebar = document.querySelector('.md-sidebar');
      const mobileHeader = document.querySelector('.md-mobile-header');
      
      expect(sidebar).toBeTruthy();
      expect(mobileHeader).toBeTruthy();
    });

    it('should include proper page metadata', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const title = document.querySelector('title');
      const viewport = document.querySelector('meta[name="viewport"]');
      const charset = document.querySelector('meta[charset]');
      
      expect(title?.textContent).toBe('Profile | Express Auth App');
      expect(viewport?.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
      expect(charset?.getAttribute('charset')).toBe('UTF-8');
    });
  });

  describe('Theme and Interactive Features', () => {
    it('should include theme toggle functionality', async () => {
      const token = createValidToken(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const themeToggle = document.querySelector('#theme-toggle');
      const themeLabel = document.querySelector('.md-theme-toggle-label');
      
      expect(themeToggle).toBeTruthy();
      expect(themeToggle?.getAttribute('type')).toBe('checkbox');
      expect(themeToggle?.getAttribute('role')).toBe('switch');
      expect(themeLabel).toBeTruthy();
    });

    it('should include Material Design interactive components', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check that the JavaScript for Material Design components is included
      expect(response.text).toMatch(/Material Design Alert Close Functionality/);
      expect(response.text).toMatch(/Material Design Ripple Effect/);
      expect(response.text).toMatch(/Custom Material Design Sidebar Functionality/);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing user data gracefully', async () => {
      const incompleteUser = { id: 1, name: 'Test User' }; // Missing email
      const token = createValidToken(incompleteUser);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const userInfo = document.querySelector('.md-user-info');
      const userName = document.querySelector('.md-user-name span');
      
      expect(userInfo).toBeTruthy();
      expect(userName?.textContent).toBe('Test User');
    });

    it('should handle user with no name gracefully', async () => {
      const userWithoutName = { ...TEST_USER, name: null };
      const token = createValidToken(userWithoutName);
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const document = parseHTML(response.text);
      const userName = document.querySelector('.md-user-name span');
      
      expect(userName?.textContent).toBe('Unknown User');
    });
  });
});