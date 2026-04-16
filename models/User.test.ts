import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Mock dependencies
jest.mock('sqlite3');
jest.mock('bcrypt');
jest.mock('fs');
jest.mock('path');

const User = require('../models/User');

// Test data
const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedpassword',
  profile_picture: 'uploads/1-1640995200000.jpg',
  created_at: '2023-01-01T00:00:00.000Z'
};

const VALID_PROFILE_DATA = {
  name: 'Updated Name',
  email: 'updated@example.com',
  profile_picture: 'uploads/1-1640995200000.png'
};

describe('User Model', () => {
  let mockDb: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database
    mockDb = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn(),
      prepare: jest.fn(() => ({
        run: jest.fn(),
        finalize: jest.fn()
      })),
      get: jest.fn()
    };
    
    (sqlite3.Database as jest.Mock).mockReturnValue(mockDb);
  });

  describe('Profile Data Validation', () => {
    // TC-F-008: Name field validation enforces 2-50 character length requirement
    test('validateProfileData should enforce name length requirements', () => {
      // Test minimum length
      const shortName = { name: 'A', email: 'test@example.com' };
      const shortResult = User.validateProfileData(shortName);
      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors.name).toContain('between 2 and 50 characters');
      
      // Test maximum length
      const longName = { name: 'A'.repeat(51), email: 'test@example.com' };
      const longResult = User.validateProfileData(longName);
      expect(longResult.isValid).toBe(false);
      expect(longResult.errors.name).toContain('between 2 and 50 characters');
      
      // Test valid length
      const validName = { name: 'Valid Name', email: 'test@example.com' };
      const validResult = User.validateProfileData(validName);
      expect(validResult.isValid).toBe(true);
    });

    // TC-F-008: Name field validation with letters and spaces only
    test('validateProfileData should enforce name character requirements', () => {
      const invalidName = { name: 'Invalid123', email: 'test@example.com' };
      const result = User.validateProfileData(invalidName);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toContain('only letters and spaces');
    });

    // TC-F-009: Email field validation enforces valid email format
    test('validateProfileData should enforce valid email format', () => {
      const invalidEmail = { name: 'Valid Name', email: 'invalid-email' };
      const result = User.validateProfileData(invalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('valid email address');
      
      // Test valid email
      const validEmail = { name: 'Valid Name', email: 'valid@example.com' };
      const validResult = User.validateProfileData(validEmail);
      expect(validResult.isValid).toBe(true);
    });

    // TC-F-010: Profile picture uploads restricted to image formats
    test('validateProfileData should restrict profile picture to valid image formats', () => {
      const invalidFormat = {
        name: 'Valid Name',
        email: 'test@example.com',
        profile_picture: 'uploads/file.txt'
      };
      const result = User.validateProfileData(invalidFormat);
      expect(result.isValid).toBe(false);
      expect(result.errors.profile_picture).toContain('valid image file');
      
      // Test valid formats
      const validFormats = ['.jpg', '.jpeg', '.png', '.gif'];
      validFormats.forEach(ext => {
        const validFormat = {
          name: 'Valid Name',
          email: 'test@example.com',
          profile_picture: `uploads/file${ext}`
        };
        const validResult = User.validateProfileData(validFormat);
        expect(validResult.isValid).toBe(true);
      });
    });

    // TC-F-008, TC-F-009: Required field validation
    test('validateProfileData should require name and email fields', () => {
      const missingName = { email: 'test@example.com' };
      const nameResult = User.validateProfileData(missingName);
      expect(nameResult.isValid).toBe(false);
      expect(nameResult.errors.name).toBe('Name is required');
      
      const missingEmail = { name: 'Valid Name' };
      const emailResult = User.validateProfileData(missingEmail);
      expect(emailResult.isValid).toBe(false);
      expect(emailResult.errors.email).toBe('Email is required');
    });
  });

  describe('Profile Update Functionality', () => {
    beforeEach(() => {
      (fs.access as jest.Mock) = jest.fn();
      (fs.unlink as jest.Mock) = jest.fn();
      (path.join as jest.Mock) = jest.fn().mockReturnValue('/full/path/to/file.jpg');
      (path.extname as jest.Mock) = jest.fn().mockReturnValue('.jpg');
    });

    // TC-F-006: Save validates all inputs and persists changes if validation passes
    test('updateProfile should validate input data before updating', async () => {
      const invalidData = { name: 'A', email: 'invalid' };
      
      try {
        await User.updateProfile(1, invalidData);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Name must be between');
      }
    });

    // TC-F-009: Email uniqueness validation
    test('updateProfile should check email uniqueness', async () => {
      const validData = { name: 'Valid Name', email: 'existing@example.com' };
      
      // Mock existing user with same email
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, { id: 2 }); // Different user ID
      });
      
      mockDb.run.mockImplementationOnce((query) => {
        if (query === 'BEGIN TRANSACTION') return;
        if (query === 'ROLLBACK') return;
      });
      
      try {
        await User.updateProfile(1, validData);
        fail('Should have thrown email exists error');
      } catch (error) {
        expect(error.message).toBe('Email already exists');
      }
    });

    // TC-F-011: Profile pictures stored in public/uploads with unique filenames
    test('updateProfile should delete old profile picture when uploading new one', async () => {
      const updateData = { name: 'Valid Name', email: 'test@example.com', profile_picture: 'uploads/1-new.jpg' };
      
      // Mock current user with existing profile picture
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, null); // No user with same email
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { profile_picture: 'uploads/1-old.jpg' }); // Current user data
        });
      
      mockDb.run
        .mockImplementationOnce(() => {}) // BEGIN TRANSACTION
        .mockImplementationOnce(function(query, params, callback) {
          callback.call({ changes: 1 }, null); // UPDATE success
        })
        .mockImplementationOnce(() => {}); // COMMIT
      
      (fs.access as jest.Mock).mockImplementationOnce((path, mode, callback) => {
        callback(null); // File exists
      });
      
      (fs.unlink as jest.Mock).mockImplementationOnce((path, callback) => {
        callback(null); // Delete success
      });
      
      const result = await User.updateProfile(1, updateData);
      expect(fs.unlink).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    // TC-F-006: Successful profile update
    test('updateProfile should successfully update valid profile data', async () => {
      const validData = { name: 'Updated Name', email: 'updated@example.com' };
      
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, null); // No duplicate email
      }).mockImplementationOnce((query, params, callback) => {
        callback(null, { profile_picture: null }); // Current user
      });
      
      mockDb.run
        .mockImplementationOnce(() => {}) // BEGIN
        .mockImplementationOnce(function(query, params, callback) {
          callback.call({ changes: 1 }, null);
        })
        .mockImplementationOnce(() => {}); // COMMIT
      
      const result = await User.updateProfile(1, validData);
      expect(result.success).toBe(true);
    });

    // TC-F-013: Database schema includes profile_picture column
    test('getUserWithProfilePicture should retrieve user with profile picture data', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        profile_picture: 'uploads/1-123456.jpg',
        created_at: '2023-01-01'
      };
      
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, mockUser);
      });
      
      const result = await User.getUserWithProfilePicture(1);
      expect(result).toEqual(mockUser);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT id, name, email, profile_picture, created_at FROM users WHERE id = ?',
        [1],
        expect.any(Function)
      );
    });
  });

  describe('File Management', () => {
    beforeEach(() => {
      (fs.access as jest.Mock).mockReset();
      (fs.unlink as jest.Mock).mockReset();
      (path.join as jest.Mock).mockReturnValue('/full/path');
    });

    // TC-F-011: Old profile picture deletion
    test('deleteProfilePicture should handle file deletion', async () => {
      (fs.access as jest.Mock).mockImplementationOnce((path, mode, callback) => {
        callback(null); // File exists
      });
      
      (fs.unlink as jest.Mock).mockImplementationOnce((path, callback) => {
        callback(null); // Delete success
      });
      
      await expect(User.deleteProfilePicture('uploads/test.jpg')).resolves.toBeUndefined();
      expect(fs.unlink).toHaveBeenCalled();
    });

    // TC-F-011: Handle non-existent file gracefully
    test('deleteProfilePicture should handle non-existent files gracefully', async () => {
      (fs.access as jest.Mock).mockImplementationOnce((path, mode, callback) => {
        callback(new Error('File not found')); // File doesn't exist
      });
      
      await expect(User.deleteProfilePicture('uploads/nonexistent.jpg')).resolves.toBeUndefined();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    // TC-F-011: Handle null profile picture path
    test('deleteProfilePicture should handle null profile picture path', async () => {
      await expect(User.deleteProfilePicture(null)).resolves.toBeUndefined();
      expect(fs.access).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('User Authentication Methods', () => {
    // TC-F-001: User authentication for profile access
    test('findById should retrieve user by ID', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, TEST_USER);
      });
      
      const result = await User.findById(1);
      expect(result).toEqual(TEST_USER);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1], expect.any(Function));
    });

    // TC-F-001: Handle user not found
    test('findById should return null for non-existent user', async () => {
      mockDb.get.mockImplementationOnce((query, params, callback) => {
        callback(null, null);
      });
      
      const result = await User.findById(999);
      expect(result).toBeNull();
    });

    // Password validation for authentication
    test('validatePassword should verify password correctly', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      const result = await User.validatePassword('plaintext', 'hashedpassword');
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('plaintext', 'hashedpassword');
    });
  });
});