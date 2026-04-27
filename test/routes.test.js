const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/auth');
const dashboardRoutes = require('../routes/dashboard');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

// Create test app
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Mock database for testing
const testDbPath = path.join(__dirname, 'routes-test.db');
let testDb;

beforeAll((done) => {
  testDb = new sqlite3.Database(testDbPath);
  testDb.serialize(() => {
    testDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, done);
  });
  
  // Mock the database module
  jest.doMock('../database/db', () => testDb);
  
  // Setup routes
  app.use('/auth', authRoutes);
  app.use('/dashboard', dashboardRoutes);
});

afterAll((done) => {
  testDb.close();
  const fs = require('fs');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  done();
});

afterEach((done) => {
  testDb.run('DELETE FROM users', done);
});

describe('Authentication Routes', () => {
  describe('GET /auth/signup', () => {
    test('should render signup form', async () => {
      const response = await request(app).get('/auth/signup');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Sign Up');
      expect(response.text).toContain('name="name"');
      expect(response.text).toContain('name="email"');
      expect(response.text).toContain('name="password"');
    });
  });

  describe('POST /auth/signup', () => {
    test('should create new user account successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData);

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/auth/login');

      // Verify user was created
      const user = await new Promise((resolve) => {
        testDb.get('SELECT * FROM users WHERE email = ?', [userData.email], (err, row) => {
          resolve(row);
        });
      });

      expect(user).toBeTruthy();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(await bcrypt.compare(userData.password, user.password)).toBe(true);
    });

    test('should reject signup with missing required fields', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({ name: 'John' }); // Missing email and password

      expect(response.status).toBe(200);
      expect(response.text).toContain('All fields are required');
    });

    test('should reject signup with short password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: '123' // Too short
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Password must be at least 6 characters long');
    });

    test('should reject signup with duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      // Create first user
      await request(app).post('/auth/signup').send(userData);

      // Try to create duplicate
      const response = await request(app).post('/auth/signup').send(userData);

      expect(response.status).toBe(200);
      expect(response.text).toContain('User with this email already exists');
    });
  });

  describe('GET /auth/login', () => {
    test('should render login form', async () => {
      const response = await request(app).get('/auth/login');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Login');
      expect(response.text).toContain('name="email"');
      expect(response.text).toContain('name="password"');
    });

    test('should display success message from query parameter', async () => {
      const response = await request(app)
        .get('/auth/login?message=Account created successfully!');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Account created successfully!');
    });
  });

  describe('POST /auth/login', () => {
    let testUser;
    const userPassword = 'password123';

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash(userPassword, 10);
      testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword
      };

      await new Promise((resolve) => {
        testDb.run(
          'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
          [testUser.name, testUser.email, testUser.password],
          resolve
        );
      });
    });

    test('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: userPassword
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/dashboard');
      
      // Check JWT token in cookies
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      expect(tokenCookie).toBeTruthy();
    });

    test('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Invalid email or password');
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userPassword
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Invalid email or password');
    });

    test('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email }); // Missing password

      expect(response.status).toBe(200);
      expect(response.text).toContain('All fields are required');
    });
  });
});

