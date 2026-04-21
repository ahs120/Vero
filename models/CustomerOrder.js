'use strict';

const mongoose = require('mongoose');

/**
 * CustomerOrder Schema
 *
 * Represents a confirmed customer order.
 * Completely separate from the admin Order model.
 *
 * Security features:
 *   - idempotencyKey  → prevents duplicate submissions
 *   - trackingToken   → lets customer check status without auth
 *   - All prices are recalculated server-side before storage
 */
const customerOrderSchema = new mongoose.Schema(
  {
    // Auto-generated code (e.g. "ORD-20260421-5")
    orderCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Idempotency — prevents duplicate submissions from retries / double-click
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Tracking token — customer can check order status without login
    trackingToken: {
      type: String,
      unique: true,
      index: true,
    },

    // ── Customer Information ───────────────────────────
    customer: {
      fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: 200,
      },
      primaryPhone: {
        type: String,
        required: [true, 'Primary phone is required'],
        trim: true,
      },
      secondaryPhone: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // ── Delivery Address ──────────────────────────────
    address: {
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      governorate: {
        type: String,
        required: [true, 'Governorate is required'],
        trim: true,
      },
      area: {
        type: String,
        required: [true, 'Area is required'],
        trim: true,
      },
      detailedAddress: {
        type: String,
        required: [true, 'Detailed address is required'],
        trim: true,
        maxlength: 500,
      },
      landmark: {
        type: String,
        trim: true,
        default: null,
      },
      buildingName: {
        type: String,
        required: [true, 'Building name/number is required'],
        trim: true,
      },
      floorNumber: {
        type: String,
        required: [true, 'Floor number is required'],
        trim: true,
      },
      apartmentNumber: {
        type: String,
        required: [true, 'Apartment number is required'],
        trim: true,
      },
    },

    // ── Cart Items (prices recalculated server-side) ──
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        productName:         { type: String, required: true, trim: true },
        selectedSize:        { type: String, required: true, trim: true },
        quantity:            { type: Number, required: true, min: 1 },
        priceBeforeDiscount: { type: Number, required: true, min: 0 },
        priceAfterDiscount:  { type: Number, required: true, min: 0 },
      },
    ],

    // ── Pricing ───────────────────────────────────────
    pricing: {
      totalBeforeDiscount: { type: Number, required: true, min: 0 },
      totalAfterDiscount:  { type: Number, required: true, min: 0 },
      promoCode:           { type: String, default: null },
      promoDiscount:       { type: Number, default: 0 },
      finalTotal:          { type: Number, required: true, min: 0 },
    },

    // ── Payment ───────────────────────────────────────
    payment: {
      method: {
        type: String,
        required: true,
        enum: {
          values: ['instapay', 'mobile_wallet', 'cash_on_delivery'],
          message: 'Invalid payment method: {VALUE}',
        },
      },
      depositRequired:  { type: Number, default: 0 },
      paymentProofPath: { type: String, default: null },
    },

    // ── Status ────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          'pending_review',
          'pending_preparation',
          'pending_delivery',
          'completed',
          'cancelled',
        ],
        message: 'Invalid order status: {VALUE}',
      },
      default: 'pending_review',
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
customerOrderSchema.index({ status: 1, createdAt: -1 });
customerOrderSchema.index({ 'customer.primaryPhone': 1 });

const CustomerOrder = mongoose.model('CustomerOrder', customerOrderSchema);

module.exports = CustomerOrder;
