import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';

// Test data and configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  password: '$2b$10$hashedPassword',
  created_at: '2023-01-01T00:00:00.000Z'
};

const INVALID_USER = {
  id: 999,
  name: 'Invalid User',
  email: 'invalid@example.com'
};

// Mock database
class MockDatabase {
  private users: any[] = [TEST_USER];
  
  get(query: string, params: any[], callback: (err: any, row: any) => void) {
    if (query.includes('SELECT id, name, email, created_at FROM users WHERE id = ?')) {
      const user = this.users.find(u => u.id === params[0]);
      callback(null, user || null);
    } else if (query.includes('SELECT id, name, email, password, created_at FROM users WHERE id = ?')) {
      const user = this.users.find(u => u.id === params[0]);
      callback(null, user || null);
    } else {
      callback(null, null);
    }
  }
  
  run(query: string, params: any[], callback: (err: any) => void) {
    if (query.includes('UPDATE users SET name = ? WHERE id = ?')) {
      const userIndex = this.users.findIndex(u => u.id === params[1]);
      if (userIndex !== -1) {
        this.users[userIndex].name = params[0];
        callback.call({ changes: 1 }, null);
      } else {
        callback.call({ changes: 0 }, null);
      }
    } else if (query.includes('UPDATE users SET password = ? WHERE id = ?')) {
      const userIndex = this.users.findIndex(u => u.id === params[1]);
      if (userIndex !== -1) {
        this.users[userIndex].password = params[0];
        callback.call({ changes: 1 }, null);
      } else {
        callback.call({ changes: 0 }, null);
      }
    } else {
      callback(null);
    }
  }
}

const mockDb = new MockDatabase();

// Mock authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (!token) {
    return res.redirect('/login');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.redirect('/login');
  }
};

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  
  // Profile routes
  app.get('/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'number') {
      return res.redirect('/login');
    }
    
    mockDb.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.redirect('/login');
      }
      
      if (!user) {
        return res.redirect('/login');
      }
      
      if (!user.name || !user.email || !user.created_at) {
        return res.redirect('/login');
      }
      
      res.render('profile', { 
        user: user,
        title: 'Profile'
      });
    });
  });
  
  app.post('/profile/update-name', authenticateToken, async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;
    
    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name must be between 2 and 50 characters' 
      });
    }
    
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name can only contain letters and spaces' 
      });
    }
    
    if (!userId || typeof userId !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid user session' 
      });
    }
    
    mockDb.run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId], function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update name' 
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Name updated successfully',
        name: name.trim()
      });
    });
  });
  
  app.post('/profile/update-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Validation
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password is required' 
      });
    }
    
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be between 6 and 128 characters' 
      });
    }
    
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must contain at least one lowercase letter, one uppercase letter, and one number' 
      });
    }
    
    if (!userId || typeof userId !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid user session' 
      });
    }
    
    // Get user from database
    mockDb.get('SELECT id, name, email, password, created_at FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: 'Database error' 
        });
      }
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      // Verify current password
      try {
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!passwordMatch) {
          return res.status(400).json({ 
            success: false, 
            error: 'Current password is incorrect' 
          });
        }
        
        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        mockDb.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId], function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              error: 'Failed to update password' 
            });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ 
              success: false, 
              error: 'User not found' 
            });
          }
          
          res.json({ 
            success: true, 
            message: 'Password updated successfully'
          });
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to update password' 
        });
      }
    });
  });
  
  app.get('/login', (req, res) => {
    res.send('Login Page');
  });
  
  return app;
};

