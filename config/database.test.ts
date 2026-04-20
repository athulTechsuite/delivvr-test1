import { dbHelpers, db } from '../config/database';
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import path from 'path';

// Mock SQLite database for testing
let testDb: sqlite3.Database;

beforeEach(async () => {
  // Create in-memory test database
  testDb = new sqlite3.Database(':memory:');
  
  // Create users table
  await new Promise<void>((resolve, reject) => {
    testDb.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  // Mock the database connection in dbHelpers
  (dbHelpers as any).db = testDb;
});

afterEach(() => {
  if (testDb) {
    testDb.close();
  }
});

describe('Database Helper Functions', () => {
  const TEST_USER = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword123'
  };

  describe('getUserByEmail', () => {
    // TC-F-013: Profile page fetches current user data from database using JWT token user ID
    test('should return user when email exists', async () => {
      // Create test user
      await new Promise<void>((resolve, reject) => {
        testDb.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
          [TEST_USER.name, TEST_USER.email, TEST_USER.password], 
          (err) => err ? reject(err) : resolve());
      });

      const user = await dbHelpers.getUserByEmail(TEST_USER.email);
      
      expect(user).toBeDefined();
      expect(user.email).toBe(TEST_USER.email);
      expect(user.name).toBe(TEST_USER.name);
    });

    test('should return undefined when email does not exist', async () => {
      const user = await dbHelpers.getUserByEmail('nonexistent@example.com');
      expect(user).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    // TC-F-013: Profile page fetches current user data from database using JWT token user ID
    test('should return user when ID exists', async () => {
      // Create test user
      const result = await new Promise<{ lastID: number }>((resolve, reject) => {
        testDb.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
          [TEST_USER.name, TEST_USER.email, TEST_USER.password], 
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          });
      });

      const user = await dbHelpers.getUserById(result.lastID);
      
      expect(user).toBeDefined();
      expect(user.id).toBe(result.lastID);
      expect(user.email).toBe(TEST_USER.email);
      expect(user.name).toBe(TEST_USER.name);
    });

    test('should return undefined when ID does not exist', async () => {
      const user = await dbHelpers.getUserById(999);
      expect(user).toBeUndefined();
    });
  });

  describe('createUser', () => {
    test('should create new user successfully', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const result = await dbHelpers.createUser(TEST_USER.name, TEST_USER.email, hashedPassword);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(TEST_USER.name);
      expect(result.email).toBe(TEST_USER.email);
      expect(result.password).toBeUndefined(); // Should not return password
    });

    test('should reject duplicate email', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      // Create first user
      await dbHelpers.createUser(TEST_USER.name, TEST_USER.email, hashedPassword);
      
      // Attempt to create duplicate
      await expect(dbHelpers.createUser('Another User', TEST_USER.email, hashedPassword))
        .rejects.toThrow();
    });
  });

  describe('updateUserName', () => {
    let userId: number;

    beforeEach(async () => {
      // Create test user
      const result = await new Promise<{ lastID: number }>((resolve, reject) => {
        testDb.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
          [TEST_USER.name, TEST_USER.email, TEST_USER.password], 
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          });
      });
      userId = result.lastID;
    });

    // TC-F-009: Save button updates user name in database and shows success feedback
    test('should update user name successfully', async () => {
      const newName = 'Updated User Name';
      
      const result = await dbHelpers.updateUserName(userId, newName);
      
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      
      // Verify update in database
      const user = await dbHelpers.getUserById(userId);
      expect(user.name).toBe(newName);
    });

    // TC-F-003: Profile name field validates that the name is not empty before saving
    // TC-F-004: Profile name field applies same validation rules as signup form (minimum 2 characters)
    test('should reject invalid name - empty string', async () => {
      await expect(dbHelpers.updateUserName(userId, ''))
        .rejects.toThrow('Invalid name');
    });

    test('should reject invalid name - too short', async () => {
      await expect(dbHelpers.updateUserName(userId, 'A'))
        .rejects.toThrow('Invalid name');
    });

    test('should reject invalid name - too long', async () => {
      const longName = 'A'.repeat(51);
      await expect(dbHelpers.updateUserName(userId, longName))
        .rejects.toThrow('Invalid name');
    });

    test('should trim whitespace from name', async () => {
      const nameWithSpaces = '  Valid Name  ';
      
      await dbHelpers.updateUserName(userId, nameWithSpaces);
      
      const user = await dbHelpers.getUserById(userId);
      expect(user.name).toBe('Valid Name');
    });

    test('should reject invalid user ID', async () => {
      await expect(dbHelpers.updateUserName('invalid' as any, 'Valid Name'))
        .rejects.toThrow('Invalid user ID');
    });

    test('should reject non-existent user ID', async () => {
      await expect(dbHelpers.updateUserName(999, 'Valid Name'))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateUserPassword', () => {
    let userId: number;

    beforeEach(async () => {
      // Create test user
      const result = await new Promise<{ lastID: number }>((resolve, reject) => {
        testDb.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
          [TEST_USER.name, TEST_USER.email, TEST_USER.password], 
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          });
      });
      userId = result.lastID;
    });

    // TC-F-007: New password field applies same validation rules as signup form (minimum 6 characters)
    test('should update user password successfully', async () => {
      const newHashedPassword = await bcrypt.hash('newPassword123', 10);
      
      const result = await dbHelpers.updateUserPassword(userId, newHashedPassword);
      
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      
      // Verify password was updated
      const user = await dbHelpers.getUserForPasswordUpdate(userId);
      const passwordValid = await bcrypt.compare('newPassword123', user.password);
      expect(passwordValid).toBe(true);
    });

    test('should reject invalid user ID', async () => {
      const newHashedPassword = await bcrypt.hash('newPassword123', 10);
      
      await expect(dbHelpers.updateUserPassword('invalid' as any, newHashedPassword))
        .rejects.toThrow('Invalid user ID');
    });

    test('should reject invalid password hash', async () => {
      await expect(dbHelpers.updateUserPassword(userId, ''))
        .rejects.toThrow('Invalid password hash');
    });

    test('should reject non-existent user ID', async () => {
      const newHashedPassword = await bcrypt.hash('newPassword123', 10);
      
      await expect(dbHelpers.updateUserPassword(999, newHashedPassword))
        .rejects.toThrow('User not found');
    });
  });

  describe('getUserForPasswordUpdate', () => {
    let userId: number;

    beforeEach(async () => {
      // Create test user
      const result = await new Promise<{ lastID: number }>((resolve, reject) => {
        testDb.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
          [TEST_USER.name, TEST_USER.email, TEST_USER.password], 
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          });
      });
      userId = result.lastID;
    });

    // TC-F-006: Current password field validates against user's existing password before allowing password update
    test('should return user with password for verification', async () => {
      const user = await dbHelpers.getUserForPasswordUpdate(userId);
      
      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
      expect(user.name).toBe(TEST_USER.name);
      expect(user.email).toBe(TEST_USER.email);
      expect(user.password).toBe(TEST_USER.password);
    });

    test('should reject invalid user ID', async () => {
      await expect(dbHelpers.getUserForPasswordUpdate('invalid' as any))
        .rejects.toThrow('Invalid user ID');
    });

    test('should reject non-existent user ID', async () => {
      await expect(dbHelpers.getUserForPasswordUpdate(999))
        .rejects.toThrow('User not found');
    });
  });
});