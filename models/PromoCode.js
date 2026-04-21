'use strict';

const mongoose = require('mongoose');

/**
 * PromoCode Schema
 *
 * Managed exclusively by admin (via DB seed or future admin UI).
 * Customer flow validates codes server-side only.
 *
 * Atomic usage tracking:
 *   findOneAndUpdate with $expr: { $lt: ['$usedCount', '$maxUsage'] }
 *   guarantees no race-condition exploitation.
 */
const promoCodeSchema = new mongoose.Schema(
  {
    // Unique code — always stored uppercase
    code: {
      type: String,
      required: [true, 'Promo code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },

    // Discount type
    discountType: {
      type: String,
      required: true,
      enum: {
        values: ['percentage', 'fixed'],
        message: 'Discount type must be percentage or fixed',
      },
    },

    // Discount amount (e.g. 10 = 10% or 10 EGP)
    discountValue: {
      type: Number,
      required: true,
      min: [0, 'Discount value cannot be negative'],
    },

    // Minimum order amount to qualify
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Maximum total uses allowed
    maxUsage: {
      type: Number,
      required: true,
      min: 1,
    },

    // Current number of times used (incremented atomically)
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Active flag — admin can deactivate
    isActive: {
      type: Boolean,
      default: true,
    },

    // Expiration date
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast lookup
promoCodeSchema.index({ code: 1, isActive: 1 });

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
