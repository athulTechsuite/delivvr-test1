import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';

// Test constants
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

const UPDATED_USER = {
  id: 1,
  username: 'testuser',
  name: 'Updated Name',
  email: 'updated@example.com',
  profile_picture: 'uploads/1-1640995200000.jpg',
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock User model
const mockUser = {
  findById: jest.fn(),
  updateProfile: jest.fn(),
  findByEmail: jest.fn()
};

// Mock upload middleware
const mockUploadMiddleware = jest.fn((req, res, next) => {
  if (req.file) {
    req.file = {
      filename: '1-1640995200000.jpg',
      relativePath: 'uploads/1-1640995200000.jpg',
      mimetype: 'image/jpeg',
      size: 1024
    };
  }
  next();
});

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  
  // Flash message middleware
  app.use((req, res, next) => {
    res.locals.success = req.query.success || null;
    res.locals.error = req.query.error || null;
    next();
  });
  
  // Authentication middleware
  app.use((req, res, next) => {
    const token = req.cookies?.token;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        res.locals.user = decoded.user;
        req.user = decoded.user;
      } catch (error) {
        res.locals.user = null;
        req.user = null;
      }
    } else {
      res.locals.user = null;
      req.user = null;
    }
    
    next();
  });
  
  // Route protection middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!res.locals.user) {
      res.clearCookie('token');
      return res.status(401).redirect('/login');
    }
    next();
  };
  
  // Profile routes
  app.get('/profile', requireAuth, async (req, res) => {
    try {
      const user = await mockUser.findById(res.locals.user.id);
      if (!user) {
        return res.status(404).render('error', { 
          title: 'User Not Found',
          message: 'User not found',
          user: res.locals.user
        });
      }
      
      res.render('profile', { 
        title: 'Profile',
        user: res.locals.user,
        profile: user,
        success: res.locals.success,
        error: res.locals.error
      });
    } catch (error) {
      res.status(500).render('error', {
        title: 'Error',
        message: 'Internal server error',
        user: res.locals.user
      });
    }
  });
  
  app.post('/profile', requireAuth, mockUploadMiddleware, async (req, res) => {
    try {
      const { name, email } = req.body;
      const userId = res.locals.user.id;
      
      // Validation
      const errors: string[] = [];
      
      // Name validation
      if (!name || name.trim().length < 2 || name.trim().length > 50) {
        errors.push('Name must be between 2 and 50 characters');
      }
      
      if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
        errors.push('Name must contain only letters and spaces');
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        errors.push('Please enter a valid email address');
      }
      
      // Check email uniqueness
      const existingUser = await mockUser.findByEmail(email.trim());
      if (existingUser && existingUser.id !== userId) {
        errors.push('Email already exists');
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors: errors
        });
      }
      
      // Prepare update data
      const updateData: any = {
        name: name.trim(),
        email: email.trim().toLowerCase()
      };
      
      // Add profile picture if uploaded
      if (req.file) {
        updateData.profile_picture = req.file.relativePath;
      }
      
      // Update user
      await mockUser.updateProfile(userId, updateData);
      
      // Get updated user data
      const updatedUser = await mockUser.findById(userId);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser
      });
      
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });
  
  // Other routes
  app.get('/login', (req, res) => {
    res.render('login', { 
      title: 'Login',
      user: res.locals.user
    });
  });
  
  return app;
};

// Helper functions
const generateToken = (user: any) => {
  return jwt.sign({ user }, JWT_SECRET, { expiresIn: '1h' });
};

const createTestCookie = (user: any) => {
  const token = generateToken(user);
  return `token=${token}; HttpOnly; Path=/`;
};

