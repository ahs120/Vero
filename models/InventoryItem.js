'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * InventoryItem Schema
 *
 * Represents a clothing/product template that groups product variants
 * (sizes, quantities) under a single catalogued item.
 *
 * gender maps to the section system:
 *   men | women | kids | perfumes | sports
 *
 * slug is auto-generated from name for clean URLs:
 *   /inventory/:sectionSlug/:categorySlug
 *
 * season indicates which collection the item belongs to.
 */

/**
 * Generate a URL-safe slug from a given string.
 * Handles Arabic and English text.
 * @param {string} str - The string to slugify
 * @returns {string} - URL-safe slug
 */
const generateSlug = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '') // keep Arabic letters, a-z, 0-9, -
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Generate a unique random suffix for slug collision resolution.
 * @returns {string} - 6-character alphanumeric suffix
 */
const generateUniqueSuffix = () => {
  return crypto.randomBytes(4).toString('hex').slice(0, 6);
};

/**
 * Generate a unique slug by checking the database for collisions.
 * @param {string} baseSlug - The base slug generated from the name
 * @param {string} [excludeId] - Optional document ID to exclude from collision check (for updates)
 * @returns {Promise<string>} - A unique slug
 */
const generateUniqueSlug = async function(baseSlug, excludeId = null) {
  const model = this;
  let slug = baseSlug;
  let counter = 0;
  const maxAttempts = 10;

  while (counter < maxAttempts) {
    // Check if slug exists
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await model.findOne(query).lean();
    if (!existing) {
      return slug;
    }

    // Collision detected - append unique suffix
    const suffix = generateUniqueSuffix();
    slug = `${baseSlug}-${suffix}`;
    counter++;
  }

  // Fallback: append timestamp if all attempts failed
  return `${baseSlug}-${Date.now()}`;
};

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [200, 'Item name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    season: {
      type: String,
      required: [true, 'Season is required'],
      enum: {
        values: ['summer', 'winter', 'autumn', 'spring'],
        message: 'Invalid season: {VALUE}',
      },
    },
    gender: {
      type: String,
      required: [true, 'Gender/Section is required'],
      enum: {
        values: ['men', 'women', 'kids', 'perfumes', 'sports'],
        message: 'Invalid section: {VALUE}',
      },
      index: true,
    },
    image: {
      type: String, // relative path, e.g. /uploads/items/filename.jpg
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate unique slug from name before validation
inventoryItemSchema.pre('validate', async function (next) {
  if (this.name) {
    const baseSlug = generateSlug(this.name);

    // Only regenerate if slug is not set OR the slug no longer matches the current name
    // (handles both new documents and name changes)
    const currentBaseSlug = this.slug ? this.slug.replace(/-[a-f0-9]{6}$/, '').replace(/-\d+$/, '') : '';

    if (!this.slug || currentBaseSlug !== baseSlug) {
      // Generate a unique slug (checking database for collisions)
      this.slug = await generateUniqueSlug.call(this.constructor, baseSlug, this._id);
    }
  }
  next();
});

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

module.exports = InventoryItem;
