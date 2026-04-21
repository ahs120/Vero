const jwt = require('jsonwebtoken');

/**
 * Middleware: Verify JWT token from httpOnly cookie only.
 * Attaches the decoded admin payload to req.admin on success.
 *
 * For web page routes: redirects to login on failure.
 * For API routes (/api/*): returns JSON error.
 */
const verifyToken = (req, res, next) => {
  let token = null;

  // Read token from httpOnly cookie only (no more Authorization header)
  if (req.cookies) {
    token = req.cookies.token;
  }

  // No token found
  if (!token) {
    // For web page routes: redirect to login
    if (!req.path.startsWith('/api/')) {
      return res.redirect('/');
    }
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    // Token is invalid or expired — clear the bad cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // For web page routes: redirect to login
    if (!req.path.startsWith('/api/')) {
      return res.redirect('/');
    }

    const message =
      error.name === 'TokenExpiredError'
        ? 'Token has expired. Please log in again.'
        : 'Invalid authentication token.';

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

/**
 * Middleware: Redirect to dashboard if the user is already authenticated.
 * Used on the login page (/) to prevent logged-in users from seeing the form.
 */
const redirectIfLoggedIn = (req, res, next) => {
  if (req.cookies && req.cookies.token) {
    try {
      jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      return res.redirect('/dashboard');
    } catch (error) {
      // Token is invalid/expired, let them see the login page
      return next();
    }
  }
  next();
};

module.exports = { verifyToken, redirectIfLoggedIn };
