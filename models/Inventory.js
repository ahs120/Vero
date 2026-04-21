'use strict';

const mongoose = require('mongoose');

/**
 * Inventory Schema
 * Represents a product entry belonging to a category + sub-category.
 *
 * Categories (Arabic → English slug):
 *   حريمي  → women
 *   رجالي  → men
 *   أطفال  → kids
 *   عطور   → perfumes
 *   رياضي  → sports
 */
const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['women', 'men', 'kids', 'perfumes', 'sports'],
        message: 'Invalid category: {VALUE}',
      },
    },
    subCategory: {
      type: String,
      required: [true, 'Sub-category is required'],
      trim: true,
      maxlength: [100, 'Sub-category cannot exceed 100 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // allows multiple null values
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for category + subCategory lookups
inventorySchema.index({ category: 1, subCategory: 1 });

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
