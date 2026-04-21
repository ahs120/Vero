'use strict';

const path = require('path');
const fs   = require('fs');
const { validationResult } = require('express-validator');
const dashboardService = require('../services/dashboardService');
const Expense          = require('../models/Expense');

const ITEM_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'items');

/** Delete an invoice image safely. */
const safeDeleteInvoiceImage = (relativePath) => {
  if (!relativePath) return;
  const filename  = path.basename(relativePath);
  const resolved  = path.resolve(ITEM_UPLOAD_DIR, filename);
  if (resolved.startsWith(ITEM_UPLOAD_DIR) && fs.existsSync(resolved)) {
    try { fs.unlinkSync(resolved); } catch (_) { /* non-fatal */ }
  }
};

/**
 * @desc  Render the analytics page (detailed sales, expenses, profit)
 * @route GET /analytics
 * @access Private
 */
const getAnalytics = async (req, res, next) => {
  try {
    const analyticsData = await dashboardService.getAnalyticsData();

    return res.render('analytics/index', {
      title:       'Vero Admin — التحليلات',
      description: 'صفحة المبيعات والمصاريف',
      admin:       req.admin,
      sales:       analyticsData.sales.byStatus,
      salesTotal:  analyticsData.sales.total,
      expenses:    analyticsData.expenses,
      profit:      analyticsData.profit,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc  Render the Add Expense form
 * @route GET /analytics/add-expense
 * @access Private
 */
const getAddExpense = (req, res) => {
  res.render('analytics/addExpense', {
    title:       'Vero Admin — إضافة مصروف',
    description: 'إضافة مصروف جديد',
    admin:       req.admin,
    csrfToken:   req.csrfToken(),
    error:       req.flashError || null,
    formData:    req.flashFormData || {},
  });
};

/**
 * @desc  Save a new expense and redirect to analytics
 * @route POST /analytics/add-expense
 * @access Private
 */
const postAddExpense = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) safeDeleteInvoiceImage(`/uploads/items/${req.file.filename}`);
      req.flashError    = errors.array()[0].msg;
      req.flashFormData = req.body;
      return getAddExpense(req, res, next);
    }

    const amount      = parseFloat(req.body.amount);
    const reason      = (req.body.reason || req.body.description || '').trim();
    const invoicePath = req.file ? `/uploads/items/${req.file.filename}` : null;

    if (!reason) {
      if (req.file) safeDeleteInvoiceImage(invoicePath);
      req.flashError    = 'السبب مطلوب';
      req.flashFormData = req.body;
      return getAddExpense(req, res, next);
    }

    await Expense.create({
      description:  reason, // keep legacy field populated
      reason,
      amount,
      invoiceImage: invoicePath,
    });

    // Return the updated total to the caller (useful for AJAX, ignored on redirect)
    res.redirect('/analytics');
  } catch (error) {
    if (req.file) safeDeleteInvoiceImage(`/uploads/items/${req.file.filename}`);
    if (error.name === 'ValidationError') {
      req.flashError    = Object.values(error.errors).map((e) => e.message).join(' — ');
      req.flashFormData = req.body;
      return getAddExpense(req, res, next);
    }
    next(error);
  }
};

module.exports = { getAnalytics, getAddExpense, postAddExpense };
