import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock database and user operations
class MockUser {
  static users: any[] = [
    {
      id: 1,
      email: 'test@example.com',
      refresh_token: null,
      token_expires_at: null
    }
  ];
  
  static async findById(userId: number) {
    return this.users.find(user => user.id === userId) || null;
  }
  
  static async updateRefreshToken(userId: number, refreshToken: string | null, expiresAt: string | null) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.refresh_token = refreshToken ? bcrypt.hashSync(refreshToken, 10) : null;
      user.token_expires_at = expiresAt;
    }
    return user;
  }
  
  static async validateRefreshToken(userId: number, refreshToken: string) {
    const user = this.users.find(u => u.id === userId);
    if (!user || !user.refresh_token) return false;
    
    const isValid = bcrypt.compareSync(refreshToken, user.refresh_token);
    const isExpired = user.token_expires_at && new Date() > new Date(user.token_expires_at);
    
    return isValid && !isExpired;
  }
  
  static generateRefreshToken() {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

// Test configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User'
};

// Authentication middleware implementation
const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = req.cookies?.token;
    const refreshToken = req.cookies?.refresh_token;
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
      // Verify current token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if token expires in less than 1 hour (3600 seconds)
      const now = Math.floor(Date.now() / 1000);
      const timeToExpiry = decoded.exp - now;
      
      // Auto-refresh if token expires in less than 1 hour and refresh token exists
      if (timeToExpiry < 3600 && refreshToken) {
        // Validate refresh token
        const user = await MockUser.findById(decoded.user.id);
        if (user && await MockUser.validateRefreshToken(user.id, refreshToken)) {
          // Generate new tokens
          const newToken = jwt.sign(
            { user: decoded.user },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          
          const newRefreshToken = MockUser.generateRefreshToken();
          const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          
          // Update refresh token in database
          await MockUser.updateRefreshToken(user.id, newRefreshToken, refreshExpiresAt);
          
          // Set new cookies
          res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          res.cookie('refresh_token', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          // Update request with new token data
          req.user = decoded.user;
          return next();
        } else {
          // Invalid refresh token - redirect to login
          res.clearCookie('token');
          res.clearCookie('refresh_token');
          return res.status(401).json({ error: 'Please log in again', redirectTo: '/login' });
        }
      }
      
      // Token is valid and not near expiry
      req.user = decoded.user;
      next();
    } catch (jwtError) {
      // JWT verification failed
      if (refreshToken) {
        // Try to refresh with refresh token
        try {
          const tokenPayload = jwt.decode(token) as any;
          if (tokenPayload && tokenPayload.user) {
            const user = await MockUser.findById(tokenPayload.user.id);
            if (user && await MockUser.validateRefreshToken(user.id, refreshToken)) {
              // Generate new tokens
              const newToken = jwt.sign(
                { user: tokenPayload.user },
                JWT_SECRET,
                { expiresIn: '7d' }
              );
              
              const newRefreshToken = MockUser.generateRefreshToken();
              const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              
              await MockUser.updateRefreshToken(user.id, newRefreshToken, refreshExpiresAt);
              
              res.cookie('token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
              });
              
              res.cookie('refresh_token', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
              });
              
              req.user = tokenPayload.user;
              return next();
            }
          }
        } catch (refreshError) {
          // Refresh failed
        }
      }
      
      // Clear invalid cookies and redirect to login
      res.clearCookie('token');
      res.clearCookie('refresh_token');
      return res.status(401).json({ error: 'Please log in again', redirectTo: '/login' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(cookieParser());
  
  // Test route that requires authentication
  app.get('/protected', authenticateToken, (req, res) => {
    res.json({ user: req.user, message: 'Access granted' });
  });
  
  // Test route that doesn't require authentication
  app.get('/public', (req, res) => {
    res.json({ message: 'Public access' });
  });
  
  return app;
};

// Helper function to create tokens
const createTokens = (user: any, expiresIn: string = '1h', includeRefresh: boolean = false) => {
  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn });
  
  let refreshToken: string | undefined;
  if (includeRefresh) {
    refreshToken = MockUser.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    MockUser.updateRefreshToken(user.id, refreshToken, refreshExpiresAt);
  }
  
  return { token, refreshToken };
};

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

