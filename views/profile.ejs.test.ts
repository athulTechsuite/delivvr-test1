import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import * as sqlite3 from 'sqlite3';

// Test data and configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: 'uploads/1-1640995200000.jpg',
  created_at: '2023-01-01T00:00:00.000Z'
};

const TEST_USER_NO_PICTURE = {
  id: 2,
  username: 'nopicuser',
  name: 'No Picture User',
  email: 'nopic@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock file upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5242880 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Mock database operations
class MockDatabase {
  private users: any[] = [TEST_USER, TEST_USER_NO_PICTURE];
  
  getUserById(id: number) {
    return this.users.find(user => user.id === id);
  }
  
  updateProfile(id: number, updates: any) {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...updates };
      return this.users[userIndex];
    }
    return null;
  }
  
  getUserByEmail(email: string, excludeId?: number) {
    return this.users.find(user => user.email === email && user.id !== excludeId);
  }
}

const mockDb = new MockDatabase();

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
  app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
  
  // Flash message middleware
  app.use((req, res, next) => {
    res.locals.success = null;
    res.locals.error = null;
    next();
  });
  
  // Authentication middleware
  app.use(mockAuthMiddleware);
  
  // Profile routes
  app.get('/profile', requireAuth, (req, res) => {
    const user = mockDb.getUserById(res.locals.user.id);
    res.render('profile', { user });
  });
  
  app.post('/profile', requireAuth, upload.single('profilePicture'), (req, res) => {
    const { name, email } = req.body;
    const userId = res.locals.user.id;
    
    // Validation
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!name || name.length < 2 || name.length > 50 || !nameRegex.test(name)) {
      return res.status(400).json({ error: 'Name must be between 2-50 characters and contain only letters and spaces' });
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check email uniqueness
    if (mockDb.getUserByEmail(email, userId)) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const updates: any = { name, email };
    
    // Handle profile picture upload
    if (req.file) {
      if (req.file.size > 5242880) {
        return res.status(400).json({ error: 'File size must be less than 5MB' });
      }
      
      const timestamp = Date.now();
      const extension = path.extname(req.file.originalname);
      const filename = `${userId}-${timestamp}${extension}`;
      updates.profile_picture = `uploads/${filename}`;
    }
    
    const updatedUser = mockDb.updateProfile(userId, updates);
    res.json({ success: true, user: updatedUser });
  });
  
  return app;
};

