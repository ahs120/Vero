"use strict";

const mongoose = require("mongoose");

/**
 * Product Schema
 * Represents a product in the unified 'products' collection.
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["men", "women", "kids", "perfumes", "sports"],
        message: "Invalid category: {VALUE}",
      },
    },
    /* MIGRATION NOTE (v2):
     *   sizes was originally type: [String]. Existing documents may still
     *   hold plain strings. New writes use the sub-document format below.
     *   A one-time migration script should convert legacy values:
     *     db.products.updateMany(
     *       { "sizes": { $type: "string" } },
     *       [{ $set: { sizes: { $map: {
     *         input: "$sizes", as: "s", in: { size: "$$s", quantity: 1 }
     *       }}} }]
     *     );
     */
    sizes: [
      {
        size: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
      },
    ],
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    images: {
      type: [String],
      default: [],
    },
    // Links this product variant to a parent InventoryItem
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes to improve query performance
productSchema.index({ category: 1, createdAt: -1 }); // list queries sorted by newest
productSchema.index({ category: 1, _id: 1 }); // fast edit/delete lookups

const Product = mongoose.model("Product", productSchema, "products");

module.exports = Product;
