import jwt from 'jsonwebtoken';

// Mock User model
const mockUser = {
  _id: '64f8b1234567890123456789',
  email: 'test@example.com',
  validateRefreshToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
  token_expires_at: null
};

const mockUserFindById = jest.fn();
jest.mock('../models/User', () => ({
  findById: mockUserFindById
}));

// Import the functions to test (simulate importing from auth.js)
const { refreshUserToken, tokenNeedsRefresh } = require('../middleware/auth');

describe('Token Management Functions', () => {
  const JWT_SECRET = 'test-jwt-secret';
  const TEST_USER_ID = '64f8b1234567890123456789';
  const TEST_EMAIL = 'test@example.com';
  const VALID_REFRESH_TOKEN = 'a'.repeat(64);
  
  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    jest.clearAllMocks();
    mockUser.token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  });
  
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });
  
  describe('tokenNeedsRefresh function', () => {
    // TC-F-008: Token auto-refresh triggers when JWT has less than 1 hour remaining before expiry
    test('should return true when token expires in less than 1 hour', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const decodedToken = {
        exp: currentTime + 1800, // 30 minutes from now
        userId: TEST_USER_ID,
        email: TEST_EMAIL
      };
      
      // Access the function through the module (testing internal logic)
      const needsRefresh = tokenNeedsRefresh(decodedToken);
      expect(needsRefresh).toBe(true);
    });
    
    test('should return false when token expires in more than 1 hour', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const decodedToken = {
        exp: currentTime + 7200, // 2 hours from now
        userId: TEST_USER_ID,
        email: TEST_EMAIL
      };
      
      const needsRefresh = tokenNeedsRefresh(decodedToken);
      expect(needsRefresh).toBe(false);
    });
    
    test('should return false when token has no exp field', () => {
      const decodedToken = {
        userId: TEST_USER_ID,
        email: TEST_EMAIL
      };
      
      const needsRefresh = tokenNeedsRefresh(decodedToken);
      expect(needsRefresh).toBe(false);
    });
    
    test('should return false when token is null or undefined', () => {
      expect(tokenNeedsRefresh(null)).toBe(false);
      expect(tokenNeedsRefresh(undefined)).toBe(false);
    });
  });
  
  describe('refreshUserToken function', () => {
    let mockReq: any;
    let mockRes: any;
    
    beforeEach(() => {
      mockReq = {};
      mockRes = {
        cookie: jest.fn()
      };
    });
    
    // TC-F-005: Refresh token is 64-character random hex string stored hashed with bcrypt
    test('should return null when refresh token is not 64 characters', async () => {
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, 'short-token');
      expect(result).toBeNull();
    });
    
    test('should return null when refresh token is not a string', async () => {
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, 123 as any);
      expect(result).toBeNull();
    });
    
    // TC-F-024: Authentication middleware validates refresh tokens before attempting refresh
    test('should return null when userId or refreshToken is missing', async () => {
      expect(await refreshUserToken(mockReq, mockRes, null, VALID_REFRESH_TOKEN)).toBeNull();
      expect(await refreshUserToken(mockReq, mockRes, TEST_USER_ID, null)).toBeNull();
      expect(await refreshUserToken(mockReq, mockRes, '', VALID_REFRESH_TOKEN)).toBeNull();
    });
    
    test('should return null when user is not found', async () => {
      mockUserFindById.mockResolvedValue(null);
      
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      expect(result).toBeNull();
      expect(mockUserFindById).toHaveBeenCalledWith(TEST_USER_ID);
    });
    
    // TC-F-021: Refresh token validation checks both hash match and expiration time
    test('should return null when refresh token validation fails', async () => {
      mockUserFindById.mockResolvedValue(mockUser);
      mockUser.validateRefreshToken.mockResolvedValue(false);
      
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      expect(result).toBeNull();
      expect(mockUser.validateRefreshToken).toHaveBeenCalledWith(VALID_REFRESH_TOKEN);
    });
    
    // TC-F-016: Refresh token expires after 7 days and cannot be used for token renewal
    test('should return null and clear token when refresh token is expired', async () => {
      mockUser.token_expires_at = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      
      mockUserFindById.mockResolvedValue(mockUser);
      mockUser.validateRefreshToken.mockResolvedValue(true);
      mockUser.clearRefreshToken.mockResolvedValue(undefined);
      
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      expect(result).toBeNull();
      expect(mockUser.clearRefreshToken).toHaveBeenCalled();
    });
    
    test('should return null when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;
      
      mockUserFindById.mockResolvedValue(mockUser);
      mockUser.validateRefreshToken.mockResolvedValue(true);
      
      // Mock console.error to suppress error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('JWT_SECRET environment variable is not set');
      
      consoleSpy.mockRestore();
    });
    
    // TC-F-009, TC-F-025: Auto-refresh generates new JWT with 7-day expiration and new refresh token, atomic operation
    test('should successfully refresh token and return user data', async () => {
      mockUserFindById.mockResolvedValue(mockUser);
      mockUser.validateRefreshToken.mockResolvedValue(true);
      mockUser.generateRefreshToken.mockResolvedValue({
        refreshToken: 'new-refresh-token-64-chars-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      
      expect(result).toEqual({
        userId: TEST_USER_ID,
        email: TEST_EMAIL
      });
      
      // Verify new cookies are set
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'token',
        expect.any(String),
        {
          httpOnly: true,
          secure: false, // NODE_ENV is not 'production' in tests
          sameSite: 'strict'
        }
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token-64-chars-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict'
        }
      );
      
      // Verify new JWT has 7-day expiration
      const tokenCall = mockRes.cookie.mock.calls.find(call => call[0] === 'token');
      const newToken = tokenCall[1];
      const decoded = jwt.verify(newToken, JWT_SECRET) as any;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      expect(decoded.exp - decoded.iat).toBeCloseTo(sevenDaysInSeconds, -2); // Allow 100s tolerance
    });
    
    test('should handle token generation errors gracefully', async () => {
      mockUserFindById.mockResolvedValue(mockUser);
      mockUser.validateRefreshToken.mockResolvedValue(true);
      mockUser.generateRefreshToken.mockRejectedValue(new Error('Database error'));
      
      // Mock console.error to suppress error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Token refresh error:', 'Database error');
      
      consoleSpy.mockRestore();
    });
    
    // TC-F-017: Concurrent requests during token refresh handle race conditions gracefully
    test('should handle concurrent refresh operations with mutex', async () => {
      mockUserFindById.mockResolvedValue(mockUser);
      mockUser.validateRefreshToken.mockResolvedValue(true);
      mockUser.generateRefreshToken.mockResolvedValue({
        refreshToken: 'new-refresh-token-64-chars-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      
      // Start first refresh operation
      const firstRefresh = refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      
      // Immediately start second refresh operation for same user
      const secondRefresh = refreshUserToken(mockReq, mockRes, TEST_USER_ID, VALID_REFRESH_TOKEN);
      
      const [firstResult, secondResult] = await Promise.all([firstRefresh, secondRefresh]);
      
      // First operation should succeed, second should return null due to mutex
      expect(firstResult).not.toBeNull();
      expect(secondResult).toBeNull();
    });
  });
  
  describe('Cookie Security Configuration', () => {
    test('should use secure cookies in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Re-require the module to pick up new environment
      delete require.cache[require.resolve('../middleware/auth')];
      const { COOKIE_OPTIONS_SECURE } = require('../middleware/auth');
      
      expect(COOKIE_OPTIONS_SECURE.secure).toBe(true);
      expect(COOKIE_OPTIONS_SECURE.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS_SECURE.sameSite).toBe('strict');
      
      process.env.NODE_ENV = originalEnv;
    });
    
    test('should not use secure cookies in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Re-require the module to pick up new environment
      delete require.cache[require.resolve('../middleware/auth')];
      const { COOKIE_OPTIONS_SECURE } = require('../middleware/auth');
      
      expect(COOKIE_OPTIONS_SECURE.secure).toBe(false);
      expect(COOKIE_OPTIONS_SECURE.httpOnly).toBe(true);
      expect(COOKIE_OPTIONS_SECURE.sameSite).toBe('strict');
      
      process.env.NODE_ENV = originalEnv;
    });
  });
  
  describe('Constants and Configuration', () => {
    test('should have correct token refresh threshold', () => {
      // Re-require to access constants
      delete require.cache[require.resolve('../middleware/auth')];
      const { TOKEN_REFRESH_THRESHOLD_SECONDS } = require('../middleware/auth');
      
      expect(TOKEN_REFRESH_THRESHOLD_SECONDS).toBe(3600); // 1 hour
    });
    
    test('should have correct JWT expiry configuration', () => {
      delete require.cache[require.resolve('../middleware/auth')];
      const { JWT_EXPIRY_DAYS } = require('../middleware/auth');
      
      expect(JWT_EXPIRY_DAYS).toBe(7); // 7 days
    });
  });
});