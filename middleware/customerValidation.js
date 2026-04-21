'use strict';

const { body, param, validationResult } = require('express-validator');
const { isValidGovernorate, isValidArea } = require('../config/egyptData');

// ──────────────────────────────────────────────────────────
// Utility: whitelist body fields (strip unknown keys)
// ──────────────────────────────────────────────────────────

/**
 * Strips any body field NOT in the allowed list.
 * Prevents attackers from injecting extra fields into the DB.
 */
const whitelistBody = (allowedFields) => (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
    return next();
  }
  const sanitized = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      sanitized[key] = req.body[key];
    }
  }
  req.body = sanitized;
  next();
};

// ──────────────────────────────────────────────────────────
// Utility: handle validation result → JSON errors
// ──────────────────────────────────────────────────────────

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return res.status(422).json({
      success: false,
      message: 'فشل التحقق من البيانات.',
      errors: formatted,
    });
  }
  next();
};

// ──────────────────────────────────────────────────────────
// Customer Info validation rules
// ──────────────────────────────────────────────────────────

const customerInfoRules = [
  body('customer.fullName')
    .trim()
    .notEmpty().withMessage('الاسم الكامل مطلوب.')
    .isLength({ min: 3, max: 200 }).withMessage('الاسم يجب أن يكون بين 3 و 200 حرف.')
    .escape(),

  body('customer.primaryPhone')
    .trim()
    .notEmpty().withMessage('رقم الهاتف الأساسي مطلوب.')
    .matches(/^01[0125]\d{8}$/).withMessage('رقم الهاتف غير صحيح (مثال: 01012345678).'),

  body('customer.secondaryPhone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^01[0125]\d{8}$/).withMessage('رقم الهاتف الثانوي غير صحيح.'),

  // Address fields
  body('address.governorate')
    .trim()
    .notEmpty().withMessage('المحافظة مطلوبة.')
    .custom((val) => {
      if (!isValidGovernorate(val)) throw new Error('المحافظة غير صحيحة.');
      return true;
    }),

  body('address.area')
    .trim()
    .notEmpty().withMessage('المنطقة مطلوبة.')
    .custom((val, { req }) => {
      const gov = req.body.address && req.body.address.governorate;
      if (!isValidArea(gov, val)) throw new Error('المنطقة لا تتبع المحافظة المختارة.');
      return true;
    }),

  body('address.detailedAddress')
    .trim()
    .notEmpty().withMessage('العنوان التفصيلي مطلوب.')
    .isLength({ max: 500 }).withMessage('العنوان لا يتجاوز 500 حرف.')
    .escape(),

  body('address.landmark')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 200 }).withMessage('العلامة المميزة لا تتجاوز 200 حرف.')
    .escape(),

  body('address.buildingName')
    .trim()
    .notEmpty().withMessage('اسم / رقم المبنى مطلوب.')
    .isLength({ max: 100 }).withMessage('اسم المبنى لا يتجاوز 100 حرف.')
    .escape(),

  body('address.floorNumber')
    .trim()
    .notEmpty().withMessage('رقم الطابق مطلوب.')
    .isLength({ max: 20 }).withMessage('رقم الطابق لا يتجاوز 20 حرف.')
    .escape(),

  body('address.apartmentNumber')
    .trim()
    .notEmpty().withMessage('رقم الشقة مطلوب.')
    .isLength({ max: 20 }).withMessage('رقم الشقة لا يتجاوز 20 حرف.')
    .escape(),

  body('address.location.lat')
    .optional({ checkFalsy: true })
    .isFloat({ min: 22, max: 32 }).withMessage('خط العرض غير صحيح.'),

  body('address.location.lng')
    .optional({ checkFalsy: true })
    .isFloat({ min: 24, max: 37 }).withMessage('خط الطول غير صحيح.'),
];

// ──────────────────────────────────────────────────────────
// Cart update validation rules
// ──────────────────────────────────────────────────────────

const cartUpdateRules = [
  body('items')
    .isArray({ min: 1 }).withMessage('يجب إضافة منتج واحد على الأقل.'),

  body('items.*.productId')
    .trim()
    .notEmpty().withMessage('معرّف المنتج مطلوب.')
    .matches(/^[a-f\d]{24}$/i).withMessage('معرّف المنتج غير صحيح.'),

  body('items.*.selectedSize')
    .trim()
    .notEmpty().withMessage('المقاس مطلوب.')
    .isLength({ max: 20 }).withMessage('المقاس غير صحيح.')
    .escape(),

  body('items.*.quantity')
    .isInt({ min: 1, max: 99 }).withMessage('الكمية يجب أن تكون بين 1 و 99.'),
];

// ──────────────────────────────────────────────────────────
// Promo code validation rules
// ──────────────────────────────────────────────────────────

const promoCodeRules = [
  body('code')
    .trim()
    .notEmpty().withMessage('كود الخصم مطلوب.')
    .isLength({ max: 20 }).withMessage('كود الخصم لا يتجاوز 20 حرف.')
    .matches(/^[A-Za-z0-9\-]+$/).withMessage('كود الخصم يحتوي على أحرف غير مسموحة.'),
];

// ──────────────────────────────────────────────────────────
// Order submission validation rules
// ──────────────────────────────────────────────────────────

const orderSubmitRules = [
  body('sessionId')
    .trim()
    .notEmpty().withMessage('معرّف الجلسة مطلوب.')
    .isUUID().withMessage('معرّف الجلسة غير صحيح.'),

  body('paymentMethod')
    .trim()
    .notEmpty().withMessage('طريقة الدفع مطلوبة.')
    .isIn(['instapay', 'mobile_wallet', 'cash_on_delivery'])
    .withMessage('طريقة الدفع غير صحيحة.'),
];

// ──────────────────────────────────────────────────────────
// Param sanitizer for governorate GET
// ──────────────────────────────────────────────────────────

const sanitizeGovParam = (req, res, next) => {
  if (req.params.governorate) {
    // Allow only Arabic letters, spaces, digits, and specific punctuation
    req.params.governorate = req.params.governorate.replace(
      /[^a-zA-Z0-9\u0600-\u06FF\s\-]/g,
      '',
    );
  }
  next();
};

module.exports = {
  whitelistBody,
  handleValidationErrors,
  customerInfoRules,
  cartUpdateRules,
  promoCodeRules,
  orderSubmitRules,
  sanitizeGovParam,
};
