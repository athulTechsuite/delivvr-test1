import { db, dbHelpers } from '../config/database.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

describe('Database Configuration and Helpers', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await new Promise((resolve) => {
      db.run('DELETE FROM users WHERE email LIKE "%test%"', resolve);
    });
  });

  afterAll(() => {
    db.close();
  });

  describe('Database Schema and Migration', () => {
    // TC-AC-013
    test('should have profile_picture column in users table', async () => {
      const result = await new Promise<any>((resolve, reject) => {
        db.get('PRAGMA table_info(users)', (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      
      const columns = await new Promise<any[]>((resolve, reject) => {
        db.all('PRAGMA table_info(users)', (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
      
      const profilePictureColumn = columns.find(col => col.name === 'profile_picture');
      expect(profilePictureColumn).toBeDefined();
      expect(profilePictureColumn.type).toBe('TEXT');
      expect(profilePictureColumn.dflt_value).toBeNull();
    });

    // TC-AC-013  
    test('should maintain backward compatibility with existing user records', async () => {
      const testUser = {
        name: 'Test User',
        email: 'test-migration@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await dbHelpers.createUser(testUser.name, testUser.email, testUser.password);
      const retrievedUser = await dbHelpers.getUserById(createdUser.id);
      
      expect(retrievedUser.profile_picture).toBeNull();
      expect(retrievedUser.name).toBe(testUser.name);
      expect(retrievedUser.email).toBe(testUser.email);
    });
  });

  describe('Database Helper Functions - Input Validation', () => {
    // TC-AC-008
    test('getUserByEmail should validate email parameter', async () => {
      await expect(dbHelpers.getUserByEmail('')).rejects.toThrow('Email must be a non-empty string');
      await expect(dbHelpers.getUserByEmail(null as any)).rejects.toThrow('Email must be a non-empty string');
      await expect(dbHelpers.getUserByEmail(123 as any)).rejects.toThrow('Email must be a non-empty string');
    });

    // TC-AC-008
    test('getUserById should validate ID parameter', async () => {
      await expect(dbHelpers.getUserById('')).rejects.toThrow('ID must be a valid integer');
      await expect(dbHelpers.getUserById('invalid')).rejects.toThrow('ID must be a valid integer');
      await expect(dbHelpers.getUserById(null as any)).rejects.toThrow('ID must be a valid integer');
    });

    // TC-AC-008
    test('createUser should validate input parameters', async () => {
      await expect(dbHelpers.createUser('', 'test@example.com', 'password'))
        .rejects.toThrow('Name must be a non-empty string');
      await expect(dbHelpers.createUser('Test User', '', 'password'))
        .rejects.toThrow('Email must be a non-empty string');
      await expect(dbHelpers.createUser('Test User', 'test@example.com', ''))
        .rejects.toThrow('Hashed password must be a non-empty string');
    });

    // TC-AC-008
    test('updateProfile should validate all input parameters', async () => {
      await expect(dbHelpers.updateProfile('', 'Test', 'test@example.com', null))
        .rejects.toThrow('User ID must be a valid integer');
      await expect(dbHelpers.updateProfile(1, '', 'test@example.com', null))
        .rejects.toThrow('Name must be a non-empty string');
      await expect(dbHelpers.updateProfile(1, 'Test', '', null))
        .rejects.toThrow('Email must be a non-empty string');
      await expect(dbHelpers.updateProfile(1, 'Test', 'test@example.com', 123 as any))
        .rejects.toThrow('Profile picture must be a string or null');
    });
  });

  describe('User Creation and Retrieval', () => {
    // TC-AC-001
    test('should create user and store profile data correctly', async () => {
      const testUser = {
        name: 'John Doe',
        email: 'john.test@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await dbHelpers.createUser(testUser.name, testUser.email, testUser.password);
      
      expect(createdUser.id).toBeDefined();
      expect(createdUser.name).toBe(testUser.name);
      expect(createdUser.email).toBe(testUser.email);
      
      const retrievedUser = await dbHelpers.getUserById(createdUser.id);
      expect(retrievedUser.name).toBe(testUser.name);
      expect(retrievedUser.email).toBe(testUser.email);
      expect(retrievedUser.profile_picture).toBeNull();
    });

    // TC-AC-001
    test('should retrieve user profile without password', async () => {
      const testUser = await dbHelpers.createUser('Profile User', 'profile.test@example.com', 'hashedpass');
      
      const profile = await dbHelpers.getUserProfileById(testUser.id);
      
      expect(profile.id).toBe(testUser.id);
      expect(profile.name).toBe('Profile User');
      expect(profile.email).toBe('profile.test@example.com');
      expect(profile.profile_picture).toBeNull();
      expect(profile.created_at).toBeDefined();
      expect(profile).not.toHaveProperty('password');
    });
  });

  describe('Profile Updates', () => {
    let testUserId: number;
    
    beforeEach(async () => {
      const user = await dbHelpers.createUser('Update Test', 'update.test@example.com', 'hashedpass');
      testUserId = user.id;
    });

    // TC-AC-006
    test('should update profile with valid data', async () => {
      const updatedData = {
        name: 'Updated Name',
        email: 'updated.test@example.com',
        profilePicture: 'uploads/123-1640995200000.jpg'
      };
      
      const result = await dbHelpers.updateProfile(
        testUserId,
        updatedData.name,
        updatedData.email,
        updatedData.profilePicture
      );
      
      expect(result.id).toBe(testUserId);
      expect(result.name).toBe(updatedData.name);
      expect(result.email).toBe(updatedData.email);
      expect(result.profile_picture).toBe(updatedData.profilePicture);
    });

    // TC-AC-011
    test('should update profile picture path in database', async () => {
      const profilePicturePath = 'uploads/456-1640995200000.png';
      
      await dbHelpers.updateProfile(testUserId, 'Test User', 'test.update@example.com', profilePicturePath);
      
      const updatedUser = await dbHelpers.getUserProfileById(testUserId);
      expect(updatedUser.profile_picture).toBe(profilePicturePath);
    });

    // TC-AC-006
    test('should reject update for non-existent user', async () => {
      await expect(dbHelpers.updateProfile(99999, 'Name', 'email@test.com', null))
        .rejects.toThrow('User not found or no changes made');
    });

    // TC-AC-008
    test('should trim whitespace from name and email', async () => {
      const result = await dbHelpers.updateProfile(
        testUserId,
        '  Trimmed Name  ',
        '  trimmed@example.com  ',
        null
      );
      
      expect(result.name).toBe('Trimmed Name');
      expect(result.email).toBe('trimmed@example.com');
    });
  });

  describe('Email Uniqueness', () => {
    // TC-AC-009
    test('should enforce unique email constraint', async () => {
      const email = 'unique.test@example.com';
      await dbHelpers.createUser('User One', email, 'password1');
      
      await expect(dbHelpers.createUser('User Two', email, 'password2'))
        .rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', () => {
      const invalidDb = new sqlite3.Database('/invalid/path/database.sqlite');
      expect(invalidDb).toBeDefined(); // Constructor doesn't throw immediately
    });

    test('should handle getUserByEmail for non-existent email', async () => {
      const result = await dbHelpers.getUserByEmail('nonexistent@example.com');
      expect(result).toBeUndefined();
    });

    test('should handle getUserById for non-existent ID', async () => {
      const result = await dbHelpers.getUserById(99999);
      expect(result).toBeUndefined();
    });
  });
});