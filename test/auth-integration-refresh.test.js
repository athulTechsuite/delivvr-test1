const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Test constants
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = 'Test User';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
const REFRESH_TOKEN_LENGTH = 64;
const SHORT_EXPIRY_TIME = 1; // 1 hour for testing
const REMEMBER_EXPIRY_TIME = 168; // 7 days
const REFRESH_WINDOW = 3600; // 1 hour before expiry

// Mock Date.now for testing time-based scenarios
let mockTime = null;
const originalDateNow = Date.now;

const mockDateNow = (time) => {
  mockTime = time;
  Date.now = jest.fn(() => mockTime);
};

const restoreDate = () => {
  Date.now = originalDateNow;
  mockTime = null;
};

// Helper function to create test user
const createTestUser = async () => {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  return await User.create({
    name: TEST_NAME,
    email: TEST_EMAIL,
    password: hashedPassword,
    refresh_token: null,
    token_expires_at: null
  });
};

// Helper function to extract cookies from response
const extractCookies = (response) => {
  const setCookieHeaders = response.headers['set-cookie'] || [];
  const cookies = {};
  
  setCookieHeaders.forEach(header => {
    const [cookiePart] = header.split(';');
    const [name, value] = cookiePart.split('=');
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value.trim());
    }
  });
  
  return cookies;
};