describe('Profile Page Functionality', () => {
  let app: express.Application;
  let validToken: string;
  let invalidToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ id: TEST_USER.id, email: TEST_USER.email }, JWT_SECRET, { expiresIn: '24h' });
    invalidToken = 'invalid-token';
  });
  
  describe('Profile Page Access and Authentication', () => {
    // TC-F-001
    test('should redirect unauthenticated users to login page', async () => {
      const response = await request(app)
        .get('/profile');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-002
    test('should redirect users with invalid JWT token to login page', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${invalidToken}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-003
    test('should allow authenticated users with valid JWT token to access profile page', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
    });
    
    // TC-F-004
    test('should redirect to login when user ID is invalid in JWT', async () => {
      const tokenWithInvalidUserId = jwt.sign({ id: 'invalid', email: TEST_USER.email }, JWT_SECRET);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${tokenWithInvalidUserId}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-005
    test('should redirect to login when user is not found in database', async () => {
      const tokenWithNonexistentUser = jwt.sign({ id: 999, email: 'nonexistent@example.com' }, JWT_SECRET);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${tokenWithNonexistentUser}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });
  
  describe('Profile Data Display', () => {
    // TC-F-006
    test('should display user name, email, and join date in readonly format', async () => {
      // Mock the profile template to return user data
      jest.spyOn(require('express').response, 'render').mockImplementation(function(this: any, view, data) {
        expect(view).toBe('profile');
        expect(data.user.name).toBe(TEST_USER.name);
        expect(data.user.email).toBe(TEST_USER.email);
        expect(data.user.created_at).toBe(TEST_USER.created_at);
        expect(data.title).toBe('Profile');
        this.status(200).send('Profile rendered');
      });
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
    });
    
    // TC-F-007
    test('should redirect to login when user data is incomplete', async () => {
      // Create user with missing data
      const incompleteUser = { id: 2, name: '', email: 'incomplete@example.com', created_at: '2023-01-01' };
      const tokenWithIncompleteUser = jwt.sign({ id: 2, email: 'incomplete@example.com' }, JWT_SECRET);
      
      // Mock database to return incomplete user
      jest.spyOn(mockDb, 'get').mockImplementation((query, params, callback) => {
        if (params[0] === 2) {
          callback(null, incompleteUser);
        } else {
          callback(null, TEST_USER);
        }
      });
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${tokenWithIncompleteUser}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });
  
  describe('Profile Name Update', () => {
    // TC-F-008
    test('should successfully update user name with valid data', async () => {
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Name updated successfully');
      expect(response.body.name).toBe('Updated Name');
    });
    
    // TC-F-009
    test('should validate name is not empty', async () => {
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name must be between 2 and 50 characters');
    });
    
    // TC-F-010
    test('should validate minimum name length of 2 characters', async () => {
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'A' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name must be between 2 and 50 characters');
    });
    
    // TC-F-011
    test('should validate maximum name length of 50 characters', async () => {
      const longName = 'A'.repeat(51);
      
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: longName });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name must be between 2 and 50 characters');
    });
    
    // TC-F-012
    test('should validate name contains only letters and spaces', async () => {
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Test Name123' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name can only contain letters and spaces');
    });
    
    // TC-F-013
    test('should reject name update for unauthenticated users', async () => {
      const response = await request(app)
        .post('/profile/update-name')
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-014
    test('should handle database error during name update gracefully', async () => {
      // Mock database error
      jest.spyOn(mockDb, 'run').mockImplementation((query, params, callback) => {
        callback.call({ changes: 0 }, new Error('Database error'));
      });
      
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to update name');
    });
    
    // TC-F-015
    test('should return error when user not found during name update', async () => {
      // Mock no changes in database
      jest.spyOn(mockDb, 'run').mockImplementation((query, params, callback) => {
        callback.call({ changes: 0 }, null);
      });
      
      const response = await request(app)
        .post('/profile/update-name')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });
  
  describe('Password Change Functionality', () => {
    beforeEach(async () => {
      // Ensure test user has a properly hashed password
      TEST_USER.password = await bcrypt.hash('currentpassword', 10);
    });
    
    // TC-F-016
    test('should successfully update password with valid current password', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'currentpassword',
          newPassword: 'NewPassword123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password updated successfully');
    });
    
    // TC-F-017
    test('should validate current password before allowing update', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'wrongpassword',
          newPassword: 'NewPassword123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is incorrect');
    });
    
    // TC-F-018
    test('should validate new password meets minimum 6 character requirement', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'currentpassword',
          newPassword: 'Abc1'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('New password must be between 6 and 128 characters');
    });
    
    // TC-F-019
    test('should validate new password contains required character types', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'currentpassword',
          newPassword: 'simplepassword'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('New password must contain at least one lowercase letter, one uppercase letter, and one number');
    });
    
    // TC-F-020
    test('should require current password field to be completed', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          newPassword: 'NewPassword123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is required');
    });
    
    // TC-F-021
    test('should require new password field to be completed', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'currentpassword'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('New password must be between 6 and 128 characters');
    });
    
    // TC-F-022
    test('should reject password update for unauthenticated users', async () => {
      const response = await request(app)
        .post('/profile/update-password')
        .send({ 
          currentPassword: 'currentpassword',
          newPassword: 'NewPassword123'
        });
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-023
    test('should handle database error during password update gracefully', async () => {
      // Mock database error on user fetch
      jest.spyOn(mockDb, 'get').mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });
      
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'currentpassword',
          newPassword: 'NewPassword123'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
    
    // TC-F-024
    test('should validate new password maximum length of 128 characters', async () => {
      const longPassword = 'A1a' + 'a'.repeat(126);
      
      const response = await request(app)
        .post('/profile/update-password')
        .set('Cookie', [`token=${validToken}`])
        .send({ 
          currentPassword: 'currentpassword',
          newPassword: longPassword
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('New password must be between 6 and 128 characters');
    });
  });
});