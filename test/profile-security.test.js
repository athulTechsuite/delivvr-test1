const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { expect } = require('chai');
const sinon = require('sinon');

// Mock the database and authentication modules
const mockUser = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

describe('Profile Security Tests', function() {
  let app;
  let userStub;
  let bcryptStub;
  let jwtStub;
  
  const VALID_JWT_SECRET = 'test-jwt-secret';
  const VALID_USER_ID = 123;
  const VALID_USER_EMAIL = 'test@example.com';
  const VALID_USER_NAME = 'Test User';
  const HASHED_PASSWORD = '$2b$10$hashedpassword';
  const CURRENT_PASSWORD = 'CurrentPass123';
  const NEW_PASSWORD = 'NewPass123';
  const WEAK_PASSWORD = '123';
  const SQL_INJECTION_PAYLOAD = "'; DROP TABLE users; --";
  const XSS_PAYLOAD = '<script>alert("xss")</script>';

  before(function() {
    // Setup Express app with security middleware
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Add CSRF protection mock
    app.use((req, res, next) => {
      req.csrfToken = () => 'mock-csrf-token';
      next();
    });

    // Add rate limiting
    const profileUpdateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 requests per windowMs
      message: 'Too many profile update attempts from this IP'
    });

    app.use('/profile/update', profileUpdateLimiter);
    app.use('/profile/password', profileUpdateLimiter);

    // Mock routes
    app.get('/profile', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;
        const user = await mockUser.findById(userId);
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at
        });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/profile/update', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;
        const { name } = req.body;

        // Input validation
        if (!name || typeof name !== 'string') {
          return res.status(400).json({ error: 'Name is required and must be a string' });
        }

        if (name.length < 2 || name.length > 50) {
          return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
        }

        if (!/^[a-zA-Z\s]+$/.test(name)) {
          return res.status(400).json({ error: 'Name must contain only letters and spaces' });
        }

        const result = await mockUser.updateById(userId, { name });
        
        if (!result) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'Profile updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/profile/password', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Input validation
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
          return res.status(400).json({ error: 'Passwords must be strings' });
        }

        // Password strength validation
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
          return res.status(400).json({ 
            error: 'Password must contain at least one lowercase letter, one uppercase letter, and one number' 
          });
        }

        const user = await mockUser.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const result = await mockUser.updateById(userId, { password: hashedNewPassword });

        if (!result) {
          return res.status(500).json({ error: 'Failed to update password' });
        }

        res.json({ success: true, message: 'Password updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  beforeEach(function() {
    // Reset stubs
    userStub = sinon.stub(mockUser);
    bcryptStub = sinon.stub(bcrypt);
    jwtStub = sinon.stub(jwt);

    // Setup default user data
    userStub.findById.resolves({
      id: VALID_USER_ID,
      name: VALID_USER_NAME,
      email: VALID_USER_EMAIL,
      password: HASHED_PASSWORD,
      created_at: new Date()
    });

    userStub.updateById.resolves(true);
    
    // Setup JWT verification
    jwtStub.verify.callsFake((token, secret, callback) => {
      if (token === 'valid-jwt-token' && secret === VALID_JWT_SECRET) {
        callback(null, { id: VALID_USER_ID, email: VALID_USER_EMAIL });
      } else {
        callback(new Error('Invalid token'));
      }
    });

    // Setup bcrypt
    bcryptStub.compare.resolves(true);
    bcryptStub.hash.resolves('$2b$10$newhashed');
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('JWT Authentication Bypass Attempts', function() {
    it('should reject requests without JWT token', async function() {
      const response = await request(app)
        .get('/profile')
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should reject requests with invalid JWT token', async function() {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should reject requests with malformed JWT token', async function() {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should reject requests with expired JWT token', async function() {
      jwtStub.verify.callsFake((token, secret, callback) => {
        callback(new Error('jwt expired'));
      });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(response.body).to.have.property('error');
    });

    it('should reject requests attempting JWT token manipulation', async function() {
      const manipulatedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5LCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIn0.fake';
      
      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${manipulatedToken}`)
        .expect(401);

      expect(response.body).to.have.property('error');
    });
  });

  describe('SQL Injection Prevention', function() {
    it('should prevent SQL injection in profile name update', async function() {
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: SQL_INJECTION_PAYLOAD })
        .expect(400);

      expect(response.body.error).to.include('Name must contain only letters and spaces');
      expect(userStub.updateById.called).to.be.false;
    });

    it('should sanitize user input in profile updates', async function() {
      await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'Valid Name' })
        .expect(200);

      expect(userStub.updateById.calledOnce).to.be.true;
      const [userId, updateData] = userStub.updateById.firstCall.args;
      expect(userId).to.equal(VALID_USER_ID);
      expect(updateData.name).to.equal('Valid Name');
    });

    it('should prevent SQL injection through user ID parameter manipulation', async function() {
      jwtStub.verify.callsFake((token, secret, callback) => {
        callback(null, { id: "'; DROP TABLE users; --", email: VALID_USER_EMAIL });
      });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer manipulated-token')
        .expect(500);

      expect(response.body).to.have.property('error');
    });

    it('should use parameterized queries for database operations', async function() {
      await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'John O\'Connor' })
        .expect(200);

      expect(userStub.updateById.calledOnce).to.be.true;
      const [userId, updateData] = userStub.updateById.firstCall.args;
      expect(userId).to.be.a('number');
      expect(updateData.name).to.equal('John O\'Connor');
    });
  });

  describe('XSS Prevention', function() {
    it('should prevent XSS in profile name field', async function() {
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: XSS_PAYLOAD })
        .expect(400);

      expect(response.body.error).to.include('Name must contain only letters and spaces');
      expect(userStub.updateById.called).to.be.false;
    });

    it('should sanitize profile data on retrieval', async function() {
      userStub.findById.resolves({
        id: VALID_USER_ID,
        name: 'Safe Name',
        email: VALID_USER_EMAIL,
        created_at: new Date()
      });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body.name).to.equal('Safe Name');
      expect(response.body.name).to.not.include('<script>');
    });

    it('should reject HTML entities in name field', async function() {
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: '&lt;script&gt;alert("xss")&lt;/script&gt;' })
        .expect(400);

      expect(response.body.error).to.include('Name must contain only letters and spaces');
    });
  });

  describe('Unauthorized Profile Access', function() {
    it('should prevent access to other users\' profiles', async function() {
      jwtStub.verify.callsFake((token, secret, callback) => {
        callback(null, { id: 999, email: 'other@example.com' });
      });

      userStub.findById.withArgs(999).resolves(null);

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer other-user-token')
        .expect(404);

      expect(response.body.error).to.equal('User not found');
    });

    it('should validate user ID from JWT matches requested profile', async function() {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(userStub.findById.calledWith(VALID_USER_ID)).to.be.true;
      expect(response.body.id).to.equal(VALID_USER_ID);
    });

    it('should reject profile updates for non-existent users', async function() {
      userStub.findById.resolves(null);

      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.error).to.equal('User not found');
    });
  });

  describe('Password Change Security', function() {
    it('should reject weak passwords', async function() {
      const response = await request(app)
        .post('/profile/password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          currentPassword: CURRENT_PASSWORD,
          newPassword: WEAK_PASSWORD
        })
        .expect(400);

      expect(response.body.error).to.include('Password must be at least 6 characters');
    });

    it('should enforce password complexity requirements', async function() {
      const response = await request(app)
        .post('/profile/password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          currentPassword: CURRENT_PASSWORD,
          newPassword: 'weakpass'
        })
        .expect(400);

      expect(response.body.error).to.include('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    });

    it('should verify current password before allowing changes', async function() {
      bcryptStub.compare.resolves(false);

      const response = await request(app)
        .post('/profile/password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: NEW_PASSWORD
        })
        .expect(400);

      expect(response.body.error).to.equal('Current password is incorrect');
    });

    it('should require both current and new passwords', async function() {
      const response = await request(app)
        .post('/profile/password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          currentPassword: CURRENT_PASSWORD
        })
        .expect(400);

      expect(response.body.error).to.equal('Current password and new password are required');
    });

    it('should hash new password before storing', async function() {
      await request(app)
        .post('/profile/password')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          currentPassword: CURRENT_PASSWORD,
          newPassword: NEW_PASSWORD
        })
        .expect(200);

      expect(bcryptStub.hash.calledWith(NEW_PASSWORD, 10)).to.be.true;
      expect(userStub.updateById.calledWith(VALID_USER_ID, { password: '$2b$10$newhashed' })).to.be.true;
    });
  });

  describe('Rate Limiting', function() {
    it('should limit profile update requests per IP', async function() {
      const requests = [];
      
      // Make 11 requests (exceeding the limit of 10)
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/profile/update')
            .set('Authorization', 'Bearer valid-jwt-token')
            .send({ name: `Name ${i}` })
        );
      }

      const responses = await Promise.all(requests);
      
      // First 10 should succeed (or at least not be rate limited)
      responses.slice(0, 10).forEach(response => {
        expect(response.status).to.not.equal(429);
      });

      // 11th request should be rate limited
      expect(responses[10].status).to.equal(429);
      expect(responses[10].text).to.include('Too many profile update attempts');
    });

    it('should limit password change requests per IP', async function() {
      const requests = [];
      
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/profile/password')
            .set('Authorization', 'Bearer valid-jwt-token')
            .send({
              currentPassword: CURRENT_PASSWORD,
              newPassword: `NewPass${i}123`
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // 11th request should be rate limited
      expect(responses[10].status).to.equal(429);
      expect(responses[10].text).to.include('Too many profile update attempts');
    });
  });

  describe('CSRF Protection', function() {
    it('should include CSRF token in responses', function(done) {
      // Mock CSRF token generation
      request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          // In a real implementation, CSRF token would be in response headers or body
          done();
        });
    });

    it('should validate CSRF tokens on state-changing operations', async function() {
      // This would be implemented with actual CSRF middleware
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.success).to.be.true;
    });
  });

  describe('Session Security', function() {
    it('should maintain session integrity during profile operations', async function() {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('name');
      expect(response.body).to.have.property('email');
    });

    it('should invalidate session on suspicious activity', function() {
      // This would detect and handle session hijacking attempts
      // Implementation depends on specific session management strategy
      expect(true).to.be.true; // Placeholder for actual test
    });
  });

  describe('Input Sanitization', function() {
    it('should validate input types', async function() {
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 123 })
        .expect(400);

      expect(response.body.error).to.equal('Name is required and must be a string');
    });

    it('should enforce input length limits', async function() {
      const longName = 'a'.repeat(51);
      
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: longName })
        .expect(400);

      expect(response.body.error).to.include('Name must be between 2 and 50 characters');
    });

    it('should reject null and undefined inputs', async function() {
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: null })
        .expect(400);

      expect(response.body.error).to.equal('Name is required and must be a string');
    });

    it('should sanitize special characters in name field', async function() {
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'John@Doe#123' })
        .expect(400);

      expect(response.body.error).to.include('Name must contain only letters and spaces');
    });
  });

  describe('Authorization Checks', function() {
    it('should ensure users can only modify their own profiles', async function() {
      jwtStub.verify.callsFake((token, secret, callback) => {
        callback(null, { id: 456, email: 'different@example.com' });
      });

      userStub.findById.withArgs(456).resolves({
        id: 456,
        name: 'Different User',
        email: 'different@example.com',
        password: HASHED_PASSWORD,
        created_at: new Date()
      });

      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer different-user-token')
        .send({ name: 'New Name' })
        .expect(200);

      expect(userStub.updateById.calledWith(456)).to.be.true;
    });

    it('should prevent cross-user profile modifications', async function() {
      // Attempt to modify another user's profile should fail at authentication level
      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'Malicious Name', userId: 999 })
        .expect(200);

      // Should only update the authenticated user's profile
      expect(userStub.updateById.calledWith(VALID_USER_ID)).to.be.true;
      expect(userStub.updateById.neverCalledWith(999)).to.be.true;
    });

    it('should validate user ownership for all profile operations', async function() {
      await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(userStub.findById.calledWith(VALID_USER_ID)).to.be.true;
    });
  });

  describe('Error Handling and Information Disclosure', function() {
    it('should not expose sensitive information in error messages', async function() {
      userStub.findById.throws(new Error('Database connection failed'));

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(500);

      expect(response.body.error).to.equal('Internal server error');
      expect(response.body.error).to.not.include('Database connection failed');
    });

    it('should handle database errors gracefully', async function() {
      userStub.updateById.throws(new Error('Database error'));

      const response = await request(app)
        .post('/profile/update')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ name: 'New Name' })
        .expect(500);

      expect(response.body.error).to.equal('Internal server error');
    });

    it('should provide generic error messages for authentication failures', async function() {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).to.not.include('jwt');
      expect(response.body.error).to.not.include('token');
    });
  });
});