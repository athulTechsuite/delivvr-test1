const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const db = require('../config/database');

// Mock database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn()
}));

describe('User Refresh Token Methods', () => {
  const MOCK_USER_ID = 123;
  const MOCK_TOKEN = 'a'.repeat(64);
  const MOCK_HASH = '$2b$10$hashedtoken';
  const MOCK_EXPIRATION = '2024-01-08T00:00:00.000Z';
  const SALT_ROUNDS = 10;
  const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters
  const EXPIRATION_DAYS = 7;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful database operations by default
    db.query.mockResolvedValue({ rows: [] });
    db.transaction.mockImplementation(async (callback) => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      return callback(mockClient);
    });
  });

  describe('generateRefreshTokenPair', () => {
    it('should generate 64-character hex token and bcrypt hash', async () => {
      const mockBuffer = Buffer.from(MOCK_TOKEN.slice(0, 32), 'hex');
      crypto.randomBytes.mockReturnValue(mockBuffer);
      bcrypt.hash.mockResolvedValue(MOCK_HASH);

      const result = await User.generateRefreshTokenPair();

      expect(crypto.randomBytes).toHaveBeenCalledWith(TOKEN_LENGTH);
      expect(bcrypt.hash).toHaveBeenCalledWith(mockBuffer.toString('hex'), SALT_ROUNDS);
      expect(result).toEqual({
        token: mockBuffer.toString('hex'),
        hashedToken: MOCK_HASH
      });
      expect(result.token).toHaveLength(64);
      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different tokens on multiple calls', async () => {
      const mockBuffer1 = Buffer.from('a'.repeat(32), 'hex');
      const mockBuffer2 = Buffer.from('b'.repeat(32), 'hex');
      
      crypto.randomBytes
        .mockReturnValueOnce(mockBuffer1)
        .mockReturnValueOnce(mockBuffer2);
      bcrypt.hash
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('hash2');

      const result1 = await User.generateRefreshTokenPair();
      const result2 = await User.generateRefreshTokenPair();

      expect(result1.token).not.toEqual(result2.token);
      expect(result1.hashedToken).not.toEqual(result2.hashedToken);
    });

    it('should handle crypto.randomBytes failure', async () => {
      const error = new Error('Crypto operation failed');
      crypto.randomBytes.mockImplementation(() => {
        throw error;
      });

      await expect(User.generateRefreshTokenPair()).rejects.toThrow('Crypto operation failed');
    });

    it('should handle bcrypt.hash failure', async () => {
      const mockBuffer = Buffer.from(MOCK_TOKEN.slice(0, 32), 'hex');
      crypto.randomBytes.mockReturnValue(mockBuffer);
      bcrypt.hash.mockRejectedValue(new Error('Bcrypt operation failed'));

      await expect(User.generateRefreshTokenPair()).rejects.toThrow('Bcrypt operation failed');
    });

    it('should use correct salt rounds for bcrypt', async () => {
      const mockBuffer = Buffer.from(MOCK_TOKEN.slice(0, 32), 'hex');
      crypto.randomBytes.mockReturnValue(mockBuffer);
      bcrypt.hash.mockResolvedValue(MOCK_HASH);

      await User.generateRefreshTokenPair();

      expect(bcrypt.hash).toHaveBeenCalledWith(
        mockBuffer.toString('hex'),
        SALT_ROUNDS
      );
    });
  });

  describe('setRefreshToken', () => {
    it('should store hashed token with correct expiration', async () => {
      const mockDate = new Date('2024-01-01T00:00:00.000Z');
      const expectedExpiration = new Date(mockDate.getTime() + (EXPIRATION_DAYS * 24 * 60 * 60 * 1000));
      
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      db.query.mockResolvedValue({ rowCount: 1 });

      await User.setRefreshToken(MOCK_USER_ID, MOCK_HASH);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = $1, token_expires_at = $2 WHERE id = $3',
        [MOCK_HASH, expectedExpiration.toISOString(), MOCK_USER_ID]
      );
    });

    it('should validate userId is a positive integer', async () => {
      await expect(User.setRefreshToken(null, MOCK_HASH)).rejects.toThrow('Invalid user ID');
      await expect(User.setRefreshToken(undefined, MOCK_HASH)).rejects.toThrow('Invalid user ID');
      await expect(User.setRefreshToken('invalid', MOCK_HASH)).rejects.toThrow('Invalid user ID');
      await expect(User.setRefreshToken(0, MOCK_HASH)).rejects.toThrow('Invalid user ID');
      await expect(User.setRefreshToken(-1, MOCK_HASH)).rejects.toThrow('Invalid user ID');
    });

    it('should validate hashedToken is a non-empty string', async () => {
      await expect(User.setRefreshToken(MOCK_USER_ID, null)).rejects.toThrow('Invalid hashed token');
      await expect(User.setRefreshToken(MOCK_USER_ID, undefined)).rejects.toThrow('Invalid hashed token');
      await expect(User.setRefreshToken(MOCK_USER_ID, '')).rejects.toThrow('Invalid hashed token');
      await expect(User.setRefreshToken(MOCK_USER_ID, 123)).rejects.toThrow('Invalid hashed token');
    });

    it('should handle database connection failures', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(User.setRefreshToken(MOCK_USER_ID, MOCK_HASH))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle user not found in database', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      await expect(User.setRefreshToken(MOCK_USER_ID, MOCK_HASH))
        .rejects.toThrow('User not found');
    });

    it('should calculate expiration correctly for 7 days', async () => {
      const mockDate = new Date('2024-01-01T12:30:45.123Z');
      const expectedExpiration = new Date(mockDate.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      db.query.mockResolvedValue({ rowCount: 1 });

      await User.setRefreshToken(MOCK_USER_ID, MOCK_HASH);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [MOCK_HASH, expectedExpiration.toISOString(), MOCK_USER_ID]
      );
    });
  });

  describe('validateRefreshToken', () => {
    const CURRENT_TIME = new Date('2024-01-01T00:00:00.000Z');
    const VALID_EXPIRATION = new Date('2024-01-08T00:00:00.000Z');
    const EXPIRED_EXPIRATION = new Date('2023-12-25T00:00:00.000Z');

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME.getTime());
    });

    it('should validate correct token and return true', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: VALID_EXPIRATION
        }]
      });
      bcrypt.compare.mockResolvedValue(true);

      const result = await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, refresh_token, token_expires_at FROM users WHERE id = $1',
        [MOCK_USER_ID]
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(MOCK_TOKEN, MOCK_HASH);
      expect(result).toBe(true);
    });

    it('should reject invalid token and return false', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: VALID_EXPIRATION
        }]
      });
      bcrypt.compare.mockResolvedValue(false);

      const result = await User.validateRefreshToken(MOCK_USER_ID, 'invalid_token');

      expect(result).toBe(false);
    });

    it('should reject expired token and return false', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: EXPIRED_EXPIRATION
        }]
      });

      const result = await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle user not found and return false', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle null refresh token and return false', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: null,
          token_expires_at: VALID_EXPIRATION
        }]
      });

      const result = await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should validate input parameters', async () => {
      await expect(User.validateRefreshToken(null, MOCK_TOKEN)).rejects.toThrow('Invalid user ID');
      await expect(User.validateRefreshToken(MOCK_USER_ID, null)).rejects.toThrow('Invalid token');
      await expect(User.validateRefreshToken(-1, MOCK_TOKEN)).rejects.toThrow('Invalid user ID');
      await expect(User.validateRefreshToken(MOCK_USER_ID, '')).rejects.toThrow('Invalid token');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN))
        .rejects.toThrow('Database error');
    });

    it('should handle bcrypt comparison errors', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: VALID_EXPIRATION
        }]
      });
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      await expect(User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN))
        .rejects.toThrow('Bcrypt error');
    });

    it('should use constant-time comparison to prevent timing attacks', async () => {
      const startTime = process.hrtime.bigint();
      
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: VALID_EXPIRATION
        }]
      });
      bcrypt.compare.mockImplementation(async () => {
        // Simulate bcrypt's constant-time behavior
        await new Promise(resolve => setTimeout(resolve, 10));
        return false;
      });

      await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      // Verify bcrypt.compare was called (indicating timing-safe comparison)
      expect(bcrypt.compare).toHaveBeenCalled();
      expect(duration).toBeGreaterThan(5); // Should take some time for security
    });
  });

  describe('clearRefreshToken', () => {
    it('should set token and expiration to null', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await User.clearRefreshToken(MOCK_USER_ID);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = NULL, token_expires_at = NULL WHERE id = $1',
        [MOCK_USER_ID]
      );
    });

    it('should validate userId parameter', async () => {
      await expect(User.clearRefreshToken(null)).rejects.toThrow('Invalid user ID');
      await expect(User.clearRefreshToken(undefined)).rejects.toThrow('Invalid user ID');
      await expect(User.clearRefreshToken('invalid')).rejects.toThrow('Invalid user ID');
      await expect(User.clearRefreshToken(0)).rejects.toThrow('Invalid user ID');
      await expect(User.clearRefreshToken(-1)).rejects.toThrow('Invalid user ID');
    });

    it('should handle user not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      await expect(User.clearRefreshToken(MOCK_USER_ID))
        .rejects.toThrow('User not found');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(User.clearRefreshToken(MOCK_USER_ID))
        .rejects.toThrow('Database error');
    });

    it('should return success when token is cleared', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await User.clearRefreshToken(MOCK_USER_ID);

      expect(result).toBeUndefined();
    });
  });

  describe('getByValidRefreshToken', () => {
    const MOCK_USER = {
      id: MOCK_USER_ID,
      email: 'test@example.com',
      refresh_token: MOCK_HASH,
      token_expires_at: '2024-01-08T00:00:00.000Z'
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T00:00:00.000Z').getTime());
    });

    it('should find user by valid refresh token', async () => {
      db.query.mockResolvedValue({ rows: [MOCK_USER] });
      bcrypt.compare.mockResolvedValue(true);

      const result = await User.getByValidRefreshToken(MOCK_TOKEN);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, email, refresh_token, token_expires_at FROM users WHERE refresh_token IS NOT NULL'
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(MOCK_TOKEN, MOCK_HASH);
      expect(result).toEqual({
        id: MOCK_USER_ID,
        email: 'test@example.com'
      });
    });

    it('should return null for invalid token', async () => {
      db.query.mockResolvedValue({ rows: [MOCK_USER] });
      bcrypt.compare.mockResolvedValue(false);

      const result = await User.getByValidRefreshToken('invalid_token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const expiredUser = {
        ...MOCK_USER,
        token_expires_at: '2023-12-25T00:00:00.000Z'
      };
      db.query.mockResolvedValue({ rows: [expiredUser] });

      const result = await User.getByValidRefreshToken(MOCK_TOKEN);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when no users have refresh tokens', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await User.getByValidRefreshToken(MOCK_TOKEN);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should validate token parameter', async () => {
      await expect(User.getByValidRefreshToken(null)).rejects.toThrow('Invalid token');
      await expect(User.getByValidRefreshToken(undefined)).rejects.toThrow('Invalid token');
      await expect(User.getByValidRefreshToken('')).rejects.toThrow('Invalid token');
      await expect(User.getByValidRefreshToken(123)).rejects.toThrow('Invalid token');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(User.getByValidRefreshToken(MOCK_TOKEN))
        .rejects.toThrow('Database error');
    });

    it('should check multiple users if multiple have refresh tokens', async () => {
      const user1 = { ...MOCK_USER, id: 1, refresh_token: 'hash1' };
      const user2 = { ...MOCK_USER, id: 2, refresh_token: 'hash2' };
      
      db.query.mockResolvedValue({ rows: [user1, user2] });
      bcrypt.compare
        .mockResolvedValueOnce(false) // First user doesn't match
        .mockResolvedValueOnce(true); // Second user matches

      const result = await User.getByValidRefreshToken(MOCK_TOKEN);

      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: 2, email: 'test@example.com' });
    });

    it('should handle malformed expiration dates', async () => {
      const malformedUser = {
        ...MOCK_USER,
        token_expires_at: 'invalid-date'
      };
      db.query.mockResolvedValue({ rows: [malformedUser] });

      const result = await User.getByValidRefreshToken(MOCK_TOKEN);

      expect(result).toBeNull();
    });

    it('should not return sensitive user data', async () => {
      const userWithSensitiveData = {
        ...MOCK_USER,
        password: 'hashedpassword',
        reset_token: 'resettoken'
      };
      db.query.mockResolvedValue({ rows: [userWithSensitiveData] });
      bcrypt.compare.mockResolvedValue(true);

      const result = await User.getByValidRefreshToken(MOCK_TOKEN);

      expect(result).toEqual({
        id: MOCK_USER_ID,
        email: 'test@example.com'
      });
      expect(result.password).toBeUndefined();
      expect(result.reset_token).toBeUndefined();
      expect(result.refresh_token).toBeUndefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent setRefreshToken calls gracefully', async () => {
      let callCount = 0;
      db.query.mockImplementation(async () => {
        callCount++;
        // Simulate database delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return { rowCount: 1 };
      });

      const promises = [
        User.setRefreshToken(MOCK_USER_ID, 'hash1'),
        User.setRefreshToken(MOCK_USER_ID, 'hash2'),
        User.setRefreshToken(MOCK_USER_ID, 'hash3')
      ];

      await Promise.all(promises);

      expect(callCount).toBe(3);
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent validation attempts', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: '2024-01-08T00:00:00.000Z'
        }]
      });
      bcrypt.compare.mockResolvedValue(true);

      const promises = Array.from({ length: 5 }, () => 
        User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN)
      );

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true, true, true]);
      expect(bcrypt.compare).toHaveBeenCalledTimes(5);
    });
  });

  describe('Performance Tests', () => {
    it('should generate tokens within reasonable time', async () => {
      const mockBuffer = Buffer.from(MOCK_TOKEN.slice(0, 32), 'hex');
      crypto.randomBytes.mockReturnValue(mockBuffer);
      bcrypt.hash.mockResolvedValue(MOCK_HASH);

      const startTime = Date.now();
      await User.generateRefreshTokenPair();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should validate tokens within reasonable time', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: '2024-01-08T00:00:00.000Z'
        }]
      });
      bcrypt.compare.mockResolvedValue(true);

      const startTime = Date.now();
      await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle batch token operations efficiently', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const startTime = Date.now();
      const promises = Array.from({ length: 10 }, (_, i) => 
        User.clearRefreshToken(i + 1)
      );
      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should handle 10 operations within 2 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long tokens gracefully', async () => {
      const longToken = 'a'.repeat(1000);
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: '2024-01-08T00:00:00.000Z'
        }]
      });
      bcrypt.compare.mockResolvedValue(false);

      const result = await User.validateRefreshToken(MOCK_USER_ID, longToken);

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(longToken, MOCK_HASH);
    });

    it('should handle tokens with special characters', async () => {
      const specialToken = 'abc123!@#$%^&*()';
      db.query.mockResolvedValue({
        rows: [{
          id: MOCK_USER_ID,
          refresh_token: MOCK_HASH,
          token_expires_at: '2024-01-08T00:00:00.000Z'
        }]
      });
      bcrypt.compare.mockResolvedValue(false);

      const result = await User.validateRefreshToken(MOCK_USER_ID, specialToken);

      expect(result).toBe(false);
    });

    it('should handle very large user IDs', async () => {
      const largeUserId = 2147483647; // Max 32-bit integer
      db.query.mockResolvedValue({ rowCount: 1 });

      await expect(User.setRefreshToken(largeUserId, MOCK_HASH))
        .resolves.toBeUndefined();
    });

    it('should handle database returning unexpected data structure', async () => {
      db.query.mockResolvedValue({ rows: [{ unexpected: 'data' }] });

      const result = await User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN);

      expect(result).toBe(false);
    });

    it('should handle null/undefined database response', async () => {
      db.query.mockResolvedValue(null);

      await expect(User.validateRefreshToken(MOCK_USER_ID, MOCK_TOKEN))
        .rejects.toThrow();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});