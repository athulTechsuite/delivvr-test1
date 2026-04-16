const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File size limit constants
const MAX_FILE_SIZE = 5242880; // 5MB in bytes
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

// File signature validation for security
const FILE_SIGNATURES = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46]
};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
    } catch (error) {
        console.error('Failed to create uploads directory:', error);
    }
}

// Configure storage with secure filename generation
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Check disk space before proceeding
        fs.stat(uploadsDir, (err, stats) => {
            if (err) {
                return cb(new Error('Failed to access uploads directory'));
            }
            cb(null, uploadsDir);
        });
    },
    filename: function (req, file, cb) {
        try {
            // Validate user authentication
            if (!req.user || !req.user.id) {
                return cb(new Error('User authentication required'));
            }

            // Get file extension and sanitize
            const ext = path.extname(file.originalname).toLowerCase();
            
            // Validate extension
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                return cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and GIF files are allowed'));
            }

            // Generate secure filename: userId-timestamp.extension
            const timestamp = Date.now();
            const filename = `${req.user.id}-${timestamp}${ext}`;
            
            // Additional filename sanitization
            const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '');
            
            cb(null, sanitizedFilename);
        } catch (error) {
            cb(new Error('Failed to generate secure filename'));
        }
    }
});

// File filter for additional validation
const fileFilter = function (req, file, cb) {
    try {
        // Check MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only image files are allowed'), false);
        }

        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new Error('Invalid file extension. Only .jpg, .jpeg, .png, and .gif files are allowed'), false);
        }

        cb(null, true);
    } catch (error) {
        cb(new Error('File validation failed'), false);
    }
};

// Configure multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    }
});

// File signature validation function
function validateFileSignature(filePath, mimeType) {
    return new Promise((resolve, reject) => {
        try {
            const expectedSignature = FILE_SIGNATURES[mimeType];
            if (!expectedSignature) {
                return resolve(true); // Skip validation for unknown types
            }

            const buffer = Buffer.alloc(expectedSignature.length);
            const fd = fs.openSync(filePath, 'r');
            
            fs.readSync(fd, buffer, 0, expectedSignature.length, 0);
            fs.closeSync(fd);

            const isValid = expectedSignature.every((byte, index) => {
                return buffer[index] === byte;
            });

            resolve(isValid);
        } catch (error) {
            reject(error);
        }
    });
}

// Enhanced middleware with post-upload validation
const uploadProfilePicture = (req, res, next) => {
    upload.single('profilePicture')(req, res, async function (err) {
        try {
            // Handle multer errors
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        error: 'File too large. Maximum size is 5MB'
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        error: 'Only one file allowed'
                    });
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({
                        error: 'Unexpected field. Use "profilePicture" as field name'
                    });
                }
                return res.status(400).json({
                    error: 'File upload error: ' + err.message
                });
            }

            // Handle custom validation errors
            if (err) {
                return res.status(400).json({
                    error: err.message
                });
            }

            // If no file was uploaded, continue to next middleware
            if (!req.file) {
                return next();
            }

            // Validate file signature for security
            try {
                const isValidSignature = await validateFileSignature(req.file.path, req.file.mimetype);
                if (!isValidSignature) {
                    // Delete invalid file
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({
                        error: 'Invalid file content. File appears to be corrupted or not a valid image'
                    });
                }
            } catch (signatureError) {
                // Delete file on signature validation error
                try {
                    fs.unlinkSync(req.file.path);
                } catch (deleteError) {
                    console.error('Failed to delete invalid file:', deleteError);
                }
                return res.status(400).json({
                    error: 'File validation failed'
                });
            }

            // Add relative path for database storage
            req.file.relativePath = path.join('uploads', req.file.filename);

            next();
        } catch (error) {
            console.error('Upload middleware error:', error);
            
            // Clean up uploaded file on error
            if (req.file && req.file.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (cleanupError) {
                    console.error('Failed to cleanup uploaded file:', cleanupError);
                }
            }

            return res.status(500).json({
                error: 'Internal server error during file upload'
            });
        }
    });
};

// Utility function to delete old profile pictures
function deleteOldProfilePicture(userId) {
    return new Promise((resolve) => {
        try {
            fs.readdir(uploadsDir, (err, files) => {
                if (err) {
                    console.error('Failed to read uploads directory:', err);
                    return resolve();
                }

                // Find files starting with userId-
                const userFiles = files.filter(file => 
                    file.startsWith(`${userId}-`) && 
                    ALLOWED_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext))
                );

                // Delete old files
                userFiles.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(uploadsDir, file));
                    } catch (deleteError) {
                        console.error('Failed to delete old profile picture:', deleteError);
                    }
                });

                resolve();
            });
        } catch (error) {
            console.error('Error cleaning up old profile pictures:', error);
            resolve();
        }
    });
}

// Utility function to clean up orphaned files
function cleanupOrphanedFiles(activeUserIds) {
    return new Promise((resolve) => {
        try {
            fs.readdir(uploadsDir, (err, files) => {
                if (err) {
                    console.error('Failed to read uploads directory for cleanup:', err);
                    return resolve();
                }

                files.forEach(file => {
                    try {
                        // Extract userId from filename pattern: userId-timestamp.ext
                        const match = file.match(/^(\d+)-\d+\.(jpg|jpeg|png|gif)$/i);
                        if (match) {
                            const fileUserId = parseInt(match[1]);
                            if (!activeUserIds.includes(fileUserId)) {
                                fs.unlinkSync(path.join(uploadsDir, file));
                            }
                        }
                    } catch (cleanupError) {
                        console.error('Failed to cleanup orphaned file:', cleanupError);
                    }
                });

                resolve();
            });
        } catch (error) {
            console.error('Error during orphaned files cleanup:', error);
            resolve();
        }
    });
}

module.exports = {
    uploadProfilePicture,
    deleteOldProfilePicture,
    cleanupOrphanedFiles,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES
};