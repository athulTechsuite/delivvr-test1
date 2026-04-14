const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const User = require('../models/User');

// Test constants
const TEST_SECRET = 'test_secret_key';
const TEST_USER_ID = 1;
const TEST_EMAIL = 'test@example.com';
const TEST_NAME = 'Test User';
const TEST_PASSWORD = 'TestPass123';
const VALID_EMAIL = 'newemail@example.com';
const VALID_NAME = 'New Name';
const INVALID_EMAIL = 'invalid-email';
const SHORT_NAME = 'A';
const LONG_NAME = 'A'.repeat(51);
const WEAK_PASSWORD = '123';
const STRONG_PASSWORD = 'NewPass123';
const EXISTING_EMAIL = 'existing@example.com';

describe('Profile Management', () => {
    let validToken;
    let mockUser;
    let originalJwtSecret;

    beforeAll(() => {
        // Set test JWT secret
        originalJwtSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = TEST_SECRET;
    });

    afterAll(() => {
        // Restore original JWT secret
        process.env.JWT_SECRET = originalJwtSecret;
    });

    beforeEach(() => {
        // Create valid JWT token for test user
        validToken = jwt.sign(
            { id: TEST_USER_ID, email: TEST_EMAIL },
            TEST_SECRET,
            { expiresIn: '1h' }
        );

        // Mock user data
        mockUser = {
            id: TEST_USER_ID,
            email: TEST_EMAIL,
            name: TEST_NAME,
            password_hash: bcrypt.hashSync(TEST_PASSWORD, 10),
            profile_picture: null,
            created_at: '2023-01-01 12:00:00'
        };

        // Reset all User model method mocks
        jest.clearAllMocks();
    });

    describe('GET /profile', () => {
        test('should display profile page for authenticated user', async () => {
            // Mock User.findById to return test user
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain(TEST_NAME);
            expect(response.text).toContain(TEST_EMAIL);
            expect(User.findById).toHaveBeenCalledWith(TEST_USER_ID);
        });

        test('should redirect to login when no token provided', async () => {
            const response = await request(app)
                .get('/profile');

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when invalid token provided', async () => {
            const invalidToken = 'invalid.jwt.token';

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${invalidToken}`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should redirect to login when user not found in database', async () => {
            User.findById = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
            expect(User.findById).toHaveBeenCalledWith(TEST_USER_ID);
        });

        test('should display account creation date in readable format', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('January 1, 2023');
        });

        test('should display default avatar when profile_picture is null', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('account_circle');
        });

        test('should display profile picture when available', async () => {
            const userWithPicture = {
                ...mockUser,
                profile_picture: 'uploads/1_123456789_avatar.jpg'
            };
            User.findById = jest.fn().mockResolvedValue(userWithPicture);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('uploads/1_123456789_avatar.jpg');
        });

        test('should handle database errors gracefully', async () => {
            User.findById = jest.fn().mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(500);
            expect(response.text).toContain('Internal Server Error');
        });
    });

    describe('POST /profile', () => {
        test('should update user name with valid input', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updateProfile = jest.fn().mockResolvedValue(true);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: VALID_NAME });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/profile');
            expect(User.prototype.updateProfile).toHaveBeenCalledWith({
                name: VALID_NAME
            });
        });

        test('should update user email with valid input', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updateProfile = jest.fn().mockResolvedValue(true);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ email: VALID_EMAIL });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/profile');
            expect(User.prototype.updateProfile).toHaveBeenCalledWith({
                email: VALID_EMAIL
            });
        });

        test('should reject name shorter than 2 characters', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: SHORT_NAME });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Name must be between 2 and 50 characters');
        });

        test('should reject name longer than 50 characters', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: LONG_NAME });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Name must be between 2 and 50 characters');
        });

        test('should reject name with non-letter characters', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: 'Test123' });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Name must contain only letters and spaces');
        });

        test('should reject invalid email format', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ email: INVALID_EMAIL });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Please enter a valid email address');
        });

        test('should reject duplicate email address', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            const duplicateError = new Error('UNIQUE constraint failed: users.email');
            duplicateError.code = 'SQLITE_CONSTRAINT_UNIQUE';
            User.prototype.updateProfile = jest.fn().mockRejectedValue(duplicateError);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ email: EXISTING_EMAIL });

            expect(response.status).toBe(400);
            expect(response.text).toContain('This email is already registered to another account');
        });

        test('should trim whitespace from input fields', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updateProfile = jest.fn().mockResolvedValue(true);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: '  Valid Name  ', email: '  valid@email.com  ' });

            expect(response.status).toBe(302);
            expect(User.prototype.updateProfile).toHaveBeenCalledWith({
                name: 'Valid Name',
                email: 'valid@email.com'
            });
        });

        test('should require authentication', async () => {
            const response = await request(app)
                .post('/profile')
                .send({ name: VALID_NAME });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should handle database update failures', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updateProfile = jest.fn().mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: VALID_NAME });

            expect(response.status).toBe(500);
            expect(response.text).toContain('Unable to update profile. Please try again.');
        });

        test('should reject empty name field', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: '' });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Name is required');
        });

        test('should reject empty email field', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ email: '' });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Email is required');
        });
    });

    describe('POST /profile/password', () => {
        test('should update password with valid inputs', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updatePassword = jest.fn().mockResolvedValue(true);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: STRONG_PASSWORD
                });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/profile');
            expect(User.prototype.updatePassword).toHaveBeenCalledWith(
                TEST_PASSWORD,
                STRONG_PASSWORD
            );
        });

        test('should reject incorrect current password', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            const incorrectPasswordError = new Error('Current password is incorrect');
            User.prototype.updatePassword = jest.fn().mockRejectedValue(incorrectPasswordError);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: 'WrongPassword',
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: STRONG_PASSWORD
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Current password is incorrect');
        });

        test('should reject weak new password', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: WEAK_PASSWORD,
                    confirmPassword: WEAK_PASSWORD
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Password must be at least 6 characters with uppercase, lowercase, and number');
        });

        test('should reject mismatched password confirmation', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: 'DifferentPass123'
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Password confirmation does not match');
        });

        test('should reject empty current password', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: '',
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: STRONG_PASSWORD
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Current password is required');
        });

        test('should reject empty new password', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: '',
                    confirmPassword: ''
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('New password is required');
        });

        test('should require authentication', async () => {
            const response = await request(app)
                .post('/profile/password')
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: STRONG_PASSWORD
                });

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should handle database update failures', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updatePassword = jest.fn().mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: STRONG_PASSWORD
                });

            expect(response.status).toBe(500);
            expect(response.text).toContain('Unable to update password. Please try again.');
        });

        test('should validate password length constraints', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const tooLongPassword = 'A'.repeat(129) + '1a';
            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: tooLongPassword,
                    confirmPassword: tooLongPassword
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Password must be between 6 and 128 characters');
        });

        test('should validate password complexity requirements', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const noUppercasePassword = 'password123';
            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: TEST_PASSWORD,
                    newPassword: noUppercasePassword,
                    confirmPassword: noUppercasePassword
                });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Password must be at least 6 characters with uppercase, lowercase, and number');
        });
    });

    describe('Authentication Middleware', () => {
        test('should require valid JWT token for all profile routes', async () => {
            const routes = ['/profile', '/profile/password'];

            for (const route of routes) {
                const response = await request(app)
                    .get(route);

                expect(response.status).toBe(302);
                expect(response.headers.location).toBe('/login');
            }
        });

        test('should reject expired JWT tokens', async () => {
            const expiredToken = jwt.sign(
                { id: TEST_USER_ID, email: TEST_EMAIL },
                TEST_SECRET,
                { expiresIn: '-1h' }
            );

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${expiredToken}`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });

        test('should reject tokens signed with different secret', async () => {
            const wrongSecretToken = jwt.sign(
                { id: TEST_USER_ID, email: TEST_EMAIL },
                'wrong_secret',
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${wrongSecretToken}`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/login');
        });
    });

    describe('Template Rendering', () => {
        test('should render profile template with Material Design classes', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('mdc-');
            expect(response.text).toContain('material-icons');
        });

        test('should include inline editing functionality in template', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('edit-name');
            expect(response.text).toContain('edit-email');
            expect(response.text).toContain('save-btn');
            expect(response.text).toContain('cancel-btn');
        });

        test('should include password change form in template', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('currentPassword');
            expect(response.text).toContain('newPassword');
            expect(response.text).toContain('confirmPassword');
        });

        test('should include profile picture upload functionality', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .get('/profile')
                .set('Cookie', `token=${validToken}`);

            expect(response.status).toBe(200);
            expect(response.text).toContain('profile-picture-upload');
            expect(response.text).toContain('enctype="multipart/form-data"');
        });
    });

    describe('Input Sanitization', () => {
        test('should sanitize HTML in name field', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: '<script>alert("xss")</script>' });

            expect(response.status).toBe(400);
            expect(response.text).toContain('Name must contain only letters and spaces');
        });

        test('should prevent SQL injection in database queries', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.prototype.updateProfile = jest.fn().mockResolvedValue(true);

            const maliciousInput = "'; DROP TABLE users; --";
            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ email: `test${maliciousInput}@example.com` });

            // Should fail validation due to invalid email format
            expect(response.status).toBe(400);
            expect(response.text).toContain('Please enter a valid email address');
        });
    });

    describe('Error Recovery', () => {
        test('should maintain form state after validation errors', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile')
                .set('Cookie', `token=${validToken}`)
                .send({ name: SHORT_NAME });

            expect(response.status).toBe(400);
            expect(response.text).toContain(SHORT_NAME);
        });

        test('should clear sensitive data after errors', async () => {
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/profile/password')
                .set('Cookie', `token=${validToken}`)
                .send({
                    currentPassword: 'wrongpassword',
                    newPassword: STRONG_PASSWORD,
                    confirmPassword: STRONG_PASSWORD
                });

            expect(response.status).toBe(400);
            expect(response.text).not.toContain('wrongpassword');
            expect(response.text).not.toContain(STRONG_PASSWORD);
        });
    });
});