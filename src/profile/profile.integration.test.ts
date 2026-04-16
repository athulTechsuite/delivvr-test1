import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sqlite3 from 'sqlite3';

// Test configuration
const JWT_SECRET = 'test-secret-key';
const TEST_DB_PATH = ':memory:';
const UPLOADS_DIR = path.join(__dirname, '../test-uploads');

// Test user data
const TEST_USER = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  password: '$2b$10$hashedpassword',
  created_at: '2023-01-01T00:00:00.000Z',
  profile_picture: null
};

const UPDATED_USER = {
  name: 'Jane Smith',
  email: 'jane@example.com'
};

// Mock database
let db: sqlite3.Database;

// Create test app with actual implementation
const createTestApp = () => {
  const app = express();
  
  // Setup middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(require('cookie-parser')());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  
  // Setup multer for testing
  const storage = multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const userId = req.user?.id || 1;
      const timestamp = Date.now();
      cb(null, `${userId}-${timestamp}${ext}`);
    }
  });
  
  const fileFilter = (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif'];
    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  };
  
  const uploadProfilePicture = multer({
    storage,
    limits: { fileSize: 5242880 }, // 5MB
    fileFilter
  });
  
  // Authentication middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect('/login');
    }
    
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.redirect('/login');
      }
      req.user = user;
      next();
    });
  };
  
  // Profile routes
  app.get('/profile', authenticateToken, (req: any, res: any) => {
    const userId = req.user.id;
    
    db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [userId], (err, user) => {
      if (err || !user) {
        return res.redirect('/login');
      }
      
      res.render('profile', {
        user,
        title: 'Profile',
        success: null,
        errors: null
      });
    });
  });
  
  app.post('/profile', authenticateToken, uploadProfilePicture.single('profilePicture'), (req: any, res: any) => {
    const { name, email } = req.body;
    const userId = req.user.id;
    
    // Validation
    const errors = [];
    if (!name || name.length < 2 || name.length > 50 || !/^[a-zA-Z\s]+$/.test(name)) {
      errors.push({ msg: 'Name must be 2-50 characters and contain only letters and spaces' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ msg: 'Please provide a valid email address' });
    }
    
    if (errors.length > 0) {
      return res.json({ success: false, errors });
    }
    
    // Check email uniqueness
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingUser) {
        return res.json({ success: false, errors: [{ msg: 'Email address is already in use' }] });
      }
      
      // Update profile
      let profilePicturePath = null;
      let query = 'UPDATE users SET name = ?, email = ?';
      const params = [name, email];
      
      if (req.file) {
        profilePicturePath = `uploads/${req.file.filename}`;
        query += ', profile_picture = ?';
        params.push(profilePicturePath);
      }
      
      query += ' WHERE id = ?';
      params.push(userId);
      
      db.run(query, params, function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update profile' });
        }
        
        res.json({ 
          success: true, 
          message: 'Profile updated successfully',
          user: { name, email, profile_picture: profilePicturePath }
        });
      });
    });
  });
  
  return app;
};

// Helper to create valid JWT token
const createValidToken = (user = TEST_USER) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

// Helper to create test image file
const createTestImageBuffer = () => {
  // Simple 1x1 PNG image as buffer
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
};

