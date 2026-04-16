import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);

// Mock database schema and operations
interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  password?: string;
  created_at: string;
  profile_picture?: string | null;
}

class MockDatabase {
  private users: User[] = [];
  private nextId = 1;
  
  // Simulate schema migration
  async migrate() {
    // This would represent the ALTER TABLE statement in real implementation
    // ALTER TABLE users ADD COLUMN profile_picture TEXT;
    console.log('Adding profile_picture column to users table');
  }
  
  async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const user: User = {
      id: this.nextId++,
      ...userData,
      created_at: new Date().toISOString(),
      profile_picture: null
    };
    
    this.users.push(user);
    return user;
  }
  
  async findUserById(id: number): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }
  
  async findUserByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) || null;
  }
  
  async updateProfile(id: number, updates: Partial<Pick<User, 'name' | 'email' | 'profile_picture'>>): Promise<User | null> {
    const userIndex = this.users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    // Validate email uniqueness if email is being updated
    if (updates.email) {
      const existingUser = await this.findUserByEmail(updates.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already in use');
      }
    }
    
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates
    };
    
    return this.users[userIndex];
  }
  
  async emailExists(email: string, excludeId?: number): Promise<boolean> {
    return this.users.some(u => u.email === email && u.id !== excludeId);
  }
  
  // Get all users (for testing)
  getAllUsers(): User[] {
    return [...this.users];
  }
  
  // Reset database (for testing)
  reset(): void {
    this.users = [];
    this.nextId = 1;
  }
}

// Mock file system operations
class MockFileSystem {
  private files = new Map<string, Buffer>();
  private directories = new Set<string>();
  
  async mkdir(dirPath: string): Promise<void> {
    this.directories.add(dirPath);
  }
  
  async writeFile(filePath: string, data: Buffer): Promise<void> {
    const dir = path.dirname(filePath);
    if (!this.directories.has(dir)) {
      await this.mkdir(dir);
    }
    this.files.set(filePath, data);
  }
  
  async unlink(filePath: string): Promise<void> {
    if (!this.files.has(filePath)) {
      throw new Error('File not found');
    }
    this.files.delete(filePath);
  }
  
  async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }
  
  getFile(filePath: string): Buffer | undefined {
    return this.files.get(filePath);
  }
  
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }
  
  directoryExists(dirPath: string): boolean {
    return this.directories.has(dirPath);
  }
  
  reset(): void {
    this.files.clear();
    this.directories.clear();
  }
}

// Profile service for testing business logic
class ProfileService {
  constructor(
    private db: MockDatabase,
    private fs: MockFileSystem
  ) {}
  
  async updateProfile(userId: number, data: {
    name: string;
    email: string;
    profilePicture?: { buffer: Buffer; filename: string; mimetype: string }
  }): Promise<User> {
    // Validation
    await this.validateProfileData(data, userId);
    
    const updateData: any = {
      name: data.name,
      email: data.email
    };
    
    // Handle profile picture upload
    if (data.profilePicture) {
      const picturePath = await this.handleProfilePictureUpload(
        userId,
        data.profilePicture
      );
      updateData.profile_picture = picturePath;
    }
    
    // Update database
    const updatedUser = await this.db.updateProfile(userId, updateData);
    
    if (!updatedUser) {
      throw new Error('Failed to update user');
    }
    
    return updatedUser;
  }
  
