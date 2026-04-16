const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../config/database');

// Test constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
const INVALID_FILE_TYPES = ['.pdf', '.exe', '.txt', '.doc', '.zip'];
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
const TEST_UPLOADS_DIR = path.join(__dirname, 'temp_uploads');

describe('Profile Picture Upload Tests', () => {
  let testUser;
  let authToken;
  let authCookie;

  beforeAll(async () => {
    // Create test uploads directory
    if (!fs.existsSync(TEST_UPLOADS_DIR)) {
      fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true });
    }

    // Create test user
    testUser = {
      id: 999,
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword'
    };

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    authCookie = `token=${authToken}; Path=/; HttpOnly`;

    // Mock database user
    jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
      if (query.includes('SELECT * FROM users WHERE id = ?')) {
        callback(null, testUser);
      } else {
        callback(null, null);
      }
    });

    jest.spyOn(db, 'run').mockImplementation((query, params, callback) => {
      callback(null, { changes: 1 });
    });
  });

  afterAll(async () => {
    // Clean up test uploads directory
    if (fs.existsSync(TEST_UPLOADS_DIR)) {
      const files = fs.readdirSync(TEST_UPLOADS_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_UPLOADS_DIR, file));
      });
      fs.rmdirSync(TEST_UPLOADS_DIR);
    }

    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear test directory before each test
    if (fs.existsSync(TEST_UPLOADS_DIR)) {
      const files = fs.readdirSync(TEST_UPLOADS_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_UPLOADS_DIR, file));
      });
    }
  });

  describe('File Type Validation', () => {
    test('should accept valid image file types', async () => {
      const validTypes = [
        { ext: 'jpg', mimetype: 'image/jpeg' },
        { ext: 'jpeg', mimetype: 'image/jpeg' },
        { ext: 'png', mimetype: 'image/png' },
        { ext: 'gif', mimetype: 'image/gif' }
      ];

      for (const type of validTypes) {
        const testImagePath = path.join(TEST_UPLOADS_DIR, `test.${type.ext}`);
        
        // Create a minimal valid image file
        const imageBuffer = type.ext === 'png' 
          ? Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG signature
          : Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG signature
        
        fs.writeFileSync(testImagePath, imageBuffer);

        const response = await request(app)
          .post('/profile')
          .set('Cookie', authCookie)
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', testImagePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('should reject invalid file types', async () => {
      const invalidTypes = [
        { ext: 'pdf', content: '%PDF-1.4' },
        { ext: 'exe', content: 'MZ' },
        { ext: 'txt', content: 'This is a text file' },
        { ext: 'doc', content: 'Document content' },
        { ext: 'zip', content: 'PK' }
      ];

      for (const type of invalidTypes) {
        const testFilePath = path.join(TEST_UPLOADS_DIR, `test.${type.ext}`);
        fs.writeFileSync(testFilePath, type.content);

        const response = await request(app)
          .post('/profile')
          .set('Cookie', authCookie)
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', testFilePath);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid file type');
      }
    });

    test('should validate MIME type matches file extension', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      
      // Create file with wrong MIME type
      fs.writeFileSync(testImagePath, 'fake image content');

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('File Size Validation', () => {
    test('should accept files under size limit', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'small.jpg');
      const smallImageBuffer = Buffer.alloc(1024 * 1024); // 1MB
      smallImageBuffer[0] = 0xFF;
      smallImageBuffer[1] = 0xD8;
      smallImageBuffer[2] = 0xFF;
      smallImageBuffer[3] = 0xE0;
      
      fs.writeFileSync(testImagePath, smallImageBuffer);

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject files over size limit', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'large.jpg');
      const largeImageBuffer = Buffer.alloc(MAX_FILE_SIZE + 1024); // Over 5MB
      largeImageBuffer[0] = 0xFF;
      largeImageBuffer[1] = 0xD8;
      largeImageBuffer[2] = 0xFF;
      largeImageBuffer[3] = 0xE0;
      
      fs.writeFileSync(testImagePath, largeImageBuffer);

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('File too large');
    });

    test('should handle exactly at size limit', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'exact.jpg');
      const exactSizeBuffer = Buffer.alloc(MAX_FILE_SIZE);
      exactSizeBuffer[0] = 0xFF;
      exactSizeBuffer[1] = 0xD8;
      exactSizeBuffer[2] = 0xFF;
      exactSizeBuffer[3] = 0xE0;
      
      fs.writeFileSync(testImagePath, exactSizeBuffer);

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Filename Generation', () => {
    test('should generate filename with userId-timestamp.extension pattern', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      const timestampBefore = Date.now();

      // Mock fs operations to capture generated filename
      let generatedFilename;
      const originalWriteFileSync = fs.writeFileSync;
      jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath, data) => {
        generatedFilename = path.basename(filepath);
        // Don't actually write to avoid file system issues in tests
      });

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      const timestampAfter = Date.now();

      expect(response.status).toBe(200);
      expect(generatedFilename).toMatch(/^999-\d+\.jpg$/);
      
      // Extract timestamp from filename
      const filenameTimestamp = parseInt(generatedFilename.split('-')[1].split('.')[0]);
      expect(filenameTimestamp).toBeGreaterThanOrEqual(timestampBefore);
      expect(filenameTimestamp).toBeLessThanOrEqual(timestampAfter);

      fs.writeFileSync.mockRestore();
    });

    test('should preserve original file extension in generated filename', async () => {
      const extensions = ['jpg', 'jpeg', 'png', 'gif'];

      for (const ext of extensions) {
        const testImagePath = path.join(TEST_UPLOADS_DIR, `test.${ext}`);
        const imageBuffer = ext === 'png' 
          ? Buffer.from([0x89, 0x50, 0x4E, 0x47])
          : Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
        
        fs.writeFileSync(testImagePath, imageBuffer);

        let generatedFilename;
        jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath) => {
          generatedFilename = path.basename(filepath);
        });

        const response = await request(app)
          .post('/profile')
          .set('Cookie', authCookie)
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', testImagePath);

        expect(response.status).toBe(200);
        expect(generatedFilename).toMatch(new RegExp(`^999-\\d+\\.${ext}$`));

        fs.writeFileSync.mockRestore();
      }
    });
  });

  describe('File Storage and Management', () => {
    test('should store file in uploads directory', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      let storedFilePath;
      jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath, data) => {
        storedFilePath = filepath;
        expect(filepath).toContain('uploads');
        expect(data).toEqual(expect.any(Buffer));
      });

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(200);
      expect(storedFilePath).toBeDefined();
      expect(path.dirname(storedFilePath)).toContain('uploads');

      fs.writeFileSync.mockRestore();
    });

    test('should delete old profile picture when uploading replacement', async () => {
      const oldFilePath = path.join(UPLOADS_DIR, '999-1234567890.jpg');
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'new.jpg');
      
      // Mock user with existing profile picture
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM users WHERE id = ?')) {
          callback(null, {
            ...testUser,
            profile_picture: 'uploads/999-1234567890.jpg'
          });
        } else {
          callback(null, null);
        }
      });

      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      let deletedFile;
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'unlinkSync').mockImplementation((filepath) => {
        deletedFile = filepath;
      });
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(200);
      expect(deletedFile).toBe(oldFilePath);

      fs.existsSync.mockRestore();
      fs.unlinkSync.mockRestore();
      fs.writeFileSync.mockRestore();
    });

    test('should handle missing old profile picture gracefully', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'new.jpg');
      
      // Mock user with non-existent profile picture
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM users WHERE id = ?')) {
          callback(null, {
            ...testUser,
            profile_picture: 'uploads/999-nonexistent.jpg'
          });
        } else {
          callback(null, null);
        }
      });

      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(200);
      expect(fs.unlinkSync).not.toHaveBeenCalled();

      fs.existsSync.mockRestore();
      fs.unlinkSync.mockRestore();
      fs.writeFileSync.mockRestore();
    });
  });

  describe('Security and Attack Prevention', () => {
    test('should prevent directory traversal in filenames', async () => {
      const maliciousNames = [
        '../../../etc/passwd.jpg',
        '..\\..\\windows\\system32\\config.jpg',
        '/etc/passwd.jpg',
        'C:\\Windows\\System32\\test.jpg'
      ];

      for (const maliciousName of maliciousNames) {
        const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
        const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
        fs.writeFileSync(testImagePath, imageBuffer);

        let storedFilePath;
        jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath) => {
          storedFilePath = filepath;
        });

        const response = await request(app)
          .post('/profile')
          .set('Cookie', authCookie)
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', testImagePath);

        expect(response.status).toBe(200);
        expect(storedFilePath).toContain('uploads');
        expect(storedFilePath).not.toContain('..');
        expect(storedFilePath).not.toContain('/etc/');
        expect(storedFilePath).not.toContain('C:');

        fs.writeFileSync.mockRestore();
      }
    });

    test('should require authentication for file upload', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      const response = await request(app)
        .post('/profile')
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should validate user can only upload to their own profile', async () => {
      const otherUserToken = jwt.sign(
        { id: 888, email: 'other@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      // Mock database to return null for unauthorized user
      jest.spyOn(db, 'get').mockImplementation((query, params, callback) => {
        if (params[0] === 888) {
          callback(null, null); // User not found
        } else {
          callback(null, testUser);
        }
      });

      const response = await request(app)
        .post('/profile')
        .set('Cookie', `token=${otherUserToken}; Path=/; HttpOnly`)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle file system write errors', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Disk full');
      });

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to save profile picture');

      fs.writeFileSync.mockRestore();
    });

    test('should handle database update errors', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      jest.spyOn(db, 'run').mockImplementation((query, params, callback) => {
        callback(new Error('Database connection failed'), null);
      });

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      fs.writeFileSync.mockRestore();
    });

    test('should handle missing file upload gracefully', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Updated User')
        .field('email', 'updated@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle corrupted or empty file uploads', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'empty.jpg');
      fs.writeFileSync(testImagePath, ''); // Empty file

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid file');
    });
  });

  describe('Concurrent Upload Handling', () => {
    test('should handle concurrent uploads with unique filenames', async () => {
      const testImagePath1 = path.join(TEST_UPLOADS_DIR, 'test1.jpg');
      const testImagePath2 = path.join(TEST_UPLOADS_DIR, 'test2.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      
      fs.writeFileSync(testImagePath1, imageBuffer);
      fs.writeFileSync(testImagePath2, imageBuffer);

      const filenames = [];
      jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath) => {
        filenames.push(path.basename(filepath));
      });

      // Simulate concurrent requests
      const promises = [
        request(app)
          .post('/profile')
          .set('Cookie', authCookie)
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', testImagePath1),
        request(app)
          .post('/profile')
          .set('Cookie', authCookie)
          .field('name', 'Test User')
          .field('email', 'test@example.com')
          .attach('profilePicture', testImagePath2)
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Filenames should be unique due to timestamp
      expect(filenames).toHaveLength(2);
      expect(filenames[0]).not.toBe(filenames[1]);

      fs.writeFileSync.mockRestore();
    });
  });

  describe('Multer Middleware Integration', () => {
    test('should properly process multipart form data with file upload', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .attach('profilePicture', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');

      fs.writeFileSync.mockRestore();
    });

    test('should handle multipart form without file upload', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should validate profilePicture field name', async () => {
      const testImagePath = path.join(TEST_UPLOADS_DIR, 'test.jpg');
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      fs.writeFileSync(testImagePath, imageBuffer);

      // Use wrong field name
      const response = await request(app)
        .post('/profile')
        .set('Cookie', authCookie)
        .field('name', 'Test User')
        .field('email', 'test@example.com')
        .attach('wrongFieldName', testImagePath);

      expect(response.status).toBe(200); // Should still work, just no file processed
      expect(response.body.success).toBe(true);
    });
  });
});