const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * @desc    Authenticate admin and set JWT in httpOnly cookie
 * @route   POST /admin/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // --- 1. Find admin by username (Mongoose parameterized query — safe from injection) ---
    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).render('auth/login', {
        title: 'Vero Admin — Login',
        error: 'Invalid username or password.',
      });
    }

    // --- 2. Compare the provided password with the stored hash ---
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).render('auth/login', {
        title: 'Vero Admin — Login',
        error: 'Invalid username or password.',
      });
    }

    // --- 3. Generate JWT token ---
    const tokenPayload = {
      id: admin._id,
      username: admin.username,
      role: admin.role,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    // --- 4. Update last login timestamp ---
    admin.lastLogin = new Date();
    await admin.save();

    // --- 5. Set httpOnly cookie (ONLY auth mechanism — token NEVER in response body) ---
    res.cookie('token', token, {
      httpOnly: true,                                       // Not accessible via JavaScript
      secure: process.env.NODE_ENV === 'production',        // HTTPS only in production
      sameSite: 'strict',                                   // CSRF protection
      maxAge: 24 * 60 * 60 * 1000,                         // 24 hours in milliseconds
    });

    // --- 6. Redirect to dashboard (cookie is already set) ---
    return res.redirect('/dashboard');
  } catch (error) {
    next(error); // Forward to global error handler
  }
};

/**
 * @desc    Logout admin (clear cookie and redirect)
 * @route   POST /admin/logout
 * @access  Private
 */
const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return res.redirect('/');
};

module.exports = {
  login,
  logout,
};