describe('Profile Page - Inline Editing with Profile Picture Upload', () => {
  let app: express.Application;
  let validToken: string;
  let invalidToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    invalidToken = 'invalid.token.here';
  });
  
  describe('Profile View Mode', () => {
    // TC-F-001: User can view their current profile information in read-only format
    it('should display user profile information in read-only format when authenticated', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check profile header
      const profileHeading = document.querySelector('#profile-heading');
      expect(profileHeading?.textContent?.trim()).toContain('User Profile');
      
      // Check profile picture display
      const profilePictureDisplay = document.querySelector('#profile-picture-display');
      expect(profilePictureDisplay).toBeTruthy();
      expect(profilePictureDisplay?.getAttribute('src')).toBe('/uploads/1-1640995200000.jpg');
      
      // Check profile information section exists
      const profileInfoHeading = document.querySelector('#profile-info-heading');
      expect(profileInfoHeading?.textContent?.trim()).toContain('Profile Information');
    });
    
    // TC-F-001: Display placeholder when no profile picture exists
    it('should display profile picture placeholder when user has no profile picture', async () => {
      const userNoPicToken = jwt.sign({ user: TEST_USER_NO_PICTURE }, JWT_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${userNoPicToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check profile picture placeholder
      const profilePicturePlaceholder = document.querySelector('#profile-picture-placeholder');
      expect(profilePicturePlaceholder).toBeTruthy();
      expect(profilePicturePlaceholder?.querySelector('.bi-person-fill')).toBeTruthy();
    });
  });
  
  describe('Authentication and Route Protection', () => {
    // TC-F-002: Redirect to login when unauthenticated
    it('should redirect to login page when user is not authenticated', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(401);
      
      expect(response.text).toContain('Redirecting to /login');
    });
    
    // TC-F-003: Reject invalid JWT tokens
    it('should redirect to login with invalid JWT token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${invalidToken}`])
        .expect(401);
      
      expect(response.text).toContain('Redirecting to /login');
    });
  });
  
  describe('Edit Mode Interface', () => {
    // TC-F-002: Edit button and mode switching elements exist
    it('should contain edit mode interface elements in the DOM', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check for profile picture edit elements
      const profilePictureEdit = document.querySelector('#profile-picture-edit');
      expect(profilePictureEdit).toBeTruthy();
      expect(profilePictureEdit?.style.display).toBe('none'); // Initially hidden
      
      // Check for file input
      const fileInput = document.querySelector('#profile-picture-input');
      expect(fileInput).toBeTruthy();
      expect(fileInput?.getAttribute('accept')).toBe('image/jpeg,image/jpg,image/png,image/gif');
      expect(fileInput?.getAttribute('name')).toBe('profilePicture');
    });
    
    // TC-F-004: Profile picture upload functionality exists
    it('should have profile picture upload input with correct file restrictions', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const fileInput = document.querySelector('#profile-picture-input');
      expect(fileInput?.getAttribute('accept')).toBe('image/jpeg,image/jpg,image/png,image/gif');
      expect(fileInput?.getAttribute('type')).toBe('file');
      
      // Check upload label
      const uploadLabel = document.querySelector('.md-file-upload-label');
      expect(uploadLabel).toBeTruthy();
      expect(uploadLabel?.textContent).toContain('Choose');
    });
  });
  
  describe('Profile Update Validation', () => {
    // TC-F-008: Name field validation (2-50 characters)
    it('should reject name updates with invalid length', async () => {
      const shortNameResponse = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'A', email: 'test@example.com' })
        .expect(400);
      
      expect(shortNameResponse.body.error).toContain('Name must be between 2-50 characters');
      
      const longNameResponse = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'A'.repeat(51), email: 'test@example.com' })
        .expect(400);
      
      expect(longNameResponse.body.error).toContain('Name must be between 2-50 characters');
    });
    
    // TC-F-008: Name field validation (letters and spaces only)
    it('should reject name updates with invalid characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Test123', email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.error).toContain('contain only letters and spaces');
    });
    
    // TC-F-009: Email field validation
    it('should reject invalid email formats', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Test User', email: 'invalid-email' })
        .expect(400);
      
      expect(response.body.error).toContain('Invalid email format');
    });
    
    // TC-F-009: Email uniqueness validation
    it('should reject email updates that conflict with existing users', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Test User', email: 'nopic@example.com' })
        .expect(400);
      
      expect(response.body.error).toContain('Email already exists');
    });
  });
  
  describe('Profile Picture Upload', () => {
    // TC-F-010: Allowed image formats
    it('should accept valid image file formats', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Updated User')
        .field('email', 'updated@example.com')
        .attach('profilePicture', Buffer.from('fake-image-data'), 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/^uploads\/\d+-\d+\.jpg$/);
    });
    
    // TC-F-012: File size limit (5MB)
    it('should reject files larger than 5MB', async () => {
      const largeBuffer = Buffer.alloc(5242881); // 1 byte over limit
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Updated User')
        .field('email', 'updated@example.com')
        .attach('profilePicture', largeBuffer, 'large.jpg')
        .expect(400);
      
      expect(response.body.error).toContain('File size must be less than 5MB');
    });
  });
  
  describe('Successful Profile Updates', () => {
    // TC-F-006: Save validates inputs and persists changes
    it('should successfully update profile with valid data', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Updated Name', email: 'updated@example.com' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('Updated Name');
      expect(response.body.user.email).toBe('updated@example.com');
    });
    
    // TC-F-014: Success confirmation message structure
    it('should return success response structure for JSON API', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Updated Name', email: 'updated@example.com' })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('email');
    });
  });
  
  describe('Message Display Areas', () => {
    // TC-F-014: Success/error message display elements
    it('should contain success and error message display elements', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check message section
      const messageSection = document.querySelector('#message-section');
      expect(messageSection).toBeTruthy();
      expect(messageSection?.getAttribute('aria-live')).toBe('polite');
      
      // Check success message element
      const successMessage = document.querySelector('#success-message');
      expect(successMessage).toBeTruthy();
      expect(successMessage?.classList.contains('md-alert-success')).toBe(true);
      expect(successMessage?.style.display).toBe('none'); // Initially hidden
      
      // Check error message element
      const errorMessage = document.querySelector('#error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.classList.contains('md-alert-error')).toBe(true);
      expect(errorMessage?.style.display).toBe('none'); // Initially hidden
    });
  });
  
  describe('Accessibility and UI Elements', () => {
    // TC-F-001: Proper ARIA labels and semantic structure
    it('should have proper accessibility attributes', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check main content structure
      const main = document.querySelector('main[role="main"]');
      expect(main).toBeTruthy();
      
      // Check profile sections have proper ARIA labels
      const profileSection = document.querySelector('section[aria-labelledby="profile-heading"]');
      expect(profileSection).toBeTruthy();
      
      const profileInfoSection = document.querySelector('section[aria-labelledby="profile-info-heading"]');
      expect(profileInfoSection).toBeTruthy();
      
      // Check file input has proper ARIA description
      const fileInput = document.querySelector('#profile-picture-input');
      expect(fileInput?.getAttribute('aria-describedby')).toBe('profile-picture-help');
    });
    
    // TC-F-004: Material Design theme consistency
    it('should maintain Material Design CSS classes and structure', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check Material Design classes
      expect(document.querySelector('.md-body')).toBeTruthy();
      expect(document.querySelector('.md-main')).toBeTruthy();
      expect(document.querySelector('.md-container')).toBeTruthy();
      expect(document.querySelector('.md-card')).toBeTruthy();
      expect(document.querySelector('.md-card-header')).toBeTruthy();
      expect(document.querySelector('.md-card-body')).toBeTruthy();
      
      // Check elevation and styling
      const card = document.querySelector('.md-card');
      expect(card?.classList.contains('md-elevation-2')).toBe(true);
    });
  });
  
  describe('Navigation and Layout Integration', () => {
    // TC-F-001: Navigation integration with active state
    it('should integrate with main navigation with active profile link', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      // Check navigation exists
      const navbar = document.querySelector('.md-navbar');
      expect(navbar).toBeTruthy();
      
      // Check profile link is active
      const profileLink = document.querySelector('a[href="/profile"]');
      expect(profileLink?.classList.contains('active')).toBe(true);
      expect(profileLink?.getAttribute('aria-current')).toBe('page');
      
      // Check other navigation links exist
      expect(document.querySelector('a[href="/dashboard"]')).toBeTruthy();
      expect(document.querySelector('form[action="/logout"]')).toBeTruthy();
    });
    
    // TC-F-001: Theme toggle integration
    it('should include theme toggle functionality', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const themeToggle = document.querySelector('#theme-toggle');
      expect(themeToggle).toBeTruthy();
      expect(themeToggle?.getAttribute('type')).toBe('checkbox');
      
      const themeLabel = document.querySelector('.md-theme-toggle-label');
      expect(themeLabel).toBeTruthy();
      
      // Check theme icons
      expect(document.querySelector('.md-theme-icon-light')).toBeTruthy();
      expect(document.querySelector('.md-theme-icon-dark')).toBeTruthy();
    });
  });
});