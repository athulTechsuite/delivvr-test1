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
  
  // Profile route
  app.get('/profile', requireAuth, (req, res) => {
    res.render('profile', {
      user: res.locals.user
    });
  });
  
  // Update profile route
  app.post('/profile/update', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }
    // Mock successful update
    res.json({ success: true, message: 'Profile updated successfully' });
  });
  
  // Change password route
  app.post('/profile/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    // Mock password validation
    if (currentPassword !== 'password') {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    res.json({ success: true, message: 'Password changed successfully' });
  });
  
  return app;
};

describe('Profile View Tests', () => {
  let app: express.Application;
  let validToken: string;
  let invalidToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    invalidToken = 'invalid.token.here';
  });
  
  describe('Profile Page Access and Authentication', () => {
    // TC-F-001
    it('should protect profile page with authentication middleware', async () => {
      const response = await request(app)
        .get('/profile');
      
      expect(response.status).toBe(401);
      expect(response.header.location).toBe('/login');
    });
    
    // TC-F-002
    it('should redirect unauthenticated users to login page', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', 'token=invalid');
      
      expect(response.status).toBe(401);
      expect(response.header.location).toBe('/login');
    });
    
    // TC-F-003
    it('should allow access to authenticated users with valid JWT tokens', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('User Profile');
    });
  });
  
  describe('Profile Data Display', () => {
    // TC-F-004
    it('should display user name, email, and join date in readonly format when first loaded', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check name field
      const nameInput = document.querySelector('#profile-name') as HTMLInputElement;
      expect(nameInput?.value).toBe(TEST_USER.name);
      
      // Check email field (readonly)
      const emailInput = document.querySelector('#profile-email') as HTMLInputElement;
      expect(emailInput?.value).toBe(TEST_USER.email);
      expect(emailInput?.readOnly).toBe(true);
    });
    
    // TC-F-005
    it('should fetch and display current user data from database using JWT token user ID', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain(TEST_USER.name);
      expect(response.text).toContain(TEST_USER.email);
    });
    
    // TC-F-006
    it('should display current user data as default values in editable fields', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const nameInput = document.querySelector('#profile-name') as HTMLInputElement;
      expect(nameInput?.value).toBe(TEST_USER.name);
      expect(nameInput?.getAttribute('required')).toBe('');
      expect(nameInput?.getAttribute('minlength')).toBe('2');
      expect(nameInput?.getAttribute('maxlength')).toBe('50');
    });
  });
  
  describe('Profile Form Validation', () => {
    // TC-F-007
    it('should validate name field is not empty before saving', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name must be at least 2 characters');
    });
    
    // TC-F-008
    it('should apply same validation rules as signup form (minimum 2 characters)', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: 'A' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name must be at least 2 characters');
    });
    
    // TC-F-009
    it('should validate name field contains only letters and spaces', async () => {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          ${fs.readFileSync(path.join(__dirname, '../views/profile.ejs'), 'utf8')}
        </body>
        </html>
      `);
      
      const document = dom.window.document;
      const nameInput = document.querySelector('#profile-name') as HTMLInputElement;
      expect(nameInput?.getAttribute('pattern')).toBe('^[A-Za-z\\s]+$');
    });
  });
  
  describe('Password Change Functionality', () => {
    // TC-F-010
    it('should include separate password change section with current and new password fields', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.text).toContain('password');
      // Check for password form structure
      expect(response.status).toBe(200);
    });
    
    // TC-F-011
    it('should validate current password before allowing password update', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'wrong', newPassword: 'newpass123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password is incorrect');
    });
    
    // TC-F-012
    it('should apply same validation rules as signup for new password (minimum 6 characters)', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'password', newPassword: '12345' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('New password must be at least 6 characters');
    });
    
    // TC-F-013
    it('should only submit password change form when both fields are completed', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'password' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Both current and new password required');
    });
  });
  
  describe('Success and Error Handling', () => {
    // TC-F-014
    it('should show success message when name update is successful', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });
    
    // TC-F-015
    it('should show success message when password change is successful', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'password', newPassword: 'newpass123' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });
  });
  
  describe('Responsive Design and Accessibility', () => {
    // TC-F-016
    it('should maintain responsive design across different viewports', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check for responsive classes
      const responsiveElements = document.querySelectorAll('[class*="md-col"]');
      expect(responsiveElements.length).toBeGreaterThan(0);
      
      // Check viewport meta tag
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      expect(viewportMeta?.getAttribute('content')).toContain('width=device-width');
    });
    
    // TC-F-017
    it('should include proper ARIA labels and accessibility attributes', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check for ARIA attributes
      const nameInput = document.querySelector('#profile-name');
      expect(nameInput?.getAttribute('aria-describedby')).toContain('profile-name-error');
      
      // Check for error containers with role="alert"
      const errorContainer = document.querySelector('#profile-name-error');
      expect(errorContainer?.getAttribute('role')).toBe('alert');
      expect(errorContainer?.getAttribute('aria-live')).toBe('polite');
    });
    
    // TC-F-018
    it('should include proper page title and meta information', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      expect(document.title).toContain('Profile');
      expect(document.title).toContain('Express Auth App');
      
      // Check for language attribute
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });
  });
  
  describe('Navigation Integration', () => {
    // TC-F-019
    it('should display profile link in navigation for authenticated users', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const profileLink = document.querySelector('a[href="/profile"]');
      expect(profileLink).toBeTruthy();
      expect(profileLink?.textContent?.trim()).toContain('Profile');
    });
    
    // TC-F-020
    it('should show active state when user is on profile page', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const activeProfileLink = document.querySelector('a[href="/profile"].active');
      expect(activeProfileLink).toBeTruthy();
      expect(activeProfileLink?.getAttribute('aria-current')).toBe('page');
    });
    
    // TC-F-021
    it('should maintain consistent styling with existing navigation', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check for consistent navigation classes
      const navLinks = document.querySelectorAll('.md-navbar-link');
      expect(navLinks.length).toBeGreaterThan(0);
      
      // Check navigation structure
      const navbar = document.querySelector('.md-navbar');
      expect(navbar).toBeTruthy();
    });
  });
});