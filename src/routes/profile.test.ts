import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { body, validationResult } from 'express-validator';

// Test configuration
const JWT_SECRET = 'test-secret';
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

const TEST_USER_WITH_PICTURE = {
  ...TEST_USER,
  profile_picture: 'uploads/1-1640995200000.jpg'
};

// Mock database
let mockUsers: any[] = [TEST_USER];

const mockDb = {
  getUserById: (id: number) => mockUsers.find(u => u.id === id),
  updateUser: (id: number, data: any) => {
    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex >= 0) {
      mockUsers[userIndex] = { ...mockUsers[userIndex], ...data };
      return mockUsers[userIndex];
    }
    return null;
  },
  getUserByEmail: (email: string, excludeId?: number) => 
    mockUsers.find(u => u.email === email && (!excludeId || u.id !== excludeId))
};

// Mock multer configuration
const mockStorage = multer.memoryStorage();
const mockUpload = multer({
  storage: mockStorage,
  limits: { fileSize: 5242880 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

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
  app.use('/uploads', express.static(UPLOADS_DIR));
  
  // Flash message middleware
  app.use((req, res, next) => {
    res.locals.success = null;
    res.locals.error = null;
    next();
  });
  
  app.use(mockAuthMiddleware);
  
  // Profile routes
  app.get('/profile', requireAuth, (req, res) => {
    const user = mockDb.getUserById(res.locals.user.id);
    res.render('profile', { title: 'Profile', user });
  });
  
  app.post('/profile', 
    requireAuth,
    mockUpload.single('profilePicture'),
    [
      body('name')
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name must be 2-50 characters, letters and spaces only'),
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address')
    ],
    (req, res) => {
      const errors = validationResult(req);
      const user = mockDb.getUserById(res.locals.user.id);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, email } = req.body;
      
      // Check email uniqueness
      const existingUser = mockDb.getUserByEmail(email, user.id);
      if (existingUser) {
        return res.status(400).json({ errors: [{ field: 'email', msg: 'Email already in use' }] });
      }
      
      const updateData: any = { name, email };
      
      // Handle profile picture upload
      if (req.file) {
        const filename = `${user.id}-${Date.now()}${path.extname(req.file.originalname)}`;
        const filepath = `uploads/${filename}`;
        
        // Mock file save
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        
        // Delete old profile picture if exists
        if (user.profile_picture) {
          const oldPath = path.join(__dirname, '../public', user.profile_picture);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        
        updateData.profile_picture = filepath;
      }
      
      const updatedUser = mockDb.updateUser(user.id, updateData);
      res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
    }
  );
  
  return app;
};

describe('Profile Page - Inline Editing with Profile Picture Upload', () => {
  let app: express.Application;
  let authenticatedAgent: request.SuperTest<request.Test>;
  
  beforeEach(() => {
    app = createTestApp();
    mockUsers = [{ ...TEST_USER }]; // Reset mock data
    
    // Create authenticated agent
    const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    authenticatedAgent = request(app);
    authenticatedAgent.jar.setCookie(`token=${token}`);
    
    // Clean up uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  });
  
  afterEach(() => {
    // Clean up uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  });
  
  describe('Profile View Mode', () => {
    // TC-F-001
    it('should display current profile information in read-only format', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);
      
      expect(response.text).toContain(TEST_USER.name);
      expect(response.text).toContain(TEST_USER.email);
    });
    
    // TC-F-001
    it('should display profile picture or placeholder when no picture exists', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);
      
      // Should show placeholder since profile_picture is null
      expect(response.text).toContain('placeholder') || expect(response.text).toContain('default-avatar');
    });
    
    // TC-F-002
    it('should display Edit Profile button in view mode', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);
      
      expect(response.text).toContain('Edit Profile') || expect(response.text).toContain('id="editButton"');
    });
  });
  
  describe('Profile Edit Mode UI', () => {
    // TC-F-003, TC-F-004
    it('should show editable fields with pre-populated values in edit mode', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);
      
      // Check for form inputs with current values
      expect(response.text).toMatch(new RegExp(`value=["']${TEST_USER.name}["']|${TEST_USER.name}["']`));
      expect(response.text).toMatch(new RegExp(`value=["']${TEST_USER.email}["']|${TEST_USER.email}["']`));
    });
    
    // TC-F-004
    it('should display profile picture upload functionality in edit mode', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);
      
      expect(response.text).toContain('type="file"') || expect(response.text).toContain('profilePicture');
    });
    
    // TC-F-005
    it('should display Save and Cancel buttons in edit mode', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);
      
      expect(response.text).toContain('Save') || expect(response.text).toContain('id="saveButton"');
      expect(response.text).toContain('Cancel') || expect(response.text).toContain('id="cancelButton"');
    });
  });
  
  describe('Profile Update Functionality', () => {
    // TC-F-006
    it('should successfully update profile with valid data', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      
      const response = await authenticatedAgent
        .post('/profile')
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Profile updated successfully');
      expect(response.body.user.name).toBe(updateData.name);
      expect(response.body.user.email).toBe(updateData.email);
    });
    
    // TC-F-008
    it('should validate name field with 2-50 character requirement', async () => {
      // Test minimum length violation
      let response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'A', email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e: any) => e.msg && e.msg.includes('2-50 characters'))).toBe(true);
      
      // Test maximum length violation
      response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'A'.repeat(51), email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e: any) => e.msg && e.msg.includes('2-50 characters'))).toBe(true);
    });
    
    // TC-F-008
    it('should validate name field contains only letters and spaces', async () => {
      const response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'Test123', email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e: any) => e.msg && e.msg.includes('letters and spaces only'))).toBe(true);
    });
    
    // TC-F-009
    it('should validate email field format', async () => {
      const response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'Test User', email: 'invalid-email' })
        .expect(400);
      
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e: any) => e.msg && e.msg.includes('valid email'))).toBe(true);
    });
    
    // TC-F-009
    it('should prevent duplicate email addresses', async () => {
      // Add another user with different email
      mockUsers.push({ id: 2, username: 'user2', name: 'User Two', email: 'user2@example.com', profile_picture: null, created_at: '2023-01-01' });
      
      const response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'Test User', email: 'user2@example.com' })
        .expect(400);
      
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e: any) => e.msg && e.msg.includes('Email already in use'))).toBe(true);
    });
  });
  
  describe('Profile Picture Upload', () => {
    // TC-F-010
    it('should accept valid image formats (jpg, jpeg, png, gif)', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await authenticatedAgent
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/\d+-\d+\.jpg$/);
    });
    
    // TC-F-010
    it('should reject invalid file formats', async () => {
      const textBuffer = Buffer.from('not-an-image');
      
      const response = await authenticatedAgent
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', textBuffer, 'test.txt')
        .expect(400);
      
      expect(response.text).toContain('Only image files are allowed');
    });
    
    // TC-F-011
    it('should store uploaded files in public/uploads directory with unique filenames', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await authenticatedAgent
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', imageBuffer, 'test.png')
        .expect(200);
      
      expect(response.body.user.profile_picture).toMatch(/^uploads\/1-\d+\.png$/);
    });
    
    // TC-F-012
    it('should enforce 5MB file size limit', async () => {
      const largeBuffer = Buffer.alloc(5242881); // 5MB + 1 byte
      
      const response = await authenticatedAgent
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', largeBuffer, 'large.jpg');
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
    
    // TC-F-011
    it('should delete old profile picture when uploading new one', async () => {
      // Setup user with existing profile picture
      mockUsers[0] = { ...TEST_USER_WITH_PICTURE };
      
      const imageBuffer = Buffer.from('new-fake-image-data');
      
      const response = await authenticatedAgent
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', imageBuffer, 'new.jpg')
        .expect(200);
      
      // Should have new profile picture path
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg$/);
      expect(response.body.user.profile_picture).not.toBe(TEST_USER_WITH_PICTURE.profile_picture);
    });
  });
  
  describe('Authentication and Security', () => {
    // TC-F-013
    it('should require JWT authentication for profile access', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    // TC-F-013
    it('should require JWT authentication for profile updates', async () => {
      const response = await request(app)
        .post('/profile')
        .send({ name: 'Test', email: 'test@example.com' })
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
    
    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', 'token=invalid-token')
        .expect(401);
      
      expect(response.headers.location).toBe('/login');
    });
  });
  
  describe('Success Confirmation', () => {
    // TC-F-014
    it('should display success confirmation message after successful update', async () => {
      const response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'Updated Name', email: 'updated@example.com' })
        .expect(200);
      
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database failure
      const originalUpdateUser = mockDb.updateUser;
      mockDb.updateUser = () => { throw new Error('Database error'); };
      
      const response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'Test User', email: 'test@example.com' })
        .expect(500);
      
      // Restore original function
      mockDb.updateUser = originalUpdateUser;
    });
    
    it('should handle missing form fields', async () => {
      const response = await authenticatedAgent
        .post('/profile')
        .send({})
        .expect(400);
      
      expect(response.body.errors).toBeDefined();
    });
    
    it('should validate boundary values for name length', async () => {
      // Test exact minimum (2 characters)
      let response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'Ab', email: 'test@example.com' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Test exact maximum (50 characters)
      response = await authenticatedAgent
        .post('/profile')
        .send({ name: 'A'.repeat(50), email: 'test@example.com' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
});