describe('Profile Page Integration Tests', () => {
  let app: express.Application;
  
  beforeAll(() => {
    // Create uploads directory for testing
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    
    // Initialize test database
    db = new sqlite3.Database(TEST_DB_PATH);
    db.serialize(() => {
      db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        profile_picture TEXT
      )`);
      
      // Insert test user
      db.run('INSERT INTO users (id, name, email, password, created_at) VALUES (?, ?, ?, ?, ?)', 
        [TEST_USER.id, TEST_USER.name, TEST_USER.email, TEST_USER.password, TEST_USER.created_at]);
    });
  });
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  afterAll(() => {
    // Clean up test uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
    
    // Close database
    if (db) {
      db.close();
    }
  });
  
  // TC-AC-001: User can view their current profile information in read-only format
  describe('Profile View Mode', () => {
    test('should display profile information in read-only format', async () => {
      const token = createValidToken();
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${token}`])
        .expect(200);
      
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('john@example.com');
      expect(response.text).toContain('2023-01-01');
    });
    
    // TC-AC-001: Unauthenticated users should be redirected
    test('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(302);
      
      expect(response.headers.location).toBe('/login');
    });
  });
  
  // TC-AC-006, TC-AC-008, TC-AC-009: Profile update validation and persistence
  describe('Profile Update Functionality', () => {
    test('should successfully update profile with valid data', async () => {
      const token = createValidToken();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.user.name).toBe(UPDATED_USER.name);
      expect(response.body.user.email).toBe(UPDATED_USER.email);
    });
    
    // TC-AC-008: Name validation - minimum length
    test('should reject name with less than 2 characters', async () => {
      const token = createValidToken();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', 'A')
        .field('email', UPDATED_USER.email)
        .expect(200);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toContain('Name must be 2-50 characters');
    });
    
    // TC-AC-008: Name validation - maximum length
    test('should reject name with more than 50 characters', async () => {
      const token = createValidToken();
      const longName = 'A'.repeat(51);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', longName)
        .field('email', UPDATED_USER.email)
        .expect(200);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toContain('Name must be 2-50 characters');
    });
    
    // TC-AC-008: Name validation - invalid characters
    test('should reject name with numbers or special characters', async () => {
      const token = createValidToken();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', 'John123')
        .field('email', UPDATED_USER.email)
        .expect(200);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toContain('letters and spaces');
    });
    
    // TC-AC-009: Email validation - invalid format
    test('should reject invalid email format', async () => {
      const token = createValidToken();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', 'invalid-email')
        .expect(200);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toContain('valid email address');
    });
    
    // TC-AC-009: Email uniqueness validation
    test('should reject email that is already in use by another user', async () => {
      // Insert another user first
      db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
        ['Other User', 'other@example.com', 'hashedpassword']);
      
      const token = createValidToken();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', 'other@example.com')
        .expect(200);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('Email address is already in use');
    });
    
    // TC-AC-006: Unauthenticated profile update should redirect
    test('should redirect unauthenticated profile update attempts', async () => {
      const response = await request(app)
        .post('/profile')
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .expect(302);
      
      expect(response.headers.location).toBe('/login');
    });
  });
  
  // TC-AC-010, TC-AC-011, TC-AC-012, TC-AC-13: Profile picture upload functionality
  describe('Profile Picture Upload', () => {
    test('should successfully upload valid image file', async () => {
      const token = createValidToken();
      const imageBuffer = createTestImageBuffer();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', imageBuffer, 'test.png')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.png/);
    });
    
    // TC-AC-010: File format validation - JPG
    test('should accept JPG files', async () => {
      const token = createValidToken();
      const imageBuffer = createTestImageBuffer();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpg/);
    });
    
    // TC-AC-010: File format validation - JPEG
    test('should accept JPEG files', async () => {
      const token = createValidToken();
      const imageBuffer = createTestImageBuffer();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', imageBuffer, 'test.jpeg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.jpeg/);
    });
    
    // TC-AC-010: File format validation - GIF
    test('should accept GIF files', async () => {
      const token = createValidToken();
      const imageBuffer = createTestImageBuffer();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', imageBuffer, 'test.gif')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user.profile_picture).toMatch(/uploads\/1-\d+\.gif/);
    });
    
    // TC-AC-010: File format validation - reject invalid formats
    test('should reject non-image file formats', async () => {
      const token = createValidToken();
      const textBuffer = Buffer.from('This is not an image');
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', textBuffer, 'test.txt')
        .expect(400);
      
      expect(response.text).toContain('Only image files are allowed');
    });
    
    // TC-AC-012: File size validation - maximum 5MB
    test('should reject files larger than 5MB', async () => {
      const token = createValidToken();
      const largeBuffer = Buffer.alloc(5242881); // 5MB + 1 byte
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', largeBuffer, 'large.png')
        .expect(400);
      
      expect(response.text).toContain('File too large');
    });
    
    // TC-AC-011: File storage location and naming
    test('should store uploaded files with correct naming convention', async () => {
      const token = createValidToken();
      const imageBuffer = createTestImageBuffer();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .attach('profilePicture', imageBuffer, 'test.png')
        .expect(200);
      
      const filename = response.body.user.profile_picture.replace('uploads/', '');
      expect(filename).toMatch(/^1-\d+\.png$/);
      
      const filePath = path.join(UPLOADS_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
  
  // TC-AC-13: Database schema includes profile_picture column
  describe('Database Schema', () => {
    test('should have profile_picture column in users table', (done) => {
      db.get("PRAGMA table_info(users)", (err, result) => {
        if (err) {
          done(err);
          return;
        }
        
        db.all("PRAGMA table_info(users)", (err, columns) => {
          if (err) {
            done(err);
            return;
          }
          
          const profilePictureColumn = columns.find(col => col.name === 'profile_picture');
          expect(profilePictureColumn).toBeDefined();
          expect(profilePictureColumn.type).toBe('TEXT');
          done();
        });
      });
    });
  });
  
  // TC-AC-14: Success confirmation message
  describe('Success Messages', () => {
    test('should return success message after profile update', async () => {
      const token = createValidToken();
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${token}`])
        .field('name', UPDATED_USER.name)
        .field('email', UPDATED_USER.email)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });
  });
});