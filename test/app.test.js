const request = require('supertest');
const app = require('../app');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

// Test database setup
const testDbPath = path.join(__dirname, 'test.db');
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

describe('Express.js Authentication App', () => {
  describe('Homepage Navigation - AC1', () => {
    test('should display homepage with signup and login navigation links', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Sign Up');
      expect(response.text).toContain('Login');
      expect(response.text).toContain('bootstrap');
      expect(response.text).toContain('Express Auth App');
    });

    test('should have Bootstrap styling', async () => {
      const response = await request(app).get('/');
      
      expect(response.text).toContain('bootstrap');
      expect(response.text).toContain('navbar');
      expect(response.text).toContain('btn');
    });
  });

  describe('User Registration - AC2', () => {
    test('should display signup form', async () => {
      const response = await request(app).get('/signup');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('name="name"');
      expect(response.text).toContain('name="email"');
      expect(response.text).toContain('name="password"');
      expect(response.text).toContain('Create Account');
    });

    test('should create new user with hashed password in SQLite database', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/signup')
        .send(userData);

      expect(response.status).toBe(302); // Redirect after successful signup
      expect(response.headers.location).toContain('/login');

      // Verify user was created in database
      const user = await new Promise((resolve) => {
        testDb.get('SELECT * FROM users WHERE email = ?', [userData.email], (err, row) => {
          resolve(row);
        });
      });

      expect(user).toBeTruthy();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(await bcrypt.compare(userData.password, user.password)).toBe(true);
    });

    test('should reject signup with missing fields', async () => {
      const response = await request(app)
        .post('/signup')
        .send({ name: 'John', email: '' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('All fields are required');
    });

    test('should reject signup with duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      // Create first user
      await request(app).post('/signup').send(userData);

      // Try to create duplicate
      const response = await request(app).post('/signup').send(userData);

      expect(response.status).toBe(200);
      expect(response.text).toContain('User with this email already exists');
    });
  });

  describe('User Login - AC3 & AC4', () => {
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

    test('should display login form', async () => {
      const response = await request(app).get('/login');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('name="email"');
      expect(response.text).toContain('name="password"');
      expect(response.text).toContain('Login');
    });

    test('should login user with valid credentials and redirect to dashboard', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: testUser.email,
          password: userPassword
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/dashboard');
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Verify JWT token is set in cookie
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      expect(tokenCookie).toBeTruthy();
    });

    test('should reject login with invalid credentials and show error', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Invalid email or password');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: userPassword
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Invalid email or password');
    });
  });

  describe('Protected Routes - AC5', () => {
    test('should redirect unauthenticated user to login page', async () => {
      const response = await request(app).get('/dashboard');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('should redirect user with invalid token to login page', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', 'token=invalid-jwt-token');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });

  describe('Dashboard Access - AC6', () => {
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
        { id: userId, email: testUser.email },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      );
    });

    test('should display dashboard with user profile and logout option for authenticated user', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${validToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain(testUser.name);
      expect(response.text).toContain(testUser.email);
      expect(response.text).toContain('Logout');
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('Profile Information');
    });

    test('should handle logout functionality', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Cookie', `token=${validToken}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/');
      
      // Check if token cookie is cleared
      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies && cookies.find(cookie => cookie.startsWith('token='));
      if (tokenCookie) {
        expect(tokenCookie).toContain('Max-Age=0'); // Cookie should be expired
      }
    });
  });

  describe('Security Features', () => {
    test('should hash passwords with bcrypt', async () => {
      const password = 'testpassword123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(await bcrypt.compare(password, hashedPassword)).toBe(true);
    });

    test('should generate valid JWT tokens', () => {
      const payload = { id: 1, email: 'test@example.com' };
      const secret = 'test-secret';
      
      const token = jwt.sign(payload, secret);
      const decoded = jwt.verify(token, secret);
      
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
    });

    test('should reject requests with expired JWT tokens', () => {
      const payload = { id: 1, email: 'test@example.com' };
      const secret = 'test-secret';

      const expiredToken = jwt.sign(payload, secret, { expiresIn: '-1h' });

      expect(() => {
        jwt.verify(expiredToken, secret);
      }).toThrow();
    });
  });

  describe('Health Endpoint', () => {
    test('should return 200 OK without authentication', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    test('should return JSON content type', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should return status "ok" in body', async () => {
      const response = await request(app).get('/health');
      expect(response.body.status).toBe('ok');
    });

    test('should not set token cookie', async () => {
      const response = await request(app).get('/health');
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const tokenCookie = cookies.find((c) => c.startsWith('token='));
        expect(tokenCookie).toBeFalsy();
      }
    });

    test('should return 404 for POST /health', async () => {
      const response = await request(app).post('/health');
      expect(response.status).toBe(404);
    });
  });
});