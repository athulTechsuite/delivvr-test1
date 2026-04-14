import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Mock database
const mockDb = {
  run: jest.fn(),
  get: jest.fn()
};

jest.mock('../config/database', () => mockDb);

const User = require('../models/User');

const TEST_USER_ID = 1;
const TEST_REFRESH_TOKEN = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';
const TEST_HASHED_TOKEN = '$2b$10$hashedrefreshtoken';

describe('User Model - Refresh Token Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful database operations by default
    mockDb.run.mockImplementation((query, params, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
    });
    
    mockDb.get.mockImplementation((query, params, callback) => {
      callback(null, {
        id: TEST_USER_ID,
        refresh_token: TEST_HASHED_TOKEN,
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    });
  });
  
  describe('generateRefreshTokenPair', () => {
    it('should generate 64-character refresh token pair', () => {
      // TC-AC-05: Refresh token is 64-character random hex string
      const { refreshToken, hashedRefreshToken } = User.generateRefreshTokenPair();
      
      expect(refreshToken).toHaveLength(64);
      expect(hashedRefreshToken).toBeDefined();
      expect(refreshToken).toMatch(/^[a-f0-9]{64}$/);
      expect(hashedRefreshToken).not.toBe(refreshToken);
    });
    
    it('should generate unique tokens on each call', () => {
      // TC-AC-05: Random token generation
      const pair1 = User.generateRefreshTokenPair();
      const pair2 = User.generateRefreshTokenPair();
      
      expect(pair1.refreshToken).not.toBe(pair2.refreshToken);
      expect(pair1.hashedRefreshToken).not.toBe(pair2.hashedRefreshToken);
    });
    
    it('should hash refresh token with bcrypt', async () => {
      // TC-AC-05: Refresh token stored hashed with bcrypt
      const { refreshToken, hashedRefreshToken } = User.generateRefreshTokenPair();
      
      const isMatch = await bcrypt.compare(refreshToken, hashedRefreshToken);
      expect(isMatch).toBe(true);
      expect(hashedRefreshToken).toMatch(/^\$2b\$/);
    });
  });
  
  describe('setRefreshToken', () => {
    it('should store hashed refresh token with expiration', async () => {
      // TC-AC-06: Store refresh token with expiration in database
      // TC-AC-20: Database stores token_expires_at as UTC ISO timestamp
      const hashedToken = 'hashed_token_123';
      
      await User.setRefreshToken(TEST_USER_ID, hashedToken);
      
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = ?, token_expires_at = ? WHERE id = ?',
        [hashedToken, expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/), TEST_USER_ID],
        expect.any(Function)
      );
      
      const [, , expirationDate] = mockDb.run.mock.calls[0][1];
      const expirationTime = new Date(expirationDate).getTime();
      const expectedTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(expirationTime).toBeGreaterThan(expectedTime - 1000);
      expect(expirationTime).toBeLessThan(expectedTime + 1000);
    });
    
    it('should overwrite existing refresh token', async () => {
      // TC-AC-07: Multiple logins overwrite previous refresh token
      const hashedToken1 = 'hashed_token_123';
      const hashedToken2 = 'hashed_token_456';
      
      await User.setRefreshToken(TEST_USER_ID, hashedToken1);
      await User.setRefreshToken(TEST_USER_ID, hashedToken2);
      
      expect(mockDb.run).toHaveBeenCalledTimes(2);
      expect(mockDb.run).toHaveBeenLastCalledWith(
        'UPDATE users SET refresh_token = ?, token_expires_at = ? WHERE id = ?',
        [hashedToken2, expect.any(String), TEST_USER_ID],
        expect.any(Function)
      );
    });
    
    it('should handle database errors during token storage', async () => {
      // TC-AC-25: Handle database errors gracefully
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Database connection failed'));
      });
      
      await expect(User.setRefreshToken(TEST_USER_ID, 'token'))
        .rejects.toThrow('Database connection failed');
    });
  });
  
  describe('validateRefreshToken', () => {
    it('should validate correct refresh token', async () => {
      // TC-AC-21: Refresh token validation checks hash match and expiration
      // TC-AC-24: Authentication middleware validates refresh tokens
      const refreshToken = 'valid_token_123';
      const hashedToken = await bcrypt.hash(refreshToken, 10);
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: hashedToken,
          token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      });
      
      const isValid = await User.validateRefreshToken(TEST_USER_ID, refreshToken);
      expect(isValid).toBe(true);
    });
    
    it('should reject invalid refresh token hash', async () => {
      // TC-AC-21: Hash mismatch validation
      const refreshToken = 'invalid_token_123';
      const hashedToken = await bcrypt.hash('different_token', 10);
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: hashedToken,
          token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      });
      
      const isValid = await User.validateRefreshToken(TEST_USER_ID, refreshToken);
      expect(isValid).toBe(false);
    });
    
    it('should reject expired refresh token', async () => {
      // TC-AC-16: Refresh token expires after 7 days
      // TC-AC-21: Expiration time validation
      const refreshToken = 'valid_token_123';
      const hashedToken = await bcrypt.hash(refreshToken, 10);
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: hashedToken,
          token_expires_at: new Date(Date.now() - 1000).toISOString() // Expired
        });
      });
      
      const isValid = await User.validateRefreshToken(TEST_USER_ID, refreshToken);
      expect(isValid).toBe(false);
    });
    
    it('should reject when user not found', async () => {
      // TC-AC-15: Invalid refresh tokens trigger immediate logout
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // User not found
      });
      
      const isValid = await User.validateRefreshToken(999, 'token');
      expect(isValid).toBe(false);
    });
    
    it('should reject when no refresh token stored', async () => {
      // TC-AC-15: Missing refresh token handling
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: null,
          token_expires_at: null
        });
      });
      
      const isValid = await User.validateRefreshToken(TEST_USER_ID, 'token');
      expect(isValid).toBe(false);
    });
    
    it('should handle malformed expiration dates', async () => {
      // TC-AC-15: Malformed token handling
      const refreshToken = 'valid_token_123';
      const hashedToken = await bcrypt.hash(refreshToken, 10);
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: hashedToken,
          token_expires_at: 'invalid_date'
        });
      });
      
      const isValid = await User.validateRefreshToken(TEST_USER_ID, refreshToken);
      expect(isValid).toBe(false);
    });
    
    it('should handle database errors during validation', async () => {
      // TC-AC-15: Database error handling
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database connection failed'));
      });
      
      await expect(User.validateRefreshToken(TEST_USER_ID, 'token'))
        .rejects.toThrow('Database connection failed');
    });
  });
  
  describe('clearRefreshToken', () => {
    it('should clear refresh token from database', async () => {
      // TC-AC-12: Logout sets refresh_token to NULL in database
      await User.clearRefreshToken(TEST_USER_ID);
      
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = NULL, token_expires_at = NULL WHERE id = ?',
        [TEST_USER_ID],
        expect.any(Function)
      );
    });
    
    it('should handle database errors during token clearing', async () => {
      // TC-AC-15: Error handling during logout
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Database connection failed'));
      });
      
      await expect(User.clearRefreshToken(TEST_USER_ID))
        .rejects.toThrow('Database connection failed');
    });
  });
  
  describe('Token Security', () => {
    it('should use sufficient bcrypt rounds for hashing', () => {
      // TC-AC-05: Secure token hashing
      const { hashedRefreshToken } = User.generateRefreshTokenPair();
      
      expect(hashedRefreshToken).toMatch(/^\$2b\$10\$/);
    });
    
    it('should generate cryptographically random tokens', () => {
      // TC-AC-05: Cryptographically secure token generation
      const tokens = Array.from({ length: 100 }, () => 
        User.generateRefreshTokenPair().refreshToken
      );
      
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100); // All tokens should be unique
    });
    
    it('should create tokens with proper entropy', () => {
      // TC-AC-05: Token entropy validation
      const token = User.generateRefreshTokenPair().refreshToken;
      
      // Check for proper hex format and length
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      
      // Basic entropy check - token should not be all same character
      const uniqueChars = new Set(token.split(''));
      expect(uniqueChars.size).toBeGreaterThan(8);
    });
  });
  
  describe('UTC Timestamp Handling', () => {
    it('should store expiration as UTC ISO string', async () => {
      // TC-AC-20: Database stores token_expires_at as UTC ISO timestamp
      await User.setRefreshToken(TEST_USER_ID, 'token');
      
      const [, , timestampParam] = mockDb.run.mock.calls[0][1];
      expect(timestampParam).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      const parsedDate = new Date(timestampParam);
      expect(parsedDate.toISOString()).toBe(timestampParam);
    });
    
    it('should validate expiration against current UTC time', async () => {
      // TC-AC-21: UTC time comparison for expiration
      const refreshToken = 'valid_token_123';
      const hashedToken = await bcrypt.hash(refreshToken, 10);
      
      const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour from now
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
      
      // Test future date (should be valid)
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: hashedToken,
          token_expires_at: futureDate
        });
      });
      
      let isValid = await User.validateRefreshToken(TEST_USER_ID, refreshToken);
      expect(isValid).toBe(true);
      
      // Test past date (should be invalid)
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, {
          id: TEST_USER_ID,
          refresh_token: hashedToken,
          token_expires_at: pastDate
        });
      });
      
      isValid = await User.validateRefreshToken(TEST_USER_ID, refreshToken);
      expect(isValid).toBe(false);
    });
  });
});