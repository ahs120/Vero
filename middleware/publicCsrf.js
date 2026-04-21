'use strict';

const OrderSession = require('../models/OrderSession');

/**
 * Stateless Double-Submit Cookie CSRF for public APIs.
 *
 * Strategy:
 *   1. On session start, server generates a CSRF token → stored in OrderSession
 *      AND set as a readable cookie (_public_csrf).
 *   2. JS reads the cookie and sends it in the x-csrf-token header.
 *   3. This middleware verifies:
 *      a) Cookie value === Header value  (double-submit match)
 *      b) Token matches the one stored in the DB for the given sessionId
 *
 * Why not csurf?
 *   csurf relies on express-session — the public flow has no session.
 *   This is an industry-standard stateless alternative.
 */
const verifyPublicCsrf = async (req, res, next) => {
  try {
    const cookieToken = req.cookies._public_csrf;
    const headerToken = req.headers['x-csrf-token'];
    const sessionId = req.body.sessionId || req.query.sessionId;

    // All three must be present
    if (!cookieToken || !headerToken || !sessionId) {
      return res.status(403).json({
        success: false,
        message: 'CSRF validation failed: missing token.',
      });
    }

    // Double-submit: cookie must match header
    if (cookieToken !== headerToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF validation failed: token mismatch.',
      });
    }

    // Verify against server-side session record
    const session = await OrderSession.findOne({
      sessionId,
      csrfToken: headerToken,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!session) {
      return res.status(403).json({
        success: false,
        message: 'CSRF validation failed: invalid or expired session.',
      });
    }

    // Attach session for downstream controllers
    req.orderSession = session;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { verifyPublicCsrf };
