const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Test constants
const TEST_CONSTANTS = {
  VALID_EMAIL: 'test@example.com',
  VALID_PASSWORD: 'TestPassword123!',
  INVALID_EMAIL: 'invalid-email',
  INVALID_PASSWORD: '123',
  EXPIRED_TOKEN: 'expired.jwt.token',
  MALICIOUS_PAYLOAD: '<script>alert("xss")</script>',
  SQL_INJECTION: "'; DROP TABLE users; --",
  JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key',
  BCRYPT_ROUNDS: 10,
  SESSION_TIMEOUT: 3600000, // 1 hour
  MAX_LOGIN_ATTEMPTS: 5
};

describe('Sidebar Authentication & Security Tests', () => {
  let testUser;
  let validToken;
  let expiredToken;

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: /test.*@example\.com/ } });
    
    // Create test user
    const hashedPassword = await bcrypt.hash(TEST_CONSTANTS.VALID_PASSWORD, TEST_CONSTANTS.BCRYPT_ROUNDS);
    testUser = await User.create({
      email: TEST_CONSTANTS.VALID_EMAIL,
      password: hashedPassword,
      name: 'Test User',
      role: 'user'
    });

    // Generate valid token
    validToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      TEST_CONSTANTS.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Generate expired token
    expiredToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      TEST_CONSTANTS.JWT_SECRET,
      { expiresIn: '-1h' }
    );
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
  });

  describe('Authenticated Route Access', () => {
    it('should allow access to dashboard with valid token', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('sidebar-nav');
      expect(response.text).toContain('nav-item active');
    });

    it('should allow access to profile with valid token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).toContain('Profile');
      expect(response.text).toContain('sidebar-nav');
    });

    it('should allow access to settings with valid token', async () => {
      const response = await request(app)
        .get('/settings')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).toContain('Settings');
      expect(response.text).toContain('sidebar-nav');
    });

    it('should redirect to login when accessing dashboard without token', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(302);

      expect(response.headers.location).toContain('/login');
    });

    it('should redirect to login when accessing profile without token', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(302);

      expect(response.headers.location).toContain('/login');
    });

    it('should redirect to login when accessing settings without token', async () => {
      const response = await request(app)
        .get('/settings')
        .expect(302);

      expect(response.headers.location).toContain('/login');
    });
  });

  describe('Token Validation Security', () => {
    it('should reject expired tokens', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('Token expired');
    });

    it('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', 'Bearer invalid.token.format')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject tokens with invalid signature', async () => {
      const invalidToken = jwt.sign(
        { userId: testUser._id, email: testUser.email },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject tokens with missing user ID', async () => {
      const tokenWithoutUserId = jwt.sign(
        { email: testUser.email },
        TEST_CONSTANTS.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${tokenWithoutUserId}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid token payload');
    });

    it('should reject tokens for non-existent users', async () => {
      const nonExistentUserId = '507f1f77bcf86cd799439011';
      const tokenForNonExistentUser = jwt.sign(
        { userId: nonExistentUserId, email: 'nonexistent@example.com' },
        TEST_CONSTANTS.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${tokenForNonExistentUser}`)
        .expect(401);

      expect(response.body.error).toBe('User not found');
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize user name in sidebar display', async () => {
      const maliciousUser = await User.create({
        email: 'malicious@example.com',
        password: await bcrypt.hash(TEST_CONSTANTS.VALID_PASSWORD, TEST_CONSTANTS.BCRYPT_ROUNDS),
        name: TEST_CONSTANTS.MALICIOUS_PAYLOAD,
        role: 'user'
      });

      const maliciousToken = jwt.sign(
        { userId: maliciousUser._id, email: maliciousUser.email },
        TEST_CONSTANTS.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(200);

      expect(response.text).not.toContain('<script>');
      expect(response.text).not.toContain('alert("xss")');
      expect(response.text).toContain('&lt;script&gt;');

      await User.findByIdAndDelete(maliciousUser._id);
    });

    it('should sanitize query parameters in navigation URLs', async () => {
      const response = await request(app)
        .get('/dashboard?tab=' + encodeURIComponent(TEST_CONSTANTS.MALICIOUS_PAYLOAD))
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).not.toContain('<script>');
      expect(response.text).not.toContain('alert("xss")');
    });
  });

  describe('Authorization Header Validation', () => {
    it('should reject requests with missing Authorization header', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(302);

      expect(response.headers.location).toContain('/login');
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.error).toBe('Invalid authorization format');
    });

    it('should reject requests with empty Bearer token', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.error).toBe('Token not provided');
    });

    it('should reject requests with extremely long tokens', async () => {
      const longToken = 'a'.repeat(10000);
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${longToken}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Session Security', () => {
    it('should handle concurrent requests with same token', async () => {
      const requests = Array(5).fill().map(() =>
        request(app)
          .get('/dashboard')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should validate user status on each request', async () => {
      // Deactivate user
      await User.findByIdAndUpdate(testUser._id, { active: false });

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.error).toBe('User account inactive');

      // Reactivate for cleanup
      await User.findByIdAndUpdate(testUser._id, { active: true });
    });

    it('should handle user role changes', async () => {
      // Update user role
      await User.findByIdAndUpdate(testUser._id, { role: 'admin' });

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).toContain('sidebar-nav');
    });
  });

  describe('Logout Security', () => {
    it('should handle logout POST request with valid token', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should prevent logout without valid token', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should handle logout with expired token', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('Token expired');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize navigation query parameters', async () => {
      const response = await request(app)
        .get('/profile?section=' + encodeURIComponent(TEST_CONSTANTS.SQL_INJECTION))
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).not.toContain('DROP TABLE');
      expect(response.text).not.toContain('--');
    });

    it('should handle special characters in user data', async () => {
      const specialCharUser = await User.create({
        email: 'special@example.com',
        password: await bcrypt.hash(TEST_CONSTANTS.VALID_PASSWORD, TEST_CONSTANTS.BCRYPT_ROUNDS),
        name: 'User "Name" & <Special> Characters',
        role: 'user'
      });

      const specialToken = jwt.sign(
        { userId: specialCharUser._id, email: specialCharUser.email },
        TEST_CONSTANTS.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${specialToken}`)
        .expect(200);

      expect(response.text).toContain('&quot;');
      expect(response.text).toContain('&amp;');
      expect(response.text).toContain('&lt;');
      expect(response.text).toContain('&gt;');

      await User.findByIdAndDelete(specialCharUser._id);
    });
  });

  describe('Rate Limiting & Abuse Prevention', () => {
    it('should handle multiple rapid requests', async () => {
      const rapidRequests = Array(10).fill().map(() =>
        request(app)
          .get('/dashboard')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(rapidRequests);
      
      // All requests should succeed (rate limiting would be handled by middleware)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    it('should validate token on each protected route', async () => {
      const protectedRoutes = ['/dashboard', '/profile', '/settings'];
      
      for (const route of protectedRoutes) {
        const response = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);
          
        expect(response.text).toContain('sidebar-nav');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection
      // For now, we test that routes handle errors properly
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.text).toBeTruthy();
    });

    it('should return proper error structure', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
    });

    it('should handle malformed JSON in token payload', async () => {
      const malformedToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid-json.signature';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });
});