// Helper function to decode JWT without verification
const decodeJwtPayload = (token) => {
  try {
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
};

// Helper function to create expired JWT
const createExpiredJwt = (userId, expiryTime) => {
  return jwt.sign(
    { 
      userId: userId,
      exp: Math.floor(expiryTime / 1000)
    },
    JWT_SECRET
  );
};

describe('Authentication Integration Tests - Refresh Token Pattern', () => {
  let testUser;

  beforeEach(async () => {
    // Clean up test data
    await User.destroy({ where: { email: TEST_EMAIL } });
    testUser = await createTestUser();
    restoreDate();
  });

  afterEach(async () => {
    // Clean up test data
    await User.destroy({ where: { email: TEST_EMAIL } });
    restoreDate();
  });

  describe('Login with Remember Me checked', () => {
    test('should create 7-day JWT and refresh token with cookies', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      // Verify response structure
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(TEST_EMAIL);

      // Extract cookies
      const cookies = extractCookies(response);
      expect(cookies.token).toBeDefined();
      expect(cookies.refresh_token).toBeDefined();

      // Verify JWT token expiry (7 days)
      const tokenPayload = decodeJwtPayload(cookies.token);
      expect(tokenPayload).toBeTruthy();
      expect(tokenPayload.userId).toBe(testUser.id);
      
      const tokenExpiry = tokenPayload.exp * 1000;
      const expectedExpiry = Date.now() + (REMEMBER_EXPIRY_TIME * 60 * 60 * 1000);
      const timeDifference = Math.abs(tokenExpiry - expectedExpiry);
      expect(timeDifference).toBeLessThan(5000); // 5 second tolerance

      // Verify refresh token is stored in database
      const updatedUser = await User.findByPk(testUser.id);
      expect(updatedUser.refresh_token).toBeTruthy();
      expect(updatedUser.token_expires_at).toBeTruthy();
      
      // Verify refresh token length
      expect(cookies.refresh_token.length).toBe(REFRESH_TOKEN_LENGTH);
      
      // Verify refresh token is hashed in database
      const isHashValid = await bcrypt.compare(cookies.refresh_token, updatedUser.refresh_token);
      expect(isHashValid).toBe(true);

      // Verify token_expires_at is 7 days from now
      const dbExpiry = new Date(updatedUser.token_expires_at).getTime();
      const expectedDbExpiry = Date.now() + (REMEMBER_EXPIRY_TIME * 60 * 60 * 1000);
      const dbTimeDifference = Math.abs(dbExpiry - expectedDbExpiry);
      expect(dbTimeDifference).toBeLessThan(5000); // 5 second tolerance
    });

    test('should overwrite existing refresh token on new login', async () => {
      // First login
      const firstResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const firstCookies = extractCookies(firstResponse);
      const firstRefreshToken = firstCookies.refresh_token;

      // Second login
      const secondResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const secondCookies = extractCookies(secondResponse);
      const secondRefreshToken = secondCookies.refresh_token;

      // Verify tokens are different
      expect(firstRefreshToken).not.toBe(secondRefreshToken);

      // Verify only second token is valid in database
      const updatedUser = await User.findByPk(testUser.id);
      const isSecondTokenValid = await bcrypt.compare(secondRefreshToken, updatedUser.refresh_token);
      const isFirstTokenValid = await bcrypt.compare(firstRefreshToken, updatedUser.refresh_token);
      
      expect(isSecondTokenValid).toBe(true);
      expect(isFirstTokenValid).toBe(false);
    });
  });

  describe('Login without Remember Me checked', () => {
    test('should create 24-hour JWT without refresh token', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: false
        })
        .expect(200);

      // Verify response structure
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();

      // Extract cookies
      const cookies = extractCookies(response);
      expect(cookies.token).toBeDefined();
      expect(cookies.refresh_token).toBeUndefined();

      // Verify JWT token expiry (24 hours)
      const tokenPayload = decodeJwtPayload(cookies.token);
      expect(tokenPayload).toBeTruthy();
      
      const tokenExpiry = tokenPayload.exp * 1000;
      const expectedExpiry = Date.now() + (24 * 60 * 60 * 1000);
      const timeDifference = Math.abs(tokenExpiry - expectedExpiry);
      expect(timeDifference).toBeLessThan(5000); // 5 second tolerance

      // Verify no refresh token in database
      const updatedUser = await User.findByPk(testUser.id);
      expect(updatedUser.refresh_token).toBeNull();
      expect(updatedUser.token_expires_at).toBeNull();
    });

    test('should create 24-hour JWT when rememberMe is undefined', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        })
        .expect(200);

      // Extract cookies
      const cookies = extractCookies(response);
      expect(cookies.token).toBeDefined();
      expect(cookies.refresh_token).toBeUndefined();

      // Verify JWT token expiry (24 hours)
      const tokenPayload = decodeJwtPayload(cookies.token);
      const tokenExpiry = tokenPayload.exp * 1000;
      const expectedExpiry = Date.now() + (24 * 60 * 60 * 1000);
      const timeDifference = Math.abs(tokenExpiry - expectedExpiry);
      expect(timeDifference).toBeLessThan(5000); // 5 second tolerance
    });
  });

  describe('Token auto-refresh functionality', () => {
    test('should automatically refresh token when less than 1 hour remaining', async () => {
      // Login with remember me to get refresh token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const loginCookies = extractCookies(loginResponse);
      const originalToken = loginCookies.token;
      const refreshToken = loginCookies.refresh_token;

      // Mock time to be 1 hour before token expiry
      const currentTime = Date.now();
      const tokenExpiry = decodeJwtPayload(originalToken).exp * 1000;
      const nearExpiryTime = tokenExpiry - (REFRESH_WINDOW - 300000); // 5 minutes before refresh window
      mockDateNow(nearExpiryTime);

      // Make authenticated request that should trigger refresh
      const protectedResponse = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`)
        .expect(200);

      // Verify response includes new tokens
      const newCookies = extractCookies(protectedResponse);
      expect(newCookies.token).toBeDefined();
      expect(newCookies.refresh_token).toBeDefined();
      expect(newCookies.token).not.toBe(originalToken);
      expect(newCookies.refresh_token).not.toBe(refreshToken);

      // Verify new JWT has 7-day expiry
      const newTokenPayload = decodeJwtPayload(newCookies.token);
      const newTokenExpiry = newTokenPayload.exp * 1000;
      const expectedNewExpiry = nearExpiryTime + (REMEMBER_EXPIRY_TIME * 60 * 60 * 1000);
      const newTimeDifference = Math.abs(newTokenExpiry - expectedNewExpiry);
      expect(newTimeDifference).toBeLessThan(5000); // 5 second tolerance

      // Verify database is updated with new refresh token
      const updatedUser = await User.findByPk(testUser.id);
      const isNewTokenValid = await bcrypt.compare(newCookies.refresh_token, updatedUser.refresh_token);
      const isOldTokenValid = await bcrypt.compare(refreshToken, updatedUser.refresh_token);
      
      expect(isNewTokenValid).toBe(true);
      expect(isOldTokenValid).toBe(false);
    });

    test('should not refresh token when more than 1 hour remaining', async () => {
      // Login with remember me
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const loginCookies = extractCookies(loginResponse);
      const originalToken = loginCookies.token;
      const refreshToken = loginCookies.refresh_token;

      // Make authenticated request with fresh token (no refresh needed)
      const protectedResponse = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`)
        .expect(200);

      // Verify no new tokens are set
      const responseCookies = extractCookies(protectedResponse);
      expect(responseCookies.token).toBeUndefined();
      expect(responseCookies.refresh_token).toBeUndefined();

      // Verify user data is still returned
      expect(protectedResponse.body.user).toBeDefined();
      expect(protectedResponse.body.user.email).toBe(TEST_EMAIL);
    });

    test('should handle expired refresh token and redirect to login', async () => {
      // Create expired refresh token in database
      const expiredTime = Date.now() - (24 * 60 * 60 * 1000); // 1 day ago
      const expiredRefreshToken = 'expired_refresh_token_64_chars_long_for_testing_purposes_here';
      const hashedExpiredToken = await bcrypt.hash(expiredRefreshToken, 10);
      
      await User.update({
        refresh_token: hashedExpiredToken,
        token_expires_at: new Date(expiredTime)
      }, { where: { id: testUser.id } });

      // Create near-expiry JWT
      const nearExpiryTime = Date.now() + (REFRESH_WINDOW - 300000); // 5 minutes before refresh
      const nearExpiryToken = createExpiredJwt(testUser.id, nearExpiryTime);

      // Make request that should trigger refresh but fail due to expired refresh token
      const response = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${nearExpiryToken}; refresh_token=${expiredRefreshToken}`)
        .expect(302);

      // Verify redirect to login
      expect(response.headers.location).toBe('/auth/login');

      // Verify cookies are cleared
      const cookies = extractCookies(response);
      expect(cookies.token).toBe('');
      expect(cookies.refresh_token).toBe('');
    });
  });

  describe('Logout functionality with refresh tokens', () => {
    test('should clear JWT cookie and nullify refresh token in database', async () => {
      // Login with remember me
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const loginCookies = extractCookies(loginResponse);
      const token = loginCookies.token;
      const refreshToken = loginCookies.refresh_token;

      // Verify tokens exist
      expect(token).toBeDefined();
      expect(refreshToken).toBeDefined();

      // Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', `token=${token}; refresh_token=${refreshToken}`)
        .expect(200);

      // Verify response
      expect(logoutResponse.body.success).toBe(true);
      expect(logoutResponse.body.message).toBe('Logged out successfully');

      // Verify cookies are cleared
      const logoutCookies = extractCookies(logoutResponse);
      expect(logoutCookies.token).toBe('');
      expect(logoutCookies.refresh_token).toBe('');

      // Verify refresh token is nullified in database
      const updatedUser = await User.findByPk(testUser.id);
      expect(updatedUser.refresh_token).toBeNull();
      expect(updatedUser.token_expires_at).toBeNull();
    });

    test('should handle logout without refresh token (24-hour session)', async () => {
      // Login without remember me
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: false
        })
        .expect(200);

      const loginCookies = extractCookies(loginResponse);
      const token = loginCookies.token;

      // Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', `token=${token}`)
        .expect(200);

      // Verify response
      expect(logoutResponse.body.success).toBe(true);

      // Verify token cookie is cleared
      const logoutCookies = extractCookies(logoutResponse);
      expect(logoutCookies.token).toBe('');
    });
  });

  describe('Invalid refresh token scenarios', () => {
    test('should handle malformed refresh token', async () => {
      // Create near-expiry JWT
      const nearExpiryTime = Date.now() + (REFRESH_WINDOW - 300000);
      const nearExpiryToken = createExpiredJwt(testUser.id, nearExpiryTime);
      const malformedRefreshToken = 'invalid_token_format';

      // Make request with malformed refresh token
      const response = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${nearExpiryToken}; refresh_token=${malformedRefreshToken}`)
        .expect(302);

      // Verify redirect to login
      expect(response.headers.location).toBe('/auth/login');

      // Verify cookies are cleared
      const cookies = extractCookies(response);
      expect(cookies.token).toBe('');
      expect(cookies.refresh_token).toBe('');
    });

    test('should handle refresh token not found in database', async () => {
      // Create near-expiry JWT
      const nearExpiryTime = Date.now() + (REFRESH_WINDOW - 300000);
      const nearExpiryToken = createExpiredJwt(testUser.id, nearExpiryTime);
      const nonExistentRefreshToken = 'a'.repeat(REFRESH_TOKEN_LENGTH);

      // Make request with non-existent refresh token
      const response = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${nearExpiryToken}; refresh_token=${nonExistentRefreshToken}`)
        .expect(302);

      // Verify redirect to login
      expect(response.headers.location).toBe('/auth/login');
    });

    test('should handle refresh token hash mismatch', async () => {
      // Set up user with different refresh token in database
      const dbRefreshToken = 'database_token_64_chars_long_for_testing_purposes_here_now';
      const hashedDbToken = await bcrypt.hash(dbRefreshToken, 10);
      const futureTime = Date.now() + (7 * 24 * 60 * 60 * 1000);
      
      await User.update({
        refresh_token: hashedDbToken,
        token_expires_at: new Date(futureTime)
      }, { where: { id: testUser.id } });

      // Create near-expiry JWT and different refresh token
      const nearExpiryTime = Date.now() + (REFRESH_WINDOW - 300000);
      const nearExpiryToken = createExpiredJwt(testUser.id, nearExpiryTime);
      const differentRefreshToken = 'different_token_64_chars_long_for_testing_purposes_here';

      // Make request with mismatched refresh token
      const response = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${nearExpiryToken}; refresh_token=${differentRefreshToken}`)
        .expect(302);

      // Verify redirect to login
      expect(response.headers.location).toBe('/auth/login');
    });
  });

  describe('Concurrent refresh request handling', () => {
    test('should handle race conditions gracefully during token refresh', async () => {
      // Login with remember me
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const loginCookies = extractCookies(loginResponse);
      const originalToken = loginCookies.token;
      const refreshToken = loginCookies.refresh_token;

      // Mock time to trigger refresh
      const currentTime = Date.now();
      const tokenExpiry = decodeJwtPayload(originalToken).exp * 1000;
      const nearExpiryTime = tokenExpiry - (REFRESH_WINDOW - 300000);
      mockDateNow(nearExpiryTime);

      // Make concurrent requests that should trigger refresh
      const concurrentRequests = Promise.all([
        request(app)
          .get('/auth/profile')
          .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`),
        request(app)
          .get('/auth/profile')
          .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`),
        request(app)
          .get('/auth/profile')
          .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`)
      ]);

      const responses = await concurrentRequests;

      // At least one request should succeed with new tokens
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);

      // Check for new tokens in successful responses
      let newTokensFound = false;
      for (const response of successfulResponses) {
        const cookies = extractCookies(response);
        if (cookies.token && cookies.token !== originalToken) {
          newTokensFound = true;
          break;
        }
      }

      // Verify that token refresh occurred
      expect(newTokensFound).toBe(true);
    });
  });

  describe('Complete user journey testing', () => {
    test('should handle complete signup -> login -> auto-refresh -> logout flow', async () => {
      // Step 1: Signup (assuming signup endpoint exists)
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Journey Test User',
          email: 'journey@test.com',
          password: 'journeypassword123'
        });

      let journeyUserId;
      if (signupResponse.status === 201) {
        journeyUserId = signupResponse.body.user.id;
      } else {
        // If signup fails, create user directly
        const journeyUser = await User.create({
          name: 'Journey Test User',
          email: 'journey@test.com',
          password: await bcrypt.hash('journeypassword123', 10)
        });
        journeyUserId = journeyUser.id;
      }

      try {
        // Step 2: Login with remember me
        const loginResponse = await request(app)
          .post('/auth/login')
          .send({
            email: 'journey@test.com',
            password: 'journeypassword123',
            rememberMe: true
          })
          .expect(200);

        const loginCookies = extractCookies(loginResponse);
        const originalToken = loginCookies.token;
        const refreshToken = loginCookies.refresh_token;

        expect(originalToken).toBeDefined();
        expect(refreshToken).toBeDefined();

        // Step 3: Wait near expiry and trigger auto-refresh
        const tokenExpiry = decodeJwtPayload(originalToken).exp * 1000;
        const nearExpiryTime = tokenExpiry - (REFRESH_WINDOW - 300000);
        mockDateNow(nearExpiryTime);

        const refreshResponse = await request(app)
          .get('/auth/profile')
          .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`)
          .expect(200);

        const refreshCookies = extractCookies(refreshResponse);
        const newToken = refreshCookies.token || originalToken;
        const newRefreshToken = refreshCookies.refresh_token || refreshToken;

        // Step 4: Logout
        const logoutResponse = await request(app)
          .post('/auth/logout')
          .set('Cookie', `token=${newToken}; refresh_token=${newRefreshToken}`)
          .expect(200);

        expect(logoutResponse.body.success).toBe(true);

        // Verify cookies are cleared
        const logoutCookies = extractCookies(logoutResponse);
        expect(logoutCookies.token).toBe('');
        expect(logoutCookies.refresh_token).toBe('');

        // Verify database cleanup
        const finalUser = await User.findByPk(journeyUserId);
        expect(finalUser.refresh_token).toBeNull();
        expect(finalUser.token_expires_at).toBeNull();

      } finally {
        // Cleanup journey test user
        await User.destroy({ where: { email: 'journey@test.com' } });
      }
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle missing cookies gracefully', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(302);

      expect(response.headers.location).toBe('/auth/login');
    });

    test('should handle corrupted JWT token', async () => {
      const corruptedToken = 'corrupted.jwt.token';
      
      const response = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${corruptedToken}`)
        .expect(302);

      expect(response.headers.location).toBe('/auth/login');
    });

    test('should handle database connection errors during refresh', async () => {
      // Login with remember me
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          rememberMe: true
        })
        .expect(200);

      const loginCookies = extractCookies(loginResponse);
      const originalToken = loginCookies.token;
      const refreshToken = loginCookies.refresh_token;

      // Mock time to trigger refresh
      const tokenExpiry = decodeJwtPayload(originalToken).exp * 1000;
      const nearExpiryTime = tokenExpiry - (REFRESH_WINDOW - 300000);
      mockDateNow(nearExpiryTime);

      // Mock User.findByPk to simulate database error
      const originalFindByPk = User.findByPk;
      User.findByPk = jest.fn().mockRejectedValue(new Error('Database connection error'));

      try {
        const response = await request(app)
          .get('/auth/profile')
          .set('Cookie', `token=${originalToken}; refresh_token=${refreshToken}`)
          .expect(302);

        expect(response.headers.location).toBe('/auth/login');
      } finally {
        // Restore original method
        User.findByPk = originalFindByPk;
      }
    });

    test('should maintain existing session behavior for users without refresh tokens', async () => {
      // Create user with no refresh token (simulating existing user)
      await User.update({
        refresh_token: null,
        token_expires_at: null
      }, { where: { id: testUser.id } });

      // Create 24-hour JWT manually
      const token = jwt.sign(
        { userId: testUser.id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Make authenticated request
      const response = await request(app)
        .get('/auth/profile')
        .set('Cookie', `token=${token}`)
        .expect(200);

      // Verify response works as expected
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(TEST_EMAIL);

      // Verify no new tokens are set
      const cookies = extractCookies(response);
      expect(cookies.token).toBeUndefined();
      expect(cookies.refresh_token).toBeUndefined();
    });
  });
});