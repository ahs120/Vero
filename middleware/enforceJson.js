'use strict';

/**
 * Enforce application/json Content-Type on mutating requests.
 *
 * Skips:
 *   - GET / HEAD / OPTIONS (no body)
 *   - multipart/form-data  (file uploads)
 */
const enforceJson = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  if (req.is('multipart/form-data')) {
    return next();
  }

  if (!req.is('application/json')) {
    return res.status(415).json({
      success: false,
      message: 'Content-Type must be application/json.',
    });
  }

  next();
};

module.exports = { enforceJson };
