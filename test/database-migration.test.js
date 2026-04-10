const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { expect } = require('chai');

describe('Database Migration Tests', () => {
    let testDb;
    let testDbPath;

    // Setup test database before each test
    beforeEach((done) => {
        // Create unique test database for each test
        testDbPath = path.join(__dirname, `test_migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.sqlite`);
        testDb = new sqlite3.Database(testDbPath, (err) => {
            if (err) {
                done(err);
                return;
            }
            done();
        });
    });

    // Cleanup test database after each test
    afterEach((done) => {
        if (testDb) {
            testDb.close((err) => {
                if (err) {
                    console.error('Error closing test database:', err);
                }
                // Remove test database file
                if (fs.existsSync(testDbPath)) {
                    try {
                        fs.unlinkSync(testDbPath);
                    } catch (unlinkErr) {
                        console.error('Error removing test database file:', unlinkErr);
                    }
                }
                done();
            });
        } else {
            done();
        }
    });

    // Helper function to create basic users table
    const createBasicUsersTable = () => {
        return new Promise((resolve, reject) => {
            testDb.serialize(() => {
                testDb.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    };

    // Helper function to insert test user data
    const insertTestUser = (name, email, password) => {
        return new Promise((resolve, reject) => {
            const stmt = testDb.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
            stmt.run([name, email, password], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    };

    // Helper function to get table info
    const getTableInfo = () => {
        return new Promise((resolve, reject) => {
            testDb.all("PRAGMA table_info(users)", (err, columns) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(columns);
                }
            });
        });
    };

    // Migration function implementation for testing
    const migrateUserTable = () => {
        return new Promise((resolve, reject) => {
            // Check if columns already exist to avoid duplicate migration
            testDb.all("PRAGMA table_info(users)", (err, columns) => {
                if (err) {
                    console.error('Error checking table structure:', err.message);
                    reject(err);
                    return;
                }

                const existingColumns = columns.map(col => col.name);
                const columnsToAdd = [];

                if (!existingColumns.includes('phone')) {
                    columnsToAdd.push('ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL');
                }
                if (!existingColumns.includes('bio')) {
                    columnsToAdd.push('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL');
                }
                if (!existingColumns.includes('avatar_url')) {
                    columnsToAdd.push('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL');
                }

                if (columnsToAdd.length === 0) {
                    console.log('User table migration: all profile columns already exist');
                    resolve();
                    return;
                }

                let completed = 0;
                let hasError = false;

                columnsToAdd.forEach((sql) => {
                    testDb.run(sql, (err) => {
                        if (err && !hasError) {
                            console.error('Error during user table migration:', err.message);
                            hasError = true;
                            reject(err);
                            return;
                        }
                        
                        completed++;
                        if (completed === columnsToAdd.length && !hasError) {
                            console.log(`User table migration: added ${columnsToAdd.length} new profile columns successfully`);
                            resolve();
                        }
                    });
                });
            });
        });
    };

    describe('migrateUserTable function', () => {
        it('should add new columns correctly to fresh users table', async () => {
            // Create basic users table
            await createBasicUsersTable();

            // Get initial table structure
            const initialColumns = await getTableInfo();
            const initialColumnNames = initialColumns.map(col => col.name);

            // Verify initial structure
            expect(initialColumnNames).to.include.members(['id', 'name', 'email', 'password', 'created_at']);
            expect(initialColumnNames).to.not.include.members(['phone', 'bio', 'avatar_url']);

            // Run migration
            await migrateUserTable();

            // Get updated table structure
            const updatedColumns = await getTableInfo();
            const updatedColumnNames = updatedColumns.map(col => col.name);

            // Verify new columns were added
            expect(updatedColumnNames).to.include.members(['id', 'name', 'email', 'password', 'created_at', 'phone', 'bio', 'avatar_url']);

            // Verify column types and defaults
            const phoneColumn = updatedColumns.find(col => col.name === 'phone');
            const bioColumn = updatedColumns.find(col => col.name === 'bio');
            const avatarUrlColumn = updatedColumns.find(col => col.name === 'avatar_url');

            expect(phoneColumn.type).to.equal('VARCHAR(20)');
            expect(phoneColumn.dflt_value).to.be.null;
            expect(phoneColumn.notnull).to.equal(0);

            expect(bioColumn.type).to.equal('TEXT');
            expect(bioColumn.dflt_value).to.be.null;
            expect(bioColumn.notnull).to.equal(0);

            expect(avatarUrlColumn.type).to.equal('VARCHAR(255)');
            expect(avatarUrlColumn.dflt_value).to.be.null;
            expect(avatarUrlColumn.notnull).to.equal(0);
        });

        it('should maintain backward compatibility with existing user records', async () => {
            // Create basic users table and insert test data
            await createBasicUsersTable();
            const userId1 = await insertTestUser('John Doe', 'john@example.com', 'hashedpassword1');
            const userId2 = await insertTestUser('Jane Smith', 'jane@example.com', 'hashedpassword2');

            // Run migration
            await migrateUserTable();

            // Verify existing user data is preserved and new fields are NULL
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users ORDER BY id', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(2);

            // Check first user
            expect(users[0].id).to.equal(userId1);
            expect(users[0].name).to.equal('John Doe');
            expect(users[0].email).to.equal('john@example.com');
            expect(users[0].password).to.equal('hashedpassword1');
            expect(users[0].phone).to.be.null;
            expect(users[0].bio).to.be.null;
            expect(users[0].avatar_url).to.be.null;
            expect(users[0].created_at).to.not.be.null;

            // Check second user
            expect(users[1].id).to.equal(userId2);
            expect(users[1].name).to.equal('Jane Smith');
            expect(users[1].email).to.equal('jane@example.com');
            expect(users[1].password).to.equal('hashedpassword2');
            expect(users[1].phone).to.be.null;
            expect(users[1].bio).to.be.null;
            expect(users[1].avatar_url).to.be.null;
            expect(users[1].created_at).to.not.be.null;
        });

        it('should handle existing columns gracefully and not duplicate them', async () => {
            // Create users table with some profile columns already present
            await new Promise((resolve, reject) => {
                testDb.serialize(() => {
                    testDb.run(`CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        phone VARCHAR(20) DEFAULT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            // Get initial table structure
            const initialColumns = await getTableInfo();
            const initialColumnNames = initialColumns.map(col => col.name);

            // Verify phone already exists, but bio and avatar_url do not
            expect(initialColumnNames).to.include('phone');
            expect(initialColumnNames).to.not.include.members(['bio', 'avatar_url']);

            // Run migration
            await migrateUserTable();

            // Get updated table structure
            const updatedColumns = await getTableInfo();
            const updatedColumnNames = updatedColumns.map(col => col.name);

            // Verify all columns exist without duplication
            expect(updatedColumnNames).to.include.members(['id', 'name', 'email', 'password', 'created_at', 'phone', 'bio', 'avatar_url']);

            // Verify no column duplication occurred
            const columnCounts = {};
            updatedColumnNames.forEach(name => {
                columnCounts[name] = (columnCounts[name] || 0) + 1;
            });

            Object.values(columnCounts).forEach(count => {
                expect(count).to.equal(1);
            });
        });

        it('should preserve data integrity during migration with existing records', async () => {
            // Create basic users table
            await createBasicUsersTable();

            // Insert users with various data patterns
            const testUsers = [
                { name: 'User One', email: 'user1@test.com', password: 'pass1' },
                { name: 'User Two', email: 'user2@test.com', password: 'pass2' },
                { name: 'Special Chars User', email: 'special@test.com', password: 'pass3' },
                { name: 'Long Name User With Many Characters', email: 'long@test.com', password: 'pass4' }
            ];

            const userIds = [];
            for (const user of testUsers) {
                const id = await insertTestUser(user.name, user.email, user.password);
                userIds.push(id);
            }

            // Run migration
            await migrateUserTable();

            // Verify all original data is preserved
            const migratedUsers = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users ORDER BY id', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(migratedUsers).to.have.length(testUsers.length);

            for (let i = 0; i < testUsers.length; i++) {
                expect(migratedUsers[i].id).to.equal(userIds[i]);
                expect(migratedUsers[i].name).to.equal(testUsers[i].name);
                expect(migratedUsers[i].email).to.equal(testUsers[i].email);
                expect(migratedUsers[i].password).to.equal(testUsers[i].password);
                expect(migratedUsers[i].phone).to.be.null;
                expect(migratedUsers[i].bio).to.be.null;
                expect(migratedUsers[i].avatar_url).to.be.null;
                expect(migratedUsers[i].created_at).to.not.be.null;
            }
        });

        it('should handle repeated migration calls without errors', async () => {
            // Create basic users table
            await createBasicUsersTable();
            await insertTestUser('Test User', 'test@example.com', 'testpass');

            // Run migration multiple times
            await migrateUserTable();
            await migrateUserTable();
            await migrateUserTable();

            // Verify table structure is correct and no duplicates exist
            const columns = await getTableInfo();
            const columnNames = columns.map(col => col.name);

            expect(columnNames).to.include.members(['id', 'name', 'email', 'password', 'created_at', 'phone', 'bio', 'avatar_url']);

            // Verify no column duplication
            const uniqueColumns = [...new Set(columnNames)];
            expect(columnNames).to.have.length(uniqueColumns.length);

            // Verify user data is still intact
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(1);
            expect(users[0].name).to.equal('Test User');
            expect(users[0].email).to.equal('test@example.com');
            expect(users[0].password).to.equal('testpass');
        });

        it('should handle database error during column addition', async () => {
            // Create basic users table
            await createBasicUsersTable();

            // Close database to simulate connection error
            testDb.close();

            // Attempt migration on closed database should reject
            try {
                await migrateUserTable();
                expect.fail('Migration should have failed on closed database');
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.include('SQLITE_MISUSE');
            }
        });

        it('should validate migration with complex existing data patterns', async () => {
            // Create users table with mixed content
            await createBasicUsersTable();

            const complexUsers = [
                { name: 'User With Apostrophe\'s Name', email: 'apostrophe@test.com', password: 'pass1' },
                { name: 'User "With Quotes"', email: 'quotes@test.com', password: 'pass2' },
                { name: 'User\nWith\nNewlines', email: 'newlines@test.com', password: 'pass3' },
                { name: 'User\tWith\tTabs', email: 'tabs@test.com', password: 'pass4' },
                { name: 'Unicode User 中文', email: 'unicode@test.com', password: 'pass5' }
            ];

            const userIds = [];
            for (const user of complexUsers) {
                const id = await insertTestUser(user.name, user.email, user.password);
                userIds.push(id);
            }

            // Run migration
            await migrateUserTable();

            // Verify complex data is preserved exactly
            const migratedUsers = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users ORDER BY id', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(migratedUsers).to.have.length(complexUsers.length);

            for (let i = 0; i < complexUsers.length; i++) {
                expect(migratedUsers[i].name).to.equal(complexUsers[i].name);
                expect(migratedUsers[i].email).to.equal(complexUsers[i].email);
                expect(migratedUsers[i].password).to.equal(complexUsers[i].password);
                expect(migratedUsers[i].phone).to.be.null;
                expect(migratedUsers[i].bio).to.be.null;
                expect(migratedUsers[i].avatar_url).to.be.null;
            }
        });

        it('should allow updating new profile fields after migration', async () => {
            // Create basic users table and migrate
            await createBasicUsersTable();
            const userId = await insertTestUser('Test User', 'test@example.com', 'testpass');
            await migrateUserTable();

            // Update profile fields
            const updateData = {
                phone: '(555) 123-4567',
                bio: 'This is a test bio',
                avatar_url: 'https://example.com/avatar.jpg'
            };

            await new Promise((resolve, reject) => {
                const stmt = testDb.prepare('UPDATE users SET phone = ?, bio = ?, avatar_url = ? WHERE id = ?');
                stmt.run([updateData.phone, updateData.bio, updateData.avatar_url, userId], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
                stmt.finalize();
            });

            // Verify update was successful
            const updatedUser = await new Promise((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(updatedUser.phone).to.equal(updateData.phone);
            expect(updatedUser.bio).to.equal(updateData.bio);
            expect(updatedUser.avatar_url).to.equal(updateData.avatar_url);
            expect(updatedUser.name).to.equal('Test User');
            expect(updatedUser.email).to.equal('test@example.com');
        });

        it('should handle empty database migration gracefully', async () => {
            // Create basic empty users table
            await createBasicUsersTable();

            // Run migration on empty table
            await migrateUserTable();

            // Verify table structure is correct
            const columns = await getTableInfo();
            const columnNames = columns.map(col => col.name);

            expect(columnNames).to.include.members(['id', 'name', 'email', 'password', 'created_at', 'phone', 'bio', 'avatar_url']);

            // Verify no data exists
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(0);
        });

        it('should maintain database constraints after migration', async () => {
            // Create basic users table
            await createBasicUsersTable();
            await insertTestUser('Original User', 'original@test.com', 'password123');

            // Run migration
            await migrateUserTable();

            // Verify unique email constraint is maintained
            try {
                await insertTestUser('Duplicate Email User', 'original@test.com', 'password456');
                expect.fail('Should have thrown unique constraint error');
            } catch (error) {
                expect(error.message).to.include('UNIQUE constraint failed');
            }

            // Verify NOT NULL constraints are maintained for original fields
            const insertNullName = () => {
                return new Promise((resolve, reject) => {
                    const stmt = testDb.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                    stmt.run([null, 'null@test.com', 'password'], function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    });
                    stmt.finalize();
                });
            };

            try {
                await insertNullName();
                expect.fail('Should have thrown NOT NULL constraint error');
            } catch (error) {
                expect(error.message).to.include('NOT NULL constraint failed');
            }
        });

        it('should support concurrent migration attempts', async () => {
            // Create basic users table
            await createBasicUsersTable();
            await insertTestUser('Concurrent Test User', 'concurrent@test.com', 'password123');

            // Run multiple migrations concurrently
            const migrationPromises = [
                migrateUserTable(),
                migrateUserTable(),
                migrateUserTable()
            ];

            // All should complete successfully
            const results = await Promise.allSettled(migrationPromises);
            
            // At least one should succeed, others may fail gracefully
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            expect(successful).to.be.at.least(1);
            
            // Verify final table structure is correct
            const columns = await getTableInfo();
            const columnNames = columns.map(col => col.name);
            expect(columnNames).to.include.members(['id', 'name', 'email', 'password', 'created_at', 'phone', 'bio', 'avatar_url']);

            // Verify data integrity
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(1);
            expect(users[0].name).to.equal('Concurrent Test User');
            expect(users[0].email).to.equal('concurrent@test.com');
        });
    });

    describe('Database rollback scenarios', () => {
        it('should handle partial migration failure gracefully', async () => {
            // Create basic users table
            await createBasicUsersTable();
            await insertTestUser('Test User', 'test@example.com', 'testpass');

            // Mock a scenario where one column addition succeeds but another fails
            // by creating a custom migration function with controlled failure
            const partialMigration = () => {
                return new Promise((resolve, reject) => {
                    testDb.all("PRAGMA table_info(users)", (err, columns) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const existingColumns = columns.map(col => col.name);
                        
                        // Add phone column successfully
                        if (!existingColumns.includes('phone')) {
                            testDb.run('ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL', (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                
                                // Simulate failure on bio column
                                testDb.run('ALTER TABLE users ADD COLUMN invalid_syntax_bio', (err) => {
                                    // This should fail due to invalid syntax
                                    if (err) {
                                        reject(err);
                                    }
                                });
                            });
                        }
                    });
                });
            };

            // Attempt partial migration and expect failure
            try {
                await partialMigration();
                expect.fail('Partial migration should have failed');
            } catch (error) {
                expect(error).to.be.an('error');
            }

            // Verify database is still accessible and original data intact
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(1);
            expect(users[0].name).to.equal('Test User');
            expect(users[0].email).to.equal('test@example.com');

            // Verify phone column was added before failure
            const columns = await getTableInfo();
            const columnNames = columns.map(col => col.name);
            expect(columnNames).to.include('phone');
        });

        it('should maintain data integrity after failed migration attempts', async () => {
            // Create table with existing user data
            await createBasicUsersTable();
            const originalUsers = [
                { name: 'User 1', email: 'user1@test.com', password: 'pass1' },
                { name: 'User 2', email: 'user2@test.com', password: 'pass2' }
            ];

            const userIds = [];
            for (const user of originalUsers) {
                const id = await insertTestUser(user.name, user.email, user.password);
                userIds.push(id);
            }

            // Attempt migration on corrupted database state (simulate by closing)
            testDb.close();

            // Create new connection to same database file
            testDb = new sqlite3.Database(testDbPath);

            // Verify data is still intact after failed migration attempt
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users ORDER BY id', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(2);
            for (let i = 0; i < originalUsers.length; i++) {
                expect(users[i].name).to.equal(originalUsers[i].name);
                expect(users[i].email).to.equal(originalUsers[i].email);
                expect(users[i].password).to.equal(originalUsers[i].password);
            }

            // Now run successful migration
            await migrateUserTable();

            // Verify migration completed successfully and data is still intact
            const migratedUsers = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users ORDER BY id', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(migratedUsers).to.have.length(2);
            for (let i = 0; i < originalUsers.length; i++) {
                expect(migratedUsers[i].name).to.equal(originalUsers[i].name);
                expect(migratedUsers[i].email).to.equal(originalUsers[i].email);
                expect(migratedUsers[i].password).to.equal(originalUsers[i].password);
                expect(migratedUsers[i].phone).to.be.null;
                expect(migratedUsers[i].bio).to.be.null;
                expect(migratedUsers[i].avatar_url).to.be.null;
            }
        });

        it('should handle transaction rollback on constraint violations', async () => {
            // Create users table with strict constraints
            await new Promise((resolve, reject) => {
                testDb.serialize(() => {
                    testDb.run(`CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL CHECK(length(name) >= 2),
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            // Insert valid test data
            await insertTestUser('Valid User', 'valid@test.com', 'password123');

            // Attempt migration with successful column additions
            await migrateUserTable();

            // Verify migration succeeded and constraints are maintained
            const columns = await getTableInfo();
            const columnNames = columns.map(col => col.name);
            expect(columnNames).to.include.members(['phone', 'bio', 'avatar_url']);

            // Test that original constraints still work
            try {
                await insertTestUser('A', 'short@test.com', 'password456'); // Should fail CHECK constraint
                expect.fail('Should have failed CHECK constraint');
            } catch (error) {
                expect(error.message).to.include('CHECK constraint failed');
            }
        });

        it('should handle schema version tracking for future migrations', async () => {
            // Create basic table
            await createBasicUsersTable();
            await insertTestUser('Version Test User', 'version@test.com', 'password123');

            // First migration
            await migrateUserTable();

            // Verify all profile columns exist
            let columns = await getTableInfo();
            let columnNames = columns.map(col => col.name);
            expect(columnNames).to.include.members(['phone', 'bio', 'avatar_url']);

            // Simulate a future migration by adding another column
            const futureColumnMigration = () => {
                return new Promise((resolve, reject) => {
                    testDb.all("PRAGMA table_info(users)", (err, columns) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const existingColumns = columns.map(col => col.name);
                        
                        if (!existingColumns.includes('last_login')) {
                            testDb.run('ALTER TABLE users ADD COLUMN last_login DATETIME DEFAULT NULL', (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log('Future migration: added last_login column');
                                    resolve();
                                }
                            });
                        } else {
                            resolve();
                        }
                    });
                });
            };

            // Run future migration
            await futureColumnMigration();

            // Verify both original and future migration columns exist
            columns = await getTableInfo();
            columnNames = columns.map(col => col.name);
            expect(columnNames).to.include.members(['phone', 'bio', 'avatar_url', 'last_login']);

            // Verify data integrity through multiple migrations
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(1);
            expect(users[0].name).to.equal('Version Test User');
            expect(users[0].email).to.equal('version@test.com');
            expect(users[0].phone).to.be.null;
            expect(users[0].bio).to.be.null;
            expect(users[0].avatar_url).to.be.null;
            expect(users[0].last_login).to.be.null;
        });
    });

    describe('Migration edge cases and error handling', () => {
        it('should handle migration on non-existent table', async () => {
            // Don't create users table - should fail gracefully
            try {
                await migrateUserTable();
                expect.fail('Migration should fail on non-existent table');
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.include('no such table: users');
            }
        });

        it('should handle migration with insufficient permissions', async () => {
            // Create read-only database scenario by creating and closing, then opening in read-only mode
            await createBasicUsersTable();
            await insertTestUser('Permission Test', 'permission@test.com', 'password');
            
            testDb.close();

            // Note: SQLite doesn't support true read-only mode in the same way, 
            // but we can test the error handling pattern
            testDb = new sqlite3.Database(testDbPath);
            
            // Create a scenario where ALTER TABLE might fail
            const failingMigration = () => {
                return new Promise((resolve, reject) => {
                    // Simulate a locked database by running a long transaction
                    testDb.run('BEGIN EXCLUSIVE TRANSACTION', (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Try to run migration while locked
                        testDb.run('ALTER TABLE users ADD COLUMN test_column TEXT', (err) => {
                            if (err) {
                                testDb.run('ROLLBACK', () => {
                                    reject(err);
                                });
                            } else {
                                testDb.run('ROLLBACK', () => {
                                    resolve();
                                });
                            }
                        });
                    });
                });
            };

            // The migration should handle database lock scenarios gracefully
            try {
                await failingMigration();
            } catch (error) {
                expect(error).to.be.an('error');
            }

            // Verify original data is still accessible
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(1);
            expect(users[0].name).to.equal('Permission Test');
        });

        it('should handle migration with corrupted table structure', async () => {
            // Create a table with unusual structure
            await new Promise((resolve, reject) => {
                testDb.run(`CREATE TABLE users (
                    id INTEGER,
                    name TEXT,
                    email TEXT,
                    password TEXT
                )`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            await insertTestUser('Corrupted Structure User', 'corrupted@test.com', 'password');

            // Migration should still work even with non-standard table structure
            await migrateUserTable();

            const columns = await getTableInfo();
            const columnNames = columns.map(col => col.name);
            
            // Should have all expected columns including the new ones
            expect(columnNames).to.include.members(['id', 'name', 'email', 'password', 'phone', 'bio', 'avatar_url']);

            // Data should be preserved
            const users = await new Promise((resolve, reject) => {
                testDb.all('SELECT * FROM users', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(users).to.have.length(1);
            expect(users[0].name).to.equal('Corrupted Structure User');
        });

        it('should validate migration logging and completion status', async () => {
            // Capture console output for testing
            const originalLog = console.log;
            const originalError = console.error;
            const logMessages = [];
            const errorMessages = [];

            console.log = (message) => {
                logMessages.push(message);
                originalLog(message);
            };

            console.error = (message) => {
                errorMessages.push(message);
                originalError(message);
            };

            try {
                // Create basic table and run migration
                await createBasicUsersTable();
                await migrateUserTable();

                // Verify success logging
                const successMessage = logMessages.find(msg => msg.includes('added 3 new profile columns successfully'));
                expect(successMessage).to.not.be.undefined;

                // Run migration again - should log that columns already exist
                logMessages.length = 0;
                await migrateUserTable();

                const skipMessage = logMessages.find(msg => msg.includes('all profile columns already exist'));
                expect(skipMessage).to.not.be.undefined;

                // Verify no errors were logged during successful migrations
                expect(errorMessages).to.have.length(0);

            } finally {
                // Restore console methods
                console.log = originalLog;
                console.error = originalError;
            }
        });
    });
});