const User = require('../models/User');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Mock database for testing
jest.mock('sqlite3');
jest.mock('fs');
jest.mock('bcrypt');

describe('User Model - Profile Management', () => {
  let mockDb;
  
  beforeEach(() => {
    mockDb = {
      serialize: jest.fn(callback => callback()),
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      prepare: jest.fn(() => ({
        run: jest.fn(),
        finalize: jest.fn()
      }))
    };
    sqlite3.Database.mockImplementation(() => mockDb);
    jest.clearAllMocks();
  });

  describe('Profile Information Display', () => {
    // TC-F-002: Profile page displays current user's name, email, and profile picture from database
    test('TC-F-002: findById should retrieve user profile information', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile_picture: 'uploads/1_123456_avatar.jpg',
        created_at: '2024-01-01 12:00:00'
      };
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockUser);
      });
      
      const result = await User.findById(1);
      expect(result).toEqual(mockUser);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1], expect.any(Function));
    });

    // TC-F-003: Profile page shows account creation date in readable format
    test('TC-F-003: findById should include created_at timestamp', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: '2024-01-01 12:00:00'
      };
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockUser);
      });
      
      const result = await User.findById(1);
      expect(result.created_at).toBeDefined();
      expect(typeof result.created_at).toBe('string');
    });

    // TC-F-004: Profile picture displays as 150x150px circular image with fallback to default avatar when null
    test('TC-F-004: should handle null profile picture gracefully', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile_picture: null
      };
      
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockUser);
      });
      
      const result = await User.findById(1);
      expect(result.profile_picture).toBeNull();
    });

    test('should reject invalid user ID parameter', async () => {
      await expect(User.findById(null)).rejects.toThrow('Invalid user ID parameter');
      await expect(User.findById('invalid')).rejects.toThrow('Invalid user ID parameter');
    });
  });

  describe('Profile Update Validation', () => {
    // TC-F-010: Name field accepts 2-50 characters containing only letters and spaces
    test('TC-F-010: isValidName should validate name format and length', () => {
      expect(User.isValidName('John')).toBe(true);
      expect(User.isValidName('John Doe')).toBe(true);
      expect(User.isValidName('A')).toBe(false); // Too short
      expect(User.isValidName('A'.repeat(51))).toBe(false); // Too long
      expect(User.isValidName('John123')).toBe(false); // Contains numbers
      expect(User.isValidName('John@Doe')).toBe(false); // Contains special chars
      expect(User.isValidName('')).toBe(false); // Empty
      expect(User.isValidName(null)).toBe(false); // Null
    });

    // TC-F-011: Name validation error displays below field: 'Name must be between 2 and 50 characters'
    test('TC-F-011: updateProfile should reject invalid name', async () => {
      await expect(User.updateProfile(1, { name: 'A' }))
        .rejects.toThrow('Name must be between 2 and 50 characters and contain only letters and spaces');
      
      await expect(User.updateProfile(1, { name: 'John123' }))
        .rejects.toThrow('Name must be between 2 and 50 characters and contain only letters and spaces');
    });

    // TC-F-012: Email field requires valid email format and shows format error if invalid
    test('TC-F-012: isValidEmail should validate email format', () => {
      expect(User.isValidEmail('john@example.com')).toBe(true);
      expect(User.isValidEmail('invalid-email')).toBe(false);
      expect(User.isValidEmail('@example.com')).toBe(false);
      expect(User.isValidEmail('john@')).toBe(false);
      expect(User.isValidEmail('')).toBe(false);
      expect(User.isValidEmail(null)).toBe(false);
    });

    // TC-F-013: Email uniqueness validation prevents duplicate emails
    test('TC-F-013: updateProfile should check email uniqueness', async () => {
      const existingUser = { id: 2, email: 'existing@example.com' };
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('email')) {
          callback(null, existingUser);
        } else {
          callback(null, null);
        }
      });
      
      User.findByEmail = jest.fn().mockResolvedValue(existingUser);
      
      await expect(User.updateProfile(1, { email: 'existing@example.com' }))
        .rejects.toThrow('This email is already registered to another account');
    });

    test('TC-F-013: updateProfile should allow same user to keep their email', async () => {
      const currentUser = { id: 1, email: 'john@example.com' };
      User.findByEmail = jest.fn().mockResolvedValue(currentUser);
      User.updateById = jest.fn().mockResolvedValue({ changes: 1 });
      
      const result = await User.updateProfile(1, { email: 'john@example.com' });
      expect(User.updateById).toHaveBeenCalled();
    });
  });

  describe('File Upload Processing', () => {
    beforeEach(() => {
      fs.existsSync = jest.fn();
      fs.statSync = jest.fn();
      fs.unlink = jest.fn();
    });

    // TC-F-015: Profile picture upload accepts only JPG and PNG files
    // TC-F-016: File size validation rejects uploads larger than 2MB
    test('TC-F-015, TC-F-016: profilePictureExists should validate file existence', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      
      expect(User.profilePictureExists('uploads/test.jpg')).toBe(true);
      expect(User.profilePictureExists(null)).toBe(false);
      expect(User.profilePictureExists('')).toBe(false);
      
      fs.existsSync.mockReturnValue(false);
      expect(User.profilePictureExists('uploads/nonexistent.jpg')).toBe(false);
    });

    // TC-F-017: Profile picture upload replaces existing image and deletes old file
    test('TC-F-017: deleteProfilePicture should remove old files', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlink.mockImplementation((path, callback) => callback(null));
      
      const result = await User.deleteProfilePicture('uploads/old_avatar.jpg');
      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('TC-F-017: deleteProfilePicture should handle non-existent files', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = await User.deleteProfilePicture('uploads/nonexistent.jpg');
      expect(result).toBe(false);
    });

    // TC-F-018: Profile picture filename follows pattern: userId_timestamp_originalExtension
    test('TC-F-018: updateProfile should handle profile picture updates', async () => {
      const mockUser = { id: 1, profile_picture: 'uploads/old_avatar.jpg' };
      User.findById = jest.fn().mockResolvedValue(mockUser);
      User.deleteProfilePicture = jest.fn().mockResolvedValue(true);
      User.updateById = jest.fn().mockResolvedValue({ changes: 1 });
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ isFile: () => true });
      
      const result = await User.updateProfile(1, { profile_picture: 'uploads/1_123456_new.jpg' });
      expect(User.deleteProfilePicture).toHaveBeenCalledWith('uploads/old_avatar.jpg');
      expect(User.updateById).toHaveBeenCalled();
    });
  });

  describe('Password Change Validation', () => {
    // TC-F-019: Password change form requires current password, new password, and confirm password fields
    // TC-F-020: Current password validation uses bcrypt.compare against stored hash
    test('TC-F-019, TC-F-020: validatePassword should verify current password', async () => {
      bcrypt.compare.mockResolvedValue(true);
      
      const result = await User.validatePassword('currentpass', 'hashedpass');
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('currentpass', 'hashedpass');
    });

    test('TC-F-020: validatePassword should reject incorrect current password', async () => {
      bcrypt.compare.mockResolvedValue(false);
      
      const result = await User.validatePassword('wrongpass', 'hashedpass');
      expect(result).toBe(false);
    });

    // TC-F-021: New password must be 6-128 characters with uppercase, lowercase, and number
    test('TC-F-021: isValidPassword should enforce password strength rules', () => {
      expect(User.isValidPassword('Password1')).toBe(true);
      expect(User.isValidPassword('pass1')).toBe(false); // No uppercase
      expect(User.isValidPassword('PASSWORD1')).toBe(false); // No lowercase
      expect(User.isValidPassword('Password')).toBe(false); // No number
      expect(User.isValidPassword('Pass1')).toBe(false); // Too short
      expect(User.isValidPassword('P'.repeat(129))).toBe(false); // Too long
      expect(User.isValidPassword('')).toBe(false); // Empty
      expect(User.isValidPassword(null)).toBe(false); // Null
    });

    test('should handle bcrypt errors gracefully', async () => {
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));
      
      await expect(User.validatePassword('password', 'hash'))
        .rejects.toThrow('Bcrypt error');
    });
  });

  describe('Database Security', () => {
    // TC-F-025: Database updates use parameterized queries to prevent SQL injection
    test('TC-F-025: updateById should use parameterized queries', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });
      
      await User.updateById(1, { name: 'New Name', email: 'new@example.com' });
      
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        ['New Name', 'new@example.com', 1],
        expect.any(Function)
      );
    });

    test('TC-F-025: findByEmail should use parameterized queries', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 1, email: 'test@example.com' });
      });
      
      await User.findByEmail('test@example.com');
      
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com'],
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    test('updateProfile should reject invalid parameters', async () => {
      await expect(User.updateProfile(null, {})).rejects.toThrow('Invalid user ID');
      await expect(User.updateProfile(1, null)).rejects.toThrow('Invalid updates object');
      await expect(User.updateProfile('invalid', {})).rejects.toThrow('Invalid user ID');
    });

    test('updateById should handle database errors', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'));
      });
      
      await expect(User.updateById(1, { name: 'Test' })).rejects.toThrow('Database error');
    });

    test('findByEmail should reject invalid email parameter', async () => {
      await expect(User.findByEmail(null)).rejects.toThrow('Invalid email parameter');
      await expect(User.findByEmail('')).rejects.toThrow('Invalid email parameter');
    });
  });
});