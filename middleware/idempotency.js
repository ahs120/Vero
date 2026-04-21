'use strict';

const CustomerOrder = require('../models/CustomerOrder');

/**
 * Idempotency middleware for order submission.
 *
 * Prevents duplicate orders caused by:
 *   - Network retries
 *   - User double-clicking submit
 *   - Browser refresh on POST
 *
 * Strategy:
 *   Client generates a UUID idempotency key ONCE on the confirmation page.
 *   Server checks if an order with that key already exists:
 *     - If yes → return the existing order (safe retry)
 *     - If no  → proceed to create
 */
const checkIdempotency = async (req, res, next) => {
  const key = req.headers['x-idempotency-key'];

  if (!key || typeof key !== 'string' || key.length > 64) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid x-idempotency-key header.',
    });
  }

  // Check if order with this key already exists
  const existing = await CustomerOrder.findOne({ idempotencyKey: key })
    .select('orderCode trackingToken status')
    .lean();

  if (existing) {
    // Return the existing order — safe retry
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: 'تم تقديم الطلب مسبقًا.',
      order: existing,
    });
  }

  req.idempotencyKey = key;
  next();
};

module.exports = { checkIdempotency };