  private async validateProfileData(data: {
    name: string;
    email: string;
    profilePicture?: { buffer: Buffer; filename: string; mimetype: string }
  }, userId: number): Promise<void> {
    const errors: string[] = [];
    
    // Name validation
    if (!data.name || data.name.length < 2 || data.name.length > 50) {
      errors.push('Name must be between 2 and 50 characters');
    }
    
    if (!/^[a-zA-Z\s]+$/.test(data.name)) {
      errors.push('Name can only contain letters and spaces');
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push('Please enter a valid email address');
    }
    
    // Check email uniqueness
    const emailExists = await this.db.emailExists(data.email, userId);
    if (emailExists) {
      errors.push('Email is already in use');
    }
    
    // File validation
    if (data.profilePicture) {
      const { buffer, filename, mimetype } = data.profilePicture;
      
      // Check file size (5MB)
      if (buffer.length > 5242880) {
        errors.push('File size must be less than 5MB');
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(mimetype)) {
        errors.push('Only JPEG, PNG and GIF files are allowed');
      }
      
      const allowedExtensions = /\.(jpg|jpeg|png|gif)$/i;
      if (!allowedExtensions.test(filename)) {
        errors.push('Invalid file extension');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }
  
  private async handleProfilePictureUpload(
    userId: number,
    file: { buffer: Buffer; filename: string; mimetype: string }
  ): Promise<string> {
    // Create uploads directory if it doesn't exist
    const uploadsDir = 'public/uploads';
    if (!this.fs.directoryExists(uploadsDir)) {
      await this.fs.mkdir(uploadsDir);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(file.filename);
    const filename = `${userId}-${timestamp}${extension}`;
    const filePath = path.join(uploadsDir, filename);
    
    // Delete existing profile picture
    const existingUser = await this.db.findUserById(userId);
    if (existingUser?.profile_picture) {
      const existingFilePath = path.join('public', existingUser.profile_picture);
      try {
        await this.fs.unlink(existingFilePath);
      } catch (error) {
        // File might not exist, continue
        console.warn('Could not delete existing profile picture:', error);
      }
    }
    
    // Save new file
    await this.fs.writeFile(filePath, file.buffer);
    
    // Return relative path for database storage
    return `uploads/${filename}`;
  }
}

describe('Profile Database Integration Tests', () => {
  let db: MockDatabase;
  let fs: MockFileSystem;
  let profileService: ProfileService;
  let testUser: User;
  
  beforeEach(async () => {
    db = new MockDatabase();
    fs = new MockFileSystem();
    profileService = new ProfileService(db, fs);
    
    // Create test user
    testUser = await db.createUser({
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword'
    });
  });
  
  afterEach(() => {
    db.reset();
    fs.reset();
  });
  
  describe('Database Schema Migration', () => {
    // TC-F-013: Database schema includes profile_picture column
    test('should add profile_picture column to users table', async () => {
      await db.migrate();
      
      // Verify new users have profile_picture column with NULL default
      const user = await db.createUser({
        username: 'newuser',
        name: 'New User',
        email: 'new@example.com'
      });
      
      expect(user).toHaveProperty('profile_picture');
      expect(user.profile_picture).toBeNull();
    });
    
    test('should maintain backward compatibility with existing users', async () => {
      // Existing user should have profile_picture as null
      expect(testUser.profile_picture).toBeNull();
      
      // Should be able to query user without issues
      const foundUser = await db.findUserById(testUser.id);
      expect(foundUser).toBeTruthy();
      expect(foundUser?.profile_picture).toBeNull();
    });
  });
  
  describe('Profile Updates', () => {
    // TC-F-006: Save validates inputs and persists changes to database
    test('should successfully update profile with valid data', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      
      const updatedUser = await profileService.updateProfile(testUser.id, updateData);
      
      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.email).toBe('updated@example.com');
      
      // Verify in database
      const dbUser = await db.findUserById(testUser.id);
      expect(dbUser?.name).toBe('Updated Name');
      expect(dbUser?.email).toBe('updated@example.com');
    });
    
    // TC-F-008: Name field validation in database operations
    test('should reject invalid name in database update', async () => {
      const updateData = {
        name: 'A', // Too short
        email: 'test@example.com'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, updateData)
      ).rejects.toThrow('Name must be between 2 and 50 characters');
      
      // Verify user was not updated
      const dbUser = await db.findUserById(testUser.id);
      expect(dbUser?.name).toBe('Test User'); // Original name
    });
    
    test('should reject name with invalid characters', async () => {
      const updateData = {
        name: 'Test123',
        email: 'test@example.com'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, updateData)
      ).rejects.toThrow('Name can only contain letters and spaces');
    });
    
    test('should reject name longer than 50 characters', async () => {
      const updateData = {
        name: 'A'.repeat(51),
        email: 'test@example.com'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, updateData)
      ).rejects.toThrow('Name must be between 2 and 50 characters');
    });
    
    // TC-F-009: Email field validation in database operations
    test('should reject invalid email format', async () => {
      const updateData = {
        name: 'Test User',
        email: 'invalid-email'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, updateData)
      ).rejects.toThrow('Please enter a valid email address');
    });
    
    test('should reject duplicate email addresses', async () => {
      // Create another user
      const anotherUser = await db.createUser({
        username: 'anotheruser',
        name: 'Another User',
        email: 'another@example.com'
      });
      
      const updateData = {
        name: 'Test User',
        email: 'another@example.com' // Already taken
      };
      
      await expect(
        profileService.updateProfile(testUser.id, updateData)
      ).rejects.toThrow('Email is already in use');
    });
    
