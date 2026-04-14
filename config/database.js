require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

// Constants
const REFRESH_TOKEN_LENGTH = 64;
const BCRYPT_ROUNDS = 10;

// Create database connection
const db = new sqlite3.Database(path.join(__dirname, '..', 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        refresh_token TEXT DEFAULT NULL,
        token_expires_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready');
        }
    });
});

// Database helper functions
const dbHelpers = {
    // Get user by email
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            if (!email || typeof email !== 'string') {
                reject(new Error('Email is required and must be a string'));
                return;
            }
            
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Get user by ID
    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
                reject(new Error('User ID is required and must be a number or string'));
                return;
            }
            
            db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Create new user
    createUser: (name, email, hashedPassword) => {
        return new Promise((resolve, reject) => {
            if (!name || typeof name !== 'string') {
                reject(new Error('Name is required and must be a string'));
                return;
            }
            if (!email || typeof email !== 'string') {
                reject(new Error('Email is required and must be a string'));
                return;
            }
            if (!hashedPassword || typeof hashedPassword !== 'string') {
                reject(new Error('Hashed password is required and must be a string'));
                return;
            }
            
            db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
                [name, email, hashedPassword], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, name, email });
                    }
                }
            );
        });
    },

    // Generate refresh token
    generateRefreshToken: () => {
        try {
            return crypto.randomBytes(REFRESH_TOKEN_LENGTH / 2).toString('hex');
        } catch (err) {
            throw new Error('Failed to generate refresh token: ' + err.message);
        }
    },

    // Hash refresh token
    hashRefreshToken: async (token) => {
        try {
            if (!token || typeof token !== 'string') {
                throw new Error('Token is required and must be a string');
            }
            
            const hashedToken = await bcrypt.hash(token, BCRYPT_ROUNDS);
            return hashedToken;
        } catch (err) {
            throw new Error('Failed to hash refresh token: ' + err.message);
        }
    },

    // Validate refresh token
    validateRefreshToken: async (plainToken, hashedToken) => {
        try {
            if (!plainToken || typeof plainToken !== 'string') {
                throw new Error('Plain token is required and must be a string');
            }
            if (!hashedToken || typeof hashedToken !== 'string') {
                throw new Error('Hashed token is required and must be a string');
            }
            
            const isValid = await bcrypt.compare(plainToken, hashedToken);
            return isValid;
        } catch (err) {
            throw new Error('Failed to validate refresh token: ' + err.message);
        }
    },

    // Set user refresh token
    setUserRefreshToken: (userId, hashedToken, expiresAt) => {
        return new Promise((resolve, reject) => {
            if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
                reject(new Error('User ID is required and must be a number or string'));
                return;
            }
            if (!hashedToken || typeof hashedToken !== 'string') {
                reject(new Error('Hashed token is required and must be a string'));
                return;
            }
            if (!expiresAt || (typeof expiresAt !== 'string' && !(expiresAt instanceof Date))) {
                reject(new Error('Expires at is required and must be a date string or Date object'));
                return;
            }
            
            const expiresAtString = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
            
            db.run('UPDATE users SET refresh_token = ?, token_expires_at = ? WHERE id = ?', 
                [hashedToken, expiresAtString, userId], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes === 0) {
                            reject(new Error('User not found'));
                        } else {
                            resolve({ userId, hashedToken, expiresAt: expiresAtString });
                        }
                    }
                }
            );
        });
    },

    // Clear user refresh token
    clearUserRefreshToken: (userId) => {
        return new Promise((resolve, reject) => {
            if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
                reject(new Error('User ID is required and must be a number or string'));
                return;
            }
            
            db.run('UPDATE users SET refresh_token = NULL, token_expires_at = NULL WHERE id = ?', 
                [userId], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ userId, cleared: this.changes > 0 });
                    }
                }
            );
        });
    },

    // Get user by refresh token
    getUserByRefreshToken: (hashedToken) => {
        return new Promise((resolve, reject) => {
            if (!hashedToken || typeof hashedToken !== 'string') {
                reject(new Error('Hashed token is required and must be a string'));
                return;
            }
            
            db.get('SELECT * FROM users WHERE refresh_token = ? AND token_expires_at > datetime("now")', 
                [hashedToken], 
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }
};

// Frontend token refresh utilities
const tokenRefreshUtils = {
    // Client-side token storage utilities for transparent refresh
    getTokenStorageScript: () => {
        return `
<script>
// Token storage and refresh management for transparent authentication
class TokenManager {
    static ACCESS_TOKEN_KEY = 'access_token';
    static REFRESH_TOKEN_KEY = 'refresh_token';
    static TOKEN_EXPIRY_KEY = 'token_expiry';
    static REFRESH_THRESHOLD_MS = 60000; // 1 minute before expiry
    
    static getAccessToken() {
        return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }
    
    static getRefreshToken() {
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }
    
    static getTokenExpiry() {
        const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
        return expiry ? new Date(expiry) : null;
    }
    
    static setTokens(accessToken, refreshToken, expiresIn) {
        if (!accessToken || !refreshToken || !expiresIn) {
            throw new Error('All token parameters are required');
        }
        
        const expiryTime = new Date(Date.now() + expiresIn * 1000);
        
        localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toISOString());
    }
    
    static clearTokens() {
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    }
    
    static isTokenExpired() {
        const expiry = this.getTokenExpiry();
        if (!expiry) return true;
        
        return Date.now() >= expiry.getTime();
    }
    
    static shouldRefreshToken() {
        const expiry = this.getTokenExpiry();
        if (!expiry) return false;
        
        return Date.now() >= (expiry.getTime() - this.REFRESH_THRESHOLD_MS);
    }
    
    static async refreshTokens() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }
        
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.clearTokens();
                    window.location.href = '/login';
                    return null;
                }
                throw new Error('Token refresh failed');
            }
            
            const data = await response.json();
            this.setTokens(data.access_token, data.refresh_token, data.expires_in);
            return data.access_token;
        } catch (error) {
            console.error('Token refresh error:', error);
            this.clearTokens();
            window.location.href = '/login';
            return null;
        }
    }
}

// HTTP interceptor for transparent token refresh
class AuthenticatedFetch {
    static async fetch(url, options = {}) {
        // Check if token needs refresh before making request
        if (TokenManager.shouldRefreshToken()) {
            await TokenManager.refreshTokens();
        }
        
        const accessToken = TokenManager.getAccessToken();
        if (!accessToken) {
            window.location.href = '/login';
            return;
        }
        
        // Add authorization header
        const headers = {
            ...options.headers,
            'Authorization': 'Bearer ' + accessToken
        };
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        // Handle 401 responses by attempting token refresh
        if (response.status === 401) {
            const newToken = await TokenManager.refreshTokens();
            if (newToken) {
                // Retry original request with new token
                const retryHeaders = {
                    ...options.headers,
                    'Authorization': 'Bearer ' + newToken
                };
                
                return fetch(url, {
                    ...options,
                    headers: retryHeaders
                });
            }
        }
        
        return response;
    }
}

// Auto-refresh timer setup
class TokenRefreshTimer {
    static timer = null;
    static CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
    
    static start() {
        this.stop(); // Clear any existing timer
        
        this.timer = setInterval(() => {
            if (TokenManager.shouldRefreshToken()) {
                TokenManager.refreshTokens().catch(error => {
                    console.error('Automatic token refresh failed:', error);
                });
            }
        }, this.CHECK_INTERVAL_MS);
    }
    
    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// Initialize token refresh timer when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (TokenManager.getAccessToken()) {
        TokenRefreshTimer.start();
    }
});

// Export utilities for use in other scripts
window.TokenManager = TokenManager;
window.AuthenticatedFetch = AuthenticatedFetch;
window.TokenRefreshTimer = TokenRefreshTimer;
</script>
        `;
    },

    // Generate middleware response headers for token refresh
    generateRefreshHeaders: (newAccessToken, newRefreshToken, expiresIn) => {
        if (!newAccessToken || typeof newAccessToken !== 'string') {
            throw new Error('New access token is required and must be a string');
        }
        if (!newRefreshToken || typeof newRefreshToken !== 'string') {
            throw new Error('New refresh token is required and must be a string');
        }
        if (!expiresIn || typeof expiresIn !== 'number') {
            throw new Error('Expires in is required and must be a number');
        }
        
        return {
            'X-New-Access-Token': newAccessToken,
            'X-New-Refresh-Token': newRefreshToken,
            'X-Token-Expires-In': expiresIn.toString(),
            'Access-Control-Expose-Headers': 'X-New-Access-Token,X-New-Refresh-Token,X-Token-Expires-In'
        };
    }
};

module.exports = {
    db,
    dbHelpers,
    tokenRefreshUtils
};