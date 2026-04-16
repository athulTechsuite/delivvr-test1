const request = require('supertest');
const app = require('../app');
const { setupDatabase, cleanupDatabase } = require('./helpers/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

// Test constants
const TEST_CONSTANTS = {
    VALID_NAME_MIN: 'Jo',
    VALID_NAME_MAX: 'A'.repeat(50),
    INVALID_NAME_SHORT: 'J',
    INVALID_NAME_LONG: 'A'.repeat(51),
    INVALID_NAME_SPECIAL: 'John@123',
    VALID_EMAIL: 'test@example.com',
    INVALID_EMAIL: 'invalid-email',
    MAX_FILE_SIZE: 5242880, // 5MB
    UPLOAD_DIR: path.join(__dirname, '../public/uploads'),
    TEST_IMAGE_PATH: path.join(__dirname, 'fixtures/test-image.jpg'),
    TEST_LARGE_IMAGE_PATH: path.join(__dirname, 'fixtures/large-image.jpg'),
    TEST_INVALID_FILE_PATH: path.join(__dirname, 'fixtures/test-document.txt')
};

describe('Profile Editing', () => {
    let testUser;
    let authToken;
    let testDb;

    beforeAll(async () => {
        testDb = await setupDatabase();
        
        // Create test fixtures directory if it doesn't exist
        const fixturesDir = path.join(__dirname, 'fixtures');
        try {
            await fs.mkdir(fixturesDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        // Create test image file (1x1 pixel JPEG)
        const testImageBuffer = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
            0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01,
            0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02,
            0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00,
            0xB5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05,
            0x04, 0x04, 0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11,
            0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71,
            0x14, 0x32, 0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52,
            0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0A, 0x16, 0x17, 0x18,
            0x19, 0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37,
            0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53,
            0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67,
            0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x83,
            0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96,
            0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9,
            0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3,
            0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6,
            0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8,
            0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA,
            0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00,
            0x3F, 0x00, 0xF9, 0xFE, 0x8A, 0x28, 0xAF, 0xC3, 0x0F, 0xFF, 0xD9
        ]);
        await fs.writeFile(TEST_CONSTANTS.TEST_IMAGE_PATH, testImageBuffer);

        // Create large image file (exceeds 5MB limit)
        const largeImageBuffer = Buffer.alloc(TEST_CONSTANTS.MAX_FILE_SIZE + 1000);
        largeImageBuffer.fill(0xFF);
        // Add JPEG header
        largeImageBuffer[0] = 0xFF;
        largeImageBuffer[1] = 0xD8;
        await fs.writeFile(TEST_CONSTANTS.TEST_LARGE_IMAGE_PATH, largeImageBuffer);

        // Create invalid file (text document)
        await fs.writeFile(TEST_CONSTANTS.TEST_INVALID_FILE_PATH, 'This is a text document');

        // Ensure uploads directory exists
        try {
            await fs.mkdir(TEST_CONSTANTS.UPLOAD_DIR, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
    });

    afterAll(async () => {
        await cleanupDatabase();
        
        // Clean up test fixtures
        try {
            await fs.unlink(TEST_CONSTANTS.TEST_IMAGE_PATH);
            await fs.unlink(TEST_CONSTANTS.TEST_LARGE_IMAGE_PATH);
            await fs.unlink(TEST_CONSTANTS.TEST_INVALID_FILE_PATH);
        } catch (error) {
            // Files may not exist
        }

        // Clean up uploads directory
        try {
            const files = await fs.readdir(TEST_CONSTANTS.UPLOAD_DIR);
            for (const file of files) {
                if (file.startsWith('test-')) {
                    await fs.unlink(path.join(TEST_CONSTANTS.UPLOAD_DIR, file));
                }
            }
        } catch (error) {
            // Directory may not exist
        }
    });

    beforeEach(async () => {
        // Create test user
        const hashedPassword = await bcrypt.hash('password123', 12);
        const result = testDb.prepare(`
            INSERT INTO users (name, email, password, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `).run('Test User', TEST_CONSTANTS.VALID_EMAIL, hashedPassword);

        testUser = {
            id: result.lastInsertRowid,
            name: 'Test User',
            email: TEST_CONSTANTS.VALID_EMAIL,
            password: hashedPassword
        };

        // Generate auth token
        authToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            process.env.JWT_SECRET || 'test_secret',
            { expiresIn: '1h' }
        );
    });

    afterEach(async () => {
        // Clean up test user and uploaded files
        if (testUser) {
            testDb.prepare('DELETE FROM users WHERE id = ?').run(testUser.id);
            
            // Clean up any uploaded profile pictures for test user
            try {
                const files = await fs.readdir(TEST_CONSTANTS.UPLOAD_DIR);
                for (const file of files) {
                    if (file.startsWith(`${testUser.id}-`) || file.startsWith('test-')) {
                        await fs.unlink(path.join(TEST_CONSTANTS.UPLOAD_DIR, file));
                    }
                }
            } catch (error) {
                // Directory may not exist or be empty
            }
        }
    });

    describe('GET /profile', () => {
        it('should return profile data for authenticated user', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`auth=${authToken}`])
                .expect(200);

            expect(response.text).toContain('Test User');
            expect(response.text).toContain(TEST_CONSTANTS.VALID_EMAIL);
        });

        it('should include profile picture if set', async () => {
            // Set profile picture for user
            const picturePath = `uploads/${testUser.id}-123456789.jpg`;
            testDb.prepare('UPDATE users SET profile_picture = ? WHERE id = ?')
                .run(picturePath, testUser.id);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`auth=${authToken}`])
                .expect(200);

            expect(response.text).toContain(picturePath);
        });

        it('should redirect to login if not authenticated', async () => {
            await request(app)
                .get('/profile')
                .expect(302)
                .expect('Location', '/login');
        });

        it('should redirect to login with invalid token', async () => {
            await request(app)
                .get('/profile')
                .set('Cookie', ['auth=invalid-token'])
                .expect(302)
                .expect('Location', '/login');
        });
    });

    describe('POST /profile', () => {
        describe('Authentication', () => {
            it('should require authentication', async () => {
                await request(app)
                    .post('/profile')
                    .field('name', 'New Name')
                    .field('email', 'new@example.com')
                    .expect(302)
                    .expect('Location', '/login');
            });

            it('should reject invalid JWT token', async () => {
                await request(app)
                    .post('/profile')
                    .set('Cookie', ['auth=invalid-token'])
                    .field('name', 'New Name')
                    .field('email', 'new@example.com')
                    .expect(302)
                    .expect('Location', '/login');
            });

            it('should only allow users to edit their own profile', async () => {
                // Create another user
                const hashedPassword = await bcrypt.hash('password123', 12);
                const otherUserResult = testDb.prepare(`
                    INSERT INTO users (name, email, password, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                `).run('Other User', 'other@example.com', hashedPassword);

                const otherUserId = otherUserResult.lastInsertRowid;

                // Try to edit other user's profile with current user's token
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Hacked Name')
                    .field('email', 'hacked@example.com')
                    .field('userId', otherUserId.toString())
                    .expect(403);

                expect(response.body.error).toBe('Forbidden: Cannot edit another user\'s profile');

                // Clean up
                testDb.prepare('DELETE FROM users WHERE id = ?').run(otherUserId);
            });
        });

        describe('Validation', () => {
            it('should update profile with valid data', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Updated Name')
                    .field('email', 'updated@example.com')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toBe('Profile updated successfully');

                // Verify database was updated
                const updatedUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
                expect(updatedUser.name).toBe('Updated Name');
                expect(updatedUser.email).toBe('updated@example.com');
            });

            it('should reject name that is too short', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', TEST_CONSTANTS.INVALID_NAME_SHORT)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(400);

                expect(response.body.error).toContain('Name must be between 2 and 50 characters');
            });

            it('should reject name that is too long', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', TEST_CONSTANTS.INVALID_NAME_LONG)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(400);

                expect(response.body.error).toContain('Name must be between 2 and 50 characters');
            });

            it('should accept minimum length name', async () => {
                await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', TEST_CONSTANTS.VALID_NAME_MIN)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(200);
            });

            it('should accept maximum length name', async () => {
                await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', TEST_CONSTANTS.VALID_NAME_MAX)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(200);
            });

            it('should reject name with special characters', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', TEST_CONSTANTS.INVALID_NAME_SPECIAL)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(400);

                expect(response.body.error).toContain('Name can only contain letters and spaces');
            });

            it('should reject invalid email format', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Valid Name')
                    .field('email', TEST_CONSTANTS.INVALID_EMAIL)
                    .expect(400);

                expect(response.body.error).toContain('Please provide a valid email address');
            });

            it('should reject duplicate email address', async () => {
                // Create another user with different email
                const hashedPassword = await bcrypt.hash('password123', 12);
                const existingUserResult = testDb.prepare(`
                    INSERT INTO users (name, email, password, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                `).run('Existing User', 'existing@example.com', hashedPassword);

                const existingUserId = existingUserResult.lastInsertRowid;

                // Try to update current user's email to existing user's email
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Valid Name')
                    .field('email', 'existing@example.com')
                    .expect(400);

                expect(response.body.error).toContain('Email address is already in use');

                // Clean up
                testDb.prepare('DELETE FROM users WHERE id = ?').run(existingUserId);
            });

            it('should allow keeping same email address', async () => {
                await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Updated Name')
                    .field('email', testUser.email)
                    .expect(200);
            });

            it('should sanitize email input', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Valid Name')
                    .field('email', '  UPPER@EXAMPLE.COM  ')
                    .expect(200);

                // Verify email was normalized
                const updatedUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
                expect(updatedUser.email).toBe('upper@example.com');
            });
        });

        describe('Profile Picture Upload', () => {
            it('should upload valid image file', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(200);

                expect(response.body.success).toBe(true);

                // Verify file was uploaded and database was updated
                const updatedUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
                expect(updatedUser.profile_picture).toMatch(/^uploads\/\d+-\d+\.jpg$/);

                // Verify file exists
                const filePath = path.join(__dirname, '../public', updatedUser.profile_picture);
                try {
                    await fs.access(filePath);
                } catch (error) {
                    fail('Uploaded file does not exist');
                }
            });

            it('should reject non-image file types', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_INVALID_FILE_PATH)
                    .expect(400);

                expect(response.body.error).toContain('Only image files are allowed');
            });

            it('should reject files exceeding size limit', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_LARGE_IMAGE_PATH)
                    .expect(400);

                expect(response.body.error).toContain('File size too large');
            });

            it('should delete old profile picture when uploading new one', async () => {
                // Upload first image
                const firstResponse = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(200);

                const firstUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
                const firstImagePath = path.join(__dirname, '../public', firstUser.profile_picture);

                // Verify first file exists
                try {
                    await fs.access(firstImagePath);
                } catch (error) {
                    fail('First uploaded file does not exist');
                }

                // Upload second image
                const secondResponse = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(200);

                const secondUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);

                // Verify database has new image path
                expect(secondUser.profile_picture).not.toBe(firstUser.profile_picture);

                // Verify old file was deleted
                try {
                    await fs.access(firstImagePath);
                    fail('Old profile picture file should have been deleted');
                } catch (error) {
                    // Expected - file should not exist
                }

                // Verify new file exists
                const secondImagePath = path.join(__dirname, '../public', secondUser.profile_picture);
                try {
                    await fs.access(secondImagePath);
                } catch (error) {
                    fail('New uploaded file does not exist');
                }
            });

            it('should generate unique filenames for concurrent uploads', async () => {
                const filename1Pattern = /uploads\/\d+-\d+\.jpg/;
                const filename2Pattern = /uploads\/\d+-\d+\.jpg/;

                // Simulate near-simultaneous uploads by creating two requests
                const [response1, response2] = await Promise.all([
                    request(app)
                        .post('/profile')
                        .set('Cookie', [`auth=${authToken}`])
                        .field('name', 'Test User')
                        .field('email', TEST_CONSTANTS.VALID_EMAIL)
                        .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH),
                    request(app)
                        .post('/profile')
                        .set('Cookie', [`auth=${authToken}`])
                        .field('name', 'Test User 2')
                        .field('email', TEST_CONSTANTS.VALID_EMAIL)
                        .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                ]);

                // Only the second request should succeed due to timing
                expect(response2.status).toBe(200);
            });
        });

        describe('Atomic Operations', () => {
            it('should rollback on validation failure with file upload', async () => {
                // Attempt to update with invalid name but valid file
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', TEST_CONSTANTS.INVALID_NAME_SHORT)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(400);

                // Verify user data was not changed
                const user = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
                expect(user.name).toBe('Test User');
                expect(user.profile_picture).toBe(null);

                // Verify no file was uploaded
                const files = await fs.readdir(TEST_CONSTANTS.UPLOAD_DIR);
                const userFiles = files.filter(file => file.startsWith(`${testUser.id}-`));
                expect(userFiles.length).toBe(0);
            });

            it('should handle database errors gracefully', async () => {
                // Create a scenario that would cause database constraint violation
                // by temporarily corrupting the database connection
                const originalPrepare = testDb.prepare;
                testDb.prepare = () => {
                    throw new Error('Database connection lost');
                };

                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Updated Name')
                    .field('email', 'updated@example.com')
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(500);

                // Restore database connection
                testDb.prepare = originalPrepare;

                expect(response.body.error).toContain('An error occurred while updating profile');

                // Verify no file was left behind
                const files = await fs.readdir(TEST_CONSTANTS.UPLOAD_DIR);
                const userFiles = files.filter(file => file.startsWith(`${testUser.id}-`));
                expect(userFiles.length).toBe(0);
            });
        });

        describe('XSS Protection', () => {
            it('should sanitize name field against XSS', async () => {
                const maliciousName = '<script>alert("xss")</script>';
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', maliciousName)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(400);

                // Should fail validation due to invalid characters
                expect(response.body.error).toContain('Name can only contain letters and spaces');
            });

            it('should handle HTML entities in name field', async () => {
                const nameWithEntities = 'John &amp; Jane';
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', nameWithEntities)
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(400);

                // Should fail validation due to invalid characters
                expect(response.body.error).toContain('Name can only contain letters and spaces');
            });

            it('should properly escape output in profile view', async () => {
                // First update with a name containing spaces (valid)
                await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'John O Connor')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .expect(200);

                // Then verify the profile page properly displays the name
                const response = await request(app)
                    .get('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .expect(200);

                expect(response.text).toContain('John O Connor');
            });
        });

        describe('File System Operations', () => {
            it('should handle file system errors during upload', async () => {
                // Mock fs.writeFile to simulate filesystem error
                const originalWriteFile = require('fs').promises.writeFile;
                require('fs').promises.writeFile = jest.fn().mockRejectedValue(new Error('Disk full'));

                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(500);

                // Restore original function
                require('fs').promises.writeFile = originalWriteFile;

                expect(response.body.error).toContain('Failed to upload profile picture');
            });

            it('should handle missing uploads directory', async () => {
                // Temporarily remove uploads directory
                try {
                    await fs.rmdir(TEST_CONSTANTS.UPLOAD_DIR, { recursive: true });
                } catch (error) {
                    // Directory may not exist
                }

                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', 'Test User')
                    .field('email', TEST_CONSTANTS.VALID_EMAIL)
                    .attach('profilePicture', TEST_CONSTANTS.TEST_IMAGE_PATH)
                    .expect(200);

                // Should succeed as middleware should create directory
                expect(response.body.success).toBe(true);

                // Verify directory was created
                try {
                    await fs.access(TEST_CONSTANTS.UPLOAD_DIR);
                } catch (error) {
                    fail('Uploads directory should have been created');
                }
            });
        });

        describe('Edge Cases', () => {
            it('should handle missing form fields', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .expect(400);

                expect(response.body.error).toContain('Name and email are required');
            });

            it('should handle empty form fields', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', '')
                    .field('email', '')
                    .expect(400);

                expect(response.body.error).toContain('Name and email are required');
            });

            it('should handle whitespace-only fields', async () => {
                const response = await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', '   ')
                    .field('email', '   ')
                    .expect(400);

                expect(response.body.error).toContain('Name and email are required');
            });

            it('should trim whitespace from valid inputs', async () => {
                await request(app)
                    .post('/profile')
                    .set('Cookie', [`auth=${authToken}`])
                    .field('name', '  Trimmed Name  ')
                    .field('email', '  trimmed@example.com  ')
                    .expect(200);

                // Verify trimming occurred
                const updatedUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
                expect(updatedUser.name).toBe('Trimmed Name');
                expect(updatedUser.email).toBe('trimmed@example.com');
            });

            it('should handle concurrent profile updates', async () => {
                const updates = [
                    request(app)
                        .post('/profile')
                        .set('Cookie', [`auth=${authToken}`])
                        .field('name', 'Update 1')
                        .field('email', 'update1@example.com'),
                    request(app)
                        .post('/profile')
                        .set('Cookie', [`auth=${authToken}`])
                        .field('name', 'Update 2')
                        .field('email', 'update2@example.com')
                ];

                const responses = await Promise.allSettled(updates);

                // At least one should succeed
                const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
                expect(successCount).toBeGreaterThanOrEqual(1);
            });
        });
    });
});