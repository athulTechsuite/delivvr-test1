import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

// Mock file system and database
jest.mock('fs');
jest.mock('../config/database.js', () => ({
  dbHelpers: {
    getUserProfileById: jest.fn(),
    updateProfile: jest.fn(),
    getUserByEmail: jest.fn()
  }
}));

import { dbHelpers } from '../config/database.js';

const mockedDbHelpers = dbHelpers as jest.Mocked<typeof dbHelpers>;
const mockedFs = fs as jest.Mocked<typeof fs>;

const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('view engine', 'ejs');
  app.use('/uploads', express.static('public/uploads'));
  
  // Authentication middleware
  app.use((req, res, next) => {
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
  });
  
  const requireAuth = (req: any, res: any, next: any) => {
    if (!res.locals.user) {
      return res.status(401).redirect('/login');
    }
    next();
  };
  
  // File upload configuration
  const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
      const userId = res.locals?.user?.id || 'unknown';
      const timestamp = Date.now();
      const extension = path.extname(file.originalname);
      cb(null, `${userId}-${timestamp}${extension}`);
    }
  });
  
  const upload = multer({
    storage,
    limits: { fileSize: 5242880 }, // 5MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (.jpg, .jpeg, .png, .gif) are allowed'));
      }
    }
  });
  
  // Routes
  app.get('/profile', requireAuth, async (req, res) => {
    try {
      const profile = await dbHelpers.getUserProfileById(res.locals.user.id);
      res.json({ profile, editMode: false });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });
  
  app.post('/profile', requireAuth, upload.single('profilePicture'), async (req, res) => {
    try {
      const { name, email } = req.body;
      const userId = res.locals.user.id;
      
      // Validation
      if (!name || name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
      }
      
      if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
        return res.status(400).json({ error: 'Name can only contain letters and spaces' });
      }
      
      if (!email || !email.includes('@') || !email.includes('.')) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }
      
      // Check email uniqueness
      const existingUser = await dbHelpers.getUserByEmail(email.trim());
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'This email is already registered to another account' });
      }
      
      // Handle profile picture
      let profilePicturePath = null;
      if (req.file) {
        // Delete old profile picture if exists
        const currentProfile = await dbHelpers.getUserProfileById(userId);
        if (currentProfile.profile_picture) {
          const oldFilePath = path.join('public', currentProfile.profile_picture);
          if (fs.existsSync(oldFilePath)) {
            fs.unlink(oldFilePath, (err) => {
              if (err) console.error('Failed to delete old profile picture:', err);
            });
          }
        }
        
        profilePicturePath = `uploads/${req.file.filename}`;
      }
      
      const updatedProfile = await dbHelpers.updateProfile(
        userId,
        name.trim(),
        email.trim(),
        profilePicturePath
      );
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        profile: updatedProfile
      });
      
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size must be less than 5MB' });
        }
      }
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });
  
  // Mock login for testing
  app.post('/auth/login', (req, res) => {
    const token = jwt.sign({ user: TEST_USER }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    res.json({ success: true });
  });
  
  return app;
};

