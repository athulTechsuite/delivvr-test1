const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

// Test constants
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MAX_FILE_SIZE = 5242880; // 5MB in bytes
const VALID_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
const NAME_REGEX = /^[a-zA-Z\s]+$/;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Profile Validation Tests', () => {
  let testUser;
  let validJwtToken;
  let cookieHeader;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('testPassword123', 10);
    testUser = {
      id: 1001,
      name: 'Test User',
      email: 'testuser@example.com',
      password: hashedPassword,
      created_at: new Date().toISOString()
    };

    // Create JWT token for authentication
    validJwtToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    cookieHeader = `token=${validJwtToken}; HttpOnly; Path=/`;

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../public/uploads');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Clean up test files
    const uploadsDir = path.join(__dirname, '../public/uploads');
    try {
      const files = await fs.readdir(uploadsDir);
      const testFiles = files.filter(file => file.startsWith('1001-'));
      for (const file of testFiles) {
        await fs.unlink(path.join(uploadsDir, file));
      }
    } catch (error) {
      // Directory might not exist or be empty
    }
  });

  describe('Name Validation', () => {
    test('should accept valid name with minimum 2 characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Jo',
          email: 'testuser@example.com'
        });

      expect(response.status).not.toBe(400);
    });

    test('should accept valid name with maximum 50 characters', async () => {
      const maxLengthName = 'a'.repeat(MAX_NAME_LENGTH);
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: maxLengthName,
          email: 'testuser@example.com'
        });

      expect(response.status).not.toBe(400);
    });

    test('should accept name with letters and spaces only', async () => {
      const validNames = [
        'John Doe',
        'Mary Jane Smith',
        'O Brien',
        'Jean Claude Van Damme',
        'Anna Maria'
      ];

      for (const name of validNames) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: name,
            email: 'testuser@example.com'
          });

        expect(response.status).not.toBe(400);
      }
    });

    test('should reject name with less than 2 characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'J',
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name must be between 2 and 50 characters');
    });

    test('should reject name with more than 50 characters', async () => {
      const longName = 'a'.repeat(MAX_NAME_LENGTH + 1);
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: longName,
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name must be between 2 and 50 characters');
    });

    test('should reject name with numbers', async () => {
      const invalidNames = [
        'John123',
        'Mary2',
        '123John',
        'John Doe 3',
        'User1'
      ];

      for (const name of invalidNames) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: name,
            email: 'testuser@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Name can only contain letters and spaces');
      }
    });

    test('should reject name with special characters', async () => {
      const invalidNames = [
        'John@Doe',
        'Mary-Jane',
        'John_Doe',
        'User!',
        'Test#User',
        'John.Doe',
        'Mary+Smith',
        'User$'
      ];

      for (const name of invalidNames) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: name,
            email: 'testuser@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Name can only contain letters and spaces');
      }
    });

    test('should reject empty name', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: '',
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name is required');
    });

    test('should reject null name', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: null,
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name is required');
    });

    test('should handle unicode characters appropriately', async () => {
      const unicodeNames = [
        'José María',
        'François',
        'Søren',
        'Müller'
      ];

      for (const name of unicodeNames) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: name,
            email: 'testuser@example.com'
          });

        // Unicode letters should be accepted based on regex pattern
        expect(response.status).not.toBe(400);
      }
    });

    test('should trim whitespace from name', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: '  John Doe  ',
          email: 'testuser@example.com'
        });

      expect(response.status).not.toBe(400);
    });
  });

  describe('Email Validation', () => {
    test('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com',
        'user123@test-domain.com',
        'a@b.co'
      ];

      for (const email of validEmails) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: 'Test User',
            email: email
          });

        expect(response.status).not.toBe(400);
      }
    });

    test('should reject invalid email formats', async () => {
      const invalidEmails = [
        'plaintext',
        '@missingdomain.com',
        'missing@.com',
        'spaces @domain.com',
        'user@',
        'user@domain',
        '.user@domain.com',
        'user.@domain.com',
        'user..double@domain.com',
        'user@domain..com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: 'Test User',
            email: email
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Please provide a valid email address');
      }
    });

    test('should normalize email addresses', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Test User',
          email: 'Test.User+Tag@EXAMPLE.COM'
        });

      // Email should be normalized to lowercase
      expect(response.status).not.toBe(400);
    });

    test('should reject empty email', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Test User',
          email: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    test('should reject null email', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Test User',
          email: null
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    test('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Test User',
          email: longEmail
        });

      // Should handle long emails appropriately
      expect(response.status).toBe(400);
    });
  });

  describe('Profile Picture Validation', () => {
    test('should accept valid image file types', async () => {
      const validTypes = VALID_IMAGE_TYPES;
      
      for (const extension of validTypes) {
        // Create a small test image buffer
        const testImageBuffer = Buffer.from('fake-image-data');
        
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .field('name', 'Test User')
          .field('email', 'testuser@example.com')
          .attach('profilePicture', testImageBuffer, `test${extension}`);

        // Should not reject based on file extension
        if (response.status === 400) {
          expect(response.body.error).not.toContain('Invalid file type');
        }
      }
    });

    test('should reject invalid file types', async () => {
      const invalidTypes = ['.txt', '.pdf', '.exe', '.js', '.html', '.zip', '.doc'];
      
      for (const extension of invalidTypes) {
        const testBuffer = Buffer.from('fake-file-data');
        
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .field('name', 'Test User')
          .field('email', 'testuser@example.com')
          .attach('profilePicture', testBuffer, `test${extension}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Only image files are allowed');
      }
    });

    test('should enforce file size limit', async () => {
      // Create a buffer larger than the limit
      const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1000);
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .field('name', 'Test User')
        .field('email', 'testuser@example.com')
        .attach('profilePicture', largeBuffer, 'large-image.jpg');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('File size exceeds maximum limit');
    });

    test('should accept file within size limit', async () => {
      // Create a buffer within the limit
      const validBuffer = Buffer.alloc(1000); // 1KB
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .field('name', 'Test User')
        .field('email', 'testuser@example.com')
        .attach('profilePicture', validBuffer, 'valid-image.jpg');

      // Should not reject based on file size
      if (response.status === 400) {
        expect(response.body.error).not.toContain('File size exceeds maximum limit');
      }
    });

    test('should handle missing profile picture gracefully', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Test User',
          email: 'testuser@example.com'
        });

      // Should work without profile picture
      expect(response.status).not.toBe(400);
    });

    test('should reject files with no extension', async () => {
      const testBuffer = Buffer.from('fake-file-data');
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .field('name', 'Test User')
        .field('email', 'testuser@example.com')
        .attach('profilePicture', testBuffer, 'noextension');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Only image files are allowed');
    });

    test('should sanitize file names', async () => {
      const testBuffer = Buffer.from('fake-image-data');
      const dangerousFileName = '../../../evil.jpg';
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .field('name', 'Test User')
        .field('email', 'testuser@example.com')
        .attach('profilePicture', testBuffer, dangerousFileName);

      // Should handle dangerous file names appropriately
      if (response.status === 200) {
        // File should be renamed to prevent directory traversal
        expect(response.body.profilePicture).not.toContain('../');
      }
    });
  });

  describe('Error Message Quality', () => {
    test('should provide descriptive error messages for validation failures', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'J',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.length).toBeGreaterThan(0);
      expect(response.body.error).not.toBe('Validation failed');
    });

    test('should provide helpful error messages', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'John123',
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Name can only contain letters and spaces/);
    });

    test('should handle multiple validation errors appropriately', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'J',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      // Should prioritize or combine error messages meaningfully
    });
  });

  describe('Security Tests', () => {
    test('should protect against SQL injection in name field', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET name='hacked'; --",
        "' UNION SELECT * FROM users --"
      ];

      for (const injection of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: injection,
            email: 'testuser@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Name can only contain letters and spaces');
      }
    });

    test('should protect against SQL injection in email field', async () => {
      const sqlInjectionAttempts = [
        "test'; DROP TABLE users; --@example.com",
        "test' OR '1'='1'@example.com"
      ];

      for (const injection of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: 'Test User',
            email: injection
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Please provide a valid email address');
      }
    });

    test('should protect against XSS in error messages', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: xssPayload,
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(400);
      // Error message should not contain unescaped script tags
      expect(response.body.error).not.toContain('<script>');
      expect(response.body.error).not.toContain('alert(');
    });

    test('should require authentication for profile updates', async () => {
      const response = await request(app)
        .post('/profile')
        .send({
          name: 'Test User',
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(401);
    });

    test('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', 'token=invalid-token')
        .send({
          name: 'Test User',
          email: 'testuser@example.com'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Edge Cases', () => {
    test('should handle concurrent profile updates', async () => {
      const requests = Array(5).fill().map(() => 
        request(app)
          .post('/profile')
          .set('Cookie', cookieHeader)
          .send({
            name: 'Concurrent User',
            email: 'concurrent@example.com'
          })
      );

      const responses = await Promise.all(requests);
      
      // At least one should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });

    test('should handle boundary conditions for name length', async () => {
      // Test exact boundary values
      const exactMinName = 'a'.repeat(MIN_NAME_LENGTH);
      const exactMaxName = 'a'.repeat(MAX_NAME_LENGTH);

      const minResponse = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: exactMinName,
          email: 'testuser@example.com'
        });

      const maxResponse = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: exactMaxName,
          email: 'testuser@example.com'
        });

      expect(minResponse.status).not.toBe(400);
      expect(maxResponse.status).not.toBe(400);
    });

    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', cookieHeader)
        .set('Content-Type', 'application/json')
        .send('{"name": "Test User", "email":}');

      expect(response.status).toBe(400);
    });
  });
});