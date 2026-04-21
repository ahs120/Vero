'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { enforceJson } = require('../middleware/enforceJson');
const { verifyPublicCsrf } = require('../middleware/publicCsrf');
const { checkIdempotency } = require('../middleware/idempotency');
const { checkHoneypot } = require('../middleware/honeypot');
const { validateAndSanitizeUpload } = require('../middleware/fileValidator');
const { uploadPaymentProof } = require('../middleware/upload');
const val = require('../middleware/customerValidation');
const ctrl = require('../controllers/publicApiController');

// ──────────────────────────────────────────────────────────
// Rate Limiters (tiered by endpoint risk)
// ──────────────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // 30 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'طلبات كثيرة. حاول لاحقًا.' },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,               // 5 orders/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات طلب كثيرة. حاول لاحقًا.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,               // 5 uploads/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات رفع كثيرة. حاول لاحقًا.' },
});

// ──────────────────────────────────────────────────────────
// Apply Content-Type enforcement + general rate limit
// ──────────────────────────────────────────────────────────

router.use(enforceJson);
router.use(generalLimiter);

// ──────────────────────────────────────────────────────────
// Session start (no CSRF yet — this IS where we create it)
// ──────────────────────────────────────────────────────────

router.post('/session/start', ctrl.startSession);

// ──────────────────────────────────────────────────────────
// Read-only endpoints (no CSRF needed for GETs)
// ──────────────────────────────────────────────────────────

router.get('/products', ctrl.getProducts);
router.get('/governorates', ctrl.getGovernorates);
router.get('/areas/:governorate', val.sanitizeGovParam, ctrl.getAreas);
router.get('/session/:sessionId', ctrl.getSessionData);

// ──────────────────────────────────────────────────────────
// Payment proof retrieval (controlled file access)
// ──────────────────────────────────────────────────────────

router.get('/payment-proof/:token', ctrl.getPaymentProof);

// ──────────────────────────────────────────────────────────
// Write endpoints (CSRF + validation required)
// ──────────────────────────────────────────────────────────

router.put(
  '/session/customer-info',
  verifyPublicCsrf,
  val.whitelistBody(['sessionId', 'customer', 'address']),
  val.customerInfoRules,
  val.handleValidationErrors,
  ctrl.updateCustomerInfo,
);

router.put(
  '/session/cart',
  verifyPublicCsrf,
  val.whitelistBody(['sessionId', 'items']),
  val.cartUpdateRules,
  val.handleValidationErrors,
  ctrl.updateCart,
);

router.post(
  '/promo/validate',
  verifyPublicCsrf,
  val.whitelistBody(['sessionId', 'code']),
  val.promoCodeRules,
  val.handleValidationErrors,
  ctrl.validatePromoCode,
);

router.post(
  '/upload/payment-proof',
  uploadLimiter,
  uploadPaymentProof.single('paymentProof'),
  validateAndSanitizeUpload,
  ctrl.uploadPaymentProof,
);

router.post(
  '/orders',
  orderLimiter,
  verifyPublicCsrf,
  checkHoneypot,
  checkIdempotency,
  val.whitelistBody(['sessionId', 'paymentMethod', '_hp_email']),
  val.orderSubmitRules,
  val.handleValidationErrors,
  ctrl.submitOrder,
);

module.exports = router;
