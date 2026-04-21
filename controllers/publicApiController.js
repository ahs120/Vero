'use strict';

const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const CustomerOrder = require('../models/CustomerOrder');
const orderSessionService = require('../services/orderSessionService');
const customerOrderService = require('../services/customerOrderService');
const { governorates, isValidGovernorate, areasByGovernorate } = require('../config/egyptData');
const logger = require('../config/logger');

// ──────────────────────────────────────────────────────────
// POST /api/public/session/start
// Creates a new server-side order session + sets CSRF cookie
// ──────────────────────────────────────────────────────────

const startSession = async (req, res, next) => {
  try {
    const { sessionId, csrfToken } = await orderSessionService.startSession();

    // Set CSRF cookie (httpOnly=false so JS can read it for the header)
    res.cookie('_public_csrf', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      path: '/',
    });

    res.status(201).json({
      success: true,
      sessionId,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// GET /api/public/products
// Returns available products with sizes that have stock
// ──────────────────────────────────────────────────────────

const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({})
      .select('name description category sizes price discount images')
      .lean();

    // Filter out sizes with zero stock
    const available = products
      .map((p) => ({
        ...p,
        sizes: p.sizes.filter((s) => s.quantity > 0),
      }))
      .filter((p) => p.sizes.length > 0);

    res.json({ success: true, products: available });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// GET /api/public/governorates
// ──────────────────────────────────────────────────────────

const getGovernorates = (req, res) => {
  res.json({
    success: true,
    governorates: governorates.map((g) => ({
      name: g.name,
      nameEn: g.nameEn,
    })),
  });
};

// ──────────────────────────────────────────────────────────
// GET /api/public/areas/:governorate
// ──────────────────────────────────────────────────────────

const getAreas = (req, res) => {
  const gov = req.params.governorate;

  if (!isValidGovernorate(gov)) {
    return res.status(400).json({
      success: false,
      message: 'المحافظة غير صحيحة.',
    });
  }

  const areas = areasByGovernorate[gov];
  res.json({
    success: true,
    areas: Array.from(areas),
  });
};

// ──────────────────────────────────────────────────────────
// PUT /api/public/session/customer-info
// ──────────────────────────────────────────────────────────

const updateCustomerInfo = async (req, res, next) => {
  try {
    const { sessionId, customer, address } = req.body;

    const session = await orderSessionService.updateCustomerInfo(
      sessionId,
      customer,
      address,
    );

    res.json({
      success: true,
      message: 'تم حفظ بيانات العميل.',
      currentStep: session.currentStep,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// PUT /api/public/session/cart
// ──────────────────────────────────────────────────────────

const updateCart = async (req, res, next) => {
  try {
    const { sessionId, items } = req.body;

    const session = await orderSessionService.updateCart(sessionId, items);

    res.json({
      success: true,
      message: 'تم تحديث السلة.',
      pricing: session.pricing,
      items: session.items,
      currentStep: session.currentStep,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// POST /api/public/promo/validate
// ──────────────────────────────────────────────────────────

const validatePromoCode = async (req, res, next) => {
  try {
    const { sessionId, code } = req.body;

    // Get session to know the current total
    const session = await orderSessionService.getSession(sessionId);

    if (!session.pricing || session.pricing.totalAfterDiscount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة منتجات أولاً.',
      });
    }

    const result = await customerOrderService.validatePromoCode(
      code,
      session.pricing.totalAfterDiscount,
    );

    if (!result) {
      return res.status(400).json({
        success: false,
        message: 'كود الخصم غير صالح أو منتهي الصلاحية.',
      });
    }

    // Save promo to session
    await orderSessionService.updatePromo(
      sessionId,
      result.code,
      result.calculatedDiscount,
      result.finalTotal,
    );

    res.json({
      success: true,
      message: `تم تطبيق كود الخصم "${result.code}".`,
      promo: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// POST /api/public/upload/payment-proof
// ──────────────────────────────────────────────────────────

const uploadPaymentProof = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف.',
      });
    }

    const sessionId = req.body.sessionId || req.orderSession.sessionId;

    // Save the file path into the session
    await orderSessionService.updatePayment(sessionId, {
      paymentProofPath: req.file.path,
    });

    res.json({
      success: true,
      message: 'تم رفع إثبات الدفع.',
      filename: req.file.filename,
    });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// POST /api/public/orders
// The critical order submission endpoint
// ──────────────────────────────────────────────────────────

const submitOrder = async (req, res, next) => {
  try {
    const { sessionId, paymentMethod } = req.body;

    // 1. Fetch the full session
    const session = await orderSessionService.getSession(sessionId);

    // 2. Validate session has required data
    if (!session.customer || !session.customer.fullName) {
      return res.status(400).json({
        success: false,
        message: 'بيانات العميل غير مكتملة.',
      });
    }
    if (!session.items || session.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'السلة فارغة.',
      });
    }

    // 3. Set payment method
    const paymentData = {
      method: paymentMethod,
      depositRequired: 0,
      paymentProofPath: session.payment ? session.payment.paymentProofPath : null,
    };

    // 4. Create the order (atomic stock + promo + creation)
    const order = await customerOrderService.createCustomerOrder(
      {
        customer: session.customer,
        address: session.address,
        items: session.items,
        pricing: session.pricing,
        payment: paymentData,
      },
      req.idempotencyKey,
    );

    // 5. Delete the session (consumed)
    await orderSessionService.deleteSession(sessionId);

    // 6. Clear CSRF cookie
    res.clearCookie('_public_csrf', { path: '/' });

    res.status(201).json({
      success: true,
      message: 'تم تقديم الطلب بنجاح!',
      order: {
        orderCode: order.orderCode,
        trackingToken: order.trackingToken,
        status: order.status,
        finalTotal: order.pricing.finalTotal,
        depositRequired: order.payment.depositRequired,
      },
    });
  } catch (err) {
    logger.error('Order submission failed', {
      error: err.message,
      sessionId: req.body.sessionId,
    });
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// GET /api/public/payment-proof/:token (controlled access)
// ──────────────────────────────────────────────────────────

const getPaymentProof = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token required.' });
    }

    const order = await CustomerOrder.findOne({ trackingToken: token })
      .select('payment.paymentProofPath')
      .lean();

    if (!order || !order.payment || !order.payment.paymentProofPath) {
      return res.status(404).json({ success: false, message: 'غير موجود.' });
    }

    const filePath = path.resolve(order.payment.paymentProofPath);
    const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'payment-proofs');

    // Prevent path traversal
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'ملف غير موجود.' });
    }

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// GET /api/public/session/:sessionId
// ──────────────────────────────────────────────────────────

const getSessionData = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await orderSessionService.getSession(sessionId);
    res.json({
      success: true,
      session: {
        currentStep: session.currentStep,
        customer: session.customer,
        address: session.address,
        items: session.items,
        pricing: session.pricing,
        payment: session.payment,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};

module.exports = {
  startSession,
  getProducts,
  getGovernorates,
  getAreas,
  updateCustomerInfo,
  updateCart,
  validatePromoCode,
  uploadPaymentProof,
  submitOrder,
  getPaymentProof,
  getSessionData,
};
