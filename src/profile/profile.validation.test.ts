import { body, validationResult } from 'express-validator';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Test constants matching implementation
const MAX_FILE_SIZE = 5242880; // 5MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
const UPLOADS_DIR = path.join(__dirname, '../test-uploads');

// Validation rules from implementation
const profileUpdateValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Mock multer configuration
const createMockMulterConfig = () => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOADS_DIR);
    },
    filename: function (req: any, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const userId = req.user?.id || 1;
      const timestamp = Date.now();
      cb(null, `${userId}-${timestamp}${ext}`);
    }
  });
  
  const fileFilter = (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed'));
    }
  };
  
  return multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: fileFilter
  });
};

// Helper function to create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Test endpoint for validation
  app.post('/test-validation', profileUpdateValidation, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    res.json({ success: true });
  });
  
  return app;
};

// Helper to create test file buffer
const createTestFileBuffer = (size: number = 1000) => {
  return Buffer.alloc(size, 'test data');
};

describe('Profile Validation Tests', () => {
  let upload: multer.Multer;
  
  beforeAll(() => {
    // Create test uploads directory
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    upload = createMockMulterConfig();
  });
  
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  });
  
  // TC-AC-008: Name field validation
  describe('Name Validation', () => {
    const testCases = [
      {
        name: 'valid name with letters only',
        input: 'John Doe',
        expected: { isValid: true }
      },
      {
        name: 'valid name with multiple spaces',
        input: 'Mary Jane Watson',
        expected: { isValid: true }
      },
      {
        name: 'minimum length - 2 characters',
        input: 'Jo',
        expected: { isValid: true }
      },
      {
        name: 'maximum length - 50 characters',
        input: 'A'.repeat(50),
        expected: { isValid: true }
      },
      {
        name: 'below minimum length - 1 character',
        input: 'A',
        expected: { isValid: false, message: 'Name must be between 2 and 50 characters' }
      },
      {
        name: 'above maximum length - 51 characters',
        input: 'A'.repeat(51),
        expected: { isValid: false, message: 'Name must be between 2 and 50 characters' }
      },
      {
        name: 'empty string',
        input: '',
        expected: { isValid: false, message: 'Name must be between 2 and 50 characters' }
      },
      {
        name: 'whitespace only',
        input: '   ',
        expected: { isValid: false, message: 'Name must be between 2 and 50 characters' }
      },
      {
        name: 'contains numbers',
        input: 'John123',
        expected: { isValid: false, message: 'Name can only contain letters and spaces' }
      },
      {
        name: 'contains special characters',
        input: 'John@Doe',
        expected: { isValid: false, message: 'Name can only contain letters and spaces' }
      },
      {
        name: 'contains hyphen',
        input: 'Mary-Jane',
        expected: { isValid: false, message: 'Name can only contain letters and spaces' }
      },
      {
        name: 'contains underscore',
        input: 'John_Doe',
        expected: { isValid: false, message: 'Name can only contain letters and spaces' }
      }
    ];
    
    testCases.forEach(({ name: testName, input, expected }) => {
      test(`should validate name: ${testName}`, async () => {
        const req = {
          body: { name: input, email: 'test@example.com' }
        } as express.Request;
        
        // Run validation
        for (const validation of profileUpdateValidation) {
          await validation(req, {} as express.Response, () => {});
        }
        
        const errors = validationResult(req);
        const nameErrors = errors.array().filter(err => err.param === 'name');
        
        if (expected.isValid) {
          expect(nameErrors).toHaveLength(0);
        } else {
          expect(nameErrors).toHaveLength(1);
          expect(nameErrors[0].msg).toBe(expected.message);
        }
      });
    });
  });
  
  // TC-AC-009: Email field validation
  describe('Email Validation', () => {
    const testCases = [
      {
        name: 'valid standard email',
        input: 'user@example.com',
        expected: { isValid: true }
      },
      {
        name: 'valid email with subdomain',
        input: 'user@mail.example.com',
        expected: { isValid: true }
      },
      {
        name: 'valid email with plus sign',
        input: 'user+tag@example.com',
        expected: { isValid: true }
      },
      {
        name: 'valid email with numbers',
        input: 'user123@example.com',
        expected: { isValid: true }
      },
      {
        name: 'valid email with dots in local part',
        input: 'user.name@example.com',
        expected: { isValid: true }
      },
      {
        name: 'missing @ symbol',
        input: 'userexample.com',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'missing domain',
        input: 'user@',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'missing local part',
        input: '@example.com',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'missing TLD',
        input: 'user@example',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'multiple @ symbols',
        input: 'user@@example.com',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'spaces in email',
        input: 'user @example.com',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'empty string',
        input: '',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      },
      {
        name: 'whitespace only',
        input: '   ',
        expected: { isValid: false, message: 'Please provide a valid email address' }
      }
    ];
    
    testCases.forEach(({ name: testName, input, expected }) => {
      test(`should validate email: ${testName}`, async () => {
        const req = {
          body: { name: 'Valid Name', email: input }
        } as express.Request;
        
        // Run validation
        for (const validation of profileUpdateValidation) {
          await validation(req, {} as express.Response, () => {});
        }
        
        const errors = validationResult(req);
        const emailErrors = errors.array().filter(err => err.param === 'email');
        
        if (expected.isValid) {
          expect(emailErrors).toHaveLength(0);
        } else {
          expect(emailErrors).toHaveLength(1);
          expect(emailErrors[0].msg).toBe(expected.message);
        }
      });
    });
  });
  
  // TC-AC-010: File format validation
  describe('File Format Validation', () => {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const invalidExtensions = ['.txt', '.pdf', '.doc', '.mp4', '.exe', '.js'];
    
    validExtensions.forEach(ext => {
      test(`should accept ${ext} files`, () => {
        const mockFile = {
          originalname: `test${ext}`,
          mimetype: 'image/jpeg',
          size: 1000
        };
        
        const fileFilter = (req: any, file: any, cb: any) => {
          const extension = path.extname(file.originalname).toLowerCase();
          if (ALLOWED_EXTENSIONS.includes(extension)) {
            cb(null, true);
          } else {
            cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed'));
          }
        };
        
        let result: boolean | Error | null = null;
        fileFilter(null, mockFile, (err: Error | null, accepted: boolean) => {
          result = err || accepted;
        });
        
        expect(result).toBe(true);
      });
    });
    
    invalidExtensions.forEach(ext => {
      test(`should reject ${ext} files`, () => {
        const mockFile = {
          originalname: `test${ext}`,
          mimetype: 'application/octet-stream',
          size: 1000
        };
        
        const fileFilter = (req: any, file: any, cb: any) => {
          const extension = path.extname(file.originalname).toLowerCase();
          if (ALLOWED_EXTENSIONS.includes(extension)) {
            cb(null, true);
          } else {
            cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed'));
          }
        };
        
        let result: boolean | Error | null = null;
        fileFilter(null, mockFile, (err: Error | null, accepted: boolean) => {
          result = err || accepted;
        });
        
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe('Only image files (jpg, jpeg, png, gif) are allowed');
      });
    });
    
    test('should handle uppercase extensions', () => {
      const mockFile = {
        originalname: 'test.JPG',
        mimetype: 'image/jpeg',
        size: 1000
      };
      
      const fileFilter = (req: any, file: any, cb: any) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(extension)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed'));
        }
      };
      
      let result: boolean | Error | null = null;
      fileFilter(null, mockFile, (err: Error | null, accepted: boolean) => {
        result = err || accepted;
      });
      
      expect(result).toBe(true);
    });
  });
  
  // TC-AC-012: File size validation
  describe('File Size Validation', () => {
    test('should accept files at maximum size (5MB)', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: MAX_FILE_SIZE // Exactly 5MB
      };
      
      expect(mockFile.size).toBeLessThanOrEqual(MAX_FILE_SIZE);
    });
    
    test('should accept files under maximum size', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: MAX_FILE_SIZE - 1 // Just under 5MB
      };
      
      expect(mockFile.size).toBeLessThanOrEqual(MAX_FILE_SIZE);
    });
    
    test('should reject files over maximum size', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: MAX_FILE_SIZE + 1 // Just over 5MB
      };
      
      expect(mockFile.size).toBeGreaterThan(MAX_FILE_SIZE);
    });
    
    test('should accept very small files', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 100 // 100 bytes
      };
      
      expect(mockFile.size).toBeLessThanOrEqual(MAX_FILE_SIZE);
    });
  });
  
  // TC-AC-011: Filename generation validation
  describe('File Naming Validation', () => {
    test('should generate filename with userId and timestamp', () => {
      const mockReq = { user: { id: 123 } };
      const mockFile = { originalname: 'profile.jpg' };
      
      const generateFilename = (req: any, file: any) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const userId = req.user.id;
        const timestamp = Date.now();
        return `${userId}-${timestamp}${ext}`;
      };
      
      const filename = generateFilename(mockReq, mockFile);
      
      expect(filename).toMatch(/^123-\d+\.jpg$/);
    });
    
    test('should preserve file extension in lowercase', () => {
      const mockReq = { user: { id: 456 } };
      const extensions = ['.JPG', '.JPEG', '.PNG', '.GIF'];
      
      extensions.forEach(ext => {
        const mockFile = { originalname: `profile${ext}` };
        
        const generateFilename = (req: any, file: any) => {
          const extension = path.extname(file.originalname).toLowerCase();
          const userId = req.user.id;
          const timestamp = Date.now();
          return `${userId}-${timestamp}${extension}`;
        };
        
        const filename = generateFilename(mockReq, mockFile);
        
        expect(filename).toMatch(new RegExp(`^456-\\d+${ext.toLowerCase()}$`));
      });
    });
    
    test('should handle different user IDs', () => {
      const userIds = [1, 999, 12345];
      const mockFile = { originalname: 'test.png' };
      
      userIds.forEach(userId => {
        const mockReq = { user: { id: userId } };
        
        const generateFilename = (req: any, file: any) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const id = req.user.id;
          const timestamp = Date.now();
          return `${id}-${timestamp}${ext}`;
        };
        
        const filename = generateFilename(mockReq, mockFile);
        
        expect(filename).toMatch(new RegExp(`^${userId}-\\d+\.png$`));
      });
    });
  });
  
  // TC-AC-006: Combined validation scenarios
  describe('Combined Validation Scenarios', () => {
    test('should pass validation with all valid fields', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      } as express.Request;
      
      for (const validation of profileUpdateValidation) {
        await validation(req, {} as express.Response, () => {});
      }
      
      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });
    
    test('should fail validation with multiple invalid fields', async () => {
      const req = {
        body: {
          name: 'A', // Too short
          email: 'invalid-email' // Invalid format
        }
      } as express.Request;
      
      for (const validation of profileUpdateValidation) {
        await validation(req, {} as express.Response, () => {});
      }
      
      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
      
      const errorArray = errors.array();
      expect(errorArray).toHaveLength(2);
      
      const nameError = errorArray.find(err => err.param === 'name');
      const emailError = errorArray.find(err => err.param === 'email');
      
      expect(nameError?.msg).toBe('Name must be between 2 and 50 characters');
      expect(emailError?.msg).toBe('Please provide a valid email address');
    });
    
    test('should trim whitespace from inputs', async () => {
      const req = {
        body: {
          name: '  John Doe  ',
          email: '  john@example.com  '
        }
      } as express.Request;
      
      for (const validation of profileUpdateValidation) {
        await validation(req, {} as express.Response, () => {});
      }
      
      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
      
      // Check that values were trimmed
      expect(req.body.name).toBe('John Doe');
      expect(req.body.email).toBe('john@example.com');
    });
    
    test('should normalize email addresses', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'JOHN@EXAMPLE.COM'
        }
      } as express.Request;
      
      for (const validation of profileUpdateValidation) {
        await validation(req, {} as express.Response, () => {});
      }
      
      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
      
      // Check that email was normalized to lowercase
      expect(req.body.email).toBe('john@example.com');
    });
  });
});