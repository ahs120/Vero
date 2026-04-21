'use strict';

const express = require('express');
const multer  = require('multer');

const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { uploadItem } = require('../middleware/upload');
const { expenseValidationRules } = require('../middleware/validation');
const analyticsController = require('../controllers/analyticsController');

// Multer error handler for invoice upload
const handleInvoiceUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    req.flashError = err.code === 'LIMIT_FILE_SIZE'
      ? 'حجم الصورة يجب أن يكون أقل من 1 ميجابايت'
      : 'خطأ في رفع الملف';
    return next();
  }
  if (err && err.message === 'Only image files are allowed!') {
    req.flashError = 'يجب أن يكون الملف المرفوع صورة';
    return next();
  }
  next(err);
};

/**
 * @route   GET /analytics
 * @desc    Analytics page — detailed sales, expenses, and profit breakdown
 * @access  Private
 */
router.get('/analytics', verifyToken, analyticsController.getAnalytics);

/**
 * @route   GET /analytics/add-expense
 * @desc    Show add expense form
 * @access  Private
 */
router.get('/analytics/add-expense', verifyToken, analyticsController.getAddExpense);

/**
 * @route   POST /analytics/add-expense
 * @desc    Save new expense (with optional invoice image)
 * @access  Private
 */
router.post(
  '/analytics/add-expense',
  verifyToken,
  (req, res, next) => uploadItem.single('invoice')(req, res, (err) => handleInvoiceUploadError(err, req, res, next)),
  expenseValidationRules,
  analyticsController.postAddExpense
);

module.exports = router;
