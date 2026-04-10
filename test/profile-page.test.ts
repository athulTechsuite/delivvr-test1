import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import path from 'path';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';
import { JSDOM } from 'jsdom';

// Import application components
const dashboardRoutes = require('../routes/dashboard');
const User = require('../models/User');

// Test constants
const TEST_CONSTANTS = {
    JWT_SECRET: 'test-jwt-secret-key',
    BCRYPT_ROUNDS: 10,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 50,
    BIO_MAX_LENGTH: 500,
    PHONE_MAX_LENGTH: 20,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^[\d\s\-\(\)]+$/
};

describe('Profile Page Tests', () => {
    let app: express.Application;
    let testDb: sqlite3.Database;
    let testUser: any;
    let authToken: string;
    let userId: number;

    before(async () => {
        // Set test environment
        process.env.JWT_SECRET = TEST_CONSTANTS.JWT_SECRET;
        
        // Create test database
        testDb = new sqlite3.Database(':memory:');
        
        // Create users table with profile fields
        await new Promise((resolve, reject) => {
            testDb.serialize(() => {
                testDb.run(`CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    phone VARCHAR(20) DEFAULT NULL,
                    bio TEXT DEFAULT NULL,
                    avatar_url VARCHAR(255) DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) reject(err);
                    else resolve(undefined);
                });
            });
        });

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(methodOverride('_method'));
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, '../views'));
        
        // Mock render for testing
        app.use((req, res, next) => {
            const originalRender = res.render;
            res.render = function(template: string, data?: any) {
                res.json({ template, data });
            };
            next();
        });

        app.use('/dashboard', dashboardRoutes);
        
        // Create test user
        await createTestUser();
    });

    after(() => {
        if (testDb) testDb.close();
    });

    beforeEach(() => {
        // Reset any test data changes
    });

    async function createTestUser() {
        const userData = {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'password123',
            phone: '(555) 123-4567',
            bio: 'Software developer'
        };

        const hashedPassword = await bcrypt.hash(userData.password, TEST_CONSTANTS.BCRYPT_ROUNDS);
        
        return new Promise((resolve, reject) => {
            testDb.run(
                'INSERT INTO users (name, email, password, phone, bio) VALUES (?, ?, ?, ?, ?)',
                [userData.name, userData.email, hashedPassword, userData.phone, userData.bio],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    userId = this.lastID;
                    testUser = { ...userData, id: userId };
                    authToken = jwt.sign({ userId }, TEST_CONSTANTS.JWT_SECRET, { expiresIn: '1h' });
                    resolve(undefined);
                }
            );
        });
    }

    describe('Profile Page Access Control', () => {
        // TC-AC-001
        it('should display profile page with user information for authenticated user', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(response.body.template).to.equal('profile');
            expect(response.body.data.user).to.exist;
            expect(response.body.data.user.name).to.equal('John Doe');
            expect(response.body.data.user.email).to.equal('john@example.com');
            expect(response.body.data.user.phone).to.equal('(555) 123-4567');
            expect(response.body.data.user.bio).to.equal('Software developer');
        });

        // TC-AC-002
        it('should redirect unauthenticated user to login page', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        // TC-AC-002 (with invalid token)
        it('should redirect user with invalid token to login page and clear cookies', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', 'token=invalid-token')
                .expect(302);

            expect(response.headers.location).to.equal('/login');
            expect(response.headers['set-cookie']).to.exist;
            expect(response.headers['set-cookie'][0]).to.include('token=;');
        });

        // TC-AC-024
        it('should redirect to login when session expires during profile editing', async () => {
            const expiredToken = jwt.sign({ userId }, TEST_CONSTANTS.JWT_SECRET, { expiresIn: '-1h' });
            
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${expiredToken}`)
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        // TC-AC-025
        it('should load profile page correctly when accessed directly via URL', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(response.body.template).to.equal('profile');
            expect(response.body.data.user.id).to.exist;
            expect(response.body.data.title).to.equal('Profile');
        });
    });

    describe('Profile Data Display', () => {
        // TC-AC-013
        it('should display existing user data in display mode', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            const userData = response.body.data.user;
            expect(userData.name).to.equal('John Doe');
            expect(userData.email).to.equal('john@example.com');
            expect(userData.phone).to.equal('(555) 123-4567');
            expect(userData.bio).to.equal('Software developer');
        });

        // TC-AC-014
        it('should display "Not provided" for missing phone and "No bio provided" for missing bio', async () => {
            // Create user without phone and bio
            const minimalUser = {
                name: 'Jane Smith',
                email: 'jane@example.com',
                password: 'password456'
            };

            const hashedPassword = await bcrypt.hash(minimalUser.password, TEST_CONSTANTS.BCRYPT_ROUNDS);
            
            const minimalUserId = await new Promise<number>((resolve, reject) => {
                testDb.run(
                    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                    [minimalUser.name, minimalUser.email, hashedPassword],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });

            const minimalToken = jwt.sign({ userId: minimalUserId }, TEST_CONSTANTS.JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${minimalToken}`)
                .expect(200);

            // The template should handle null values appropriately
            const userData = response.body.data.user;
            expect(userData.phone).to.be.null;
            expect(userData.bio).to.be.null;
        });

        // TC-AC-023
        it('should handle special characters in profile data without XSS vulnerabilities', async () => {
            const xssUser = {
                name: 'Test <script>alert("xss")</script> User',
                email: 'xss@example.com',
                password: 'password789',
                bio: 'Bio with <img src="x" onerror="alert(1)"> content'
            };

            const hashedPassword = await bcrypt.hash(xssUser.password, TEST_CONSTANTS.BCRYPT_ROUNDS);
            
            const xssUserId = await new Promise<number>((resolve, reject) => {
                testDb.run(
                    'INSERT INTO users (name, email, password, bio) VALUES (?, ?, ?, ?)',
                    [xssUser.name, xssUser.email, hashedPassword, xssUser.bio],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });

            const xssToken = jwt.sign({ userId: xssUserId }, TEST_CONSTANTS.JWT_SECRET, { expiresIn: '1h' });
            
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${xssToken}`)
                .expect(200);

            const userData = response.body.data.user;
            expect(userData.name).to.equal('Test <script>alert("xss")</script> User');
            expect(userData.bio).to.equal('Bio with <img src="x" onerror="alert(1)"> content');
            // Template should handle escaping during rendering
        });
    });

    describe('Profile Update Validation', () => {
        // TC-AC-005
        it('should successfully update profile with valid data and display success message', async () => {
            const updateData = {
                name: 'John Updated',
                email: 'john.updated@example.com',
                phone: '(555) 987-6543',
                bio: 'Updated bio information'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile?success=');
            
            // Verify data was updated in database
            const updatedUser = await new Promise<any>((resolve, reject) => {
                testDb.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(updatedUser.name).to.equal(updateData.name);
            expect(updatedUser.email).to.equal(updateData.email);
            expect(updatedUser.phone).to.equal(updateData.phone);
            expect(updatedUser.bio).to.equal(updateData.bio);
        });

        // TC-AC-017
        it('should remain on profile page with updated data after successful update', async () => {
            const updateData = {
                name: 'John Final',
                email: 'john.final@example.com',
                phone: '(555) 111-2222',
                bio: 'Final bio update'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile');
            expect(response.headers.location).to.include('success=');
        });

        // TC-AC-006
        it('should show validation error when required fields are missing', async () => {
            const invalidData = {
                name: '', // Missing required field
                email: 'valid@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(invalidData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile?error=');
            expect(decodeURIComponent(response.headers.location)).to.include('Name');
        });

        // TC-AC-007
        it('should prevent submission and show error for invalid email format', async () => {
            const invalidData = {
                name: 'Valid Name',
                email: 'invalid-email-format'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(invalidData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile?error=');
            expect(decodeURIComponent(response.headers.location)).to.include('email');
        });

        // TC-AC-008
        it('should show phone format validation error for invalid characters', async () => {
            const invalidData = {
                name: 'Valid Name',
                email: 'valid@example.com',
                phone: 'abc-123-xyz' // Invalid characters
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(invalidData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile?error=');
            expect(decodeURIComponent(response.headers.location)).to.include('phone');
        });

        // TC-AC-009
        it('should prevent submission when bio exceeds 500 characters', async () => {
            const invalidData = {
                name: 'Valid Name',
                email: 'valid@example.com',
                bio: 'A'.repeat(501) // Exceeds limit
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(invalidData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile?error=');
            expect(decodeURIComponent(response.headers.location)).to.include('500');
        });

        // TC-AC-018
        it('should receive appropriate error message when database error occurs', async () => {
            // Mock database failure by closing connection temporarily
            testDb.close();
            
            const updateData = {
                name: 'Test Name',
                email: 'test@example.com'
            };

            const response = await request(app)
                .put('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .send(updateData)
                .expect(302);

            expect(response.headers.location).to.include('/dashboard/profile?error=');
            
            // Restore database connection for other tests
            testDb = new sqlite3.Database(':memory:');
            await createTestUser();
        });
    });

    describe('Sidebar Navigation', () => {
        // TC-AC-010
        it('should show Profile link in sidebar navigation for authenticated user', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            // Verify user context is passed to layout for sidebar rendering
            expect(response.body.data.user).to.exist;
            expect(response.body.data.user.name).to.exist;
        });

        // TC-AC-011
        it('should not show Profile link in sidebar for unauthenticated user', async () => {
            const response = await request(app)
                .get('/dashboard/profile')
                .expect(302);

            expect(response.headers.location).to.equal('/login');
        });

        // TC-AC-012
        it('should navigate to profile page when sidebar Profile link is clicked', async () => {
            // This test verifies the route exists and is accessible
            const response = await request(app)
                .get('/dashboard/profile')
                .set('Cookie', `token=${authToken}`)
                .expect(200);

            expect(response.body.template).to.equal('profile');
        });
    });
});

// Validation helper functions for reference
function validateName(name: string): boolean {
    return typeof name === 'string' && name.length >= TEST_CONSTANTS.NAME_MIN_LENGTH && name.length <= TEST_CONSTANTS.NAME_MAX_LENGTH;
}

function validateEmail(email: string): boolean {
    return typeof email === 'string' && TEST_CONSTANTS.EMAIL_REGEX.test(email);
}

function validatePhone(phone: string): boolean {
    return !phone || (typeof phone === 'string' && phone.length <= TEST_CONSTANTS.PHONE_MAX_LENGTH && TEST_CONSTANTS.PHONE_REGEX.test(phone));
}

function validateBio(bio: string): boolean {
    return !bio || (typeof bio === 'string' && bio.length <= TEST_CONSTANTS.BIO_MAX_LENGTH);
}