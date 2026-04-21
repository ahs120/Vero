const express = require('express');
const router = express.Router();

const { login, logout } = require('../controllers/adminAuthController');
const { loginValidationRules, validate } = require('../middleware/validation');
const { verifyToken, redirectIfLoggedIn } = require('../middleware/auth');

// ============================================
// Page Routes
// ============================================

/**
 * @route   GET /
 * @desc    Render login page (redirects to dashboard if already logged in)
 */
router.get('/', redirectIfLoggedIn, (req, res) => {
  res.render('auth/login', { title: 'Vero Admin — Login', error: null });
});

/**
 * @route   POST /admin/login
 * @desc    Process login form (validate, authenticate, set cookie, redirect)
 */
router.post('/admin/login', loginValidationRules, validate, login);

/**
 * @route   POST /admin/logout
 * @desc    Clear auth cookie and redirect to login
 */
router.post('/admin/logout', verifyToken, logout);

module.exports = router;