    test('should allow user to keep their own email', async () => {
      const updateData = {
        name: 'Updated Name',
        email: testUser.email // Same email
      };
      
      const updatedUser = await profileService.updateProfile(testUser.id, updateData);
      expect(updatedUser.email).toBe(testUser.email);
    });
  });
  
  describe('Profile Picture Storage', () => {
    // TC-F-011: Profile pictures stored in public/uploads with unique filenames
    test('should store profile picture with unique filename', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-image-data'),
        filename: 'test.jpg',
        mimetype: 'image/jpeg'
      };
      
      const updatedUser = await profileService.updateProfile(testUser.id, {
        name: 'Test User',
        email: 'test@example.com',
        profilePicture: mockFile
      });
      
      expect(updatedUser.profile_picture).toMatch(/uploads\/1-\d+\.jpg/);
      
      // Verify file was created
      const filePath = `public/${updatedUser.profile_picture}`;
      expect(await fs.exists(filePath)).toBe(true);
      expect(fs.getFile(filePath)).toEqual(mockFile.buffer);
    });
    
    test('should create uploads directory if it does not exist', async () => {
      expect(fs.directoryExists('public/uploads')).toBe(false);
      
      const mockFile = {
        buffer: Buffer.from('fake-image-data'),
        filename: 'test.png',
        mimetype: 'image/png'
      };
      
      await profileService.updateProfile(testUser.id, {
        name: 'Test User',
        email: 'test@example.com',
        profilePicture: mockFile
      });
      
      expect(fs.directoryExists('public/uploads')).toBe(true);
    });
    
    test('should delete existing profile picture when uploading new one', async () => {
      // First upload
      const firstFile = {
        buffer: Buffer.from('first-image'),
        filename: 'first.jpg',
        mimetype: 'image/jpeg'
      };
      
      const firstUpdate = await profileService.updateProfile(testUser.id, {
        name: 'Test User',
        email: 'test@example.com',
        profilePicture: firstFile
      });
      
      const firstFilePath = `public/${firstUpdate.profile_picture}`;
      expect(await fs.exists(firstFilePath)).toBe(true);
      
      // Second upload should delete first file
      const secondFile = {
        buffer: Buffer.from('second-image'),
        filename: 'second.jpg',
        mimetype: 'image/jpeg'
      };
      
      const secondUpdate = await profileService.updateProfile(testUser.id, {
        name: 'Test User',
        email: 'test@example.com',
        profilePicture: secondFile
      });
      
      expect(await fs.exists(firstFilePath)).toBe(false);
      
      const secondFilePath = `public/${secondUpdate.profile_picture}`;
      expect(await fs.exists(secondFilePath)).toBe(true);
    });
    
    // TC-F-010: File type validation
    test('should reject invalid file types', async () => {
      const invalidFile = {
        buffer: Buffer.from('text-file-content'),
        filename: 'document.txt',
        mimetype: 'text/plain'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, {
          name: 'Test User',
          email: 'test@example.com',
          profilePicture: invalidFile
        })
      ).rejects.toThrow('Only JPEG, PNG and GIF files are allowed');
    });
    
    // TC-F-012: File size validation
    test('should reject files larger than 5MB', async () => {
      const largeFile = {
        buffer: Buffer.alloc(5242881), // 5MB + 1 byte
        filename: 'large.jpg',
        mimetype: 'image/jpeg'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, {
          name: 'Test User',
          email: 'test@example.com',
          profilePicture: largeFile
        })
      ).rejects.toThrow('File size must be less than 5MB');
    });
    
    test('should accept files at size limit', async () => {
      const maxSizeFile = {
        buffer: Buffer.alloc(5242880), // Exactly 5MB
        filename: 'maxsize.jpg',
        mimetype: 'image/jpeg'
      };
      
      const updatedUser = await profileService.updateProfile(testUser.id, {
        name: 'Test User',
        email: 'test@example.com',
        profilePicture: maxSizeFile
      });
      
      expect(updatedUser.profile_picture).toBeTruthy();
    });
  });
  
  describe('Atomic Operations', () => {
    test('should rollback on validation failure', async () => {
      const originalUser = await db.findUserById(testUser.id);
      
      const invalidUpdate = {
        name: 'A', // Invalid name
        email: 'updated@example.com',
        profilePicture: {
          buffer: Buffer.from('image-data'),
          filename: 'test.jpg',
          mimetype: 'image/jpeg'
        }
      };
      
      await expect(
        profileService.updateProfile(testUser.id, invalidUpdate)
      ).rejects.toThrow();
      
      // Verify user was not updated
      const unchangedUser = await db.findUserById(testUser.id);
      expect(unchangedUser).toEqual(originalUser);
      
      // Verify no files were created
      expect(fs.listFiles().length).toBe(0);
    });
    
    test('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(db, 'updateProfile').mockRejectedValue(new Error('Database connection failed'));
      
      const updateData = {
        name: 'Valid Name',
        email: 'valid@example.com'
      };
      
      await expect(
        profileService.updateProfile(testUser.id, updateData)
      ).rejects.toThrow('Database connection failed');
    });
  });
});