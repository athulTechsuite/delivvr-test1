import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Test configuration
const JWT_SECRET = 'test-secret';
const TEST_USER = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  password: '$2b$10$hashedpassword',
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock database operations
const mockDb = {
  getUserById: jest.fn(),
  updateUserById: jest.fn(),
  updateUserPassword: jest.fn()
};

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  
  if (!token) {
    return res.status(401).redirect('/login');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.locals.user = decoded.user;
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
  app.set('views', 'views');
  
  // Profile routes
  app.get('/profile', authenticateToken, async (req, res) => {
    try {
      const user = await mockDb.getUserById(res.locals.user.id);
      if (!user) {
        return res.status(404).redirect('/login');
      }
      res.render('profile', { user });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/profile/update', authenticateToken, async (req, res) => {
    try {
      const { name } = req.body;
      const userId = res.locals.user.id;
      
      // Validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      if (name.length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }
      
      if (name.length > 50) {
        return res.status(400).json({ error: 'Name must not exceed 50 characters' });
      }
      
      if (!/^[A-Za-z\s]+$/.test(name)) {
        return res.status(400).json({ error: 'Name must contain only letters and spaces' });
      }
      
      // Check if name is unchanged
      const currentUser = await mockDb.getUserById(userId);
      if (currentUser && currentUser.name === name) {
        return res.status(200).json({ 
          success: true, 
          message: 'No changes detected',
          unchanged: true 
        });
      }
      
      await mockDb.updateUserById(userId, { name });
      
      res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });
  
  app.post('/profile/password', authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = res.locals.user.id;
      
      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new password are required' });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      
      // Verify current password
      const user = await mockDb.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const isCurrentPasswordValid = await mockBcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password and update
      const hashedNewPassword = await mockBcrypt.hash(newPassword, 10);
      await mockDb.updateUserPassword(userId, hashedNewPassword);
      
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });
  
  return app;
};

describe('Profile Routes', () => {
  let app: express.Application;
  let validToken: string;
  
  beforeEach(() => {
    app = createTestApp();
    validToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '1h' });
    
    // Reset mocks
    jest.clearAllMocks();
    mockDb.getUserById.mockResolvedValue(TEST_USER);
    mockDb.updateUserById.mockResolvedValue({ affected: 1 });
    mockDb.updateUserPassword.mockResolvedValue({ affected: 1 });
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue('$2b$10$newhashed');
  });
  
  describe('Profile Page Access', () => {
    // TC-F-040
    it('should protect profile route with authenticateToken middleware', async () => {
      const response = await request(app).get('/profile');
      
      expect(response.status).toBe(401);
      expect(response.header.location).toBe('/login');
    });
    
    // TC-F-041
    it('should fetch user data from database using JWT token user ID', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(mockDb.getUserById).toHaveBeenCalledWith(TEST_USER.id);
      expect(response.status).toBe(200);
    });
    
    // TC-F-042
    it('should handle database errors gracefully during profile fetch', async () => {
      mockDb.getUserById.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
    
    // TC-F-043
    it('should redirect to login if user data is missing from database', async () => {
      mockDb.getUserById.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${validToken}`);
      
      expect(response.status).toBe(404);
      expect(response.header.location).toBe('/login');
    });
  });
  
  describe('Profile Update Validation', () => {
    // TC-F-044
    it('should validate name field is required and not empty', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name is required');
    });
    
    // TC-F-045
    it('should enforce minimum 2 character length for name', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: 'A' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name must be at least 2 characters');
    });
    
    // TC-F-046
    it('should enforce maximum 50 character length for name', async () => {
      const longName = 'A'.repeat(51);
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: longName });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name must not exceed 50 characters');
    });
    
    // TC-F-047
    it('should validate name contains only letters and spaces', async () => {
      const invalidNames = ['John123', 'John@Doe', 'John.Doe', 'John-Doe'];
      
      for (const invalidName of invalidNames) {
        const response = await request(app)
          .post('/profile/update')
          .set('Cookie', `token=${validToken}`)
          .send({ name: invalidName });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name must contain only letters and spaces');
      }
    });
    
    // TC-F-048
    it('should accept valid names with letters and spaces', async () => {
      const validNames = ['John Doe', 'Mary Jane', 'Van Der Berg', 'Jean Claude'];
      
      for (const validName of validNames) {
        const response = await request(app)
          .post('/profile/update')
          .set('Cookie', `token=${validToken}`)
          .send({ name: validName });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });
  
  describe('Profile Update Operations', () => {
    // TC-F-049
    it('should prevent unnecessary database operations when name is unchanged', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: TEST_USER.name });
      
      expect(response.status).toBe(200);
      expect(response.body.unchanged).toBe(true);
      expect(response.body.message).toBe('No changes detected');
      expect(mockDb.updateUserById).not.toHaveBeenCalled();
    });
    
    // TC-F-050
    it('should update user name in database when valid changes are submitted', async () => {
      const newName = 'Updated Name';
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: newName });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(mockDb.updateUserById).toHaveBeenCalledWith(TEST_USER.id, { name: newName });
    });
    
    // TC-F-051
    it('should handle database errors gracefully during profile update', async () => {
      mockDb.updateUserById.mockRejectedValueOnce(new Error('Database update failed'));
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: 'New Name' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update profile');
    });
  });
  
  describe('Password Change Validation', () => {
    // TC-F-052
    it('should require both current and new password fields', async () => {
      // Test missing current password
      let response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ newPassword: 'newpass123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Both current and new password are required');
      
      // Test missing new password
      response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'oldpass' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Both current and new password are required');
    });
    
    // TC-F-053
    it('should enforce minimum 6 character length for new password', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'oldpass', newPassword: '12345' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('New password must be at least 6 characters');
    });
    
    // TC-F-054
    it('should verify current password against database before allowing update', async () => {
      mockBcrypt.compare.mockResolvedValueOnce(false);
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password is incorrect');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('wrongpass', TEST_USER.password);
    });
    
    // TC-F-055
    it('should hash new password with bcrypt before storing', async () => {
      const newPassword = 'newpass123';
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'oldpass', newPassword });
      
      expect(response.status).toBe(200);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockDb.updateUserPassword).toHaveBeenCalledWith(TEST_USER.id, '$2b$10$newhashed');
    });
  });
  
  describe('Password Change Operations', () => {
    // TC-F-056
    it('should successfully change password when all validations pass', async () => {
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });
    
    // TC-F-057
    it('should handle database errors gracefully during password update', async () => {
      mockDb.updateUserPassword.mockRejectedValueOnce(new Error('Database update failed'));
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to change password');
    });
    
    // TC-F-058
    it('should handle case when user is not found during password change', async () => {
      mockDb.getUserById.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/profile/password')
        .set('Cookie', `token=${validToken}`)
        .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });
  
  describe('Authentication and Authorization', () => {
    // TC-F-059
    it('should reject requests without valid JWT token', async () => {
      const response = await request(app)
        .post('/profile/update')
        .send({ name: 'New Name' });
      
      expect(response.status).toBe(401);
      expect(response.header.location).toBe('/login');
    });
    
    // TC-F-060
    it('should reject requests with expired JWT token', async () => {
      const expiredToken = jwt.sign({ user: TEST_USER }, JWT_SECRET, { expiresIn: '-1h' });
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${expiredToken}`)
        .send({ name: 'New Name' });
      
      expect(response.status).toBe(401);
      expect(response.header.location).toBe('/login');
    });
    
    // TC-F-061
    it('should reject requests with malformed JWT token', async () => {
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', 'token=invalid.jwt.token')
        .send({ name: 'New Name' });
      
      expect(response.status).toBe(401);
      expect(response.header.location).toBe('/login');
    });
  });
  
  describe('Input Sanitization and Security', () => {
    // TC-F-062
    it('should handle SQL injection attempts in name field', async () => {
      const maliciousNames = [
        "'; DROP TABLE users; --",
        "<script>alert('xss')</script>",
        "../../etc/passwd"
      ];
      
      for (const maliciousName of maliciousNames) {
        const response = await request(app)
          .post('/profile/update')
          .set('Cookie', `token=${validToken}`)
          .send({ name: maliciousName });
        
        // Should be rejected due to pattern validation
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Name must contain only letters and spaces');
      }
    });
    
    // TC-F-063
    it('should validate data types for all input fields', async () => {
      // Test non-string name
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: 12345 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name is required');
    });
    
    // TC-F-064
    it('should handle very long input strings gracefully', async () => {
      const veryLongString = 'A'.repeat(1000);
      
      const response = await request(app)
        .post('/profile/update')
        .set('Cookie', `token=${validToken}`)
        .send({ name: veryLongString });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name must not exceed 50 characters');
    });
  });
});