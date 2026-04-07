const jwt = require('jsonwebtoken');
const { authenticateToken, redirectIfAuthenticated } = require('../middleware/auth');
const httpMocks = require('node-mocks-http');

describe('Authentication Middleware', () => {
  const JWT_SECRET = 'test-secret-key';
  const validPayload = { userId: 1, email: 'test@example.com' };
  let validToken;

  beforeAll(() => {
    validToken = jwt.sign(validPayload, JWT_SECRET);
  });

  describe('authenticateToken middleware', () => {
    test('should call next() for valid token in Authorization header', () => {
      const req = httpMocks.createRequest({
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      // Mock JWT_SECRET
      process.env.JWT_SECRET = JWT_SECRET;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(expect.objectContaining(validPayload));
    });

    test('should call next() for valid token in cookies', () => {
      const req = httpMocks.createRequest({
        cookies: {
          token: validToken
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(expect.objectContaining(validPayload));
    });

    test('should redirect to /login when no token provided', () => {
      const req = httpMocks.createRequest();
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect to /login for invalid token', () => {
      const req = httpMocks.createRequest({
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect to /login for expired token', () => {
      const expiredToken = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '-1h' });
      
      const req = httpMocks.createRequest({
        cookies: {
          token: expiredToken
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should prefer Authorization header over cookie token', () => {
      const headerToken = jwt.sign({ userId: 2, email: 'header@example.com' }, JWT_SECRET);
      const cookieToken = jwt.sign({ userId: 3, email: 'cookie@example.com' }, JWT_SECRET);
      
      const req = httpMocks.createRequest({
        headers: {
          authorization: `Bearer ${headerToken}`
        },
        cookies: {
          token: cookieToken
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe(2);
      expect(req.user.email).toBe('header@example.com');
    });
  });

  describe('redirectIfAuthenticated middleware', () => {
    test('should redirect authenticated user to /dashboard', () => {
      const req = httpMocks.createRequest({
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      redirectIfAuthenticated(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/dashboard');
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect authenticated user with cookie token to /dashboard', () => {
      const req = httpMocks.createRequest({
        cookies: {
          token: validToken
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      redirectIfAuthenticated(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/dashboard');
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() for unauthenticated user', () => {
      const req = httpMocks.createRequest();
      const res = httpMocks.createResponse();
      const next = jest.fn();

      redirectIfAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200); // Default status
    });

    test('should call next() for user with invalid token', () => {
      const req = httpMocks.createRequest({
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      redirectIfAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    test('should call next() for user with expired token', () => {
      const expiredToken = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '-1h' });
      
      const req = httpMocks.createRequest({
        cookies: {
          token: expiredToken
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      redirectIfAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Token validation edge cases', () => {
    test('should handle malformed Authorization header', () => {
      const req = httpMocks.createRequest({
        headers: {
          authorization: 'InvalidFormat'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle empty Authorization header', () => {
      const req = httpMocks.createRequest({
        headers: {
          authorization: ''
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle missing cookies object', () => {
      const req = httpMocks.createRequest();
      // Explicitly remove cookies
      delete req.cookies;
      
      const res = httpMocks.createResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle JWT verification errors gracefully', () => {
      const req = httpMocks.createRequest({
        cookies: {
          token: 'malformed.jwt.token'
        }
      });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      process.env.JWT_SECRET = JWT_SECRET;

      authenticateToken(req, res, next);

      expect(res.statusCode).toBe(302);
      expect(res.getHeader('Location')).toBe('/login');
      expect(next).not.toHaveBeenCalled();
    });
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
  });
});