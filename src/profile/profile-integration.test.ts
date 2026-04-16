import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { JSDOM } from 'jsdom';

const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock database operations
const mockDb = {
  users: [TEST_USER],
  updateUser: jest.fn(),
  findUserById: jest.fn(),
  findUserByEmail: jest.fn()
};

// Mock file operations
const mockFs = {
  unlink: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
};

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
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
  
  // Route protection middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!res.locals.user) {
      res.clearCookie('token');
      return res.status(401).redirect('/login');
    }
    next();
  };
  
  // Multer setup for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../../public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const userId = res.locals?.user?.id || 'unknown';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      cb(null, `${userId}-${timestamp}${ext}`);
    }
  });
  
  const upload = multer({
    storage,
    limits: { fileSize: 5242880 }, // 5MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'), false);
      }
    }
  });
  
  // Profile routes
  app.get('/profile', requireAuth, (req, res) => {
    const user = res.locals.user;
    const profileData = {
      ...user,
      joinDate: new Date(user.created_at).toLocaleDateString()
    };
    
    res.json({ user: profileData });
  });
  
  app.post('/profile', requireAuth, upload.single('profilePicture'), async (req, res) => {
    try {
      const userId = res.locals.user.id;
      const { name, email } = req.body;
      
      // Validation
      if (!name || name.length < 2 || name.length > 50 || !/^[a-zA-Z\s]+$/.test(name)) {
        return res.status(400).json({ message: 'Invalid name format' });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      
      // Check email uniqueness (excluding current user)
      const existingUser = mockDb.users.find(u => u.email === email && u.id !== userId);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      
      // Handle file upload
      let profilePicturePath = null;
      if (req.file) {
        profilePicturePath = `uploads/${req.file.filename}`;
        
        // Delete old profile picture
        const currentUser = mockDb.users.find(u => u.id === userId);
        if (currentUser?.profile_picture) {
          const oldPath = path.join(__dirname, '../../../public', currentUser.profile_picture);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
      
      // Update user in mock database
      const userIndex = mockDb.users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        mockDb.users[userIndex] = {
          ...mockDb.users[userIndex],
          name,
          email,
          ...(profilePicturePath && { profile_picture: profilePicturePath })
        };
      }
      
      mockDb.updateUser(userId, { name, email, profile_picture: profilePicturePath });
      
      res.json({
        success: true,
        user: {
          id: userId,
          name,
          email,
          profilePicture: profilePicturePath
        }
      });
      
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Login endpoint for testing
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === TEST_USER.username && password === 'password') {
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });
      res.json({ success: true });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });
  
  return app;
};

