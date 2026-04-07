const express = require('express');
const router = express.Router();

// Constants
const ROUTES = {
  PROFILE: '/profile',
  LOGIN: '/login'
};

const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  INTERNAL_SERVER_ERROR: 500
};

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required to access profile',
  PROFILE_LOAD_ERROR: 'Unable to load profile information',
  INVALID_USER_DATA: 'Invalid user data detected'
};

const PAGE_METADATA = {
  TITLE: 'Profile - Dashboard',
  DESCRIPTION: 'User profile management page',
  CURRENT_PAGE: 'profile'
};

// Middleware to ensure user is authenticated
const requireAuth = (req, res, next) => {
  try {
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect(ROUTES.LOGIN);
    }
    
    // Validate user session data
    const user = req.session.user;
    if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
      req.session.destroy();
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect(ROUTES.LOGIN);
    }
    
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect(ROUTES.LOGIN);
  }
};

// Sanitize user data for display
const sanitizeUserData = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }
  
  return {
    id: user.id || '',
    username: user.username || 'Unknown User',
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    createdAt: user.createdAt || null,
    lastLogin: user.lastLogin || null
  };
};

// GET /profile - Display user profile page
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).redirect(ROUTES.LOGIN);
    }
    
    // Sanitize user data for safe rendering
    const sanitizedUser = sanitizeUserData(user);
    
    if (!sanitizedUser) {
      console.error('Invalid user data in session:', user);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('error', {
        title: 'Error',
        message: ERROR_MESSAGES.INVALID_USER_DATA,
        currentPage: PAGE_METADATA.CURRENT_PAGE,
        user: null,
        isAuthenticated: false
      });
    }
    
    // Render profile page with sidebar layout
    res.status(HTTP_STATUS.OK).render('profile', {
      title: PAGE_METADATA.TITLE,
      description: PAGE_METADATA.DESCRIPTION,
      currentPage: PAGE_METADATA.CURRENT_PAGE,
      user: sanitizedUser,
      isAuthenticated: true,
      sidebarEnabled: true,
      breadcrumbs: [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Profile', url: ROUTES.PROFILE, active: true }
      ]
    });
    
  } catch (error) {
    console.error('Profile route error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('error', {
      title: 'Profile Error',
      message: ERROR_MESSAGES.PROFILE_LOAD_ERROR,
      currentPage: PAGE_METADATA.CURRENT_PAGE,
      user: req.session.user ? sanitizeUserData(req.session.user) : null,
      isAuthenticated: !!req.session.user,
      sidebarEnabled: true
    });
  }
});

// POST /profile - Handle profile updates (placeholder for future implementation)
router.post('/', requireAuth, async (req, res) => {
  try {
    // Input validation
    const allowedFields = ['firstName', 'lastName', 'email'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const value = req.body[field];
        
        // Validate field type and length
        if (typeof value !== 'string') {
          return res.status(400).json({
            success: false,
            message: `Invalid data type for field: ${field}`
          });
        }
        
        // Sanitize and validate field length
        const sanitizedValue = value.trim();
        if (sanitizedValue.length > 255) {
          return res.status(400).json({
            success: false,
            message: `Field ${field} exceeds maximum length`
          });
        }
        
        updateData[field] = sanitizedValue;
      }
    }
    
    // Email validation if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }
    
    // Placeholder response - actual update logic to be implemented
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile update functionality will be implemented in future release',
      data: updateData
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Unable to update profile at this time'
    });
  }
});

module.exports = router;