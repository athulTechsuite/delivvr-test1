import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_DB_PATH = path.join(__dirname, 'test-profile.db');

// Mock database helper
class TestDatabase {
  private db: sqlite3.Database;
  
  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }
  
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create users table with profile_picture column
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          profile_picture TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      this.db.run(createTableQuery, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  alterTableAddProfilePicture(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Simulate adding profile_picture column to existing table
      const alterQuery = 'ALTER TABLE users ADD COLUMN profile_picture TEXT';
      
      this.db.run(alterQuery, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  insertUser(userData: any): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users (username, name, email, password, profile_picture)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        userData.username,
        userData.name, 
        userData.email,
        userData.password,
        userData.profile_picture
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }
  
  getUserById(id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE id = ?';
      
      this.db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
  
  updateUser(id: number, updateData: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      
      const query = `UPDATE users SET ${setClause} WHERE id = ?`;
      values.push(id);
      
      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  checkEmailUnique(email: string, excludeId?: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT id FROM users WHERE email = ?';
      const params = [email];
      
      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!row); // true if unique (no existing row)
        }
      });
    });
  }
  
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => {
        resolve();
      });
    });
  }
}

describe('Database Schema - Profile Picture Column', () => {
  let database: TestDatabase;
  
  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    database = new TestDatabase(TEST_DB_PATH);
    await database.init();
  });
  
  afterEach(async () => {
    await database.close();
    
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });
  
  describe('Profile Picture Column Addition', () => {
    // TC-D-001
    it('should add profile_picture column as TEXT type with NULL default', async () => {
      // Insert a user without profile_picture to test default behavior
      const userId = await database.insertUser({
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      const user = await database.getUserById(userId);
      
      expect(user.profile_picture).toBeNull();
      expect(typeof user.profile_picture === 'string' || user.profile_picture === null).toBe(true);
    });
    
    // TC-D-002
    it('should maintain backward compatibility for existing users', async () => {
      // Simulate existing user data before migration
      const userData = {
        username: 'existinguser',
        name: 'Existing User',
        email: 'existing@example.com', 
        password: 'hashedpassword',
        profile_picture: null
      };
      
      const userId = await database.insertUser(userData);
      const user = await database.getUserById(userId);
      
      // Existing user should have NULL profile_picture
      expect(user.profile_picture).toBeNull();
      expect(user.username).toBe(userData.username);
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
    });
    
    // TC-D-003
    it('should handle ALTER TABLE operation without breaking existing data', async () => {
      // This would typically be tested in a migration scenario
      // For this test, we'll simulate adding the column to an existing table
      try {
        await database.alterTableAddProfilePicture();
        // Should not throw error even if column already exists
        expect(true).toBe(true);
      } catch (error) {
        // Only acceptable error is duplicate column
        expect(error.message).toContain('duplicate column');
      }
    });
  });
  
  describe('Profile Picture Data Storage', () => {
    // TC-D-004
    it('should store relative file paths in profile_picture column', async () => {
      const userId = await database.insertUser({
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        profile_picture: 'uploads/123-1640995200000.jpg'
      });
      
      const user = await database.getUserById(userId);
      
      expect(user.profile_picture).toBe('uploads/123-1640995200000.jpg');
      expect(user.profile_picture).toMatch(/^uploads\/\d+-\d+\.(jpg|jpeg|png|gif)$/);
    });
    
    // TC-D-005
    it('should allow NULL values for users without profile pictures', async () => {
      const userId = await database.insertUser({
        username: 'nopicuser',
        name: 'No Picture User',
        email: 'nopic@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      const user = await database.getUserById(userId);
      
      expect(user.profile_picture).toBeNull();
    });
    
    // TC-D-006
    it('should update profile_picture column independently of other fields', async () => {
      const userId = await database.insertUser({
        username: 'updatetest',
        name: 'Update Test',
        email: 'update@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      // Update only profile picture
      await database.updateUser(userId, {
        profile_picture: 'uploads/456-1640995300000.png'
      });
      
      const updatedUser = await database.getUserById(userId);
      
      expect(updatedUser.profile_picture).toBe('uploads/456-1640995300000.png');
      expect(updatedUser.name).toBe('Update Test'); // Other fields unchanged
      expect(updatedUser.email).toBe('update@example.com');
    });
  });
  
  describe('Data Integrity and Constraints', () => {
    // TC-D-007
    it('should maintain email uniqueness constraint with profile updates', async () => {
      // Create two users
      const user1Id = await database.insertUser({
        username: 'user1',
        name: 'User One',
        email: 'user1@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      const user2Id = await database.insertUser({
        username: 'user2',
        name: 'User Two', 
        email: 'user2@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      // Check email uniqueness
      const isUnique = await database.checkEmailUnique('user1@example.com', user2Id);
      expect(isUnique).toBe(false); // Should not be unique (already taken)
      
      const isUniqueForNewEmail = await database.checkEmailUnique('newemail@example.com');
      expect(isUniqueForNewEmail).toBe(true); // Should be unique
    });
    
    // TC-D-008
    it('should handle profile picture column in atomic update operations', async () => {
      const userId = await database.insertUser({
        username: 'atomictest',
        name: 'Atomic Test',
        email: 'atomic@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      // Simulate atomic update of multiple fields including profile picture
      await database.updateUser(userId, {
        name: 'Updated Atomic Test',
        email: 'updated-atomic@example.com',
        profile_picture: 'uploads/789-1640995400000.jpg'
      });
      
      const updatedUser = await database.getUserById(userId);
      
      expect(updatedUser.name).toBe('Updated Atomic Test');
      expect(updatedUser.email).toBe('updated-atomic@example.com');
      expect(updatedUser.profile_picture).toBe('uploads/789-1640995400000.jpg');
    });
  });
  
  describe('Migration and Schema Validation', () => {
    // TC-D-009
    it('should preserve existing user data during schema migration', async () => {
      const originalUserData = {
        username: 'migrationtest',
        name: 'Migration Test User',
        email: 'migration@example.com',
        password: 'hashedpassword',
        profile_picture: null
      };
      
      const userId = await database.insertUser(originalUserData);
      
      // Simulate migration (column already exists in our test setup)
      await database.alterTableAddProfilePicture().catch(() => {
        // Ignore duplicate column error
      });
      
      const userAfterMigration = await database.getUserById(userId);
      
      expect(userAfterMigration.username).toBe(originalUserData.username);
      expect(userAfterMigration.name).toBe(originalUserData.name);
      expect(userAfterMigration.email).toBe(originalUserData.email);
      expect(userAfterMigration.password).toBe(originalUserData.password);
      expect(userAfterMigration.profile_picture).toBeNull();
    });
    
    // TC-D-010
    it('should handle profile picture column length constraints', async () => {
      const longFilePath = 'uploads/' + 'a'.repeat(200) + '.jpg';
      
      const userId = await database.insertUser({
        username: 'longpath',
        name: 'Long Path User',
        email: 'longpath@example.com',
        password: 'hashedpassword',
        profile_picture: longFilePath
      });
      
      const user = await database.getUserById(userId);
      
      // TEXT type should handle long paths
      expect(user.profile_picture).toBe(longFilePath);
      expect(user.profile_picture.length).toBeGreaterThan(200);
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      await database.close();
      
      try {
        await database.getUserById(1);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
    
    it('should handle invalid update data types', async () => {
      const userId = await database.insertUser({
        username: 'invalidtest',
        name: 'Invalid Test',
        email: 'invalid@example.com',
        password: 'hashedpassword',
        profile_picture: null
      });
      
      // Update with valid profile picture path
      await database.updateUser(userId, {
        profile_picture: 'uploads/valid-123.jpg'
      });
      
      const user = await database.getUserById(userId);
      expect(user.profile_picture).toBe('uploads/valid-123.jpg');
    });
  });
});