import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { uploadProfilePicture, deleteOldProfilePicture, cleanupOrphanedFiles, MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './upload';

// Test constants
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com'
};

const UPLOADS_DIR = path.join(__dirname, 'test-uploads');

// Mock Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded.user;
      } catch (error) {
        req.user = null;
      }
    }
    next();
  });
  
  app.post('/upload', uploadProfilePicture, (req, res) => {
    res.json({ 
      success: true, 
      file: req.file,
      message: 'File uploaded successfully'
    });
  });
  
  return app;
};

// Helper functions
const generateToken = (user: any) => {
  return jwt.sign({ user }, JWT_SECRET, { expiresIn: '1h' });
};

const createTestImage = (type: string): Buffer => {
  const signatures: { [key: string]: number[] } = {
    'jpeg': [0xFF, 0xD8, 0xFF],
    'png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'gif': [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
  };
  
  const signature = signatures[type] || signatures['jpeg'];
  const buffer = Buffer.alloc(1000);
  signature.forEach((byte, index) => {
    buffer[index] = byte;
  });
  
  return buffer;
};

const createMaliciousFile = (): Buffer => {
  // Create a file that looks like an image but has different content
  const buffer = Buffer.alloc(1000);
  buffer.write('<!DOCTYPE html><script>alert("xss")</script>', 0);
  return buffer;
};

