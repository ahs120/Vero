'use strict';

const { v4: uuidv4 } = require('uuid');
const OrderSession = require('../models/OrderSession');
const Product = require('../models/Product');

// ──────────────────────────────────────────────────────────
// Create a new order session
// ──────────────────────────────────────────────────────────

/**
 * Creates a new server-side order session.
 * Returns { sessionId, csrfToken } — the ONLY values the client stores.
 */
const startSession = async () => {
  const sessionId = uuidv4();
  const csrfToken = uuidv4();

  await OrderSession.create({
    sessionId,
    csrfToken,
    currentStep: 'info',
  });

  return { sessionId, csrfToken };
};

// ──────────────────────────────────────────────────────────
// Update customer info (step 1 → step 2)
// ──────────────────────────────────────────────────────────

/**
 * Saves customer info + address into session and advances to 'products' step.
 */
const updateCustomerInfo = async (sessionId, customer, address) => {
  const session = await OrderSession.findOneAndUpdate(
    { sessionId, expiresAt: { $gt: new Date() } },
    {
      $set: {
        customer,
        address,
        currentStep: 'products',
      },
    },
    { new: true },
  );

  if (!session) {
    const err = new Error('الجلسة منتهية أو غير موجودة.');
    err.statusCode = 404;
    throw err;
  }

  return session;
};

// ──────────────────────────────────────────────────────────
// Update cart (step 2 → step 3)
// ──────────────────────────────────────────────────────────

/**
 * Recalculates all item prices from the DB (never trust client prices)
 * and saves the cart into the session.
 */
const updateCart = async (sessionId, clientItems) => {
  // 1. Fetch all referenced products in one query
  const productIds = clientItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = {};
  for (const p of products) productMap[p._id.toString()] = p;

  // 2. Recalculate prices server-side
  const pricedItems = [];
  let totalBeforeDiscount = 0;
  let totalAfterDiscount = 0;

  for (const item of clientItems) {
    const product = productMap[item.productId];
    if (!product) {
      const err = new Error(`المنتج غير موجود: ${item.productId}`);
      err.statusCode = 400;
      throw err;
    }

    // Verify the size exists
    const sizeEntry = product.sizes.find(
      (s) => s.size === item.selectedSize && s.quantity >= item.quantity,
    );
    if (!sizeEntry) {
      const err = new Error(
        `المقاس "${item.selectedSize}" غير متاح بالكمية المطلوبة لـ ${product.name}.`,
      );
      err.statusCode = 400;
      throw err;
    }

    const priceBeforeDiscount = product.price * item.quantity;
    const priceAfterDiscount =
      (product.price - (product.discount || 0)) * item.quantity;

    pricedItems.push({
      productId: product._id,
      productName: product.name,
      selectedSize: item.selectedSize,
      quantity: item.quantity,
      priceBeforeDiscount,
      priceAfterDiscount,
    });

    totalBeforeDiscount += priceBeforeDiscount;
    totalAfterDiscount += priceAfterDiscount;
  }

  // 3. Save to session
  const session = await OrderSession.findOneAndUpdate(
    { sessionId, expiresAt: { $gt: new Date() } },
    {
      $set: {
        items: pricedItems,
        pricing: {
          totalBeforeDiscount,
          totalAfterDiscount,
          promoCode: null,
          promoDiscount: 0,
          finalTotal: totalAfterDiscount,
        },
        currentStep: 'payment',
      },
    },
    { new: true },
  );

  if (!session) {
    const err = new Error('الجلسة منتهية أو غير موجودة.');
    err.statusCode = 404;
    throw err;
  }

  return session;
};

// ──────────────────────────────────────────────────────────
// Get session
// ──────────────────────────────────────────────────────────

const getSession = async (sessionId) => {
  const session = await OrderSession.findOne({
    sessionId,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!session) {
    const err = new Error('الجلسة منتهية أو غير موجودة.');
    err.statusCode = 404;
    throw err;
  }

  return session;
};

// ──────────────────────────────────────────────────────────
// Update payment info in session
// ──────────────────────────────────────────────────────────

const updatePayment = async (sessionId, paymentData) => {
  const session = await OrderSession.findOneAndUpdate(
    { sessionId, expiresAt: { $gt: new Date() } },
    {
      $set: {
        payment: paymentData,
      },
    },
    { new: true },
  );

  if (!session) {
    const err = new Error('الجلسة منتهية أو غير موجودة.');
    err.statusCode = 404;
    throw err;
  }

  return session;
};

// ──────────────────────────────────────────────────────────
// Update promo in session
// ──────────────────────────────────────────────────────────

const updatePromo = async (sessionId, promoCode, promoDiscount, finalTotal) => {
  await OrderSession.findOneAndUpdate(
    { sessionId, expiresAt: { $gt: new Date() } },
    {
      $set: {
        'pricing.promoCode': promoCode,
        'pricing.promoDiscount': promoDiscount,
        'pricing.finalTotal': finalTotal,
      },
    },
  );
};

// ──────────────────────────────────────────────────────────
// Delete session (after order is placed)
// ──────────────────────────────────────────────────────────

const deleteSession = async (sessionId) => {
  await OrderSession.deleteOne({ sessionId });
};

module.exports = {
  startSession,
  updateCustomerInfo,
  updateCart,
  getSession,
  updatePayment,
  updatePromo,
  deleteSession,
};
