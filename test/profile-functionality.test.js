const request = require('supertest');
const app = require('../app');
const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Test constants
const TEST_TIMEOUT = 10000;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 6;
const VALID_NAME_PATTERN = /^[a-zA-Z\s]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const JWT_EXPIRES_IN = '24h';
const BCRYPT_SALT_ROUNDS = 10;

describe('Profile Functionality Tests', () => {
  let testUser;
  let authToken;
  let userId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('TestPass123', BCRYPT_SALT_ROUNDS);
    testUser = {
      name: 'John Doe',
      email: 'john.doe@test.com',
      password: hashedPassword
    };

    // Insert test user into database
    const result = await db.query(
      'INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [testUser.name, testUser.email, testUser.password]
    );
    userId = result.insertId;

    // Generate valid JWT token
    authToken = jwt.sign(
      { userId: userId, email: testUser.email },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await db.query('DELETE FROM users WHERE id = ?', [userId]);
    }
    await db.end();
  });

  describe('Profile Page Access and Authentication', () => {
    test('should allow access with valid JWT authentication', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.text).toContain('Profile');
      expect(response.text).toContain(testUser.name);
      expect(response.text).toContain(testUser.email);
    }, TEST_TIMEOUT);

    test('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });

    test('should redirect users with invalid JWT token to login', async () => {
      const invalidToken = 'invalid.jwt.token';
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${invalidToken}`)
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });

    test('should redirect users with expired JWT token to login', async () => {
      const expiredToken = jwt.sign(
        { userId: userId, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${expiredToken}`)
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });

    test('should handle missing user data gracefully', async () => {
      const nonExistentUserId = 99999;
      const invalidUserToken = jwt.sign(
        { userId: nonExistentUserId, email: 'nonexistent@test.com' },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${invalidUserToken}`)
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });
  });

  describe('Profile Data Display', () => {
    test('should display user profile data from database', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.text).toContain(testUser.name);
      expect(response.text).toContain(testUser.email);
      expect(response.text).toContain('Member since');
    });

    test('should display formatted join date', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      // Should contain a properly formatted date
      const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/;
      expect(response.text).toMatch(dateRegex);
    });

    test('should display email as read-only field', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.text).toContain('readonly');
      expect(response.text).toContain(testUser.email);
    });
  });

  describe('Name Field Editing and Validation', () => {
    test('should update user name with valid input', async () => {
      const newName = 'Jane Smith';
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: newName })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');

      // Verify database was updated
      const [updatedUser] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
      expect(updatedUser.name).toBe(newName);

      // Reset name for other tests
      await db.query('UPDATE users SET name = ? WHERE id = ?', [testUser.name, userId]);
    });

    test('should reject empty name field', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Name is required');
    });

    test('should reject name shorter than minimum length', async () => {
      const shortName = 'A';
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: shortName })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(`at least ${MIN_NAME_LENGTH} characters`);
    });

    test('should reject name longer than maximum length', async () => {
      const longName = 'A'.repeat(MAX_NAME_LENGTH + 1);
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: longName })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(`maximum ${MAX_NAME_LENGTH} characters`);
    });

    test('should reject name with invalid characters', async () => {
      const invalidName = 'John123';
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: invalidName })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('letters and spaces only');
    });

    test('should accept name with valid characters and spaces', async () => {
      const validName = 'Mary Jane Watson';
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: validName })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Reset name
      await db.query('UPDATE users SET name = ? WHERE id = ?', [testUser.name, userId]);
    });

    test('should prevent unauthorized name updates', async () => {
      const response = await request(app)
        .post('/profile/update')
        .send({ name: 'Unauthorized Change' })
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });
  });

  describe('Password Change Functionality', () => {
    test('should change password with valid current password', async () => {
      const currentPassword = 'TestPass123';
      const newPassword = 'NewPass456';

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newPassword,
          confirmPassword: newPassword
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password updated successfully');

      // Verify password was changed in database
      const [user] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
      const passwordMatch = await bcrypt.compare(newPassword, user.password);
      expect(passwordMatch).toBe(true);

      // Reset password for other tests
      const hashedOriginal = await bcrypt.hash('TestPass123', BCRYPT_SALT_ROUNDS);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedOriginal, userId]);
    });

    test('should reject password change with incorrect current password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPass456',
          confirmPassword: 'NewPass456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    test('should reject new password shorter than minimum length', async () => {
      const shortPassword = '123';

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          currentPassword: 'TestPass123',
          newPassword: shortPassword,
          confirmPassword: shortPassword
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(`at least ${MIN_PASSWORD_LENGTH} characters`);
    });

    test('should reject new password without required character types', async () => {
      const weakPassword = 'password'; // No uppercase or numbers

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          currentPassword: 'TestPass123',
          newPassword: weakPassword,
          confirmPassword: weakPassword
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('uppercase letter');
    });

    test('should reject mismatched password confirmation', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          currentPassword: 'TestPass123',
          newPassword: 'NewPass456',
          confirmPassword: 'DifferentPass789'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Passwords do not match');
    });

    test('should reject password change without current password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          newPassword: 'NewPass456',
          confirmPassword: 'NewPass456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Current password is required');
    });

    test('should prevent unauthorized password changes', async () => {
      const response = await request(app)
        .post('/profile/password')
        .send({
          currentPassword: 'TestPass123',
          newPassword: 'NewPass456',
          confirmPassword: 'NewPass456'
        })
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });
  });

  describe('Database Error Scenarios', () => {
    test('should handle database connection errors gracefully', async () => {
      // Temporarily close database connection
      await db.end();

      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(302);

      expect(response.headers.location).toBe('/login');

      // Reconnect database for remaining tests
      await db.connect();
    });

    test('should handle database update errors gracefully', async () => {
      // Use an invalid user ID to simulate database error
      const invalidUserToken = jwt.sign(
        { userId: -1, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${invalidUserToken}`)
        .send({ name: 'New Name' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('database error');
    });
  });

  describe('Concurrent User Update Handling', () => {
    test('should handle concurrent name updates safely', async () => {
      const name1 = 'Concurrent User One';
      const name2 = 'Concurrent User Two';

      // Simulate concurrent updates
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/profile/update')
          .set('Cookie', `token=${authToken}`)
          .send({ name: name1 }),
        request(app)
          .post('/profile/update')
          .set('Cookie', `token=${authToken}`)
          .send({ name: name2 })
      ]);

      // One should succeed, both should be handled gracefully
      const successfulResponses = [response1, response2].filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThanOrEqual(1);

      // Reset name
      await db.query('UPDATE users SET name = ? WHERE id = ?', [testUser.name, userId]);
    });

    test('should handle concurrent password changes safely', async () => {
      const newPass1 = 'NewPass123';
      const newPass2 = 'NewPass456';

      // Simulate concurrent password changes
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/profile/password')
          .set('Cookie', `token=${authToken}`)
          .send({
            currentPassword: 'TestPass123',
            newPassword: newPass1,
            confirmPassword: newPass1
          }),
        request(app)
          .post('/profile/password')
          .set('Cookie', `token=${authToken}`)
          .send({
            currentPassword: 'TestPass123',
            newPassword: newPass2,
            confirmPassword: newPass2
          })
      ]);

      // One should succeed, the other might fail due to changed current password
      const successCount = [response1, response2].filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Reset password
      const hashedOriginal = await bcrypt.hash('TestPass123', BCRYPT_SALT_ROUNDS);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedOriginal, userId]);
    });
  });

  describe('AJAX Form Submission Handling', () => {
    test('should return JSON response for profile update requests', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .set('Accept', 'application/json')
        .send({ name: 'AJAX Test Name' })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('should return JSON error response for invalid requests', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .set('Accept', 'application/json')
        .send({ name: '' })
        .expect(400);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed JSON requests gracefully', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Sanitization and Security', () => {
    test('should sanitize name input to prevent XSS attacks', async () => {
      const maliciousName = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: maliciousName })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('letters and spaces only');
    });

    test('should use parameterized queries to prevent SQL injection', async () => {
      const sqlInjectionAttempt = "'; DROP TABLE users; --";

      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: sqlInjectionAttempt })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify table still exists by querying user
      const [user] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
      expect(user).toBeDefined();
    });

    test('should validate JWT token integrity', async () => {
      // Tamper with token
      const tamperedToken = authToken.slice(0, -5) + 'xxxxx';

      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${tamperedToken}`)
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });
  });

  describe('User Feedback and Error Messages', () => {
    test('should provide specific validation error messages', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: 'A' })
        .expect(400);

      expect(response.body.error).toContain('at least 2 characters');
    });

    test('should provide success messages for successful updates', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: 'Success Test Name' })
        .expect(200);

      expect(response.body.message).toContain('Profile updated successfully');

      // Reset name
      await db.query('UPDATE users SET name = ? WHERE id = ?', [testUser.name, userId]);
    });

    test('should provide user-friendly database error messages', async () => {
      // Use a very long name that would cause database constraint error
      const oversizedName = 'A'.repeat(1000);

      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: oversizedName })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('maximum');
    });
  });

  describe('Complete User Flow Integration', () => {
    test('should complete full profile update workflow', async () => {
      // 1. Access profile page
      let response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.text).toContain(testUser.name);

      // 2. Update name
      response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${authToken}`)
        .send({ name: 'Updated Test Name' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // 3. Verify updated data on profile page
      response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.text).toContain('Updated Test Name');

      // 4. Change password
      response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${authToken}`)
        .send({
          currentPassword: 'TestPass123',
          newPassword: 'UpdatedPass123',
          confirmPassword: 'UpdatedPass123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // 5. Verify can still access profile with new password
      response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.text).toContain('Updated Test Name');

      // Reset user data
      const hashedOriginal = await bcrypt.hash('TestPass123', BCRYPT_SALT_ROUNDS);
      await db.query(
        'UPDATE users SET name = ?, password = ? WHERE id = ?',
        [testUser.name, hashedOriginal, userId]
      );
    });

    test('should maintain session consistency across profile operations', async () => {
      const agent = request.agent(app);

      // Login and establish session
      await agent
        .post('/login')
        .send({
          email: testUser.email,
          password: 'TestPass123'
        })
        .expect(302);

      // Access profile
      let response = await agent
        .get('/profile')
        .expect(200);

      expect(response.text).toContain(testUser.name);

      // Update profile
      response = await agent
        .post('/profile/update')
        .send({ name: 'Session Test Name' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session still valid
      response = await agent
        .get('/profile')
        .expect(200);

      expect(response.text).toContain('Session Test Name');

      // Reset name
      await db.query('UPDATE users SET name = ? WHERE id = ?', [testUser.name, userId]);
    });
  });
});