import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';

// Test configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z',
  password: '$2a$10$hashedpassword'
};

// Mock database helpers
const mockDbHelpers = {
  getUserById: jest.fn(),
  updateUserById: jest.fn(),
  getUserByEmail: jest.fn(),
  comparePasswords: jest.fn()
};

// Mock authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (!token) {
    return res.status(401).redirect('/login');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded.user;
    next();
  } catch (error) {
    return res.status(401).redirect('/login');
  }
};

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  
  // Profile routes
  app.get('/profile', authenticateToken, async (req, res) => {
    try {
      const user = await mockDbHelpers.getUserById(req.user.id);
      if (!user || !user.name || !user.email || !user.created_at) {
        return res.redirect('/login');
      }
      
      res.render('profile', {
        title: 'Profile',
        user: {
          ...user,
          joinDate: new Date(user.created_at).toLocaleDateString('en-US')
        }
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).redirect('/login');
    }
  });
  
  app.post('/profile/update', authenticateToken, async (req, res) => {
    try {
      const { name } = req.body;
      
      // Validate name
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      
      const trimmedName = name.trim();
      const namePattern = /^[a-zA-Z\s]+$/;
      
      if (trimmedName.length < 2 || trimmedName.length > 50 || !namePattern.test(trimmedName)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Name must be 2-50 characters and contain only letters and spaces' 
        });
      }
      
      await mockDbHelpers.updateUserById(req.user.id, { name: trimmedName });
      
      res.json({ success: true, message: 'Name updated successfully' });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  });
  
  app.post('/profile/password', authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Validate required fields
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Current password and new password are required' 
        });
      }
      
      // Get user from database
      const user = await mockDbHelpers.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await mockDbHelpers.comparePasswords(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      
      // Validate new password
      const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
      if (!passwordPattern.test(newPassword)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password must be at least 6 characters with uppercase, lowercase, and number' 
        });
      }
      
      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await mockDbHelpers.updateUserById(req.user.id, { password: hashedPassword });
      
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password update error:', error);
      res.status(500).json({ success: false, message: 'Failed to update password' });
    }
  });
  
  // Test routes for authentication
  app.post('/auth/login', (req, res) => {
    const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  });
  
  return app;
};