describe('Profile Management Integration Tests', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    
    // Mock file system
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.unlink.mockImplementation((path, callback) => {
      if (typeof callback === 'function') callback(null);
    });
  });
  
  describe('Complete Profile Edit Workflow', () => {
    let authToken: string;
    
    beforeEach(() => {
      authToken = jwt.sign({ user: TEST_USER }, JWT_SECRET);
    });
    
    // TC-AC-001, TC-AC-002
    test('should complete full profile view and edit workflow', async () => {
      mockedDbHelpers.getUserProfileById.mockResolvedValue(TEST_USER);
      
      // Step 1: View profile in read-only mode
      const viewResponse = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${authToken}`])
        .expect(200);
      
      expect(viewResponse.body.profile).toEqual(TEST_USER);
      expect(viewResponse.body.editMode).toBe(false);
      
      // Step 2: Update profile (simulating edit mode save)
      const updatedProfile = {
        ...TEST_USER,
        name: 'Jane Doe',
        email: 'jane@example.com'
      };
      
      mockedDbHelpers.getUserByEmail.mockResolvedValue(null);
      mockedDbHelpers.updateProfile.mockResolvedValue(updatedProfile);
      
      const updateResponse = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Jane Doe')
        .field('email', 'jane@example.com')
        .expect(200);
      
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.message).toBe('Profile updated successfully');
      expect(updateResponse.body.profile.name).toBe('Jane Doe');
      expect(updateResponse.body.profile.email).toBe('jane@example.com');
    });
    
    // TC-AC-004, TC-AC-011
    test('should handle profile picture upload with file cleanup', async () => {
      const existingProfile = {
        ...TEST_USER,
        profile_picture: 'uploads/1-1640995200000.jpg'
      };
      
      const updatedProfile = {
        ...existingProfile,
        profile_picture: 'uploads/1-1640995300000.png'
      };
      
      mockedDbHelpers.getUserProfileById.mockResolvedValue(existingProfile);
      mockedDbHelpers.getUserByEmail.mockResolvedValue(null);
      mockedDbHelpers.updateProfile.mockResolvedValue(updatedProfile);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('fake image data'), {
          filename: 'new-profile.png',
          contentType: 'image/png'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(mockedFs.unlink).toHaveBeenCalledWith(
        'public/uploads/1-1640995200000.jpg',
        expect.any(Function)
      );
      expect(mockedDbHelpers.updateProfile).toHaveBeenCalledWith(
        TEST_USER.id,
        'Test User',
        'test@example.com',
        expect.stringMatching(/uploads\/\d+-\d+\.png/)
      );
    });
  });
  
  describe('Validation Error Scenarios', () => {
    let authToken: string;
    
    beforeEach(() => {
      authToken = jwt.sign({ user: TEST_USER }, JWT_SECRET);
    });
    
    // TC-AC-008
    test('should validate name boundary conditions', async () => {
      // Test minimum length (2 characters)
      let response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Ab')
        .field('email', 'test@example.com')
        .expect(200);
      
      mockedDbHelpers.getUserByEmail.mockResolvedValue(null);
      mockedDbHelpers.updateProfile.mockResolvedValue({ ...TEST_USER, name: 'Ab' });
      
      // Test maximum length (50 characters)
      const fiftyCharName = 'A'.repeat(49) + 'Z'; // Exactly 50 chars
      response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', fiftyCharName)
        .field('email', 'test@example.com')
        .expect(200);
    });
    
    // TC-AC-010
    test('should reject non-image file types', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('fake pdf data'), {
          filename: 'document.pdf',
          contentType: 'application/pdf'
        })
        .expect(400);
      
      expect(response.body.error).toContain('Only image files');
    });
    
    // TC-AC-012
    test('should enforce file size limit', async () => {
      // Create buffer larger than 5MB
      const largeBuffer = Buffer.alloc(5242881); // 5MB + 1 byte
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', largeBuffer, {
          filename: 'large-image.jpg',
          contentType: 'image/jpeg'
        })
        .expect(400);
      
      expect(response.body.error).toBe('File size must be less than 5MB');
    });
  });
  
  describe('Authentication and Security', () => {
    // TC-AC-001
    test('should maintain JWT authentication throughout edit workflow', async () => {
      // Test unauthenticated access
      await request(app)
        .get('/profile')
        .expect(401)
        .expect('Location', '/login');
      
      await request(app)
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .expect(401)
        .expect('Location', '/login');
    });
    
    test('should handle JWT token expiration during edit session', async () => {
      const expiredToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '-1h' });
      
      await request(app)
        .get('/profile')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(401)
        .expect('Location', '/login');
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    let authToken: string;
    
    beforeEach(() => {
      authToken = jwt.sign({ user: TEST_USER }, JWT_SECRET);
    });
    
    test('should handle database connection failures gracefully', async () => {
      mockedDbHelpers.getUserProfileById.mockRejectedValue(new Error('Database connection lost'));
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${authToken}`])
        .expect(500);
      
      expect(response.body.error).toBe('Failed to load profile');
    });
    
    test('should handle file system errors during profile picture deletion', async () => {
      const existingProfile = {
        ...TEST_USER,
        profile_picture: 'uploads/old-picture.jpg'
      };
      
      mockedDbHelpers.getUserProfileById.mockResolvedValue(existingProfile);
      mockedDbHelpers.getUserByEmail.mockResolvedValue(null);
      mockedDbHelpers.updateProfile.mockResolvedValue({ ...existingProfile, name: 'Updated' });
      
      // Mock file deletion error
      mockedFs.unlink.mockImplementation((path, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Permission denied'));
        }
      });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Updated Name')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('new image data'), {
          filename: 'new-pic.jpg',
          contentType: 'image/jpeg'
        })
        .expect(200);
      
      // Should still succeed even if old file deletion fails
      expect(response.body.success).toBe(true);
    });
    
    // TC-AC-014
    test('should display appropriate success message after update', async () => {
      mockedDbHelpers.getUserByEmail.mockResolvedValue(null);
      mockedDbHelpers.updateProfile.mockResolvedValue({ ...TEST_USER, name: 'Updated' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${authToken}`])
        .field('name', 'Updated Name')
        .field('email', 'test@example.com')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });
  });
});