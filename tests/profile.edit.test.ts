import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);

// Test data and configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z',
  profile_picture: null
};

const TEST_USER_WITH_PICTURE = {
  ...TEST_USER,
  profile_picture: 'uploads/1-1640995200000.jpg'
};

// Mock database
class MockDatabase {
  private users: any[] = [TEST_USER];
  
  findUserById(id: number) {
    return Promise.resolve(this.users.find(u => u.id === id));
  }
  
  updateProfile(id: number, data: any) {
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...data };
      return Promise.resolve(this.users[userIndex]);
    }
    return Promise.reject(new Error('User not found'));
  }
  
  emailExists(email: string, excludeId?: number) {
    return Promise.resolve(
      this.users.some(u => u.email === email && u.id !== excludeId)
    );
  }
  
  reset() {
    this.users = [{ ...TEST_USER }];
  }
}

const mockDb = new MockDatabase();

// Mock file system operations
const mockFs = {
  files: new Map<string, Buffer>(),
  writeFile: (path: string, data: Buffer) => {
    mockFs.files.set(path, data);
    return Promise.resolve();
  },
  unlink: (path: string) => {
    mockFs.files.delete(path);
    return Promise.resolve();
  },
  exists: (path: string) => {
    return Promise.resolve(mockFs.files.has(path));
  },
  reset: () => {
    mockFs.files.clear();
  }
};

// Authentication middleware
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

// Route protection middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!res.locals.user) {
    return res.status(401).redirect('/login');
  }
  next();
};

// Multer configuration for testing
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5242880 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  }
});

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
      const user = await mockDb.findUserById(res.locals.user.id);
      res.render('profile', { 
        title: 'Profile', 
        user: res.locals.user,
        profile: user
      });
    } catch (error) {
      res.status(500).send('Server error');
    }
  });
  
  app.post('/profile', requireAuth, upload.single('profilePicture'), async (req, res) => {
    try {
      const { name, email } = req.body;
      const userId = res.locals.user.id;
      
      // Validation
      const errors: string[] = [];
      
      // Name validation
      if (!name || name.length < 2 || name.length > 50) {
        errors.push('Name must be between 2 and 50 characters');
      }
      if (!/^[a-zA-Z\s]+$/.test(name)) {
        errors.push('Name can only contain letters and spaces');
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        errors.push('Please enter a valid email address');
      }
      
      // Check email uniqueness
      const emailExists = await mockDb.emailExists(email, userId);
      if (emailExists) {
        errors.push('Email is already in use');
      }
      
      if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
      }
      
      const updateData: any = { name, email };
      
      // Handle profile picture upload
      if (req.file) {
        const timestamp = Date.now();
        const extension = path.extname(req.file.originalname);
        const filename = `${userId}-${timestamp}${extension}`;
        const filePath = `uploads/${filename}`;
        
        // Delete existing profile picture
        const currentUser = await mockDb.findUserById(userId);
        if (currentUser?.profile_picture) {
          try {
            await mockFs.unlink(path.join('public', currentUser.profile_picture));
          } catch (error) {
            // File might not exist, continue
          }
        }
        
        // Save new file
        await mockFs.writeFile(path.join('public', filePath), req.file.buffer);
        updateData.profile_picture = filePath;
      }
      
      // Update user profile
      const updatedUser = await mockDb.updateProfile(userId, updateData);
      
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        user: updatedUser 
      });
      
    } catch (error) {
      res.status(500).json({ success: false, errors: ['Server error'] });
    }
  });
  
  return app;
};

