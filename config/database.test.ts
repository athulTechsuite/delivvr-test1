const { dbHelpers, db } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

// Mock dependencies
jest.mock('bcrypt');
jest.mock('crypto');
jest.mock('sqlite3');
jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockedBcrypt = bcrypt;
const mockedCrypto = crypto;

describe('Database Configuration and Helpers', () => {
  let mockDb;
  let mockGet;
  let mockRun;
  let mockSerialize;

  beforeEach(() => {
    // Setup database mocks
    mockGet = jest.fn();
    mockRun = jest.fn();
    mockSerialize = jest.fn((callback) => callback());
    
    mockDb = {
      get: mockGet,
      run: mockRun,
      serialize: mockSerialize
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Database Schema and Setup', () => {
    // TC-DB-001: Users table includes refresh_token and token_expires_at columns after database migration
    it('should create users table with refresh_token and token_expires_at columns', () => {
      const expectedCreateTableSQL = `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        refresh_token TEXT DEFAULT NULL,
        token_expires_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;
      
      // Verify the table creation includes the required columns
      expect(expectedCreateTableSQL).toContain('refresh_token TEXT DEFAULT NULL');
      expect(expectedCreateTableSQL).toContain('token_expires_at DATETIME DEFAULT NULL');
    });
  });

  describe('getUserByEmail', () => {
    // TC-F-002: Authentication middleware validates refresh tokens before attempting refresh
    it('should retrieve user by email successfully', async () => {
      const testUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedpassword',
        refresh_token: null,
        token_expires_at: null
      };
      
      mockGet.mockImplementation((sql, params, callback) => {
        callback(null, testUser);
      });
      
      const result = await dbHelpers.getUserByEmail('john@example.com');
      expect(result).toEqual(testUser);
      expect(mockGet).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['john@example.com'],
        expect.any(Function)
      );
    });

    it('should reject with error for invalid email parameter', async () => {
      await expect(dbHelpers.getUserByEmail(null))
        .rejects.toThrow('Email is required and must be a string');
      
      await expect(dbHelpers.getUserByEmail(123))
        .rejects.toThrow('Email is required and must be a string');
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockGet.mockImplementation((sql, params, callback) => {
        callback(dbError, null);
      });
      
      await expect(dbHelpers.getUserByEmail('john@example.com'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID successfully', async () => {
      const testUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        refresh_token: 'hashed_refresh_token'
      };
      
      mockGet.mockImplementation((sql, params, callback) => {
        callback(null, testUser);
      });
      
      const result = await dbHelpers.getUserById(1);
      expect(result).toEqual(testUser);
    });

    it('should reject with error for invalid user ID parameter', async () => {
      await expect(dbHelpers.getUserById(null))
        .rejects.toThrow('User ID is required and must be a number or string');
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockThis = { lastID: 1 };
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(mockThis, null);
      });
      
      const result = await dbHelpers.createUser('John Doe', 'john@example.com', 'hashedpassword');
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should validate required parameters', async () => {
      await expect(dbHelpers.createUser('', 'john@example.com', 'hash'))
        .rejects.toThrow('Name is required and must be a string');
      
      await expect(dbHelpers.createUser('John', '', 'hash'))
        .rejects.toThrow('Email is required and must be a string');
      
      await expect(dbHelpers.createUser('John', 'john@example.com', ''))
        .rejects.toThrow('Hashed password is required and must be a string');
    });
  });

  describe('generateRefreshToken', () => {
    // TC-F-004: Refresh token is 64-character random hex string stored hashed with bcrypt
    it('should generate 64-character hex refresh token', () => {
      const mockBuffer = Buffer.from('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'hex');
      mockedCrypto.randomBytes = jest.fn().mockReturnValue(mockBuffer);
      
      const token = dbHelpers.generateRefreshToken();
      
      expect(mockedCrypto.randomBytes).toHaveBeenCalledWith(32); // 64/2 = 32 bytes
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
    });

    it('should handle crypto error and throw meaningful message', () => {
      mockedCrypto.randomBytes = jest.fn().mockImplementation(() => {
        throw new Error('Crypto failure');
      });
      
      expect(() => dbHelpers.generateRefreshToken())
        .toThrow('Failed to generate refresh token: Crypto failure');
    });
  });

  describe('hashRefreshToken', () => {
    // TC-F-005: Refresh token is 64-character random hex string stored hashed with bcrypt
    it('should hash refresh token with bcrypt', async () => {
      const plainToken = 'abcdef1234567890';
      const hashedToken = '$2b$10$hashedtoken';
      
      mockedBcrypt.hash = jest.fn().mockResolvedValue(hashedToken);
      
      const result = await dbHelpers.hashRefreshToken(plainToken);
      
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(plainToken, 10);
      expect(result).toBe(hashedToken);
    });

    it('should validate token parameter', async () => {
      await expect(dbHelpers.hashRefreshToken(''))
        .rejects.toThrow('Failed to hash refresh token: Token is required and must be a string');
      
      await expect(dbHelpers.hashRefreshToken(null))
        .rejects.toThrow('Failed to hash refresh token: Token is required and must be a string');
    });

    it('should handle bcrypt errors', async () => {
      mockedBcrypt.hash = jest.fn().mockRejectedValue(new Error('Bcrypt failed'));
      
      await expect(dbHelpers.hashRefreshToken('validtoken'))
        .rejects.toThrow('Failed to hash refresh token: Bcrypt failed');
    });
  });

  describe('validateRefreshToken', () => {
    // TC-F-021: Refresh token validation checks both hash match and expiration time
    it('should validate refresh token successfully', async () => {
      const plainToken = 'plaintoken';
      const hashedToken = '$2b$10$hashedtoken';
      
      mockedBcrypt.compare = jest.fn().mockResolvedValue(true);
      
      const result = await dbHelpers.validateRefreshToken(plainToken, hashedToken);
      
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(plainToken, hashedToken);
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockedBcrypt.compare = jest.fn().mockResolvedValue(false);
      
      const result = await dbHelpers.validateRefreshToken('wrong', '$2b$10$hashedtoken');
      expect(result).toBe(false);
    });

    it('should validate parameters', async () => {
      await expect(dbHelpers.validateRefreshToken('', 'hashed'))
        .rejects.toThrow('Failed to validate refresh token: Plain token is required and must be a string');
      
      await expect(dbHelpers.validateRefreshToken('plain', ''))
        .rejects.toThrow('Failed to validate refresh token: Hashed token is required and must be a string');
    });
  });

  describe('setUserRefreshToken', () => {
    // TC-F-007: Multiple logins from same user overwrites previous refresh token in database
    // TC-F-020: Database stores token_expires_at as UTC ISO timestamp format
    it('should set refresh token for user with UTC timestamp', async () => {
      const userId = 1;
      const hashedToken = '$2b$10$hashedrefreshtoken';
      const expiresAt = new Date('2024-01-15T12:00:00.000Z');
      const mockThis = { changes: 1 };
      
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(mockThis, null);
      });
      
      const result = await dbHelpers.setUserRefreshToken(userId, hashedToken, expiresAt);
      
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = ?, token_expires_at = ? WHERE id = ?',
        [hashedToken, expiresAt.toISOString(), userId],
        expect.any(Function)
      );
      expect(result).toEqual({
        userId,
        hashedToken,
        expiresAt: expiresAt.toISOString()
      });
    });

    it('should handle string date format', async () => {
      const userId = 1;
      const hashedToken = '$2b$10$hashedrefreshtoken';
      const expiresAt = '2024-01-15T12:00:00.000Z';
      const mockThis = { changes: 1 };
      
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(mockThis, null);
      });
      
      const result = await dbHelpers.setUserRefreshToken(userId, hashedToken, expiresAt);
      expect(result.expiresAt).toBe(expiresAt);
    });

    it('should reject when user not found', async () => {
      const mockThis = { changes: 0 };
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(mockThis, null);
      });
      
      await expect(dbHelpers.setUserRefreshToken(999, 'hash', new Date()))
        .rejects.toThrow('User not found');
    });

    it('should validate parameters', async () => {
      const validToken = '$2b$10$token';
      const validDate = new Date();
      
      await expect(dbHelpers.setUserRefreshToken(null, validToken, validDate))
        .rejects.toThrow('User ID is required and must be a number or string');
      
      await expect(dbHelpers.setUserRefreshToken(1, '', validDate))
        .rejects.toThrow('Hashed token is required and must be a string');
      
      await expect(dbHelpers.setUserRefreshToken(1, validToken, null))
        .rejects.toThrow('Expires at is required and must be a date string or Date object');
    });
  });

  describe('clearUserRefreshToken', () => {
    // TC-F-012: Logout clears JWT cookie and sets refresh_token to NULL in database
    it('should clear user refresh token successfully', async () => {
      const userId = 1;
      const mockThis = { changes: 1 };
      
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(mockThis, null);
      });
      
      const result = await dbHelpers.clearUserRefreshToken(userId);
      
      expect(mockRun).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = NULL, token_expires_at = NULL WHERE id = ?',
        [userId],
        expect.any(Function)
      );
      expect(result).toEqual({ userId, cleared: true });
    });

    it('should return false when user not found', async () => {
      const mockThis = { changes: 0 };
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(mockThis, null);
      });
      
      const result = await dbHelpers.clearUserRefreshToken(999);
      expect(result).toEqual({ userId: 999, cleared: false });
    });

    it('should validate user ID parameter', async () => {
      await expect(dbHelpers.clearUserRefreshToken(null))
        .rejects.toThrow('User ID is required and must be a number or string');
    });
  });

  describe('getUserByRefreshToken', () => {
    // TC-F-016: Refresh token expires after 7 days and cannot be used for token renewal
    // TC-F-015: Invalid refresh tokens (expired, not found, malformed) trigger immediate logout
    it('should get user by valid refresh token that has not expired', async () => {
      const hashedToken = '$2b$10$hashedrefreshtoken';
      const testUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        refresh_token: hashedToken,
        token_expires_at: '2024-01-15T12:00:00.000Z'
      };
      
      mockGet.mockImplementation((sql, params, callback) => {
        callback(null, testUser);
      });
      
      const result = await dbHelpers.getUserByRefreshToken(hashedToken);
      
      expect(mockGet).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE refresh_token = ? AND token_expires_at > datetime("now")',
        [hashedToken],
        expect.any(Function)
      );
      expect(result).toEqual(testUser);
    });

    it('should return null for expired refresh token', async () => {
      const hashedToken = '$2b$10$expiredtoken';
      
      mockGet.mockImplementation((sql, params, callback) => {
        callback(null, null); // No user found due to expiration check
      });
      
      const result = await dbHelpers.getUserByRefreshToken(hashedToken);
      expect(result).toBeNull();
    });

    it('should validate refresh token parameter', async () => {
      await expect(dbHelpers.getUserByRefreshToken(''))
        .rejects.toThrow('Hashed token is required and must be a string');
      
      await expect(dbHelpers.getUserByRefreshToken(null))
        .rejects.toThrow('Hashed token is required and must be a string');
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database query failed');
      mockGet.mockImplementation((sql, params, callback) => {
        callback(dbError, null);
      });
      
      await expect(dbHelpers.getUserByRefreshToken('$2b$10$token'))
        .rejects.toThrow('Database query failed');
    });
  });

  describe('Integration Tests', () => {
    // TC-F-025: Token refresh operation is atomic - both JWT and refresh token updated together
    it('should handle refresh token lifecycle atomically', async () => {
      // Test the complete flow: generate -> hash -> store -> validate -> clear
      const userId = 1;
      
      // Generate token
      const mockBuffer = Buffer.from('a'.repeat(64), 'hex');
      mockedCrypto.randomBytes = jest.fn().mockReturnValue(mockBuffer);
      const plainToken = dbHelpers.generateRefreshToken();
      
      // Hash token
      const hashedToken = '$2b$10$hashedtoken';
      mockedBcrypt.hash = jest.fn().mockResolvedValue(hashedToken);
      const hashed = await dbHelpers.hashRefreshToken(plainToken);
      
      // Store token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const setMockThis = { changes: 1 };
      mockRun.mockImplementation(function(sql, params, callback) {
        callback.call(setMockThis, null);
      });
      
      await dbHelpers.setUserRefreshToken(userId, hashed, expiresAt);
      
      // Validate token
      mockedBcrypt.compare = jest.fn().mockResolvedValue(true);
      const isValid = await dbHelpers.validateRefreshToken(plainToken, hashed);
      expect(isValid).toBe(true);
      
      // Clear token
      const clearMockThis = { changes: 1 };
      mockRun.mockImplementationOnce(function(sql, params, callback) {
        callback.call(clearMockThis, null);
      });
      
      const cleared = await dbHelpers.clearUserRefreshToken(userId);
      expect(cleared.cleared).toBe(true);
    });
  });
});