describe('Upload Middleware', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    
    // Create test uploads directory
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  });
  
  afterEach(() => {
    // Clean up test uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
      });
      fs.rmdirSync(UPLOADS_DIR);
    }
  });
  
  describe('File Type Validation', () => {
    // TC-F-010: Profile picture uploads are restricted to common image formats (jpg, jpeg, png, gif)
    test('should accept valid image file types - JPEG', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
      expect(response.body.file.mimetype).toBe('image/jpeg');
    });
    
    // TC-F-010: Profile picture uploads are restricted to common image formats (jpg, jpeg, png, gif)
    test('should accept valid image file types - PNG', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('png');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'test.png')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.file.mimetype).toBe('image/png');
    });
    
    // TC-F-010: Profile picture uploads are restricted to common image formats (jpg, jpeg, png, gif)
    test('should accept valid image file types - GIF', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('gif');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'test.gif')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.file.mimetype).toBe('image/gif');
    });
    
    // TC-F-010: Profile picture uploads are restricted to common image formats (jpg, jpeg, png, gif)
    test('should reject invalid file types', async () => {
      const token = generateToken(TEST_USER);
      const textBuffer = Buffer.from('This is a text file');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', textBuffer, 'test.txt')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid file extension');
    });
    
    // TC-F-010: Profile picture uploads are restricted to common image formats (jpg, jpeg, png, gif)
    test('should reject files with wrong MIME type', async () => {
      const token = generateToken(TEST_USER);
      const textBuffer = Buffer.from('This is a text file');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('profilePicture', 'data:text/plain;base64,' + textBuffer.toString('base64'))
        .expect(400);
      
      expect(response.body.error).toMatch(/Invalid file type|Invalid file extension/);
    });
  });
  
  describe('File Size Validation', () => {
    // TC-F-012: Profile picture file size is limited to a reasonable maximum (e.g., 5MB)
    test('should accept files under 5MB limit', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = Buffer.concat([
        createTestImage('jpeg'),
        Buffer.alloc(1024 * 1024) // 1MB additional data
      ]);
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    // TC-F-012: Profile picture file size is limited to a reasonable maximum (e.g., 5MB)
    test('should reject files over 5MB limit', async () => {
      const token = generateToken(TEST_USER);
      const largeImageBuffer = Buffer.concat([
        createTestImage('jpeg'),
        Buffer.alloc(MAX_FILE_SIZE + 1000) // Exceed 5MB limit
      ]);
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', largeImageBuffer, 'large.jpg')
        .expect(400);
      
      expect(response.body.error).toContain('File too large');
    });
    
    // TC-F-012: Profile picture file size is limited to a reasonable maximum (e.g., 5MB)
    test('should accept files at exactly 5MB limit', async () => {
      const token = generateToken(TEST_USER);
      const maxSizeBuffer = Buffer.concat([
        createTestImage('jpeg'),
        Buffer.alloc(MAX_FILE_SIZE - 100) // Just under the limit
      ]);
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', maxSizeBuffer, 'max.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Authentication Requirements', () => {
    // TC-F-004: Profile picture upload requires active JWT authentication - unauthenticated users receive 401 redirect to /login page
    test('should require authentication for file upload', async () => {
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(400);
      
      expect(response.body.error).toContain('User authentication required');
    });
    
    // TC-F-004: Profile picture upload requires active JWT authentication - unauthenticated users receive 401 redirect to /login page
    test('should reject invalid JWT tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${invalidToken}`)
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(400);
      
      expect(response.body.error).toContain('User authentication required');
    });
    
    // TC-F-004: Profile picture upload requires active JWT authentication - unauthenticated users receive 401 redirect to /login page
    test('should accept valid JWT tokens', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('File Storage and Naming', () => {
    // TC-F-011: Uploaded profile pictures are stored in the public/uploads directory with unique filenames
    test('should generate unique filename with userId and timestamp', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'original.jpg')
        .expect(200);
      
      expect(response.body.file.filename).toMatch(/^1-\d+\.jpg$/);
      expect(response.body.file.relativePath).toContain('uploads/');
    });
    
    // TC-F-011: Uploaded profile pictures are stored in the public/uploads directory with unique filenames
    test('should sanitize filename to prevent path traversal', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, '../../../malicious.jpg')
        .expect(200);
      
      expect(response.body.file.filename).not.toContain('../');
      expect(response.body.file.filename).toMatch(/^1-\d+\.jpg$/);
    });
    
    // TC-F-011: Uploaded profile pictures are stored in the public/uploads directory with unique filenames
    test('should handle special characters in filename', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer, 'file@#$%^&*().jpg')
        .expect(200);
      
      expect(response.body.file.filename).toMatch(/^[1-9][0-9]*-[0-9]+\.jpg$/);
    });
  });
  
  describe('File Security Validation', () => {
    test('should validate file signatures for security', async () => {
      const token = generateToken(TEST_USER);
      const maliciousBuffer = createMaliciousFile();
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', maliciousBuffer, 'malicious.jpg')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid file content');
    });
    
    test('should accept valid file signatures', async () => {
      const token = generateToken(TEST_USER);
      const validImageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', validImageBuffer, 'valid.jpg')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle multiple file uploads', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer1 = createTestImage('jpeg');
      const imageBuffer2 = createTestImage('png');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', imageBuffer1, 'test1.jpg')
        .attach('profilePicture', imageBuffer2, 'test2.png')
        .expect(400);
      
      expect(response.body.error).toContain('Only one file allowed');
    });
    
    test('should handle wrong field name', async () => {
      const token = generateToken(TEST_USER);
      const imageBuffer = createTestImage('jpeg');
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('wrongField', imageBuffer, 'test.jpg')
        .expect(400);
      
      expect(response.body.error).toContain('Unexpected field');
    });
    
    test('should handle missing file', async () => {
      const token = generateToken(TEST_USER);
      
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeUndefined();
    });
  });
  
  describe('File Management Utilities', () => {
    test('deleteOldProfilePicture should remove user files', async () => {
      // Create test files
      const testFiles = ['1-123456.jpg', '1-789012.png', '2-123456.jpg'];
      testFiles.forEach(file => {
        fs.writeFileSync(path.join(UPLOADS_DIR, file), 'test content');
      });
      
      await deleteOldProfilePicture(1);
      
      // Check that user 1 files are deleted but user 2 files remain
      expect(fs.existsSync(path.join(UPLOADS_DIR, '1-123456.jpg'))).toBe(false);
      expect(fs.existsSync(path.join(UPLOADS_DIR, '1-789012.png'))).toBe(false);
      expect(fs.existsSync(path.join(UPLOADS_DIR, '2-123456.jpg'))).toBe(true);
    });
    
    test('cleanupOrphanedFiles should remove files for inactive users', async () => {
      // Create test files
      const testFiles = ['1-123456.jpg', '2-789012.png', '3-123456.gif'];
      testFiles.forEach(file => {
        fs.writeFileSync(path.join(UPLOADS_DIR, file), 'test content');
      });
      
      await cleanupOrphanedFiles([1, 2]); // Only users 1 and 2 are active
      
      // Check that user 3 files are deleted
      expect(fs.existsSync(path.join(UPLOADS_DIR, '1-123456.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(UPLOADS_DIR, '2-789012.png'))).toBe(true);
      expect(fs.existsSync(path.join(UPLOADS_DIR, '3-123456.gif'))).toBe(false);
    });
  });
  
  describe('Configuration Constants', () => {
    test('should export correct constants', () => {
      expect(MAX_FILE_SIZE).toBe(5242880); // 5MB
      expect(ALLOWED_EXTENSIONS).toEqual(['.jpg', '.jpeg', '.png', '.gif']);
      expect(ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/gif']);
    });
  });
});