'use strict';

const express = require('express');

const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { sanitizeParam, statusUpdateValidationRules } = require('../middleware/validation');
const ordersController = require('../controllers/ordersController');

/**
 * @route   GET /orders
 * @desc    Orders page — list by status tab + date filter
 * @access  Private
 */
router.get('/orders', verifyToken, ordersController.getOrders);

/**
 * @route   GET /orders/:id
 * @desc    Order details page
 * @access  Private
 */
router.get(
  '/orders/:id',
  verifyToken,
  sanitizeParam('id'),
  ordersController.getOrderDetails
);

/**
 * @route   POST /orders/:id/status
 * @desc    Update order status (AJAX JSON endpoint)
 * @access  Private
 */
router.post(
  '/orders/:id/status',
  verifyToken,
  sanitizeParam('id'),
  statusUpdateValidationRules,
  ordersController.updateStatus
);

module.exports = router;
