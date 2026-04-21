'use strict';

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Request logger middleware.
 *
 * Attaches a unique requestId to every request and logs
 * method / path / status / duration on response finish.
 */
const requestLogger = (req, res, next) => {
  req.requestId = uuidv4();
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const data = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', data);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', data);
    } else {
      logger.info('Request OK', data);
    }
  });

  next();
};

module.exports = { requestLogger };