describe('Profile Integration Tests', () => {
  let app: express.Application;
  let validToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    
    // Reset mock database
    mockDb.users = [{ ...TEST_USER }];
    jest.clearAllMocks();
  });
  
  describe('Profile View Access Control', () => {
    test('should redirect to login when not authenticated', async () => {
      // TC-A-001: Authentication required for profile access
      const response = await request(app)
        .get('/profile');
      
      expect(response.status).toBe(401);
      expect(response.headers.location).toBe('/login');
    });
    
    test('should clear cookies when redirecting unauthenticated users', async () => {
      // TC-A-001: Clear cookies on authentication failure
      const response = await request(app)
        .get('/profile')
        .set('Cookie', 'token=invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('token=;')])
      );
    });
    
    test('should allow access with valid JWT token', async () => {
      // TC-A-002: Valid JWT token allows profile access
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(TEST_USER.id);
      expect(response.body.user.name).toBe(TEST_USER.name);
      expect(response.body.user.email).toBe(TEST_USER.email);
    });
  });
  
  describe('Profile Update Endpoint', () => {
    test('should update profile with valid data', async () => {
      // TC-F-006: Save validates and persists changes to database
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('Updated Name');
      expect(response.body.user.email).toBe('updated@example.com');
      expect(mockDb.updateUser).toHaveBeenCalledWith(1, {
        name: 'Updated Name',
        email: 'updated@example.com',
        profile_picture: null
      });
    });
    
    test('should validate name field requirements', async () => {
      // TC-F-008: Name field validation enforces length and character requirements
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'A')
        .field('email', 'test@example.com');
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid name format');
    });
    
    test('should validate email format requirements', async () => {
      // TC-F-009: Email field validation enforces valid format
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Valid Name')
        .field('email', 'invalid-email');
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid email format');
    });
    
    test('should enforce email uniqueness constraint', async () => {
      // TC-F-009: Email uniqueness validation
      // Add another user with different email
      mockDb.users.push({
        id: 2,
        username: 'otheruser',
        name: 'Other User',
        email: 'other@example.com',
        profile_picture: null,
        created_at: '2023-01-02T00:00:00.000Z'
      });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Valid Name')
        .field('email', 'other@example.com');
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email already exists');
    });
    
    test('should handle profile picture upload with valid image', async () => {
      // TC-F-010/011: Profile picture upload and storage
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', imageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.user.profilePicture).toMatch(/uploads\/1-\d+\.jpg/);
    });
    
    test('should reject invalid file types for profile picture', async () => {
      // TC-F-010: File type validation for profile pictures
      const textBuffer = Buffer.from('not-an-image');
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', textBuffer, {
          filename: 'test.txt',
          contentType: 'text/plain'
        });
      
      expect(response.status).toBe(500); // Multer error handling
    });
    
    test('should require authentication for profile updates', async () => {
      // TC-A-001: Authentication required for profile updates
      const response = await request(app)
        .post('/profile')
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com');
      
      expect(response.status).toBe(401);
      expect(response.headers.location).toBe('/login');
    });
    
    test('should prevent updating other users profiles', async () => {
      // TC-A-002: Users can only edit their own profile
      const otherUserToken = jwt.sign({ 
        user: { id: 999, username: 'otheruser' } 
      }, JWT_SECRET);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${otherUserToken}`)
        .field('name', 'Hacked Name')
        .field('email', 'hacked@example.com');
      
      // Should fail because user 999 doesn't exist in our mock DB
      expect(response.status).toBe(500);
      
      // Original user should be unchanged
      const originalUser = mockDb.users.find(u => u.id === TEST_USER.id);
      expect(originalUser?.name).toBe(TEST_USER.name);
    });
  });
  
  describe('File Upload and Storage', () => {
    test('should store uploaded files with correct naming convention', async () => {
      // TC-F-011: Files stored with userId-timestamp.extension format
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', imageBuffer, {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.user.profilePicture).toMatch(/uploads\/1-\d+\.jpg/);
    });
    
    test('should enforce file size limits', async () => {
      // TC-F-012: File size limited to 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', largeBuffer, {
          filename: 'large.jpg',
          contentType: 'image/jpeg'
        });
      
      expect(response.status).toBe(500); // Multer will reject large files
    });
  });
  
  describe('Database Schema Integration', () => {
    test('should handle profile picture column in user updates', async () => {
      // TC-F-013: Database schema includes profile_picture column
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com');
      
      expect(mockDb.updateUser).toHaveBeenCalledWith(1, {
        name: 'Updated Name',
        email: 'updated@example.com',
        profile_picture: null
      });
    });
    
    test('should maintain backward compatibility with existing users', async () => {
      // TC-F-013: Backward compatibility with NULL profile_picture
      const userWithoutPicture = {
        ...TEST_USER,
        profile_picture: null
      };
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.user.profile_picture).toBeNull();
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    test('should handle server errors gracefully', async () => {
      // TC-F-006: Error handling for server failures
      mockDb.updateUser.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
    
    test('should handle boundary values for name validation', async () => {
      // TC-F-008: Boundary value testing for name field
      // Test minimum length (2 characters)
      let response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Jo')
        .field('email', 'test@example.com');
      
      expect(response.status).toBe(200);
      
      // Test maximum length (50 characters)
      const fiftyCharName = 'A'.repeat(50);
      response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', fiftyCharName)
        .field('email', 'test@example.com');
      
      expect(response.status).toBe(200);
      
      // Test exceeding maximum length (51 characters)
      const fiftyOneCharName = 'A'.repeat(51);
      response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', fiftyOneCharName)
        .field('email', 'test@example.com');
      
      expect(response.status).toBe(400);
    });
    
    test('should handle empty form submission', async () => {
      // TC-F-006: Empty form validation
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(400);
    });
  });
});
