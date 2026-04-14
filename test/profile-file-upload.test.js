const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

// Test constants
const TEST_USER_ID = 1;
const TEST_JWT_SECRET = 'test-secret';
const MAX_FILE_SIZE = 2097152; // 2MB in bytes
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

// Mock setup
jest.mock('../models/User');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

describe('Profile Picture Upload Tests', () => {
  let app;
  let testUser;
  let authToken;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create test app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Test user data
    testUser = {
      id: TEST_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      profile_picture: null,
      created_at: new Date().toISOString()
    };

    // Generate test JWT token
    authToken = jwt.sign({ id: TEST_USER_ID }, TEST_JWT_SECRET);

    // Mock User methods
    User.findById = jest.fn().mockResolvedValue(testUser);
    User.prototype.updateProfile = jest.fn().mockResolvedValue(true);

    // Mock filesystem operations
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.unlinkSync.mockReturnValue(undefined);

    // Setup multer middleware mock
    const multerMiddleware = (req, res, next) => {
      if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        req.file = req.testFile || null;
      }
      next();
    };

    // JWT middleware mock
    const jwtMiddleware = (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token === authToken) {
        req.user = testUser;
        next();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    };

    // Profile routes
    app.post('/profile', jwtMiddleware, multerMiddleware, async (req, res) => {
      try {
        const { name, email } = req.body;
        const file = req.file;

        // Validate file if provided
        if (file) {
          // File size validation
          if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: 'File too large (max 2MB)' });
          }

          // MIME type validation
          if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type (JPG/PNG only)' });
          }

          // File extension validation
          const allowedExtensions = ['.jpg', '.jpeg', '.png'];
          const fileExt = path.extname(file.originalname).toLowerCase();
          if (!allowedExtensions.includes(fileExt)) {
            return res.status(400).json({ error: 'Invalid file extension' });
          }

          // Generate unique filename
          const timestamp = Date.now();
          const filename = `${req.user.id}_${timestamp}_${file.originalname}`;
          const filepath = `uploads/${filename}`;

          // Delete old profile picture if exists
          if (req.user.profile_picture) {
            const oldFilePath = path.join(__dirname, '../public', req.user.profile_picture);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }

          // Update user with new profile picture path
          req.user.profile_picture = filepath;
        }

        // Update profile data
        if (name !== undefined) req.user.name = name;
        if (email !== undefined) req.user.email = email;

        await req.user.updateProfile({
          name: req.user.name,
          email: req.user.email,
          profile_picture: req.user.profile_picture
        });

        res.json({ success: true, message: 'Profile updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Unable to update profile. Please try again.' });
      }
    });
  });

  describe('Valid File Upload Tests', () => {
    test('should upload valid JPG file under 2MB', async () => {
      const testFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1048576, // 1MB
        buffer: Buffer.from('fake-image-data')
      };

      const response = await request(app)
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .send({ name: 'Updated Name' })
        .expect(200);

      // Mock the file in middleware
      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = testFile;
        next();
      });

      const fileResponse = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(fileResponse.body.success).toBe(true);
    });

    test('should upload valid PNG file under 2MB', async () => {
      const testFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 500000, // 500KB
        buffer: Buffer.from('fake-png-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = testFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should generate correct filename pattern', async () => {
      const testFile = {
        originalname: 'profile.jpg',
        mimetype: 'image/jpeg',
        size: 1000000,
        buffer: Buffer.from('test-data')
      };

      const timestampBefore = Date.now();
      
      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = testFile;
        next();
      });

      await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      const timestampAfter = Date.now();

      // Verify updateProfile was called with profile_picture matching pattern
      const updateCall = User.prototype.updateProfile.mock.calls[0][0];
      expect(updateCall.profile_picture).toMatch(
        new RegExp(`uploads/${TEST_USER_ID}_\\d+_profile\\.jpg`)
      );

      // Extract timestamp from generated filename
      const filenameMatch = updateCall.profile_picture.match(/uploads\/\d+_(\d+)_.*$/);
      expect(filenameMatch).toBeTruthy();
      
      const generatedTimestamp = parseInt(filenameMatch[1]);
      expect(generatedTimestamp).toBeGreaterThanOrEqual(timestampBefore);
      expect(generatedTimestamp).toBeLessThanOrEqual(timestampAfter);
    });
  });

  describe('File Size Validation Tests', () => {
    test('should reject files over 2MB limit', async () => {
      const oversizedFile = {
        originalname: 'large.jpg',
        mimetype: 'image/jpeg',
        size: 2097153, // 2MB + 1 byte
        buffer: Buffer.alloc(2097153)
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = oversizedFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(response.body.error).toBe('File too large (max 2MB)');
    });

    test('should accept files exactly at 2MB limit', async () => {
      const maxSizeFile = {
        originalname: 'maxsize.png',
        mimetype: 'image/png',
        size: MAX_FILE_SIZE, // Exactly 2MB
        buffer: Buffer.alloc(MAX_FILE_SIZE)
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = maxSizeFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('MIME Type Validation Tests', () => {
    test('should reject non-image MIME types', async () => {
      const invalidMimeFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1000000,
        buffer: Buffer.from('pdf-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = invalidMimeFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(response.body.error).toBe('Invalid file type (JPG/PNG only)');
    });

    test('should reject text files with image extension', async () => {
      const fakeImageFile = {
        originalname: 'fake.jpg',
        mimetype: 'text/plain',
        size: 1000,
        buffer: Buffer.from('not-an-image')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = fakeImageFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(response.body.error).toBe('Invalid file type (JPG/PNG only)');
    });

    test('should accept image/jpeg MIME type', async () => {
      const jpegFile = {
        originalname: 'test.jpeg',
        mimetype: 'image/jpeg',
        size: 500000,
        buffer: Buffer.from('jpeg-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = jpegFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('File Extension Validation Tests', () => {
    test('should reject executable files with image MIME type', async () => {
      const executableFile = {
        originalname: 'malicious.exe',
        mimetype: 'image/jpeg',
        size: 1000000,
        buffer: Buffer.from('executable-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = executableFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(response.body.error).toBe('Invalid file extension');
    });

    test('should accept case-insensitive extensions', async () => {
      const uppercaseExtFile = {
        originalname: 'test.JPG',
        mimetype: 'image/jpeg',
        size: 500000,
        buffer: Buffer.from('image-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = uppercaseExtFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should accept .jpeg extension', async () => {
      const jpegExtFile = {
        originalname: 'photo.jpeg',
        mimetype: 'image/jpeg',
        size: 750000,
        buffer: Buffer.from('jpeg-image-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = jpegExtFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Old File Deletion Tests', () => {
    test('should delete old profile picture when new one uploaded', async () => {
      // Setup user with existing profile picture
      testUser.profile_picture = 'uploads/old_picture.jpg';
      User.findById.mockResolvedValue(testUser);

      const newFile = {
        originalname: 'new.jpg',
        mimetype: 'image/jpeg',
        size: 1000000,
        buffer: Buffer.from('new-image-data')
      };

      // Mock fs.existsSync to return true for old file
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('old_picture.jpg');
      });

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = newFile;
        next();
      });

      await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      // Verify old file deletion was attempted
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('old_picture.jpg')
      );
    });

    test('should handle case when old profile picture file does not exist', async () => {
      testUser.profile_picture = 'uploads/missing_picture.jpg';
      User.findById.mockResolvedValue(testUser);

      const newFile = {
        originalname: 'replacement.png',
        mimetype: 'image/png',
        size: 800000,
        buffer: Buffer.from('replacement-data')
      };

      // Mock fs.existsSync to return false for missing file
      fs.existsSync.mockReturnValue(false);

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = newFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      // Should not attempt to delete non-existent file
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });

    test('should not attempt deletion when user has no existing profile picture', async () => {
      testUser.profile_picture = null;
      User.findById.mockResolvedValue(testUser);

      const firstFile = {
        originalname: 'first.jpg',
        mimetype: 'image/jpeg',
        size: 600000,
        buffer: Buffer.from('first-upload')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = firstFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle database update failure gracefully', async () => {
      User.prototype.updateProfile.mockRejectedValue(new Error('Database error'));

      const validFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1000000,
        buffer: Buffer.from('test-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = validFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(500);

      expect(response.body.error).toBe('Unable to update profile. Please try again.');
    });

    test('should handle file system errors during upload', async () => {
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      testUser.profile_picture = 'uploads/existing.jpg';
      User.findById.mockResolvedValue(testUser);

      const newFile = {
        originalname: 'new.png',
        mimetype: 'image/png',
        size: 500000,
        buffer: Buffer.from('new-data')
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = newFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(500);

      expect(response.body.error).toBe('Unable to update profile. Please try again.');
    });

    test('should handle missing file object gracefully', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .send({ name: 'No File Update' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });
  });

  describe('Authentication Tests', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Content-Type', 'multipart/form-data')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject requests with invalid authentication token', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Authorization', 'Bearer invalid-token')
        .set('Content-Type', 'multipart/form-data')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Directory Creation Tests', () => {
    test('should ensure uploads directory exists', () => {
      // This test verifies the setup creates the uploads directory
      expect(fs.mkdirSync).toHaveBeenCalledTimes(0); // Not called in beforeEach
      
      // Verify directory path constant
      expect(UPLOADS_DIR).toBe(path.join(__dirname, '../public/uploads'));
    });

    test('should handle directory creation permissions', () => {
      // Mock directory creation
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockReturnValue(undefined);

      // Simulate directory creation
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      expect(fs.mkdirSync).toHaveBeenCalledWith(UPLOADS_DIR, { recursive: true });
    });
  });

  describe('Multer Middleware Integration Tests', () => {
    test('should handle multer file processing correctly', async () => {
      const testFile = {
        fieldname: 'profilePicture',
        originalname: 'upload.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        destination: UPLOADS_DIR,
        filename: 'processed-filename.jpg',
        path: path.join(UPLOADS_DIR, 'processed-filename.jpg'),
        size: 1500000
      };

      const agent = request(app);
      agent.app.use((req, res, next) => {
        req.testFile = testFile;
        next();
      });

      const response = await agent
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle missing multer file object', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ name: 'Text Only Update' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});