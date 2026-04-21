'use strict';

const mongoose = require('mongoose');

/**
 * OrderSession Schema
 *
 * Server-side temporary storage for each multi-step customer order.
 * Replaces insecure client-side sessionStorage.
 *
 * Lifecycle:
 *   1. Created when customer starts flow (/order/info)
 *   2. Updated at each step (customer info → cart → payment)
 *   3. Consumed when order is submitted
 *   4. Auto-deleted after 2 hours via TTL index
 */
const orderSessionSchema = new mongoose.Schema(
  {
    // Unique identifier — the ONLY value the client stores
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Step tracking — enforces flow order
    currentStep: {
      type: String,
      enum: ['info', 'products', 'payment', 'confirm'],
      default: 'info',
    },

    // Customer info (step 1)
    customer: {
      fullName:       { type: String, default: null },
      primaryPhone:   { type: String, default: null },
      secondaryPhone: { type: String, default: null },
    },

    // Address (step 1)
    address: {
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      governorate:     { type: String, default: null },
      area:            { type: String, default: null },
      detailedAddress: { type: String, default: null },
      landmark:        { type: String, default: null },
      buildingName:    { type: String, default: null },
      floorNumber:     { type: String, default: null },
      apartmentNumber: { type: String, default: null },
    },

    // Cart items (step 2) — prices are always recalculated server-side
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        productName:         { type: String },
        selectedSize:        { type: String },
        quantity:            { type: Number, min: 1 },
        priceBeforeDiscount: { type: Number },
        priceAfterDiscount:  { type: Number },
      },
    ],

    // Pricing (computed server-side at step 2)
    pricing: {
      totalBeforeDiscount: { type: Number, default: 0 },
      totalAfterDiscount:  { type: Number, default: 0 },
      promoCode:           { type: String, default: null },
      promoDiscount:       { type: Number, default: 0 },
      finalTotal:          { type: Number, default: 0 },
    },

    // Payment details (step 3)
    payment: {
      method:           { type: String, default: null },
      depositRequired:  { type: Number, default: 0 },
      paymentProofPath: { type: String, default: null },
    },

    // CSRF token bound to this session (Double-Submit Cookie strategy)
    csrfToken: {
      type: String,
      required: true,
    },

    // Auto-expire after 2 hours via MongoDB TTL index
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  },
);

const OrderSession = mongoose.model('OrderSession', orderSessionSchema);

module.exports = OrderSession;
