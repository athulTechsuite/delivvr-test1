import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

// Test configuration
const JWT_SECRET = 'test-secret';
const UPLOADS_DIR = path.join(__dirname, '../test-uploads');
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

const ANOTHER_USER = {
  id: 2,
  username: 'anotheruser', 
  name: 'Another User',
  email: 'another@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock database with file cleanup tracking
class MockDatabase {
  private users: any[] = [TEST_USER, ANOTHER_USER];
  public deletedFiles: string[] = [];
  
  getUserById(id: number) {
    return Promise.resolve(this.users.find(user => user.id === id));
  }
  
  getUserByEmail(email: string, excludeId?: number) {
    return Promise.resolve(this.users.find(user => user.email === email && user.id !== excludeId));
  }
  
  async updateProfile(id: number, updates: any) {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
      // Simulate deleting old profile picture
      if (updates.profile_picture && this.users[userIndex].profile_picture) {
        this.deletedFiles.push(this.users[userIndex].profile_picture);
      }
      
      this.users[userIndex] = { ...this.users[userIndex], ...updates };
      return this.users[userIndex];
    }
    throw new Error('User not found');
  }
  
  reset() {
    this.users = [{ ...TEST_USER }, { ...ANOTHER_USER }];
    this.deletedFiles = [];
  }
}

