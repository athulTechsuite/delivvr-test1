const express = require('express');
const router = express.Router();

// Constants
const ROUTE_PATHS = {
  SETTINGS: '/',
  LOGIN: '/login'
};

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Access denied. Please log in to continue.',
  SERVER_ERROR: 'An error occurred while loading the settings page.',
  INVALID_REQUEST: 'Invalid request format.'
};

const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  SERVER_ERROR: 500,
  REDIRECT: 302
};

// Middleware to ensure user is authenticated
const requireAuth = (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      req.flash('error', ERROR_MESSAGES.UNAUTHORIZED);
      return res.status(HTTP_STATUS.REDIRECT).redirect(ROUTE_PATHS.LOGIN);
    }
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    req.flash('error', ERROR_MESSAGES.SERVER_ERROR);
    return res.status(HTTP_STATUS.REDIRECT).redirect(ROUTE_PATHS.LOGIN);
  }
};

// Input validation middleware
const validateRequest = (req, res, next) => {
  try {
    // Validate session exists and has proper structure
    if (!req.session || typeof req.session !== 'object') {
      req.flash('error', ERROR_MESSAGES.INVALID_REQUEST);
      return res.status(HTTP_STATUS.REDIRECT).redirect(ROUTE_PATHS.LOGIN);
    }

    // Sanitize any query parameters
    if (req.query) {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key].trim();
        }
      }
    }

    next();
  } catch (error) {
    console.error('Request validation error:', error);
    req.flash('error', ERROR_MESSAGES.SERVER_ERROR);
    return res.status(HTTP_STATUS.SERVER_ERROR).redirect(ROUTE_PATHS.LOGIN);
  }
};

// GET /settings - Settings page
router.get(ROUTE_PATHS.SETTINGS, validateRequest, requireAuth, async (req, res) => {
  try {
    // Validate user session data
    const userId = req.session.userId;
    if (!userId || typeof userId !== 'string') {
      req.flash('error', ERROR_MESSAGES.UNAUTHORIZED);
      return res.status(HTTP_STATUS.REDIRECT).redirect(ROUTE_PATHS.LOGIN);
    }

    // Prepare view data with proper escaping
    const viewData = {
      title: 'Settings',
      currentPage: 'settings',
      user: {
        id: userId,
        // Additional user data would be fetched from database in real implementation
      },
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
      }
    };

    // Render settings page
    res.status(HTTP_STATUS.OK).render('pages/settings', viewData);

  } catch (error) {
    console.error('Settings page error:', error);
    req.flash('error', ERROR_MESSAGES.SERVER_ERROR);
    res.status(HTTP_STATUS.SERVER_ERROR).redirect('/dashboard');
  }
});

module.exports = router;