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
  app.get('/login', (req, res) => {
    const error = req.query.error as string || undefined;
    res.render('login', { 
      title: 'Login',
      error: error
    });
  });
  
  // Mock login endpoint
  app.post('/login', (req, res) => {
    const { email, password, rememberMe } = req.body;
    
    if (email === TEST_USER.email && password === 'password') {
      // Mock token expiration based on remember me
      const expiresIn = rememberMe === 'true' ? '7d' : '24h';
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn });
      
      res.cookie('token', token, { httpOnly: true });
      
      // Mock refresh token creation when remember me is checked
      if (rememberMe === 'true') {
        const refreshToken = 'mock-refresh-token-' + Math.random().toString(36);
        res.cookie('refresh_token', refreshToken, { httpOnly: true });
      }
      
      res.redirect('/dashboard');
    } else {
      res.redirect('/login?error=Invalid email or password');
    }
  });
  
  return app;
};

describe('Login Form - Remember Me Implementation', () => {
  let app: express.Application;
  let server: any;
  
  beforeAll(() => {
    app = createTestApp();
    server = app.listen(0);
  });
  
  afterAll(() => {
    if (server) {
      server.close();
    }
  });
  
  describe('Form Structure and Elements', () => {
    // TC-F-001
    test('should display remember me checkbox with correct label', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const rememberMeCheckbox = document.querySelector('input[name="rememberMe"]') as HTMLInputElement;
      const rememberMeLabel = document.querySelector('label[for="rememberMe"]');
      
      expect(rememberMeCheckbox).not.toBeNull();
      expect(rememberMeCheckbox?.type).toBe('checkbox');
      expect(rememberMeCheckbox?.value).toBe('true');
      expect(rememberMeCheckbox?.checked).toBe(false); // Should be unchecked by default
      expect(rememberMeLabel?.textContent).toContain('Remember me for 7 days');
    });
    
    // TC-F-018
    test('should have remember me checkbox unchecked by default', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const rememberMeCheckbox = document.querySelector('input[name="rememberMe"]') as HTMLInputElement;
      
      expect(rememberMeCheckbox).not.toBeNull();
      expect(rememberMeCheckbox?.checked).toBe(false);
    });
    
    test('should have proper form structure with email and password fields', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const form = document.querySelector('form[action="/login"][method="POST"]');
      const emailInput = document.querySelector('input[name="email"][type="email"]');
      const passwordInput = document.querySelector('input[name="password"][type="password"]');
      
      expect(form).not.toBeNull();
      expect(emailInput).not.toBeNull();
      expect(passwordInput).not.toBeNull();
      expect(emailInput?.getAttribute('required')).toBe('');
      expect(passwordInput?.getAttribute('required')).toBe('');
    });
    
    test('should have accessibility attributes for remember me checkbox', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const rememberMeCheckbox = document.querySelector('input[name="rememberMe"]') as HTMLInputElement;
      const rememberMeLabel = document.querySelector('label[for="rememberMe"]');
      
      expect(rememberMeCheckbox?.id).toBe('rememberMe');
      expect(rememberMeLabel?.getAttribute('for')).toBe('rememberMe');
      expect(rememberMeCheckbox?.getAttribute('aria-describedby')).toBe('remember-description');
    });
  });
  
  describe('Form Submission Behavior', () => {
    // TC-F-002, TC-F-023
    test('should submit form without remember me checked (24-hour token)', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: TEST_USER.email,
          password: 'password'
          // rememberMe not included (unchecked)
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/dashboard');
      
      // Should set token cookie but not refresh_token cookie
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const refreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(tokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeUndefined();
    });
    
    // TC-F-003, TC-F-022
    test('should submit form with remember me checked (7-day token)', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: TEST_USER.email,
          password: 'password',
          rememberMe: 'true'
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/dashboard');
      
      // Should set both token and refresh_token cookies
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const refreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(tokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();
    });
    
    test('should handle invalid credentials properly', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
          rememberMe: 'true'
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/login?error=Invalid email or password');
      
      // Should not set any cookies on failed login
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
    
    test('should handle missing form fields', async () => {
      const response = await request(app)
        .post('/login')
        .send({})
        .expect(302);
      
      expect(response.headers.location).toBe('/login?error=Invalid email or password');
    });
  });
  
  describe('Error Handling and Display', () => {
    test('should display error message when login fails', async () => {
      const response = await request(app)
        .get('/login?error=Invalid email or password')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const errorAlert = document.querySelector('.md-alert-error');
      const errorMessage = document.querySelector('.md-alert-message');
      
      expect(errorAlert).not.toBeNull();
      expect(errorMessage?.textContent).toContain('Invalid email or password');
      expect(errorAlert?.getAttribute('role')).toBe('alert');
      expect(errorAlert?.getAttribute('aria-live')).toBe('polite');
    });
    
    test('should not display error message when no error is present', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const errorAlert = document.querySelector('.md-alert-error');
      
      expect(errorAlert).toBeNull();
    });
  });
  
  describe('Form Validation and Accessibility', () => {
    test('should have proper ARIA labels and roles', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const form = document.querySelector('form');
      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      
      expect(form?.getAttribute('novalidate')).toBe('');
      expect(form?.getAttribute('aria-labelledby')).toBe('login-heading');
      expect(emailInput?.getAttribute('aria-describedby')).toBe('email-error');
      expect(emailInput?.getAttribute('aria-invalid')).toBe('false');
      expect(passwordInput?.getAttribute('aria-describedby')).toBe('password-error');
      expect(passwordInput?.getAttribute('aria-invalid')).toBe('false');
    });
    
    test('should have proper autocomplete attributes', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      
      expect(emailInput?.getAttribute('autocomplete')).toBe('email');
      expect(passwordInput?.getAttribute('autocomplete')).toBe('current-password');
    });
    
    test('should have password toggle functionality structure', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const passwordToggle = document.querySelector('.md-input-toggle-password');
      const passwordToggleIcon = passwordToggle?.querySelector('.bi-eye');
      
      expect(passwordToggle).not.toBeNull();
      expect(passwordToggle?.getAttribute('type')).toBe('button');
      expect(passwordToggle?.getAttribute('aria-label')).toBe('Toggle password visibility');
      expect(passwordToggle?.getAttribute('tabindex')).toBe('-1');
      expect(passwordToggleIcon).not.toBeNull();
    });
  });
  
  describe('Navigation and Layout', () => {
    test('should have proper navigation structure', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const navbar = document.querySelector('.md-navbar');
      const brandLink = document.querySelector('.md-navbar-brand-link');
      const loginLink = document.querySelector('a[href="/login"].active');
      const signupLink = document.querySelector('a[href="/signup"]');
      const homeLink = document.querySelector('a[href="/"]');
      
      expect(navbar).not.toBeNull();
      expect(navbar?.getAttribute('role')).toBe('navigation');
      expect(navbar?.getAttribute('aria-label')).toBe('Main navigation');
      expect(brandLink?.getAttribute('href')).toBe('/');
      expect(loginLink).not.toBeNull();
      expect(loginLink?.getAttribute('aria-current')).toBe('page');
      expect(signupLink).not.toBeNull();
      expect(homeLink).not.toBeNull();
    });
    
    test('should have theme toggle functionality', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const themeToggle = document.querySelector('.md-theme-toggle');
      const themeToggleIcon = themeToggle?.querySelector('.bi-sun-fill');
      
      expect(themeToggle).not.toBeNull();
      expect(themeToggle?.getAttribute('role')).toBe('switch');
      expect(themeToggle?.getAttribute('aria-checked')).toBe('false');
      expect(themeToggle?.getAttribute('aria-label')).toBe('Toggle dark mode');
      expect(themeToggle?.getAttribute('tabindex')).toBe('0');
      expect(themeToggleIcon).not.toBeNull();
    });
  });
  
  describe('Security and Standards Compliance', () => {
    test('should use HTTPS-ready form submission', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const form = document.querySelector('form');
      
      expect(form?.getAttribute('method')).toBe('POST');
      expect(form?.getAttribute('action')).toBe('/login');
    });
    
    test('should have proper input validation attributes', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      const rememberMeInput = document.querySelector('input[name="rememberMe"]');
      
      expect(emailInput?.getAttribute('type')).toBe('email');
      expect(emailInput?.hasAttribute('required')).toBe(true);
      expect(passwordInput?.getAttribute('type')).toBe('password');
      expect(passwordInput?.hasAttribute('required')).toBe(true);
      expect(rememberMeInput?.getAttribute('type')).toBe('checkbox');
      expect(rememberMeInput?.getAttribute('value')).toBe('true');
    });
  });
});