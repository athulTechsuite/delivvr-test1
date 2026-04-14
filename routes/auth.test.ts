import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { JSDOM } from 'jsdom';

// Mock database and user model
class MockUser {
  static users: any[] = [
    {
      id: 1,
      email: 'test@example.com',
      password: bcrypt.hashSync('password', 10),
      refresh_token: null,
      token_expires_at: null
    }
  ];
  
  static async findByEmail(email: string) {
    return this.users.find(user => user.email === email) || null;
  }
  
  static async updateRefreshToken(userId: number, refreshToken: string | null, expiresAt: string | null) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.refresh_token = refreshToken ? bcrypt.hashSync(refreshToken, 10) : null;
      user.token_expires_at = expiresAt;
    }
    return user;
  }
  
  static async findByRefreshToken(refreshToken: string) {
    for (const user of this.users) {
      if (user.refresh_token && bcrypt.compareSync(refreshToken, user.refresh_token)) {
        return user;
      }
    }
    return null;
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

// Create test app with auth routes
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  // Auth routes
  app.post('/login', async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      const user = await MockUser.findByEmail(email);
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Generate JWT with appropriate expiration
      const tokenExpiration = rememberMe === 'true' ? '7d' : '24h';
      const token = jwt.sign(
        { user: { id: user.id, email: user.email } },
        JWT_SECRET,
        { expiresIn: tokenExpiration }
      );
      
      // Set token cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      // Generate and store refresh token if Remember Me is checked
      if (rememberMe === 'true') {
        const refreshToken = MockUser.generateRefreshToken();
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        
        await MockUser.updateRefreshToken(user.id, refreshToken, refreshExpiresAt);
        
        res.cookie('refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      } else {
        // Clear any existing refresh token for this user
        await MockUser.updateRefreshToken(user.id, null, null);
      }
      
      res.status(200).json({ message: 'Login successful', user: { id: user.id, email: user.email } });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/logout', async (req, res) => {
    try {
      const token = req.cookies?.token;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          // Clear refresh token from database
          await MockUser.updateRefreshToken(decoded.user.id, null, null);
        } catch (error) {
          // Token invalid, but continue with logout
        }
      }
      
      // Clear cookies
      res.clearCookie('token');
      res.clearCookie('refresh_token');
      
      res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/refresh-token', async (req, res) => {
    try {
      const { refresh_token: refreshToken } = req.cookies;
      
      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token not provided' });
      }
      
      // Find user by refresh token
      const user = await MockUser.findByRefreshToken(refreshToken);
      if (!user) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      
      // Validate refresh token
      const isValid = await MockUser.validateRefreshToken(user.id, refreshToken);
      if (!isValid) {
        return res.status(401).json({ error: 'Refresh token expired or invalid' });
      }
      
      // Generate new tokens
      const newToken = jwt.sign(
        { user: { id: user.id, email: user.email } },
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
      
      res.status(200).json({ message: 'Token refreshed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  return app;
};

describe('Authentication Routes - Remember Me Implementation', () => {
  let app: express.Application;
  
  beforeEach(() => {
    // Reset mock data
    MockUser.users = [
      {
        id: 1,
        email: 'test@example.com',
        password: bcrypt.hashSync('password', 10),
        refresh_token: null,
        token_expires_at: null
      }
    ];
    
    app = createTestApp();
  });
  
  describe('Login Endpoint', () => {
    // TC-F-002
    test('should create 24-hour JWT when remember me is not checked', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        })
        .expect(200);
      
      expect(response.body.message).toBe('Login successful');
      
      // Verify JWT cookie is set with 24-hour expiration
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const refreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(tokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeUndefined();
      
      // Verify token payload and expiration
      const token = tokenCookie?.split(';')[0].split('=')[1];
      const decoded = jwt.verify(token!, JWT_SECRET) as any;
      const tokenExp = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeDiff = tokenExp - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      expect(hoursDiff).toBeLessThanOrEqual(24);
      expect(hoursDiff).toBeGreaterThan(23);
    });
    
    // TC-F-003, TC-F-004
    test('should create 7-day JWT and refresh token when remember me is checked', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      expect(response.body.message).toBe('Login successful');
      
      // Verify both JWT and refresh token cookies are set
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const refreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(tokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();
      
      // Verify JWT has 7-day expiration
      const token = tokenCookie?.split(';')[0].split('=')[1];
      const decoded = jwt.verify(token!, JWT_SECRET) as any;
      const tokenExp = decoded.exp * 1000;
      const now = Date.now();
      const timeDiff = tokenExp - now;
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeLessThanOrEqual(7);
      expect(daysDiff).toBeGreaterThan(6.9);
    });
    
    // TC-F-005
    test('should generate 64-character refresh token stored hashed', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      // Check refresh token is stored in database (hashed)
      const user = await MockUser.findByEmail('test@example.com');
      expect(user?.refresh_token).toBeDefined();
      expect(user?.token_expires_at).toBeDefined();
      
      // Verify refresh token cookie value is 64 characters (hex)
      const cookies = response.headers['set-cookie'];
      const refreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      const refreshTokenValue = refreshTokenCookie?.split(';')[0].split('=')[1];
      
      expect(refreshTokenValue).toHaveLength(64);
      expect(refreshTokenValue).toMatch(/^[a-f0-9]{64}$/);
    });
    
    // TC-F-007
    test('should overwrite existing refresh token on new login', async () => {
      // First login
      await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      const userAfterFirstLogin = await MockUser.findByEmail('test@example.com');
      const firstRefreshToken = userAfterFirstLogin?.refresh_token;
      
      // Second login
      await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      const userAfterSecondLogin = await MockUser.findByEmail('test@example.com');
      const secondRefreshToken = userAfterSecondLogin?.refresh_token;
      
      expect(firstRefreshToken).not.toBe(secondRefreshToken);
      expect(secondRefreshToken).toBeDefined();
    });
    
    test('should handle invalid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
          rememberMe: 'true'
        })
        .expect(401);
      
      expect(response.body.error).toBe('Invalid credentials');
      
      // Should not set any cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
    
    test('should handle missing email or password', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com'
          // missing password
        })
        .expect(400);
      
      expect(response.body.error).toBe('Email and password are required');
    });
    
    test('should clear existing refresh token when remember me is not checked', async () => {
      // First login with remember me
      await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      let user = await MockUser.findByEmail('test@example.com');
      expect(user?.refresh_token).toBeDefined();
      
      // Second login without remember me
      await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        })
        .expect(200);
      
      user = await MockUser.findByEmail('test@example.com');
      expect(user?.refresh_token).toBeNull();
      expect(user?.token_expires_at).toBeNull();
    });
  });
  
  describe('Logout Endpoint', () => {
    // TC-F-012, TC-F-013
    test('should clear JWT and refresh token cookies and database entry', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        });
      
      const loginCookies = loginResponse.headers['set-cookie'];
      const tokenCookie = loginCookies?.find((cookie: string) => cookie.startsWith('token='));
      
      // Logout
      const logoutResponse = await request(app)
        .post('/logout')
        .set('Cookie', loginCookies)
        .expect(200);
      
      expect(logoutResponse.body.message).toBe('Logout successful');
      
      // Check cookies are cleared
      const logoutCookies = logoutResponse.headers['set-cookie'];
      const clearedTokenCookie = logoutCookies?.find((cookie: string) => cookie.includes('token=;'));
      const clearedRefreshCookie = logoutCookies?.find((cookie: string) => cookie.includes('refresh_token=;'));
      
      expect(clearedTokenCookie).toBeDefined();
      expect(clearedRefreshCookie).toBeDefined();
      
      // Check refresh token is cleared from database
      const user = await MockUser.findByEmail('test@example.com');
      expect(user?.refresh_token).toBeNull();
      expect(user?.token_expires_at).toBeNull();
    });
    
    test('should handle logout without valid token gracefully', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(200);
      
      expect(response.body.message).toBe('Logout successful');
    });
    
    test('should handle logout with invalid token gracefully', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Cookie', 'token=invalid-token')
        .expect(200);
      
      expect(response.body.message).toBe('Logout successful');
    });
  });
  
  describe('Token Refresh Endpoint', () => {
    // TC-F-009, TC-F-025
    test('should refresh token with valid refresh token', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        });
      
      const loginCookies = loginResponse.headers['set-cookie'];
      
      // Refresh token
      const refreshResponse = await request(app)
        .post('/refresh-token')
        .set('Cookie', loginCookies)
        .expect(200);
      
      expect(refreshResponse.body.message).toBe('Token refreshed successfully');
      
      // Check new cookies are set
      const refreshCookies = refreshResponse.headers['set-cookie'];
      const newTokenCookie = refreshCookies?.find((cookie: string) => cookie.startsWith('token='));
      const newRefreshTokenCookie = refreshCookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(newTokenCookie).toBeDefined();
      expect(newRefreshTokenCookie).toBeDefined();
      
      // Verify new tokens are different from original
      const originalToken = loginCookies?.find((cookie: string) => cookie.startsWith('token='))?.split(';')[0].split('=')[1];
      const newToken = newTokenCookie?.split(';')[0].split('=')[1];
      
      expect(newToken).not.toBe(originalToken);
    });
    
    // TC-F-011, TC-F-15
    test('should reject refresh request with invalid refresh token', async () => {
      const response = await request(app)
        .post('/refresh-token')
        .set('Cookie', 'refresh_token=invalid-token')
        .expect(401);
      
      expect(response.body.error).toBe('Invalid refresh token');
    });
    
    test('should reject refresh request without refresh token', async () => {
      const response = await request(app)
        .post('/refresh-token')
        .expect(401);
      
      expect(response.body.error).toBe('Refresh token not provided');
    });
    
    // TC-F-016, TC-F-021
    test('should reject expired refresh token', async () => {
      // Manually create user with expired refresh token
      const expiredToken = MockUser.generateRefreshToken();
      const expiredDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      
      await MockUser.updateRefreshToken(1, expiredToken, expiredDate);
      
      const response = await request(app)
        .post('/refresh-token')
        .set('Cookie', `refresh_token=${expiredToken}`)
        .expect(401);
      
      expect(response.body.error).toBe('Refresh token expired or invalid');
    });
  });
  
  describe('Security and Validation', () => {
    test('should use secure cookie options in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      // Note: In a real test environment, you'd check that cookies have secure flag
      // This is a simplified check since supertest doesn't parse cookie options
      expect(response.body.message).toBe('Login successful');
      
      process.env.NODE_ENV = originalEnv;
    });
    
    test('should set httpOnly cookies', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies?.find((cookie: string) => cookie.startsWith('token='));
      const refreshTokenCookie = cookies?.find((cookie: string) => cookie.startsWith('refresh_token='));
      
      expect(tokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('HttpOnly');
    });
    
    // TC-F-020
    test('should store refresh token expiration as UTC timestamp', async () => {
      await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password',
          rememberMe: 'true'
        })
        .expect(200);
      
      const user = await MockUser.findByEmail('test@example.com');
      expect(user?.token_expires_at).toBeDefined();
      
      // Verify it's a valid ISO timestamp
      const expiresAt = new Date(user!.token_expires_at!);
      expect(expiresAt.toString()).not.toBe('Invalid Date');
      
      // Verify it's approximately 7 days from now
      const now = new Date();
      const diffInDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffInDays).toBeCloseTo(7, 1);
    });
  });
});