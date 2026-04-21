'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicController');

/**
 * Customer-facing page routes.
 * Mounted at /order in server.js
 *
 * These are GET-only — they serve EJS views.
 * NO admin middleware. NO verifyToken. Completely public.
 */

// Landing page
router.get('/', ctrl.renderLanding);

// Customer info form
router.get('/info', ctrl.renderCustomerInfo);

// Product listing + cart
router.get('/products', ctrl.renderProducts);

// Payment method selection
router.get('/payment', ctrl.renderPayment);

// Order confirmation
router.get('/confirm', ctrl.renderConfirmation);

module.exports = router;
