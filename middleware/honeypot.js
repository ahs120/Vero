'use strict';

const logger = require('../config/logger');

/**
 * Honeypot anti-bot middleware.
 *
 * The frontend includes a hidden field `_hp_email` that is:
 *   - Invisible to real users (display:none, aria-hidden, tabindex=-1)
 *   - Auto-filled by bots that parse form fields
 *
 * If the field contains any value → bot detected.
 * We return a fake success response so the bot doesn't retry.
 */
const checkHoneypot = (req, res, next) => {
  if (req.body._hp_email) {
    logger.warn('Honeypot triggered — bot detected', {
      ip: req.ip,
      path: req.originalUrl,
      userAgent: req.get('user-agent'),
    });

    // Return a fake success so the bot thinks it worked
    return res.status(200).json({
      success: true,
      message: 'تم تقديم الطلب بنجاح.',
      order: { orderCode: 'FAKE-000', trackingToken: 'none' },
    });
  }

  // Clean the honeypot field before downstream processing
  delete req.body._hp_email;
  next();
};

module.exports = { checkHoneypot };
