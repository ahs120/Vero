'use strict';

/**
 * Migration: Add slug field to existing InventoryItems
 * 
 * This script generates URL-friendly slugs from item names
 * for all InventoryItems that don't have a slug yet.
 * 
 * Run with: node seeders/inventoryItemSlugMigration.js
 */

const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const connectDB = require('../config/db');

/**
 * Generate a URL-friendly slug from a name
 * Handles both Arabic and English text
 */
const generateSlug = (name) => {
  if (!name) return '';
  
  // Convert to lowercase and replace spaces with hyphens
  let slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '') // keep Arabic letters, a-z, 0-9, -
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
  
  return slug;
};

/**
 * Ensure slug uniqueness by appending a number if needed
 */
const ensureUniqueSlug = async (baseSlug, itemId) => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    // Check if any OTHER item has this slug
    const existing = await InventoryItem.findOne({ 
      slug, 
      _id: { $ne: itemId } 
    });
    
    if (!existing) break;
    
    // Append counter and try again
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
};

const runMigration = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');
    
    // Find all items without a slug
    const itemsWithoutSlug = await InventoryItem.find({ 
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });
    
    console.log(`📦 Found ${itemsWithoutSlug.length} items without slugs`);
    
    if (itemsWithoutSlug.length === 0) {
      console.log('✅ All items already have slugs. Nothing to do!');
      process.exit(0);
    }
    
    let updated = 0;
    let errors = 0;
    
    for (const item of itemsWithoutSlug) {
      try {
        // Generate base slug from name
        const baseSlug = generateSlug(item.name);
        
        if (!baseSlug) {
          console.log(`⚠️  Skipping item "${item.name}" (ID: ${item._id}) - could not generate slug`);
          errors++;
          continue;
        }
        
        // Ensure uniqueness
        const uniqueSlug = await ensureUniqueSlug(baseSlug, item._id);
        
        // Update the item
        item.slug = uniqueSlug;
        await item.save();
        
        console.log(`✅ Updated: "${item.name}" → slug: "${uniqueSlug}"`);
        updated++;
      } catch (err) {
        console.error(`❌ Error updating item "${item.name}" (ID: ${item._id}):`, err.message);
        errors++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Updated: ${updated} items`);
    console.log(`   Errors:  ${errors} items`);
    console.log(`   Total:   ${itemsWithoutSlug.length} items processed`);
    
    if (errors === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = { runMigration, generateSlug };
