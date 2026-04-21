"use strict";

const mongoose = require("mongoose");

/**
 * Order Schema
 * Tracks customer orders with status lifecycle and financial data.
 *
 * Status lifecycle:
 *   pending_review → preparing → delivering → completed
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, "Order number is required"],
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["pending_review", "pending_preparation", "pending_delivery", "completed"],
        message: "Invalid order status: {VALUE}",
      },
      default: "pending_review",
    },
    items: [
      {
        name: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    customerName: {
      type: String,
      trim: true,
      default: null,
    },
    // Unique daily-sequence code, e.g. "20260419-3" — set on creation via Counter
    orderCode: {
      type: String,
      unique: true,
      sparse: true, // allows null for legacy orders without a code
      trim: true,
    },
    // Transfer/bank-slip image path (shown on pending_review orders)
    transferImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// Compound index for status-tab + date-filter queries
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