const mockDb = new MockDatabase();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${req.user.id}-${timestamp}${extension}`;
    cb(null, filename);
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
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Authentication middleware
const mockAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded.user;
      res.locals.user = decoded.user;
    } catch (error) {
      req.user = null;
      res.locals.user = null;
    }
  } else {
    req.user = null;
    res.locals.user = null;
  }
  
  next();
};

// Route protection middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Authentication required', redirect: '/login' });
  }
  next();
};

// Create test app with profile routes
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mockAuthMiddleware);
  
  // Profile routes
  app.get('/profile', requireAuth, async (req, res) => {
    try {
      const user = await mockDb.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/profile', requireAuth, upload.single('profilePicture'), async (req, res) => {
    try {
      const { name, email } = req.body;
      const userId = req.user.id;
      
      // Name validation
      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!name || name.length < 2 || name.length > 50 || !nameRegex.test(name)) {
        return res.status(400).json({ 
          error: 'Name must be between 2-50 characters and contain only letters and spaces' 
        });
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      // Email uniqueness check
      const existingUser = await mockDb.getUserByEmail(email, userId);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      
      const updates: any = { name, email };
      
      // Handle profile picture upload
      if (req.file) {
        const relativePath = `uploads/${req.file.filename}`;
        updates.profile_picture = relativePath;
      }
      
      const updatedUser = await mockDb.updateProfile(userId, updates);
      res.json({ success: true, user: updatedUser, message: 'Profile updated successfully' });
      
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Error handling middleware
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size must be less than 5MB' });
      }
      return res.status(400).json({ error: error.message });
    }
    
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ error: 'Only image files (jpg, jpeg, png, gif) are allowed' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  });
  
  return app;
};

describe('Profile Route Integration Tests', () => {
  let app: express.Application;
  let validToken: string;
  let anotherUserToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    anotherUserToken = jwt.sign({ user: ANOTHER_USER }, JWT_SECRET, { expiresIn: '1h' });
    mockDb.reset();
    
    // Clean up test upload directory
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  });
  
  describe('Profile Data Retrieval', () => {
    // TC-F-001: Profile data retrieval with authentication
    it('should return user profile data when authenticated', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.body.user).toEqual({
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        profile_picture: null,
        created_at: '2023-01-01T00:00:00.000Z'
      });
    });
    
    // TC-F-003: Authentication required for profile access
    it('should reject profile access without valid authentication', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(401);
      
      expect(response.body.error).toBe('Authentication required');
      expect(response.body.redirect).toBe('/login');
    });
    
    // TC-F-003: Invalid JWT token handling
    it('should reject profile access with invalid JWT token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', ['token=invalid.jwt.token'])
        .expect(401);
      
      expect(response.body.error).toBe('Authentication required');
    });
  });
  
  describe('Profile Update - Input Validation', () => {
    // TC-F-008: Name validation - minimum length
    it('should reject name updates shorter than 2 characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'A', email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.error).toContain('Name must be between 2-50 characters');
    });
    
    // TC-F-008: Name validation - maximum length
    it('should reject name updates longer than 50 characters', async () => {
      const longName = 'A'.repeat(51);
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: longName, email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.error).toContain('Name must be between 2-50 characters');
    });
    
    // TC-F-008: Name validation - character restrictions
    it('should reject name updates with invalid characters', async () => {
      const invalidNames = ['Test123', 'Test@User', 'Test_User', 'Test-User', 'Test.User'];
      
      for (const invalidName of invalidNames) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${validToken}`])
          .send({ name: invalidName, email: 'test@example.com' })
          .expect(400);
        
        expect(response.body.error).toContain('contain only letters and spaces');
      }
    });
    
    // TC-F-008: Name validation - valid names with spaces
    it('should accept valid names with letters and spaces', async () => {
      const validNames = ['John Doe', 'Mary Jane Smith', 'Al', 'Jean Claude Van Damme'];
      
      for (const validName of validNames) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${validToken}`])
          .send({ name: validName, email: 'updated@example.com' })
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.user.name).toBe(validName);
        
        // Reset for next iteration
        mockDb.reset();
      }
    });
    
    // TC-F-009: Email validation - invalid formats
    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        'missing@domain',
        '@missing-local.com',
        'spaces @domain.com',
        'double@@domain.com',
        'trailing.dot@domain.',
        ''
      ];
      
      for (const invalidEmail of invalidEmails) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${validToken}`])
          .send({ name: 'Test User', email: invalidEmail })
          .expect(400);
        
        expect(response.body.error).toBe('Invalid email format');
      }
    });
    
    // TC-F-009: Email uniqueness validation
    it('should reject email that already exists for another user', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Test User', email: 'another@example.com' }) // ANOTHER_USER's email
        .expect(400);
      
      expect(response.body.error).toBe('Email already exists');
    });
    
    // TC-F-009: Email update to same email should be allowed
    it('should allow email update to the same email (no change)', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Updated Name', email: 'test@example.com' }) // Same email
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });
  });
  
  describe('Profile Picture Upload', () => {
    // TC-F-010: Supported image formats
    it('should accept valid image formats', async () => {
      const imageBuffer = Buffer.from('fake-jpeg-data');
      const formats = ['.jpg', '.jpeg', '.png', '.gif'];
      
      for (const format of formats) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${validToken}`])
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', imageBuffer, `test${format}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.user.profile_picture).toMatch(new RegExp(`uploads/1-\\d+\\${format}$`));
        
        // Reset for next iteration
        mockDb.reset();
      }
    });
    
    // TC-F-010: Rejected file formats
    it('should reject non-image file formats', async () => {
      const fileBuffer = Buffer.from('fake-file-data');
      const invalidFormats = ['.txt', '.pdf', '.doc', '.exe', '.zip'];
      
      for (const format of invalidFormats) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${validToken}`])
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', fileBuffer, `test${format}`)
          .expect(400);
        
        expect(response.body.error).toContain('Only image files');
      }
    });
    
    // TC-F-012: File size limit enforcement
    it('should reject files larger than 5MB', async () => {
      const largeBuffer = Buffer.alloc(5242881); // 1 byte over 5MB limit
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', largeBuffer, 'large.jpg')
        .expect(400);
      
      expect(response.body.error).toBe('File size must be less than 5MB');
    });
    
    // TC-F-012: File size within limit should be accepted
    it('should accept files within 5MB limit', async () => {
      const validBuffer = Buffer.alloc(5242880); // Exactly 5MB
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', validBuffer, 'valid.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg$/);
    });
    
    // TC-F-011: Unique filename generation
    it('should generate unique filenames for uploaded pictures', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response1 = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response2 = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Test User 2')
        .field('email', 'test2@example.com')
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response1.body.user.profile_picture).not.toBe(response2.body.user.profile_picture);
      expect(response1.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg$/);
      expect(response2.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg$/);
    });
    
    // TC-F-011: File cleanup on profile picture replacement
    it('should track old profile picture deletion when uploading new one', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      // First upload
      await mockDb.updateProfile(1, { profile_picture: 'uploads/1-old-picture.jpg' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(mockDb.deletedFiles).toContain('uploads/1-old-picture.jpg');
    });
  });
  
  describe('Successful Profile Updates', () => {
    // TC-F-006: Complete profile update with all fields
    it('should successfully update all profile fields', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', imageBuffer, 'profile.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('Updated Name');
      expect(response.body.user.email).toBe('updated@example.com');
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg$/);
      expect(response.body.message).toBe('Profile updated successfully');
    });
    
    // TC-F-006: Profile update without picture upload
    it('should successfully update name and email without changing profile picture', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'New Name', email: 'new@example.com' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe('New Name');
      expect(response.body.user.email).toBe('new@example.com');
      expect(response.body.user.profile_picture).toBeNull();
    });
    
    // TC-F-014: Success response format
    it('should return proper success response format', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Response Test', email: 'response@example.com' })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('profile_picture');
    });
  });
  
  describe('User Isolation and Security', () => {
    // TC-F-003: User can only edit their own profile
    it('should only allow users to edit their own profile based on JWT token', async () => {
      // User 1 tries to access their profile - should work
      const user1Response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(user1Response.body.user.id).toBe(1);
      
      // User 2 accesses their own profile - should work
      const user2Response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${anotherUserToken}`])
        .expect(200);
      
      expect(user2Response.body.user.id).toBe(2);
    });
    
    // TC-F-003: Session timeout handling
    it('should handle expired JWT tokens', async () => {
      const expiredToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '-1h' });
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(401);
      
      expect(response.body.error).toBe('Authentication required');
    });
    
    // TC-F-003: Malformed JWT token handling
    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'malformed.token',
        'Bearer invalid-token',
        'totally-not-a-jwt',
        ''
      ];
      
      for (const token of malformedTokens) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${token}`])
          .send({ name: 'Test', email: 'test@example.com' })
          .expect(401);
        
        expect(response.body.error).toBe('Authentication required');
      }
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    // TC-F-006: Empty required fields validation
    it('should reject updates with missing required fields', async () => {
      const emptyFieldTests = [
        { name: '', email: 'test@example.com' },
        { name: 'Test User', email: '' },
        { name: '', email: '' }
      ];
      
      for (const testData of emptyFieldTests) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', [`token=${validToken}`])
          .send(testData)
          .expect(400);
        
        expect(response.body).toHaveProperty('error');
      }
    });
    
    // TC-F-006: Boundary value testing for name length
    it('should handle boundary values for name length', async () => {
      // Test exactly 2 characters (minimum valid)
      const twoCharResponse = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: 'Al', email: 'al@example.com' })
        .expect(200);
      
      expect(twoCharResponse.body.success).toBe(true);
      
      // Reset database
      mockDb.reset();
      
      // Test exactly 50 characters (maximum valid)
      const fiftyCharName = 'A'.repeat(49) + 'Z'; // 50 characters
      const fiftyCharResponse = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .send({ name: fiftyCharName, email: 'fifty@example.com' })
        .expect(200);
      
      expect(fiftyCharResponse.body.success).toBe(true);
      expect(fiftyCharResponse.body.user.name).toBe(fiftyCharName);
    });
    
    // TC-F-010: Multiple file upload attempt
    it('should handle multiple file upload attempts gracefully', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      // Multer should only process the first file for single file upload
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', imageBuffer, 'first.jpg')
        .attach('profilePicture', imageBuffer, 'second.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      // Should only process one file
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg$/);
    });
  });
});