// Jest setup file: configure environment variables before any test modules are loaded
const path = require('path');

// Ensure JWT_SECRET is set so app.js doesn't exit during tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Point the app to the same SQLite DB file that app.test.js uses,
// so test inserts are visible to the running app instance.
process.env.DB_PATH = path.join(__dirname, 'test.db');