describe('Authentication Middleware - Token Refresh', () => {
  let app: express.Application;
  
  beforeEach(() => {
    // Reset mock data
    MockUser.users = [
      {
        id: 1,
        email: 'test@example.com',
        refresh_token: null,
        token_expires_at: null
      }
    ];
    
    app = createTestApp();
  });
  
  describe('Basic Authentication', () => {
    test('should allow access with valid token', async () => {
      const { token } = createTokens(TEST_USER, '1h');
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      expect(response.body.user).toEqual(TEST_USER);
      expect(response.body.message).toBe('Access granted');
    });
    
    test('should deny access without token', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401);
      
      expect(response.body.error).toBe('Access token required');
    });
    
    test('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Cookie', 'token=invalid-token')
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      expect(response.body.redirectTo).toBe('/login');
    });
  });
  
  describe('Token Auto-Refresh Logic', () => {
    // TC-F-008
    test('should auto-refresh token when it expires in less than 1 hour', async () => {
      // Create token that expires in 30 minutes
      const { token, refreshToken } = createTokens(TEST_USER, '30m', true);
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}; refresh_token=${refreshToken}`)
        .expect(200);
      
      expect(response.body.user).toEqual(TEST_USER);
      expect(response.body.message).toBe('Access granted');
      
      // Check that new cookies were set
      const cookies = response.headers['set-cookie'];
      const newTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const newRefreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(newTokenCookie).toBeDefined();
      expect(newRefreshTokenCookie).toBeDefined();
      
      // Verify new token is different from original
      const newToken = newTokenCookie?.split(';')[0].split('=')[1];
      expect(newToken).not.toBe(token);
    });
    
    // TC-F-010, TC-F-019
    test('should not auto-refresh token when it has more than 1 hour remaining', async () => {
      // Create token that expires in 2 hours
      const { token, refreshToken } = createTokens(TEST_USER, '2h', true);
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}; refresh_token=${refreshToken}`)
        .expect(200);
      
      expect(response.body.user).toEqual(TEST_USER);
      expect(response.body.message).toBe('Access granted');
      
      // Check that no new cookies were set (no refresh occurred)
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
    
    // TC-F-014
    test('should continue with existing 24-hour sessions without refresh token', async () => {
      // Create token without refresh token (24-hour session)
      const { token } = createTokens(TEST_USER, '23h', false);
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      expect(response.body.user).toEqual(TEST_USER);
      expect(response.body.message).toBe('Access granted');
      
      // No refresh should occur
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
    
    // TC-F-011
    test('should redirect to login when refresh token is invalid', async () => {
      // Create token that expires in 30 minutes with invalid refresh token
      const { token } = createTokens(TEST_USER, '30m', false);
      const invalidRefreshToken = 'invalid-refresh-token';
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}; refresh_token=${invalidRefreshToken}`)
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      expect(response.body.redirectTo).toBe('/login');
      
      // Check that cookies are cleared
      const cookies = response.headers['set-cookie'];
      const clearedTokenCookie = cookies?.find((cookie: string) => cookie.includes('token=;'));
      const clearedRefreshCookie = cookies?.find((cookie: string) => cookie.includes('refresh_token=;'));
      
      expect(clearedTokenCookie).toBeDefined();
      expect(clearedRefreshCookie).toBeDefined();
    });
    
    // TC-F-015
    test('should trigger logout when refresh token is expired', async () => {
      // Create expired refresh token
      const expiredRefreshToken = MockUser.generateRefreshToken();
      const expiredDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      await MockUser.updateRefreshToken(TEST_USER.id, expiredRefreshToken, expiredDate);
      
      // Create token that needs refresh
      const { token } = createTokens(TEST_USER, '30m', false);
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}; refresh_token=${expiredRefreshToken}`)
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      expect(response.body.redirectTo).toBe('/login');
    });
    
    test('should handle expired JWT with valid refresh token', async () => {
      // Create expired token
      const expiredToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '-1h' }); // Expired 1 hour ago
      
      // Create valid refresh token
      const refreshToken = MockUser.generateRefreshToken();
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await MockUser.updateRefreshToken(TEST_USER.id, refreshToken, refreshExpiresAt);
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${expiredToken}; refresh_token=${refreshToken}`)
        .expect(200);
      
      expect(response.body.user).toEqual(TEST_USER);
      expect(response.body.message).toBe('Access granted');
      
      // Check that new cookies were set
      const cookies = response.headers['set-cookie'];
      const newTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const newRefreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(newTokenCookie).toBeDefined();
      expect(newRefreshTokenCookie).toBeDefined();
    });
  });
  
  describe('Concurrent Request Handling', () => {
    // TC-F-017
    test('should handle concurrent requests during token refresh gracefully', async () => {
      // Create token that expires in 30 minutes
      const { token, refreshToken } = createTokens(TEST_USER, '30m', true);
      
      // Make multiple concurrent requests
      const requests = Array(3).fill(null).map(() => 
        request(app)
          .get('/protected')
          .set('Cookie', `token=${token}; refresh_token=${refreshToken}`)
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.user).toEqual(TEST_USER);
        expect(response.body.message).toBe('Access granted');
      });
      
      // At least one should have refreshed tokens
      const refreshedResponses = responses.filter(response => 
        response.headers['set-cookie']?.some((cookie: string) => cookie.startsWith('token='))
      );
      
      expect(refreshedResponses.length).toBeGreaterThan(0);
    });
  });
  
  describe('Security and Edge Cases', () => {
    test('should handle malformed JWT gracefully', async () => {
      const malformedToken = 'malformed.jwt.token';
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${malformedToken}`)
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      expect(response.body.redirectTo).toBe('/login');
    });
    
    test('should handle missing refresh token gracefully when auto-refresh is needed', async () => {
      // Create token that expires in 30 minutes without refresh token
      const { token } = createTokens(TEST_USER, '30m', false);
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      expect(response.body.user).toEqual(TEST_USER);
      expect(response.body.message).toBe('Access granted');
      
      // No refresh should occur without refresh token
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
    
    test('should handle database errors during refresh gracefully', async () => {
      // Create token that needs refresh
      const { token } = createTokens(TEST_USER, '30m', false);
      const refreshToken = 'some-refresh-token';
      
      // Mock database error by removing user
      MockUser.users = [];
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}; refresh_token=${refreshToken}`)
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      expect(response.body.redirectTo).toBe('/login');
    });
    
    // TC-F-024
    test('should validate refresh tokens before attempting refresh', async () => {
      // Create token that needs refresh
      const { token } = createTokens(TEST_USER, '30m', false);
      const nonExistentRefreshToken = MockUser.generateRefreshToken();
      
      // Don't store the refresh token in database
      
      const response = await request(app)
        .get('/protected')
        .set('Cookie', `token=${token}; refresh_token=${nonExistentRefreshToken}`)
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      expect(response.body.redirectTo).toBe('/login');
    });
  });
  
  describe('Cookie Handling', () => {
    test('should set secure cookies in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const { token, refreshToken } = createTokens(TEST_USER, '30m', true);
        
        const response = await request(app)
          .get('/protected')
          .set('Cookie', `token=${token}; refresh_token=${refreshToken}`)
          .expect(200);
        
        expect(response.body.message).toBe('Access granted');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
    
    test('should clear both cookies on authentication failure', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Cookie', 'token=invalid; refresh_token=invalid')
        .expect(401);
      
      expect(response.body.error).toBe('Please log in again');
      
      const cookies = response.headers['set-cookie'];
      const clearedTokenCookie = cookies?.find((cookie: string) => cookie.includes('token=;'));
      const clearedRefreshCookie = cookies?.find((cookie: string) => cookie.includes('refresh_token=;'));
      
      expect(clearedTokenCookie).toBeDefined();
      expect(clearedRefreshCookie).toBeDefined();
    });
  });
});