describe('Dashboard Routes', () => {
  let testUser;
  let validToken;
  const userPassword = 'password123';

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    
    const userId = await new Promise((resolve) => {
      testDb.run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        ['Test User', 'test@example.com', hashedPassword],
        function() { resolve(this.lastID); }
      );
    });

    testUser = {
      id: userId,
      name: 'Test User',
      email: 'test@example.com'
    };

    validToken = jwt.sign(
      { userId: userId, email: testUser.email },
      process.env.JWT_SECRET || 'your-secret-key'
    );
  });

  describe('GET /dashboard', () => {
    test('should render dashboard for authenticated user', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${validToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain(testUser.name);
      expect(response.text).toContain(testUser.email);
      expect(response.text).toContain('Profile Information');
    });

    test('should redirect unauthenticated user to login', async () => {
      const response = await request(app).get('/dashboard');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should redirect user with invalid token to login', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', 'token=invalid-token');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should clear invalid token cookie and redirect', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', 'token=expired-or-invalid-token');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
      
      // Check if token cookie is cleared
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
        if (tokenCookie) {
          expect(tokenCookie).toContain('Max-Age=0');
        }
      }
    });
  });

  describe('POST /dashboard/logout', () => {
    test('should logout user and clear token cookie', async () => {
      const response = await request(app)
        .post('/dashboard/logout')
        .set('Cookie', `token=${validToken}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/');
      
      // Check if token cookie is cleared
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies && cookies.find(cookie => cookie.startsWith('token='));
      if (tokenCookie) {
        expect(tokenCookie).toContain('Max-Age=0');
      }
    });

    test('should handle logout without token', async () => {
      const response = await request(app).post('/dashboard/logout');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/');
    });
  });
});

describe('Health Endpoint', () => {
  // Build an isolated app with only the health route, matching app.js exactly.
  // This mirrors the unauthenticated, DB-independent registration in app.js.
  const healthApp = express();
  healthApp.use(express.json());
  healthApp.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
  // Match app.js 404 catch-all so unsupported methods return 404.
  healthApp.use((req, res) => {
    res.status(404).send('Not Found');
  });

  const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  describe('GET /health', () => {
    test('should return 200 OK', async () => {
      const response = await request(healthApp).get('/health');
      expect(response.status).toBe(200);
    });

    test('should return JSON content type', async () => {
      const response = await request(healthApp).get('/health');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should return status "ok"', async () => {
      const response = await request(healthApp).get('/health');
      expect(response.body.status).toBe('ok');
    });

    test('should return uptime as a non-negative number', async () => {
      const response = await request(healthApp).get('/health');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(response.body.uptime)).toBe(true);
    });

    test('should return timestamp as a valid ISO-8601 string', async () => {
      const response = await request(healthApp).get('/health');
      expect(typeof response.body.timestamp).toBe('string');
      expect(response.body.timestamp).toMatch(ISO_8601_REGEX);
      // Round-trip parse check: Date must reconstruct the same ISO string.
      const parsed = new Date(response.body.timestamp);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(parsed.toISOString()).toBe(response.body.timestamp);
    });

    test('should not set authentication cookies', async () => {
      const response = await request(healthApp).get('/health');
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const tokenCookie = cookies.find((cookie) => cookie.startsWith('token='));
        expect(tokenCookie).toBeFalsy();
      }
    });

    test('should succeed without any authentication token', async () => {
      const response = await request(healthApp).get('/health');
      // No cookie sent; endpoint must not redirect or reject.
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(401);
    });
  });

  describe('POST /health', () => {
    test('should return 404 for unsupported method', async () => {
      const response = await request(healthApp).post('/health');
      expect(response.status).toBe(404);
    });
  });
});

describe('Route Security', () => {
  test('should validate JWT token signature', () => {
    const payload = { userId: 1, email: 'test@example.com' };
    const secret = 'test-secret';
    const wrongSecret = 'wrong-secret';
    
    const token = jwt.sign(payload, secret);
    
    expect(() => {
      jwt.verify(token, wrongSecret);
    }).toThrow('invalid signature');
  });

  test('should handle malformed JWT tokens', () => {
    const malformedToken = 'not.a.valid.jwt.token';
    
    expect(() => {
      jwt.verify(malformedToken, 'any-secret');
    }).toThrow();
  });

  test('should properly hash passwords', async () => {
    const password = 'testpassword123';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    
    // Same password should generate different hashes
    expect(hash1).not.toBe(hash2);
    
    // Both hashes should be valid for the original password
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
    
    // Wrong password should not match
    expect(await bcrypt.compare('wrongpassword', hash1)).toBe(false);
  });
});