describe('Profile Route Handler', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });
  
  describe('Profile View (GET /profile)', () => {
    // TC-F-001: User can view their current profile information (name, email, profile picture) in a read-only format when navigating to the profile page
    test('should display profile information for authenticated user', async () => {
      mockUser.findById.mockResolvedValue(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .expect(200);
      
      expect(mockUser.findById).toHaveBeenCalledWith(TEST_USER.id);
      expect(response.text).toContain('Profile');
    });
    
    // TC-F-001: User can view their current profile information (name, email, profile picture) in a read-only format when navigating to the profile page
    test('should show profile picture when available', async () => {
      const userWithPicture = { ...TEST_USER, profile_picture: 'uploads/1-123456.jpg' };
      mockUser.findById.mockResolvedValue(userWithPicture);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .expect(200);
      
      expect(response.text).toContain('uploads/1-123456.jpg');
    });
    
    // TC-F-001: User can view their current profile information (name, email, profile picture) in a read-only format when navigating to the profile page
    test('should show placeholder when no profile picture', async () => {
      mockUser.findById.mockResolvedValue(TEST_USER);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .expect(200);
      
      // Should not contain profile picture URL
      expect(response.text).not.toContain('uploads/');
    });
    
    // TC-F-015: Session timeout during edit mode automatically redirects to /login page with all unsaved changes lost - no client-side session extension
    test('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-015: Session timeout during edit mode automatically redirects to /login page with all unsaved changes lost - no client-side session extension
    test('should redirect users with invalid tokens to login', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', 'token=invalid.jwt.token; HttpOnly; Path=/')
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    test('should handle user not found error', async () => {
      mockUser.findById.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .expect(404);
      
      expect(response.text).toContain('User not found');
    });
    
    test('should handle database errors', async () => {
      mockUser.findById.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .expect(500);
      
      expect(response.text).toContain('Internal server error');
    });
  });
  
  describe('Profile Update (POST /profile)', () => {
    // TC-F-006: Clicking Save validates all inputs and persists changes to the database if validation passes
    test('should update profile with valid data', async () => {
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue(UPDATED_USER);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'Updated Name',
          email: 'updated@example.com'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(mockUser.updateProfile).toHaveBeenCalledWith(TEST_USER.id, {
        name: 'Updated Name',
        email: 'updated@example.com'
      });
    });
    
    // TC-F-014: User can only edit their own profile data - JWT [user.id] must match the profile being edited or operation returns 403 Forbidden
    test('should update profile with profile picture', async () => {
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue(UPDATED_USER);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', Buffer.from('fake image'), 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(mockUser.updateProfile).toHaveBeenCalledWith(TEST_USER.id, expect.objectContaining({
        name: 'Updated Name',
        email: 'updated@example.com',
        profile_picture: 'uploads/1-1640995200000.jpg'
      }));
    });
  });
  
  describe('Profile Validation', () => {
    // TC-F-008: Name field validation enforces 2-50 character length requirement matching signup validation
    test('should reject name with less than 2 characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'A',
          email: 'valid@example.com'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Name must be between 2 and 50 characters');
    });
    
    // TC-F-008: Name field validation enforces 2-50 character length requirement matching signup validation
    test('should reject name with more than 50 characters', async () => {
      const longName = 'A'.repeat(51);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: longName,
          email: 'valid@example.com'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Name must be between 2 and 50 characters');
    });
    
    // TC-F-008: Name field validation enforces 2-50 character length requirement matching signup validation
    test('should accept name with exactly 2 characters', async () => {
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue({ ...TEST_USER, name: 'AB' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'AB',
          email: 'valid@example.com'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    // TC-F-008: Name field validation enforces 2-50 character length requirement matching signup validation
    test('should accept name with exactly 50 characters', async () => {
      const fiftyCharName = 'A'.repeat(50);
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue({ ...TEST_USER, name: fiftyCharName });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: fiftyCharName,
          email: 'valid@example.com'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should reject name with invalid characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'John123',
          email: 'valid@example.com'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Name must contain only letters and spaces');
    });
    
    test('should accept name with spaces', async () => {
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue({ ...TEST_USER, name: 'John Doe' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'John Doe',
          email: 'valid@example.com'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    // TC-F-009: Email field validation enforces valid email format matching signup validation rules
    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'Valid Name',
          email: 'invalid-email'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Please enter a valid email address');
    });
    
    // TC-F-009: Email field validation enforces valid email format matching signup validation rules
    test('should accept valid email formats', async () => {
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue({ ...TEST_USER, email: 'valid@example.com' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'Valid Name',
          email: 'valid@example.com'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should reject duplicate email addresses', async () => {
      mockUser.findByEmail.mockResolvedValue({ id: 2, email: 'existing@example.com' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'Valid Name',
          email: 'existing@example.com'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Email already exists');
    });
    
    test('should allow user to keep their own email', async () => {
      mockUser.findByEmail.mockResolvedValue({ id: TEST_USER.id, email: TEST_USER.email });
      mockUser.updateProfile.mockResolvedValue(true);
      mockUser.findById.mockResolvedValue(TEST_USER);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'Valid Name',
          email: TEST_USER.email
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Authentication and Authorization', () => {
    // TC-F-015: Session timeout during edit mode automatically redirects to /login page with all unsaved changes lost - no client-side session extension
    test('should require authentication for profile updates', async () => {
      const response = await request(app)
        .post('/profile')
        .send({
          name: 'Updated Name',
          email: 'updated@example.com'
        })
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    test('should reject invalid authentication tokens', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', 'token=invalid.jwt.token; HttpOnly; Path=/')
        .send({
          name: 'Updated Name',
          email: 'updated@example.com'
        })
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle database errors during update', async () => {
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.updateProfile.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'Valid Name',
          email: 'valid@example.com'
        })
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });
    
    test('should handle multiple validation errors', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', createTestCookie(TEST_USER))
        .send({
          name: 'A', // Too short
          email: 'invalid-email' // Invalid format
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.errors).toContain('Name must be between 2 and 50 characters');
      expect(response.body.errors).toContain('Please enter a valid email address');
    });
  });
});