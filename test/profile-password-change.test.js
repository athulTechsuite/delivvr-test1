const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');

// Mock bcrypt operations for isolated testing
jest.mock('bcrypt');

// Mock User model
jest.mock('../models/User');

describe('POST /profile/password', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  const VALID_USER_ID = 1;
  const VALID_TOKEN = jwt.sign({ userId: VALID_USER_ID }, JWT_SECRET);
  
  const VALID_CURRENT_PASSWORD = 'CurrentPass123';
  const VALID_NEW_PASSWORD = 'NewPass123';
  const HASHED_CURRENT_PASSWORD = '$2b$10$hashedCurrentPassword';
  const HASHED_NEW_PASSWORD = '$2b$10$hashedNewPassword';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should redirect to login when no token provided', async () => {
      const response = await request(app)
        .post('/profile/password')
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    it('should redirect to login when invalid token provided', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', 'token=invalid-token')
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });

  describe('Password Change Validation', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        id: VALID_USER_ID,
        password: HASHED_CURRENT_PASSWORD
      });
    });

    it('should successfully change password with valid inputs', async () => {
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(HASHED_NEW_PASSWORD);
      User.prototype.updatePassword = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/profile?success=Password%20updated%20successfully');
      expect(bcrypt.compare).toHaveBeenCalledWith(VALID_CURRENT_PASSWORD, HASHED_CURRENT_PASSWORD);
      expect(bcrypt.hash).toHaveBeenCalledWith(VALID_NEW_PASSWORD, 10);
      expect(User.prototype.updatePassword).toHaveBeenCalledWith(VALID_USER_ID, HASHED_NEW_PASSWORD);
    });

    it('should reject empty current password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: '',
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Current password is required'
      });
    });

    it('should reject when current password does not match', async () => {
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Current password is incorrect'
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword123', HASHED_CURRENT_PASSWORD);
    });

    it('should reject new password shorter than 6 characters', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: 'Short1',
          confirmPassword: 'Short1'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'New password must be at least 6 characters long'
      });
    });

    it('should reject new password longer than 128 characters', async () => {
      bcrypt.compare.mockResolvedValue(true);
      const longPassword = 'A1' + 'a'.repeat(127);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: longPassword,
          confirmPassword: longPassword
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'New password must be no more than 128 characters long'
      });
    });

    it('should reject new password without uppercase letter', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: 'newpass123',
          confirmPassword: 'newpass123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    });

    it('should reject new password without lowercase letter', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: 'NEWPASS123',
          confirmPassword: 'NEWPASS123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    });

    it('should reject new password without number', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: 'NewPassword',
          confirmPassword: 'NewPassword'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    });

    it('should reject when confirm password does not match new password', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: 'DifferentPass123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Password confirmation does not match'
      });
    });
  });

  describe('Database Operations', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        id: VALID_USER_ID,
        password: HASHED_CURRENT_PASSWORD
      });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(HASHED_NEW_PASSWORD);
    });

    it('should handle user not found error', async () => {
      User.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'User not found'
      });
    });

    it('should handle database update failure', async () => {
      User.prototype.updatePassword = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Unable to update password. Please try again.'
      });
    });

    it('should handle database connection error', async () => {
      User.findById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Unable to update password. Please try again.'
      });
    });
  });

  describe('Bcrypt Operations', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        id: VALID_USER_ID,
        password: HASHED_CURRENT_PASSWORD
      });
      bcrypt.compare.mockResolvedValue(true);
      User.prototype.updatePassword = jest.fn().mockResolvedValue(true);
    });

    it('should handle bcrypt hashing error', async () => {
      bcrypt.hash.mockRejectedValue(new Error('Bcrypt hashing failed'));

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Unable to update password. Please try again.'
      });
    });

    it('should handle bcrypt comparison error', async () => {
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt comparison failed'));

      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Unable to update password. Please try again.'
      });
    });

    it('should use salt rounds of 10 for password hashing', async () => {
      bcrypt.hash.mockResolvedValue(HASHED_NEW_PASSWORD);
      User.prototype.updatePassword = jest.fn().mockResolvedValue(true);

      await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(bcrypt.hash).toHaveBeenCalledWith(VALID_NEW_PASSWORD, 10);
    });
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        id: VALID_USER_ID,
        password: HASHED_CURRENT_PASSWORD
      });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(HASHED_NEW_PASSWORD);
      User.prototype.updatePassword = jest.fn().mockResolvedValue(true);
    });

    it('should trim whitespace from password fields', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: `  ${VALID_CURRENT_PASSWORD}  `,
          newPassword: `  ${VALID_NEW_PASSWORD}  `,
          confirmPassword: `  ${VALID_NEW_PASSWORD}  `
        });

      expect(response.status).toBe(302);
      expect(bcrypt.compare).toHaveBeenCalledWith(VALID_CURRENT_PASSWORD, HASHED_CURRENT_PASSWORD);
      expect(bcrypt.hash).toHaveBeenCalledWith(VALID_NEW_PASSWORD, 10);
    });

    it('should handle null and undefined values gracefully', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: null,
          newPassword: undefined,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Current password is required'
      });
    });
  });

  describe('Success Response', () => {
    beforeEach(() => {
      User.findById.mockResolvedValue({
        id: VALID_USER_ID,
        password: HASHED_CURRENT_PASSWORD
      });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(HASHED_NEW_PASSWORD);
      User.prototype.updatePassword = jest.fn().mockResolvedValue(true);
    });

    it('should redirect to profile with success message', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/profile?success=Password%20updated%20successfully');
    });

    it('should call updatePassword with hashed new password', async () => {
      await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${VALID_TOKEN}`)
        .send({
          currentPassword: VALID_CURRENT_PASSWORD,
          newPassword: VALID_NEW_PASSWORD,
          confirmPassword: VALID_NEW_PASSWORD
        });

      expect(User.prototype.updatePassword).toHaveBeenCalledWith(VALID_USER_ID, HASHED_NEW_PASSWORD);
    });
  });
});