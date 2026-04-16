const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('Database Migration - Profile Picture Column', () => {
  let db;
  let testDbPath;

  const PROFILE_PICTURE_COLUMN_NAME = 'profile_picture';
  const USERS_TABLE_NAME = 'users';
  const TEST_USER_DATA = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword123',
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    // Create unique test database for each test
    testDbPath = path.join(__dirname, `test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    
    // Enable foreign keys and WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Migration Setup and Prerequisites', () => {
    it('should create users table without profile_picture column initially', () => {
      // Create original users table without profile_picture column
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Verify table exists
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(USERS_TABLE_NAME);
      expect(tableInfo).to.exist;
      expect(tableInfo.name).to.equal(USERS_TABLE_NAME);
      
      // Verify profile_picture column does not exist initially
      const columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      const profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      expect(profilePictureColumn).to.be.undefined;
    });

    it('should handle empty users table migration', () => {
      // Create table without profile_picture column
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Perform migration
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      
      expect(() => {
        db.exec(migrationSql);
      }).to.not.throw();
      
      // Verify column was added
      const columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      const profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      expect(profilePictureColumn).to.exist;
      expect(profilePictureColumn.type).to.equal('TEXT');
      expect(profilePictureColumn.notnull).to.equal(0); // NULL allowed
      expect(profilePictureColumn.dflt_value).to.be.null; // Default is NULL
    });
  });

  describe('Migration with Existing Data', () => {
    beforeEach(() => {
      // Create users table and insert test data
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Insert test user data
      const insertSql = `
        INSERT INTO ${USERS_TABLE_NAME} (name, email, password, created_at)
        VALUES (?, ?, ?, ?)
      `;
      
      db.prepare(insertSql).run(
        TEST_USER_DATA.name,
        TEST_USER_DATA.email,
        TEST_USER_DATA.password,
        TEST_USER_DATA.created_at
      );
    });

    it('should successfully add profile_picture column to table with existing users', () => {
      // Verify user exists before migration
      const userBefore = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME} WHERE email = ?`).get(TEST_USER_DATA.email);
      expect(userBefore).to.exist;
      expect(userBefore.name).to.equal(TEST_USER_DATA.name);
      expect(userBefore.email).to.equal(TEST_USER_DATA.email);

      // Perform migration
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      
      expect(() => {
        db.exec(migrationSql);
      }).to.not.throw();

      // Verify user data integrity after migration
      const userAfter = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME} WHERE email = ?`).get(TEST_USER_DATA.email);
      expect(userAfter).to.exist;
      expect(userAfter.name).to.equal(TEST_USER_DATA.name);
      expect(userAfter.email).to.equal(TEST_USER_DATA.email);
      expect(userAfter.password).to.equal(TEST_USER_DATA.password);
      expect(userAfter.created_at).to.equal(TEST_USER_DATA.created_at);
      expect(userAfter.profile_picture).to.be.null; // New column defaults to NULL
    });

    it('should maintain data integrity with multiple existing users', () => {
      const additionalUsers = [
        { name: 'User Two', email: 'user2@example.com', password: 'hash2', created_at: new Date().toISOString() },
        { name: 'User Three', email: 'user3@example.com', password: 'hash3', created_at: new Date().toISOString() }
      ];

      // Insert additional users
      const insertSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, created_at) VALUES (?, ?, ?, ?)`;
      const insertStmt = db.prepare(insertSql);
      
      additionalUsers.forEach(user => {
        insertStmt.run(user.name, user.email, user.password, user.created_at);
      });

      // Verify all users exist before migration
      const userCountBefore = db.prepare(`SELECT COUNT(*) as count FROM ${USERS_TABLE_NAME}`).get();
      expect(userCountBefore.count).to.equal(3);

      // Perform migration
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);

      // Verify all users still exist with correct data
      const userCountAfter = db.prepare(`SELECT COUNT(*) as count FROM ${USERS_TABLE_NAME}`).get();
      expect(userCountAfter.count).to.equal(3);

      const allUsers = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME} ORDER BY id`).all();
      expect(allUsers).to.have.length(3);
      
      allUsers.forEach(user => {
        expect(user.profile_picture).to.be.null;
        expect(user.name).to.be.a('string');
        expect(user.email).to.be.a('string');
        expect(user.password).to.be.a('string');
        expect(user.created_at).to.be.a('string');
      });
    });

    it('should preserve table constraints after migration', () => {
      // Perform migration
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);

      // Test unique email constraint still works
      const insertDuplicateEmail = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password) VALUES (?, ?, ?)`;
      
      expect(() => {
        db.prepare(insertDuplicateEmail).run('Duplicate User', TEST_USER_DATA.email, 'password');
      }).to.throw();

      // Test NOT NULL constraints still work
      const insertNullName = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password) VALUES (?, ?, ?)`;
      
      expect(() => {
        db.prepare(insertNullName).run(null, 'new@example.com', 'password');
      }).to.throw();
    });
  });

  describe('Migration Idempotency', () => {
    beforeEach(() => {
      // Create users table
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
    });

    it('should handle running migration twice without errors', () => {
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      
      // First migration should succeed
      expect(() => {
        db.exec(migrationSql);
      }).to.not.throw();
      
      // Verify column exists
      let columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      let profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      expect(profilePictureColumn).to.exist;
      
      // Second migration should fail with specific error
      expect(() => {
        db.exec(migrationSql);
      }).to.throw(/duplicate column name/i);
      
      // Verify column still exists and table is not corrupted
      columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      expect(profilePictureColumn).to.exist;
    });

    it('should provide safe migration with IF NOT EXISTS check', () => {
      // Simulate safe migration pattern
      const safeMigration = () => {
        // Check if column already exists
        const columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
        const columnExists = columns.some(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
        
        if (!columnExists) {
          const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
          db.exec(migrationSql);
          return true; // Migration performed
        }
        return false; // Migration skipped
      };

      // First run should perform migration
      const firstResult = safeMigration();
      expect(firstResult).to.be.true;
      
      // Verify column exists
      let columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      let profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      expect(profilePictureColumn).to.exist;
      
      // Second run should skip migration
      const secondResult = safeMigration();
      expect(secondResult).to.be.false;
      
      // Verify column still exists
      columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      expect(profilePictureColumn).to.exist;
    });
  });

  describe('Migration Error Handling', () => {
    it('should handle migration on non-existent table', () => {
      const migrationSql = `ALTER TABLE non_existent_table ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      
      expect(() => {
        db.exec(migrationSql);
      }).to.throw(/no such table/i);
    });

    it('should handle invalid column definition', () => {
      // Create users table first
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Try migration with invalid syntax
      const invalidMigrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} INVALID_TYPE`;
      
      expect(() => {
        db.exec(invalidMigrationSql);
      }).to.throw();
    });

    it('should handle database connection errors during migration', () => {
      // Create users table
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Close database connection
      db.close();
      
      // Try migration on closed database
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      
      expect(() => {
        db.exec(migrationSql);
      }).to.throw();
    });
  });

  describe('Column Specification and Properties', () => {
    beforeEach(() => {
      // Create users table
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
    });

    it('should create profile_picture column with correct TEXT type', () => {
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);
      
      const columns = db.pragma(`table_info(${USERS_TABLE_NAME})`);
      const profilePictureColumn = columns.find(col => col.name === PROFILE_PICTURE_COLUMN_NAME);
      
      expect(profilePictureColumn).to.exist;
      expect(profilePictureColumn.type).to.equal('TEXT');
      expect(profilePictureColumn.notnull).to.equal(0); // NULL allowed
      expect(profilePictureColumn.dflt_value).to.be.null; // No default value
      expect(profilePictureColumn.pk).to.equal(0); // Not primary key
    });

    it('should allow NULL values in profile_picture column', () => {
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);
      
      // Insert user with NULL profile picture
      const insertSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, profile_picture) VALUES (?, ?, ?, ?)`;
      
      expect(() => {
        db.prepare(insertSql).run('Test User', 'test@example.com', 'password', null);
      }).to.not.throw();
      
      // Verify NULL value was stored
      const user = db.prepare(`SELECT profile_picture FROM ${USERS_TABLE_NAME} WHERE email = ?`).get('test@example.com');
      expect(user.profile_picture).to.be.null;
    });

    it('should accept text values in profile_picture column', () => {
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);
      
      const testFilePath = 'uploads/123-1640995200000.jpg';
      
      // Insert user with profile picture path
      const insertSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, profile_picture) VALUES (?, ?, ?, ?)`;
      
      expect(() => {
        db.prepare(insertSql).run('Test User', 'test@example.com', 'password', testFilePath);
      }).to.not.throw();
      
      // Verify text value was stored correctly
      const user = db.prepare(`SELECT profile_picture FROM ${USERS_TABLE_NAME} WHERE email = ?`).get('test@example.com');
      expect(user.profile_picture).to.equal(testFilePath);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing functionality after adding profile_picture column', () => {
      // Create and populate table
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Insert user before migration
      const insertSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password) VALUES (?, ?, ?)`;
      db.prepare(insertSql).run(TEST_USER_DATA.name, TEST_USER_DATA.email, TEST_USER_DATA.password);
      
      // Perform migration
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);
      
      // Test existing queries still work
      const selectAllSql = `SELECT * FROM ${USERS_TABLE_NAME}`;
      const users = db.prepare(selectAllSql).all();
      expect(users).to.have.length(1);
      expect(users[0].name).to.equal(TEST_USER_DATA.name);
      expect(users[0].profile_picture).to.be.null;
      
      // Test queries without profile_picture column still work
      const selectSpecificSql = `SELECT name, email FROM ${USERS_TABLE_NAME} WHERE email = ?`;
      const user = db.prepare(selectSpecificSql).get(TEST_USER_DATA.email);
      expect(user.name).to.equal(TEST_USER_DATA.name);
      expect(user.email).to.equal(TEST_USER_DATA.email);
      
      // Test updates without profile_picture still work
      const updateSql = `UPDATE ${USERS_TABLE_NAME} SET name = ? WHERE email = ?`;
      const newName = 'Updated Name';
      db.prepare(updateSql).run(newName, TEST_USER_DATA.email);
      
      const updatedUser = db.prepare(`SELECT name, profile_picture FROM ${USERS_TABLE_NAME} WHERE email = ?`).get(TEST_USER_DATA.email);
      expect(updatedUser.name).to.equal(newName);
      expect(updatedUser.profile_picture).to.be.null; // Should remain NULL
    });

    it('should allow queries to explicitly handle NULL profile_picture values', () => {
      // Setup table and migration
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);
      
      // Insert users with and without profile pictures
      const insertSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, profile_picture) VALUES (?, ?, ?, ?)`;
      db.prepare(insertSql).run('User One', 'user1@example.com', 'pass1', null);
      db.prepare(insertSql).run('User Two', 'user2@example.com', 'pass2', 'uploads/user2.jpg');
      
      // Test querying users with NULL profile pictures
      const usersWithoutPicture = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME} WHERE profile_picture IS NULL`).all();
      expect(usersWithoutPicture).to.have.length(1);
      expect(usersWithoutPicture[0].name).to.equal('User One');
      
      // Test querying users with profile pictures
      const usersWithPicture = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME} WHERE profile_picture IS NOT NULL`).all();
      expect(usersWithPicture).to.have.length(1);
      expect(usersWithPicture[0].name).to.equal('User Two');
      expect(usersWithPicture[0].profile_picture).to.equal('uploads/user2.jpg');
    });
  });

  describe('Database Integrity and Consistency', () => {
    beforeEach(() => {
      // Create users table
      const createTableSql = `
        CREATE TABLE ${USERS_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.exec(createTableSql);
      
      // Perform migration
      const migrationSql = `ALTER TABLE ${USERS_TABLE_NAME} ADD COLUMN ${PROFILE_PICTURE_COLUMN_NAME} TEXT`;
      db.exec(migrationSql);
    });

    it('should maintain database integrity after migration under concurrent access simulation', () => {
      const users = [
        { name: 'User 1', email: 'user1@example.com', password: 'pass1' },
        { name: 'User 2', email: 'user2@example.com', password: 'pass2' },
        { name: 'User 3', email: 'user3@example.com', password: 'pass3' }
      ];
      
      // Simulate concurrent inserts
      const insertSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, profile_picture) VALUES (?, ?, ?, ?)`;
      const insertStmt = db.prepare(insertSql);
      
      users.forEach((user, index) => {
        const profilePicture = index % 2 === 0 ? `uploads/user${index}.jpg` : null;
        insertStmt.run(user.name, user.email, user.password, profilePicture);
      });
      
      // Verify all data is consistent
      const allUsers = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME} ORDER BY id`).all();
      expect(allUsers).to.have.length(3);
      
      allUsers.forEach((user, index) => {
        expect(user.name).to.equal(users[index].name);
        expect(user.email).to.equal(users[index].email);
        expect(user.password).to.equal(users[index].password);
        
        if (index % 2 === 0) {
          expect(user.profile_picture).to.equal(`uploads/user${index}.jpg`);
        } else {
          expect(user.profile_picture).to.be.null;
        }
      });
    });

    it('should handle transaction rollback scenarios after migration', () => {
      const insertUser1Sql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, profile_picture) VALUES (?, ?, ?, ?)`;
      
      // Insert initial user
      db.prepare(insertUser1Sql).run('Valid User', 'valid@example.com', 'password', 'uploads/valid.jpg');
      
      // Test transaction rollback with constraint violation
      const transaction = db.transaction(() => {
        // This should work
        db.prepare(insertUser1Sql).run('User A', 'usera@example.com', 'passwordA', null);
        
        // This should fail due to duplicate email, causing rollback
        db.prepare(insertUser1Sql).run('User B', 'valid@example.com', 'passwordB', 'uploads/userb.jpg');
      });
      
      expect(() => {
        transaction();
      }).to.throw();
      
      // Verify rollback - only original user should exist
      const users = db.prepare(`SELECT * FROM ${USERS_TABLE_NAME}`).all();
      expect(users).to.have.length(1);
      expect(users[0].name).to.equal('Valid User');
      expect(users[0].email).to.equal('valid@example.com');
      expect(users[0].profile_picture).to.equal('uploads/valid.jpg');
    });

    it('should maintain referential integrity patterns after migration', () => {
      // Create a related table that references users
      const createPostsTableSql = `
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES ${USERS_TABLE_NAME}(id) ON DELETE CASCADE
        )
      `;
      
      db.exec(createPostsTableSql);
      
      // Insert user and related post
      const insertUserSql = `INSERT INTO ${USERS_TABLE_NAME} (name, email, password, profile_picture) VALUES (?, ?, ?, ?)`;
      const result = db.prepare(insertUserSql).run('Author User', 'author@example.com', 'password', 'uploads/author.jpg');
      const userId = result.lastInsertRowid;
      
      const insertPostSql = `INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)`;
      db.prepare(insertPostSql).run(userId, 'Test Post', 'Post content');
      
      // Verify foreign key relationship works
      const userWithPosts = db.prepare(`
        SELECT u.name, u.email, u.profile_picture, p.title, p.content
        FROM ${USERS_TABLE_NAME} u
        JOIN posts p ON u.id = p.user_id
        WHERE u.id = ?
      `).get(userId);
      
      expect(userWithPosts).to.exist;
      expect(userWithPosts.name).to.equal('Author User');
      expect(userWithPosts.profile_picture).to.equal('uploads/author.jpg');
      expect(userWithPosts.title).to.equal('Test Post');
      
      // Test cascade delete still works
      db.prepare(`DELETE FROM ${USERS_TABLE_NAME} WHERE id = ?`).run(userId);
      
      const remainingPosts = db.prepare('SELECT * FROM posts WHERE user_id = ?').all(userId);
      expect(remainingPosts).to.have.length(0);
    });
  });
});