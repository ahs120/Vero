'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Counter = require('../models/Counter');
const Product = require('../models/Product');
const PromoCode = require('../models/PromoCode');
const CustomerOrder = require('../models/CustomerOrder');
const logger = require('../config/logger');

// ──────────────────────────────────────────────────────────
// Atomic daily order code generator
// ──────────────────────────────────────────────────────────

/**
 * Generates "ORD-YYYYMMDD-N" atomically via Counter collection.
 */
const generateOrderCode = async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const counter = await Counter.findOneAndUpdate(
    { date: `cust-${today}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `ORD-${today}-${counter.seq}`;
};

// ──────────────────────────────────────────────────────────
// Recalculate all prices from DB (never trust client)
// ──────────────────────────────────────────────────────────

const recalculatePricing = async (items) => {
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = {};
  for (const p of products) productMap[p._id.toString()] = p;

  const pricedItems = [];
  let totalBeforeDiscount = 0;
  let totalAfterDiscount = 0;

  for (const item of items) {
    const product = productMap[item.productId.toString()];
    if (!product) {
      const err = new Error(`المنتج غير موجود: ${item.productId}`);
      err.statusCode = 400;
      throw err;
    }

    const before = product.price * item.quantity;
    const after = (product.price - (product.discount || 0)) * item.quantity;

    pricedItems.push({
      productId: product._id,
      productName: product.name,
      selectedSize: item.selectedSize,
      quantity: item.quantity,
      priceBeforeDiscount: before,
      priceAfterDiscount: after,
    });

    totalBeforeDiscount += before;
    totalAfterDiscount += after;
  }

  return { items: pricedItems, totalBeforeDiscount, totalAfterDiscount };
};

// ──────────────────────────────────────────────────────────
// Atomic stock decrement with guard
// ──────────────────────────────────────────────────────────

/**
 * Decrements stock atomically. Returns false if insufficient stock.
 *
 * The findOneAndUpdate condition `'sizes.quantity': { $gte: quantity }`
 * is evaluated atomically — no race condition possible.
 */
const decrementStock = async (productId, size, quantity) => {
  const result = await Product.findOneAndUpdate(
    {
      _id: productId,
      'sizes.size': size,
      'sizes.quantity': { $gte: quantity },
    },
    {
      $inc: { 'sizes.$.quantity': -quantity },
    },
    { new: true },
  );
  return result !== null;
};

// ──────────────────────────────────────────────────────────
// Rollback stock (on transaction failure)
// ──────────────────────────────────────────────────────────

const incrementStock = async (productId, size, quantity) => {
  await Product.findOneAndUpdate(
    {
      _id: productId,
      'sizes.size': size,
    },
    {
      $inc: { 'sizes.$.quantity': quantity },
    },
  );
};

// ──────────────────────────────────────────────────────────
// Validate promo code (read-only check)
// ──────────────────────────────────────────────────────────

const validatePromoCode = async (code, orderTotal) => {
  const now = new Date();
  const promo = await PromoCode.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
    expiresAt: { $gt: now },
    $expr: { $lt: ['$usedCount', '$maxUsage'] },
  }).lean();

  if (!promo) return null;

  if (orderTotal < promo.minOrderAmount) return null;

  // Calculate discount
  let discount = 0;
  if (promo.discountType === 'percentage') {
    discount = Math.round((orderTotal * promo.discountValue) / 100);
  } else {
    discount = promo.discountValue;
  }

  // Cap at order total
  discount = Math.min(discount, orderTotal);

  return {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    calculatedDiscount: discount,
    finalTotal: orderTotal - discount,
  };
};

// ──────────────────────────────────────────────────────────
// Atomic promo code consumption
// ──────────────────────────────────────────────────────────

/**
 * Validates AND consumes a promo code in a single atomic operation.
 * The $expr condition guarantees no race-condition exploitation.
 */
const consumePromoCode = async (code, orderTotal) => {
  const now = new Date();
  const promo = await PromoCode.findOneAndUpdate(
    {
      code: code.toUpperCase().trim(),
      isActive: true,
      expiresAt: { $gt: now },
      $expr: { $lt: ['$usedCount', '$maxUsage'] },
      minOrderAmount: { $lte: orderTotal },
    },
    {
      $inc: { usedCount: 1 },
    },
    { new: true },
  );
  return promo;
};

// ──────────────────────────────────────────────────────────
// Calculate discount amount from promo
// ──────────────────────────────────────────────────────────

const calculatePromoDiscount = (promo, orderTotal) => {
  let discount = 0;
  if (promo.discountType === 'percentage') {
    discount = Math.round((orderTotal * promo.discountValue) / 100);
  } else {
    discount = promo.discountValue;
  }
  return Math.min(discount, orderTotal);
};

// ──────────────────────────────────────────────────────────
// Full order creation (the critical path)
// ──────────────────────────────────────────────────────────

/**
 * Creates a customer order:
 *   1. Recalculates prices from DB
 *   2. Decrements stock atomically per item
 *   3. Consumes promo code atomically (if used)
 *   4. Creates order document
 *
 * Uses manual rollback strategy for stock decrements
 * since MongoDB transactions on Atlas Shared Tier may not be available.
 */
const createCustomerOrder = async (sessionData, idempotencyKey) => {
  // 1. Recalculate all prices from DB
  const pricingResult = await recalculatePricing(sessionData.items);

  // 2. Decrement stock atomically for each item
  const decremented = []; // Track for rollback
  for (const item of sessionData.items) {
    const success = await decrementStock(
      item.productId,
      item.selectedSize,
      item.quantity,
    );
    if (!success) {
      // Rollback already-decremented stock
      for (const d of decremented) {
        await incrementStock(d.productId, d.selectedSize, d.quantity);
      }
      const err = new Error(
        `الكمية غير متاحة لـ "${item.productName}" (${item.selectedSize}).`,
      );
      err.statusCode = 409;
      throw err;
    }
    decremented.push(item);
  }

  // 3. Handle promo code
  let promoDiscount = 0;
  if (sessionData.pricing && sessionData.pricing.promoCode) {
    const promo = await consumePromoCode(
      sessionData.pricing.promoCode,
      pricingResult.totalAfterDiscount,
    );
    if (!promo) {
      // Rollback stock
      for (const d of decremented) {
        await incrementStock(d.productId, d.selectedSize, d.quantity);
      }
      const err = new Error('كود الخصم لم يعد صالحًا.');
      err.statusCode = 400;
      throw err;
    }
    promoDiscount = calculatePromoDiscount(
      promo,
      pricingResult.totalAfterDiscount,
    );
  }

  // 4. Generate order code + tracking token
  const orderCode = await generateOrderCode();
  const trackingToken = uuidv4();

  const finalTotal = pricingResult.totalAfterDiscount - promoDiscount;

  // 5. Calculate deposit for COD
  let depositRequired = 0;
  if (sessionData.payment.method === 'cash_on_delivery') {
    depositRequired = Math.ceil(finalTotal * 0.5);
  }

  // 6. Create order document
  const order = await CustomerOrder.create({
    orderCode,
    idempotencyKey,
    trackingToken,
    customer: sessionData.customer,
    address: sessionData.address,
    items: pricingResult.items,
    pricing: {
      totalBeforeDiscount: pricingResult.totalBeforeDiscount,
      totalAfterDiscount: pricingResult.totalAfterDiscount,
      promoCode: sessionData.pricing ? sessionData.pricing.promoCode : null,
      promoDiscount,
      finalTotal,
    },
    payment: {
      method: sessionData.payment.method,
      depositRequired,
      paymentProofPath: sessionData.payment.paymentProofPath || null,
    },
    status: 'pending_review',
  });

  logger.info('Customer order created', {
    orderCode,
    trackingToken,
    total: finalTotal,
    items: sessionData.items.length,
    paymentMethod: sessionData.payment.method,
  });

  return order;
};

module.exports = {
  generateOrderCode,
  recalculatePricing,
  decrementStock,
  incrementStock,
  validatePromoCode,
  consumePromoCode,
  calculatePromoDiscount,
  createCustomerOrder,
};
