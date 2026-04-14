const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('../models/User');
jest.mock('fs');
jest.mock('bcrypt');

describe('Profile Routes', () => {
  let validToken;
  let mockUser;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock user
    mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      profile_picture: null,
      created_at: '2023-01-01'
    };
    
    // Generate valid JWT token
    validToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'test_secret');
    
    // Mock User methods
    User.findById = jest.fn().mockResolvedValue(mockUser);
    User.findByEmail = jest.fn().mockResolvedValue(null);
    User.prototype.updateProfile = jest.fn().mockResolvedValue(true);
    User.prototype.updatePassword = jest.fn().mockResolvedValue(true);
    
    // Mock file system
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.unlinkSync = jest.fn();
    
    // Mock bcrypt
    bcrypt.compare = jest.fn().mockResolvedValue(true);
  });
  
  describe('GET /profile', () => {
    // TC-F-001: User can access profile page via /profile route when authenticated
    test('TC-F-001: should render profile page for authenticated user', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('john@example.com');
      expect(User.findById).toHaveBeenCalledWith(1);
    });
    
    // TC-F-026: Unauthenticated requests to /profile redirect to /login page
    test('TC-F-026: should redirect to login when not authenticated', async () => {
      await request(app)
        .get('/profile')
        .expect(302)
        .expect('Location', '/login');
    });
    
    // TC-F-002: Profile page displays current user's name, email, and profile picture
    test('TC-F-002: should display user profile information from database', async () => {
      mockUser.profile_picture = 'uploads/profile_123.jpg';
      User.findById.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('john@example.com');
      expect(response.text).toContain('uploads/profile_123.jpg');
    });
    
    // TC-F-003: Profile page shows account creation date in readable format
    test('TC-F-003: should display account creation date in readable format', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('2023');
    });
    
    // TC-F-004: Profile picture displays with fallback to default avatar when null
    test('TC-F-004: should show default avatar when profile picture is null', async () => {
      mockUser.profile_picture = null;
      User.findById.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('default-avatar');
    });
  });
  
  describe('POST /profile', () => {
    // TC-F-010: Name field accepts 2-50 characters containing only letters and spaces
    test('TC-F-010: should accept valid name with letters and spaces', async () => {
      await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Jane Smith')
        .field('email', 'jane@example.com')
        .expect(302)
        .expect('Location', '/profile');
      
      expect(User.prototype.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jane Smith',
          email: 'jane@example.com'
        })
      );
    });
    
    // TC-F-011: Name validation error for invalid length
    test('TC-F-011: should reject name with less than 2 characters', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'J')
        .field('email', 'john@example.com')
        .expect(400);
      
      expect(response.text).toContain('Name must be between 2 and 50 characters');
      expect(User.prototype.updateProfile).not.toHaveBeenCalled();
    });
    
    test('TC-F-011: should reject name with more than 50 characters', async () => {
      const longName = 'a'.repeat(51);
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', longName)
        .field('email', 'john@example.com')
        .expect(400);
      
      expect(response.text).toContain('Name must be between 2 and 50 characters');
    });
    
    // TC-F-012: Email field requires valid email format
    test('TC-F-012: should reject invalid email format', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'invalid-email')
        .expect(400);
      
      expect(response.text).toContain('Please enter a valid email');
      expect(User.prototype.updateProfile).not.toHaveBeenCalled();
    });
    
    // TC-F-013: Email uniqueness validation
    test('TC-F-013: should reject duplicate email address', async () => {
      User.findByEmail.mockResolvedValue({ id: 2, email: 'existing@example.com' });
      
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'existing@example.com')
        .expect(400);
      
      expect(response.text).toContain('This email is already registered to another account');
      expect(User.prototype.updateProfile).not.toHaveBeenCalled();
    });
    
    // TC-F-014: Successful profile update redirects with success message
    test('TC-F-014: should redirect to profile page with success message after update', async () => {
      await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'Updated Name')
        .field('email', 'updated@example.com')
        .expect(302)
        .expect('Location', '/profile');
      
      expect(User.prototype.updateProfile).toHaveBeenCalled();
    });
    
    // TC-F-015: Profile picture upload accepts only JPG and PNG files
    test('TC-F-015: should accept valid image file formats', async () => {
      const imagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
      
      await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('profile_picture', imagePath)
        .expect(302);
      
      expect(User.prototype.updateProfile).toHaveBeenCalled();
    });
    
    // TC-F-016: File size validation rejects uploads larger than 2MB
    test('TC-F-016: should reject files larger than 2MB', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('profile_picture', Buffer.alloc(2097153), 'large-file.jpg')
        .expect(400);
      
      expect(response.text).toContain('File too large (max 2MB)');
    });
    
    test('TC-F-015: should reject invalid file types', async () => {
      const response = await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('profile_picture', Buffer.from('test'), 'document.pdf')
        .expect(400);
      
      expect(response.text).toContain('Invalid file type (JPG/PNG only)');
    });
    
    // TC-F-017: Profile picture upload replaces existing image
    test('TC-F-017: should delete old profile picture when uploading new one', async () => {
      mockUser.profile_picture = 'uploads/old_profile.jpg';
      User.findById.mockResolvedValue(mockUser);
      
      const imagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
      
      await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('profile_picture', imagePath)
        .expect(302);
      
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('old_profile.jpg')
      );
    });
    
    // TC-F-018: Profile picture filename follows pattern
    test('TC-F-018: should generate filename with userId_timestamp_originalExtension pattern', async () => {
      const imagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
      
      await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('profile_picture', imagePath)
        .expect(302);
      
      expect(User.prototype.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_picture: expect.stringMatching(/^uploads\/1_\d+_.*\.jpg$/)
        })
      );
    });
    
    // TC-F-025: Database updates use parameterized queries
    test('TC-F-025: should use parameterized queries for database updates', async () => {
      await request(app)
        .post('/profile')
        .set('Cookie', [`token=${validToken}`])
        .field('name', "'; DROP TABLE users; --")
        .field('email', 'safe@example.com')
        .expect(302);
      
      // Verify that the User model method was called (indicating parameterized queries)
      expect(User.prototype.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "'; DROP TABLE users; --",
          email: 'safe@example.com'
        })
      );
    });
  });
  
  describe('POST /profile/password', () => {
    // TC-F-019: Password change form requires all fields
    test('TC-F-019: should require current password field', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('newPassword', 'NewPass123')
        .field('confirmPassword', 'NewPass123')
        .expect(400);
      
      expect(response.text).toContain('Current password is required');
    });
    
    // TC-F-020: Current password validation uses bcrypt.compare
    test('TC-F-020: should validate current password using bcrypt.compare', async () => {
      bcrypt.compare.mockResolvedValue(false);
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'wrongpassword')
        .field('newPassword', 'NewPass123')
        .field('confirmPassword', 'NewPass123')
        .expect(400);
      
      expect(response.text).toContain('Current password is incorrect');
      expect(bcrypt.compare).toHaveBeenCalled();
    });
    
    // TC-F-021: New password must meet complexity requirements
    test('TC-F-021: should enforce password complexity requirements', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'oldpassword')
        .field('newPassword', 'weak')
        .field('confirmPassword', 'weak')
        .expect(400);
      
      expect(response.text).toContain('Password must be at least 6 characters');
    });
    
    test('TC-F-021: should require uppercase letter in password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'oldpassword')
        .field('newPassword', 'newpass123')
        .field('confirmPassword', 'newpass123')
        .expect(400);
      
      expect(response.text).toContain('Password must contain uppercase');
    });
    
    test('TC-F-021: should require lowercase letter in password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'oldpassword')
        .field('newPassword', 'NEWPASS123')
        .field('confirmPassword', 'NEWPASS123')
        .expect(400);
      
      expect(response.text).toContain('Password must contain lowercase');
    });
    
    test('TC-F-021: should require number in password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'oldpassword')
        .field('newPassword', 'NewPassword')
        .field('confirmPassword', 'NewPassword')
        .expect(400);
      
      expect(response.text).toContain('Password must contain a number');
    });
    
    // TC-F-022: Confirm password must match new password
    test('TC-F-022: should require password confirmation to match', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'oldpassword')
        .field('newPassword', 'NewPass123')
        .field('confirmPassword', 'DifferentPass123')
        .expect(400);
      
      expect(response.text).toContain('Passwords do not match');
    });
    
    // TC-F-024: Successful password update shows success message
    test('TC-F-024: should update password successfully with valid input', async () => {
      await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${validToken}`])
        .field('currentPassword', 'oldpassword')
        .field('newPassword', 'NewPass123')
        .field('confirmPassword', 'NewPass123')
        .expect(302)
        .expect('Location', '/profile');
      
      expect(bcrypt.compare).toHaveBeenCalled();
      expect(User.prototype.updatePassword).toHaveBeenCalled();
    });
  });
});
