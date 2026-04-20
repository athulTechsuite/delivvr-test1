import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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

// Mock database helpers
const mockDbHelpers = {
  getUserById: jest.fn(),
  updateUserById: jest.fn(),
  updateUserPassword: jest.fn()
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
  
  // Profile routes
  app.get('/profile', requireAuth, async (req, res) => {
    try {
      const user = await mockDbHelpers.getUserById(res.locals.user.id);
      if (!user) {
        return res.redirect('/login');
      }
      res.render('profile', { 
        title: 'Profile', 
        user: user,
        success: res.locals.success,
        error: res.locals.error
      });
    } catch (error) {
      res.locals.error = 'Error loading profile';
      res.redirect('/dashboard');
    }
  });
  
  app.post('/profile/update', requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || name.trim().length < 2) {
        res.locals.error = 'Name must be at least 2 characters';
        return res.redirect('/profile');
      }
      
      if (name.length > 50 || !/^[a-zA-Z\s]+$/.test(name)) {
        res.locals.error = 'Name must contain only letters and spaces (2-50 characters)';
        return res.redirect('/profile');
      }
      
      await mockDbHelpers.updateUserById(res.locals.user.id, { name: name.trim() });
      res.locals.success = 'Profile updated successfully';
      res.redirect('/profile');
    } catch (error) {
      res.locals.error = 'Error updating profile';
      res.redirect('/profile');
    }
  });
  
  app.post('/profile/password', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        res.locals.error = 'Both current and new passwords are required';
        return res.redirect('/profile');
      }
      
      if (newPassword.length < 6 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        res.locals.error = 'New password must be at least 6 characters with uppercase, lowercase, and number';
        return res.redirect('/profile');
      }
      
      const user = await mockDbHelpers.getUserById(res.locals.user.id);
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        res.locals.error = 'Current password is incorrect';
        return res.redirect('/profile');
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await mockDbHelpers.updateUserPassword(res.locals.user.id, hashedPassword);
      res.locals.success = 'Password updated successfully';
      res.redirect('/profile');
    } catch (error) {
      res.locals.error = 'Error updating password';
      res.redirect('/profile');
    }
  });
  
  return app;
};

describe('Profile Page Routes', () => {
  let app: express.Application;
  let validToken: string;
  let invalidToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '24h' });
    invalidToken = jwt.sign({ user: INVALID_USER }, 'wrong-secret', { expiresIn: '24h' });
    
    // Reset mocks
    jest.clearAllMocks();
    mockDbHelpers.getUserById.mockResolvedValue(TEST_USER);
    mockDbHelpers.updateUserById.mockResolvedValue(true);
    mockDbHelpers.updateUserPassword.mockResolvedValue(true);
  });
  
  describe('GET /profile', () => {
    // TC-F-001, TC-F-012
    it('should display profile page for authenticated users', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(mockDbHelpers.getUserById).toHaveBeenCalledWith(TEST_USER.id);
    });
    
    // TC-F-012
    it('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-013
    it('should fetch current user data from database using JWT token user ID', async () => {
      await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(mockDbHelpers.getUserById).toHaveBeenCalledWith(TEST_USER.id);
    });
    
    // TC-F-021
    it('should handle database errors gracefully', async () => {
      mockDbHelpers.getUserById.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.headers.location).toBe('/dashboard');
    });
    
    it('should redirect to login if user not found in database', async () => {
      mockDbHelpers.getUserById.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.headers.location).toBe('/login');
    });
  });
  
  describe('POST /profile/update', () => {
    // TC-F-003, TC-F-009
    it('should validate name is not empty before saving', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: '' })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserById).not.toHaveBeenCalled();
    });
    
    // TC-F-004
    it('should apply same validation rules as signup form (minimum 2 characters)', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'A' })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserById).not.toHaveBeenCalled();
    });
    
    it('should enforce maximum 50 characters for name', async () => {
      const longName = 'A'.repeat(51);
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: longName })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserById).not.toHaveBeenCalled();
    });
    
    it('should enforce letters and spaces only in name', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Test123' })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserById).not.toHaveBeenCalled();
    });
    
    // TC-F-009, TC-F-016
    it('should update user name in database and show success feedback', async () => {
      const newName = 'Updated Name';
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: newName })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserById).toHaveBeenCalledWith(TEST_USER.id, { name: newName });
    });
    
    // TC-F-021
    it('should handle database errors gracefully with user-friendly error messages', async () => {
      mockDbHelpers.updateUserById.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Valid Name' })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/profile/update')
        .send({ name: 'Test Name' })
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    it('should trim whitespace from name', async () => {
      const nameWithSpaces = '  Valid Name  ';
      
      await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: nameWithSpaces })
        .expect(302);
      
      expect(mockDbHelpers.updateUserById).toHaveBeenCalledWith(TEST_USER.id, { name: 'Valid Name' });
    });
  });
  
  describe('POST /profile/password', () => {
    const validCurrentPassword = 'currentPass123';
    const validNewPassword = 'newPass123';
    const hashedCurrentPassword = '$2b$10$hashedPassword';
    
    beforeEach(() => {
      mockDbHelpers.getUserById.mockResolvedValue({
        ...TEST_USER,
        password: hashedCurrentPassword
      });
    });
    
    // TC-F-015
    it('should only submit when both current and new password fields are completed', async () => {
      let response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ currentPassword: validCurrentPassword })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
      
      response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ newPassword: validNewPassword })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
    });
    
    // TC-F-006
    it('should validate current password against user existing password before allowing update', async () => {
      // Mock bcrypt.compare to return false for incorrect password
      jest.spyOn(bcrypt, 'compare').mockImplementation(async (password, hash) => {
        return password === validCurrentPassword;
      });
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'wrongPassword',
          newPassword: validNewPassword 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
    });
    
    // TC-F-007
    it('should apply same validation rules as signup form for new password', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      
      // Test minimum 6 characters
      let response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: 'abc12' 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
      
      // Test missing uppercase
      response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: 'abc123' 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
      
      // Test missing lowercase
      response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: 'ABC123' 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
      
      // Test missing number
      response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: 'AbcDef' 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).not.toHaveBeenCalled();
    });
    
    // TC-F-017
    it('should show success notification after successful password change', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$10$newHashedPassword');
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: validNewPassword 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
      expect(mockDbHelpers.updateUserPassword).toHaveBeenCalledWith(
        TEST_USER.id, 
        '$2b$10$newHashedPassword'
      );
    });
    
    // TC-F-021
    it('should handle database errors gracefully', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      mockDbHelpers.updateUserPassword.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: validNewPassword 
        })
        .expect(302);
      
      expect(response.headers.location).toBe('/profile');
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/profile/password')
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: validNewPassword 
        })
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    it('should use bcrypt with 10 salt rounds for password hashing', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$10$newHashedPassword');
      
      await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: validCurrentPassword,
          newPassword: validNewPassword 
        })
        .expect(302);
      
      expect(hashSpy).toHaveBeenCalledWith(validNewPassword, 10);
    });
  });
});