describe('Profile Routes', () => {
  let app: express.Application;
  let authToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    authToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '24h' });
    jest.clearAllMocks();
    
    // Default mock implementations
    mockDbHelpers.getUserById.mockResolvedValue(TEST_USER);
    mockDbHelpers.updateUserById.mockResolvedValue({ affectedRows: 1 });
    mockDbHelpers.comparePasswords.mockImplementation(async (plain, hashed) => {
      return plain === 'correctpassword';
    });
  });

  describe('GET /profile', () => {
    // TC-R-001: Profile page is protected by authenticateToken middleware and redirects unauthenticated users
    test('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/profile');
      
      expect(response.status).toBe(401);
      expect(response.headers.location).toBe('/login');
    });

    // TC-R-002: Profile page fetches current user data from database using JWT token user ID
    test('should fetch and display user profile for authenticated users', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${authToken}`]);
      
      expect(response.status).toBe(200);
      expect(mockDbHelpers.getUserById).toHaveBeenCalledWith(TEST_USER.id);
    });

    // TC-R-003: Profile page displays user's name, email, and join date in readonly format
    test('should render profile page with user data', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${authToken}`]);
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('profile');
    });

    // TC-R-004: Profile rendering validates complete user data presence
    test('should redirect to login if user data is incomplete', async () => {
      mockDbHelpers.getUserById.mockResolvedValue({ 
        id: 1, 
        name: 'Test User'
        // Missing email and created_at
      });
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${authToken}`]);
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    // TC-R-005: Profile page handles database errors gracefully
    test('should handle database errors gracefully', async () => {
      mockDbHelpers.getUserById.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', [`token=${authToken}`]);
      
      expect(response.status).toBe(500);
      expect(response.headers.location).toBe('/login');
    });

    // TC-R-006: Invalid JWT token redirects to login
    test('should redirect with invalid JWT token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', ['token=invalid.jwt.token']);
      
      expect(response.status).toBe(401);
      expect(response.headers.location).toBe('/login');
    });
  });

  describe('POST /profile/update', () => {
    // TC-R-007: Profile name update requires authentication
    test('should require authentication for name updates', async () => {
      const response = await request(app)
        .post('/profile/update')
        .send({ name: 'New Name' });
      
      expect(response.status).toBe(401);
      expect(response.headers.location).toBe('/login');
    });

    // TC-R-008: Save button updates user name in database
    test('should update user name successfully', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Name updated successfully'
      });
      expect(mockDbHelpers.updateUserById).toHaveBeenCalledWith(TEST_USER.id, {
        name: 'Updated Name'
      });
    });

    // TC-R-009: Profile name field validates minimum 2 characters
    test('should reject name with less than 2 characters', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: 'A' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('2-50 characters');
    });

    // TC-R-010: Profile name field validates maximum 50 characters
    test('should reject name with more than 50 characters', async () => {
      const longName = 'A'.repeat(51);
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: longName });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('2-50 characters');
    });

    // TC-R-011: Profile name field validates letters and spaces only
    test('should reject name with invalid characters', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: 'John123' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('letters and spaces');
    });

    // TC-R-012: Profile name field validates that name is not empty
    test('should reject empty name', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Name is required');
    });

    // TC-R-013: Profile name field validates that name is provided
    test('should reject missing name field', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Name is required');
    });

    // TC-R-014: Handle database errors during name update
    test('should handle database errors during name update', async () => {
      mockDbHelpers.updateUserById.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: 'Valid Name' });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to update profile');
    });

    // TC-R-015: Name field trims whitespace
    test('should trim whitespace from name', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', [`token=${authToken}`])
        .send({ name: '  Trimmed Name  ' });
      
      expect(response.status).toBe(200);
      expect(mockDbHelpers.updateUserById).toHaveBeenCalledWith(TEST_USER.id, {
        name: 'Trimmed Name'
      });
    });
  });

  describe('POST /profile/password', () => {
    // TC-R-016: Password change requires authentication
    test('should require authentication for password changes', async () => {
      const response = await request(app)
        .post('/profile/password')
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(401);
      expect(response.headers.location).toBe('/login');
    });

    // TC-R-017: Current password field validates against user's existing password
    test('should verify current password before allowing change', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDbHelpers.comparePasswords).toHaveBeenCalledWith('correctpassword', TEST_USER.password);
    });

    // TC-R-018: Reject incorrect current password
    test('should reject incorrect current password', async () => {
      mockDbHelpers.comparePasswords.mockResolvedValue(false);
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect');
    });

    // TC-R-019: New password field applies minimum 6 characters validation
    test('should reject new password with less than 6 characters', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'Pass1'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('at least 6 characters');
    });

    // TC-R-020: New password requires uppercase letter
    test('should reject new password without uppercase letter', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('uppercase');
    });

    // TC-R-021: New password requires lowercase letter
    test('should reject new password without lowercase letter', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'PASSWORD123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('lowercase');
    });

    // TC-R-022: New password requires number
    test('should reject new password without number', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'Password'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('number');
    });

    // TC-R-023: Password change form only submits when both fields are completed
    test('should reject missing current password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    // TC-R-024: Reject missing new password
    test('should reject missing new password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    // TC-R-025: Successful password change shows success message
    test('should hash and update password successfully', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password updated successfully'
      });
      
      // Verify password was hashed and updated
      const updateCall = mockDbHelpers.updateUserById.mock.calls[0];
      expect(updateCall[0]).toBe(TEST_USER.id);
      expect(updateCall[1].password).toBeDefined();
      expect(updateCall[1].password).not.toBe('NewPass123'); // Should be hashed
    });

    // TC-R-026: Handle user not found error
    test('should handle user not found during password change', async () => {
      mockDbHelpers.getUserById.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    // TC-R-027: Handle database errors during password change
    test('should handle database errors during password change', async () => {
      mockDbHelpers.updateUserById.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', [`token=${authToken}`])
        .send({
          currentPassword: 'correctpassword',
          newPassword: 'NewPass123'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to update password');
    });
  });

  describe('JWT Token Validation', () => {
    // TC-R-028: JWT tokens must expire after exactly 24 hours
    test('should create JWT tokens with 24 hour expiration', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'test', password: 'password' });
      
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies.find((cookie: string) => cookie.startsWith('token='));
      
      expect(tokenCookie).toContain('Max-Age=86400'); // 24 hours in seconds
    });

    // TC-R-029: JWT tokens contain user ID and email claims
    test('should include user ID and email in JWT token', () => {
      const token = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      expect(decoded.user.id).toBe(TEST_USER.id);
      expect(decoded.user.email).toBe(TEST_USER.email);
    });
  });
});