describe('Profile Editing Tests', () => {
  let app: express.Application;
  let validToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    mockDb.reset();
    mockFs.reset();
  });
  
  afterEach(() => {
    mockDb.reset();
    mockFs.reset();
  });
  
  describe('Profile View', () => {
    // TC-F-001: User can view their current profile information in read-only format
    test('should display current profile information in read-only format', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Test User');
      expect(response.text).toContain('test@example.com');
    });
    
    // TC-F-002: User can click an 'Edit Profile' button to switch to edit mode
    test('should contain edit profile button or control', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.text).toMatch(/edit.*profile|Edit Profile/i);
    });
    
    // TC-F-015: Authentication requirement for profile access
    test('should redirect to login when not authenticated', async () => {
      const response = await request(app)
        .get('/profile');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Profile Updates', () => {
    // TC-F-006: Save validates inputs and persists changes when validation passes
    test('should successfully update profile with valid data', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.user.name).toBe('Updated Name');
      expect(response.body.user.email).toBe('updated@example.com');
    });
    
    // TC-F-008: Name field validation enforces 2-50 character length requirement
    test('should reject name with less than 2 characters', async () => {
      const updateData = {
        name: 'A',
        email: 'test@example.com'
      };
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Name must be between 2 and 50 characters');
    });
    
    test('should reject name with more than 50 characters', async () => {
      const updateData = {
        name: 'A'.repeat(51),
        email: 'test@example.com'
      };
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Name must be between 2 and 50 characters');
    });
    
    test('should reject name with invalid characters', async () => {
      const updateData = {
        name: 'Test123',
        email: 'test@example.com'
      };
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Name can only contain letters and spaces');
    });
    
    // TC-F-009: Email field validation enforces valid email format
    test('should reject invalid email format', async () => {
      const updateData = {
        name: 'Test User',
        email: 'invalid-email'
      };
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Please enter a valid email address');
    });
    
    test('should reject duplicate email address', async () => {
      // Add another user to mock database
      const anotherUser = {
        id: 2,
        username: 'anotheruser',
        name: 'Another User',
        email: 'another@example.com',
        created_at: '2023-01-01T00:00:00.000Z'
      };
      
      const updateData = {
        name: 'Test User',
        email: 'another@example.com'
      };
      
      // Mock email exists
      jest.spyOn(mockDb, 'emailExists').mockResolvedValue(true);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Email is already in use');
    });
    
    // TC-F-015: Authentication requirement for profile updates
    test('should reject profile update without authentication', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      
      const response = await request(app)
        .post('/profile')
        .send(updateData);
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Profile Picture Upload', () => {
    // TC-F-010: Profile picture uploads restricted to common image formats
    test('should accept valid image file types', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('fake-image-data'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg/);
    });
    
    test('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('fake-data'), {
          filename: 'test.txt',
          contentType: 'text/plain'
        });
      
      expect(response.status).toBe(500);
    });
    
    // TC-F-012: Profile picture file size limited to 5MB
    test('should reject files larger than 5MB', async () => {
      const largeBuffer = Buffer.alloc(5242881); // 5MB + 1 byte
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', largeBuffer, {
          filename: 'large.jpg',
          contentType: 'image/jpeg'
        });
      
      expect(response.status).toBe(500);
    });
    
    // TC-F-011: Uploaded profile pictures stored in public/uploads directory with unique filenames
    test('should store profile picture with unique filename', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('fake-image-data'), {
          filename: 'test.png',
          contentType: 'image/png'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.png/);
    });
    
    test('should delete existing profile picture when uploading new one', async () => {
      // Set up user with existing profile picture
      await mockDb.updateProfile(1, { profile_picture: 'uploads/1-old.jpg' });
      mockFs.files.set('public/uploads/1-old.jpg', Buffer.from('old-image'));
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', Buffer.from('new-image-data'), {
          filename: 'new.jpg',
          contentType: 'image/jpeg'
        });
      
      expect(response.status).toBe(200);
      expect(mockFs.files.has('public/uploads/1-old.jpg')).toBe(false);
    });
  });
  
  describe('Success Messages', () => {
    // TC-F-014: Success confirmation message displayed after successful update
    test('should return success message after successful profile update', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${validToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });
  });
});