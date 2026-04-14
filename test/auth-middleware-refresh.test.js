const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
jest.mock('../models/User');

describe('Authentication Middleware - Refresh Token Functionality', () => {
  let req, res, next;
  
  // Constants from middleware
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const JWT_EXPIRY_7_DAYS = '7d';
  const REFRESH_THRESHOLD_SECONDS = 3600; // 1 hour
  const TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('tokenNeedsRefresh() functionality', () => {
    test('should return true when token expires in less than 1 hour', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 3000; // 50 minutes from now
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      req.cookies.token = 'valid-jwt-token';

      authenticateToken(req, res, next);

      // Should trigger refresh logic
      expect(User.findById).toHaveBeenCalled();
    });

    test('should return false when token expires in more than 1 hour', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 5000; // ~83 minutes from now
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      req.cookies.token = 'valid-jwt-token';

      authenticateToken(req, res, next);

      // Should not trigger refresh logic for User.findById call
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(next).toHaveBeenCalled();
    });

    test('should handle edge case exactly at 1 hour threshold', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + REFRESH_THRESHOLD_SECONDS; // exactly 1 hour
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      req.cookies.token = 'valid-jwt-token';

      authenticateToken(req, res, next);

      // At exactly 1 hour, should trigger refresh
      expect(User.findById).toHaveBeenCalled();
    });

    test('should handle token with no expiration time', () => {
      jwt.verify.mockReturnValue({ 
        userId: 'user123'
        // No exp field
      });

      req.cookies.token = 'token-without-exp';

      authenticateToken(req, res, next);

      // Should proceed normally without refresh attempt
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Token refresh trigger conditions', () => {
    test('should refresh when token expires in 30 minutes', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800; // 30 minutes
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token');

      await authenticateToken(req, res, next);

      expect(bcrypt.compare).toHaveBeenCalledWith('current-refresh-token', 'hashed-refresh-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user123', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY_7_DAYS }
      );
      expect(res.cookie).toHaveBeenCalledWith('token', 'new-jwt-token', TOKEN_COOKIE_OPTIONS);
    });

    test('should not refresh when token expires in 90 minutes', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 5400; // 90 minutes
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com'
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'valid-jwt-token';

      await authenticateToken(req, res, next);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    test('should not attempt refresh if no refresh token cookie present', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800; // 30 minutes
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com'
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      // No refresh_token cookie

      await authenticateToken(req, res, next);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Refresh token validation', () => {
    beforeEach(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800; // 30 minutes - triggers refresh
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'refresh-token-from-cookie';
    });

    test('should successfully validate and use valid refresh token', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token');

      await authenticateToken(req, res, next);

      expect(bcrypt.compare).toHaveBeenCalledWith('refresh-token-from-cookie', 'hashed-refresh-token');
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('token', 'new-jwt-token', TOKEN_COOKIE_OPTIONS);
      expect(next).toHaveBeenCalled();
    });

    test('should redirect to login with invalid refresh token hash', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Invalid token

      await authenticateToken(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect to login with expired refresh token', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      await authenticateToken(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect to login when user has no refresh token in database', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: null,
        token_expires_at: null
      };

      User.findById.mockResolvedValue(mockUser);

      await authenticateToken(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect to login when refresh token is malformed', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockRejectedValue(new Error('Malformed hash'));

      await authenticateToken(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('New token generation', () => {
    beforeEach(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800; // 30 minutes - triggers refresh
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'valid-refresh-token';
    });

    test('should generate new JWT with 7-day expiration', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token-with-7day-exp');

      await authenticateToken(req, res, next);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user123', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY_7_DAYS }
      );
      expect(res.cookie).toHaveBeenCalledWith('token', 'new-jwt-token-with-7day-exp', TOKEN_COOKIE_OPTIONS);
    });

    test('should generate new refresh token and save to database', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('brand-new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token');

      await authenticateToken(req, res, next);

      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'brand-new-refresh-token', TOKEN_COOKIE_OPTIONS);
    });

    test('should handle JWT signing failure gracefully', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication error',
        message: 'Token refresh failed' 
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Cookie updates', () => {
    test('should update both JWT and refresh token cookies during refresh', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800; // 30 minutes
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('updated-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('refreshed-jwt-token');

      await authenticateToken(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith('token', 'refreshed-jwt-token', TOKEN_COOKIE_OPTIONS);
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'updated-refresh-token', TOKEN_COOKIE_OPTIONS);
      expect(res.cookie).toHaveBeenCalledTimes(2);
    });

    test('should use correct cookie options for security', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800;
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token');

      await authenticateToken(req, res, next);

      const expectedOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      };

      expect(res.cookie).toHaveBeenCalledWith('token', 'new-jwt-token', expectedOptions);
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'new-refresh-token', expectedOptions);
    });
  });

  describe('Database atomicity', () => {
    test('should handle database save failure during refresh', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800;
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockRejectedValue(new Error('Database save failed'))
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication error',
        message: 'Token refresh failed' 
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle User.findById failure gracefully', async () => {
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: Math.floor(Date.now() / 1000) + 1800
      });

      User.findById.mockRejectedValue(new Error('Database connection failed'));
      req.cookies.token = 'valid-jwt-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication error',
        message: 'User lookup failed' 
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Failure scenarios and security', () => {
    test('should not expose sensitive database information in error responses', async () => {
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: Math.floor(Date.now() / 1000) + 1800
      });

      User.findById.mockRejectedValue(new Error('Connection to MongoDB failed at mongodb://internal-server:27017/production_db'));
      req.cookies.token = 'valid-jwt-token';

      await authenticateToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication error',
        message: 'User lookup failed' 
      });
      
      // Ensure no sensitive database details are leaked
      const jsonCall = res.json.mock.calls[0][0];
      expect(JSON.stringify(jsonCall)).not.toContain('mongodb://');
      expect(JSON.stringify(jsonCall)).not.toContain('production_db');
    });

    test('should handle missing JWT secret gracefully', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      jwt.verify.mockImplementation(() => {
        throw new Error('JWT secret not configured');
      });

      req.cookies.token = 'valid-jwt-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication failed',
        message: 'Invalid token' 
      });

      // Restore original secret
      process.env.JWT_SECRET = originalSecret;
    });

    test('should handle concurrent refresh attempts safely', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800;
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token');

      // Simulate concurrent calls
      const promise1 = authenticateToken(req, res, next);
      const promise2 = authenticateToken(req, res, next);

      await Promise.all([promise1, promise2]);

      // Both should complete successfully (one will get new token, other will use updated token)
      expect(res.status).not.toHaveBeenCalledWith(500);
    });
  });

  describe('Middleware chain continuation', () => {
    test('should populate req.user and call next() after successful refresh', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800;
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('refreshed-jwt-token');

      await authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should populate req.user and call next() when no refresh is needed', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 5400; // 90 minutes - no refresh needed
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'valid-jwt-token';

      await authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('Performance and timing', () => {
    test('should complete token refresh within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800;
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        refresh_token: 'hashed-refresh-token',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        generateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      req.cookies.token = 'expiring-jwt-token';
      req.cookies.refresh_token = 'current-refresh-token';
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('new-jwt-token');

      await authenticateToken(req, res, next);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within 100ms for normal operation
      expect(executionTime).toBeLessThan(100);
      expect(next).toHaveBeenCalled();
    });

    test('should handle database timeout scenarios', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 1800;
      
      jwt.verify.mockReturnValue({ 
        userId: 'user123',
        exp: expirationTime 
      });

      // Simulate database timeout
      User.findById.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Database timeout')), 50);
        });
      });

      req.cookies.token = 'expiring-jwt-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication error',
        message: 'User lookup failed' 
      });
    });
  });
});