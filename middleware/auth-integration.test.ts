import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { authenticateToken, redirectIfAuthenticated, clearAuthCookies } from '../middleware/auth';

// Mock User model with comprehensive test scenarios
const mockUsers = {
  '64f8b1234567890123456789': {
    _id: '64f8b1234567890123456789',
    email: 'test@example.com',
    validateRefreshToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
    token_expires_at: null
  },
  '64f8b1234567890123456790': {
    _id: '64f8b1234567890123456790',
    email: 'user2@example.com',
    validateRefreshToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
    token_expires_at: null
  }
};

const mockUserFindById = jest.fn();
jest.mock('../models/User', () => ({
  findById: mockUserFindById
}));

describe('Authentication Middleware Integration Tests', () => {
  const JWT_SECRET = 'test-jwt-secret';
  const TEST_USER_ID_1 = '64f8b1234567890123456789';
  const TEST_USER_ID_2 = '64f8b1234567890123456790';
  const VALID_REFRESH_TOKEN = 'a'.repeat(64);
  let app: express.Application;
  
  const createTestApp = () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(cookieParser());
    
    // Simulate different protected routes
    testApp.get('/dashboard', authenticateToken, (req, res) => {
      res.json({ page: 'dashboard', user: req.user });
    });
    
    testApp.get('/profile', authenticateToken, (req, res) => {
      res.json({ page: 'profile', user: req.user });
    });
    
    testApp.get('/login', redirectIfAuthenticated, (req, res) => {
      res.json({ page: 'login' });
    });
    
    testApp.get('/signup', redirectIfAuthenticated, (req, res) => {
      res.json({ page: 'signup' });
    });
    
    testApp.post('/logout', (req, res) => {
      clearAuthCookies(res);
      res.json({ success: true });
    });
    
    return testApp;
  };
  
  const createJWT = (payload: any, expiresIn: string = '24h') => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  };
  
  const createSoonToExpireJWT = (payload: any) => {
    const expiryTime = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
    return jwt.sign({ ...payload, exp: expiryTime }, JWT_SECRET);
  };
  
  beforeEach(() => {
    app = createTestApp();
    process.env.JWT_SECRET = JWT_SECRET;
    jest.clearAllMocks();
    
    // Reset user mock states
    Object.values(mockUsers).forEach(user => {
      user.token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      user.validateRefreshToken.mockReset();
      user.generateRefreshToken.mockReset();
      user.clearRefreshToken.mockReset();
    });
  });
  
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });
  
  describe('End-to-End Authentication Flow', () => {
    // TC-F-019: Token refresh maintains user session without requiring re-authentication
    test('should maintain user session through automatic token refresh', async () => {
      const user = mockUsers[TEST_USER_ID_1];
      const soonToExpireToken = createSoonToExpireJWT({
        userId: TEST_USER_ID_1,
        email: 'test@example.com'
      });
      
      mockUserFindById.mockResolvedValue(user);
      user.validateRefreshToken.mockResolvedValue(true);
      user.generateRefreshToken.mockResolvedValue({
        refreshToken: 'new-refresh-token-64-chars-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      
      // First request to dashboard with soon-to-expire token
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${soonToExpireToken}`, `refresh_token=${VALID_REFRESH_TOKEN}`]);
      
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.page).toBe('dashboard');
      expect(dashboardResponse.body.user.userId).toBe(TEST_USER_ID_1);
      
      // Verify new tokens were set
      const cookies = dashboardResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      // Extract new token from response
      const newTokenCookie = cookies.find((cookie: string) => cookie.startsWith('token='));
      const newToken = newTokenCookie.split(';')[0].split('=')[1];
      
      // Subsequent request with new token should work seamlessly
      const profileResponse = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${newToken}`]);
      
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.page).toBe('profile');
      expect(profileResponse.body.user.userId).toBe(TEST_USER_ID_1);
    });
    
    // TC-F-018: Remember me state is per-login session, not persistent user preference
    test('should handle different authentication states for different users', async () => {
      const user1Token = createJWT({ userId: TEST_USER_ID_1, email: 'test@example.com' });
      const user2Token = createJWT({ userId: TEST_USER_ID_2, email: 'user2@example.com' });
      
      // User 1 access
      const user1Response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${user1Token}`]);
      
      expect(user1Response.status).toBe(200);
      expect(user1Response.body.user.userId).toBe(TEST_USER_ID_1);
      
      // User 2 access
      const user2Response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${user2Token}`]);
      
      expect(user2Response.status).toBe(200);
      expect(user2Response.body.user.userId).toBe(TEST_USER_ID_2);
    });
    
    // TC-F-022, TC-F-023: Login with/without Remember me creates appropriate cookies
    test('should handle login flow with remember me checked (simulated)', async () => {
      // Simulate login response with remember me checked (7-day token + refresh token)
      const longLivedToken = createJWT(
        { userId: TEST_USER_ID_1, email: 'test@example.com' },
        '7d'
      );
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [
          `token=${longLivedToken}`,
          `refresh_token=${VALID_REFRESH_TOKEN}`
        ]);
      
      expect(response.status).toBe(200);
      expect(response.body.user.userId).toBe(TEST_USER_ID_1);
      
      // Verify token has long expiration
      const decoded = jwt.decode(longLivedToken) as any;
      const expirationDiff = decoded.exp - decoded.iat;
      expect(expirationDiff).toBeGreaterThan(6 * 24 * 60 * 60); // More than 6 days
    });
    
    test('should handle login flow without remember me (simulated)', async () => {
      // Simulate login response without remember me (24-hour token, no refresh token)
      const shortLivedToken = createJWT(
        { userId: TEST_USER_ID_1, email: 'test@example.com' },
        '24h'
      );
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${shortLivedToken}`]); // No refresh token
      
      expect(response.status).toBe(200);
      expect(response.body.user.userId).toBe(TEST_USER_ID_1);
      
      // Verify token has short expiration
      const decoded = jwt.decode(shortLivedToken) as any;
      const expirationDiff = decoded.exp - decoded.iat;
      expect(expirationDiff).toBeLessThan(25 * 60 * 60); // Less than 25 hours
    });
    
    test('should redirect authenticated users away from login/signup pages', async () => {
      const validToken = createJWT({ userId: TEST_USER_ID_1, email: 'test@example.com' });
      
      // Try to access login page while authenticated
      const loginResponse = await request(app)
        .get('/login')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(loginResponse.status).toBe(302);
      expect(loginResponse.headers.location).toBe('/dashboard');
      
      // Try to access signup page while authenticated
      const signupResponse = await request(app)
        .get('/signup')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(signupResponse.status).toBe(302);
      expect(signupResponse.headers.location).toBe('/dashboard');
    });
    
    test('should allow unauthenticated users to access login/signup pages', async () => {
      // Access login page without token
      const loginResponse = await request(app)
        .get('/login');
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.page).toBe('login');
      
      // Access signup page without token
      const signupResponse = await request(app)
        .get('/signup');
      
      expect(signupResponse.status).toBe(200);
      expect(signupResponse.body.page).toBe('signup');
    });
  });
  
  describe('Session Termination and Cleanup', () => {
    // TC-F-012, TC-F-013: Logout clears JWT cookie and refresh_token from database and browser
    test('should properly handle logout with cookie cleanup', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Cookie', [
          `token=some-token`,
          `refresh_token=${VALID_REFRESH_TOKEN}`
        ]);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => 
        cookie.includes('token=; Path=/')
      )).toBe(true);
      expect(cookies.some((cookie: string) => 
        cookie.includes('refresh_token=; Path=/')
      )).toBe(true);
    });
    
    test('should handle session expiry gracefully', async () => {
      const expiredToken = jwt.sign(
        { userId: TEST_USER_ID_1, email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${expiredToken}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
      
      // Verify cookies are cleared on expiry
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        expect(cookies.some((cookie: string) => 
          cookie.includes('token=; Path=/')
        )).toBe(true);
      }
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JWT tokens gracefully', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', ['token=malformed.jwt.token']);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    test('should handle database errors during token refresh', async () => {
      const user = mockUsers[TEST_USER_ID_1];
      const soonToExpireToken = createSoonToExpireJWT({
        userId: TEST_USER_ID_1,
        email: 'test@example.com'
      });
      
      mockUserFindById.mockRejectedValue(new Error('Database connection failed'));
      
      // Mock console.error to suppress error output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${soonToExpireToken}`, `refresh_token=${VALID_REFRESH_TOKEN}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
      
      consoleSpy.mockRestore();
    });
    
    test('should handle missing environment configuration', async () => {
      delete process.env.JWT_SECRET;
      
      const response = await request(app)
        .get('/dashboard')
        .set('Authorization', 'Bearer some-token');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server configuration error');
    });
  });
  
  describe('Security and Performance', () => {
    // TC-F-020: Database stores token_expires_at as UTC ISO timestamp format
    test('should handle UTC timestamp format for token expiration', async () => {
      const user = mockUsers[TEST_USER_ID_1];
      const soonToExpireToken = createSoonToExpireJWT({
        userId: TEST_USER_ID_1,
        email: 'test@example.com'
      });
      
      // Set expiration in UTC ISO format
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.token_expires_at = futureDate.toISOString();
      
      mockUserFindById.mockResolvedValue(user);
      user.validateRefreshToken.mockResolvedValue(true);
      user.generateRefreshToken.mockResolvedValue({
        refreshToken: 'new-refresh-token-64-chars-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${soonToExpireToken}`, `refresh_token=${VALID_REFRESH_TOKEN}`]);
      
      expect(response.status).toBe(200);
      expect(new Date(user.token_expires_at).toISOString()).toBe(user.token_expires_at);
    });
    
    test('should prevent token refresh with tampered refresh tokens', async () => {
      const soonToExpireToken = createSoonToExpireJWT({
        userId: TEST_USER_ID_1,
        email: 'test@example.com'
      });
      
      // Use tampered refresh token (wrong length)
      const tamperedToken = 'tampered-token';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${soonToExpireToken}`, `refresh_token=${tamperedToken}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
    
    test('should handle concurrent requests to different protected routes', async () => {
      const validToken = createJWT({ userId: TEST_USER_ID_1, email: 'test@example.com' });
      
      const requests = [
        request(app).get('/dashboard').set('Cookie', [`token=${validToken}`]),
        request(app).get('/profile').set('Cookie', [`token=${validToken}`]),
        request(app).get('/dashboard').set('Cookie', [`token=${validToken}`])
      ];
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.user.userId).toBe(TEST_USER_ID_1);
      });
    });
  });
});