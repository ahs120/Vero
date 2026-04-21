'use strict';

const InventoryItem = require('../models/InventoryItem');
const Product       = require('../models/Product');
const dashboardService = require('../services/dashboardService');

const { VALID_CATEGORIES, INVENTORY_CATEGORIES } = dashboardService;

// Section label map (slug → Arabic)
const SECTION_LABELS = {};
INVENTORY_CATEGORIES.forEach(c => { SECTION_LABELS[c.slug] = c.label; });

// Season label map
const SEASON_LABELS = {
  summer: 'صيف',
  winter: 'شتاء',
  autumn: 'خريف',
  spring: 'ربيع',
};

/**
 * GET /inventory
 * Inventory landing page — shows all sections (رجالي، حريمي، أطفال، عطور، رياضي)
 */
const getSections = async (req, res, next) => {
  try {
    // Count items per section for badge display
    const counts = await InventoryItem.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(r => { countMap[r._id] = r.count; });

    // Count total products per section (via itemId → InventoryItem.gender)
    const productCounts = await Product.aggregate([
      { $lookup: { from: 'inventoryitems', localField: 'itemId', foreignField: '_id', as: 'item' } },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$item.gender', count: { $sum: 1 } } },
    ]);
    const productCountMap = {};
    productCounts.forEach(r => { productCountMap[r._id] = r.count; });

    const sections = INVENTORY_CATEGORIES.map(c => ({
      slug: c.slug,
      label: c.label,
      itemCount: countMap[c.slug] || 0,
      productCount: productCountMap[c.slug] || 0,
    }));

    res.render('inventory/index', {
      title: 'Vero Admin — المخزون',
      description: 'إدارة المخزون',
      admin: req.admin,
      sections,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /inventory/:sectionSlug
 * Shows categories (InventoryItems) within a section.
 * Flow: Inventory → Section → [Categories list]
 */
const getCategories = async (req, res, next) => {
  try {
    const { sectionSlug } = req.params;
    console.log('[inventoryController] getCategories — sectionSlug:', sectionSlug);

    if (!VALID_CATEGORIES.has(sectionSlug)) {
      console.log('[inventoryController] Invalid sectionSlug:', sectionSlug);
      return res.status(404).render('error', {
        title: 'الصفحة غير موجودة',
        statusCode: 404,
        message: 'القسم المطلوب غير موجود.',
      });
    }

    const sectionLabel = SECTION_LABELS[sectionSlug] || sectionSlug;

    // Pagination
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryItem.find({ gender: sectionSlug })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments({ gender: sectionSlug }),
    ]);

    // Attach product count per item
    const itemIds = items.map(i => i._id);
    const prodCounts = await Product.aggregate([
      { $match: { itemId: { $in: itemIds } } },
      { $group: { _id: '$itemId', count: { $sum: 1 } } },
    ]);
    const prodCountMap = {};
    prodCounts.forEach(r => { prodCountMap[r._id.toString()] = r.count; });

    items.forEach(item => {
      item.productCount = prodCountMap[item._id.toString()] || 0;
    });

    const pages = Math.ceil(total / limit);

    console.log('[inventoryController] getCategories — found', items.length, 'categories in', sectionLabel);

    res.render('inventory/categories', {
      title: `Vero Admin — ${sectionLabel}`,
      description: `أصناف قسم ${sectionLabel}`,
      admin: req.admin,
      csrfToken: req.csrfToken(),
      sectionSlug,
      sectionLabel,
      items,
      total,
      page,
      pages,
      sections: INVENTORY_CATEGORIES,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /inventory/:sectionSlug/:categorySlug
 * Shows products for a specific category (InventoryItem).
 * Flow: Inventory → Section → Category → [Products list]
 */
const getProducts = async (req, res, next) => {
  try {
    const { sectionSlug, categorySlug } = req.params;
    console.log('[inventoryController] getProducts — sectionSlug:', sectionSlug, 'categorySlug:', categorySlug);

    if (!VALID_CATEGORIES.has(sectionSlug)) {
      console.log('[inventoryController] Invalid sectionSlug:', sectionSlug);
      return res.status(404).render('error', {
        title: 'الصفحة غير موجودة',
        statusCode: 404,
        message: 'القسم المطلوب غير موجود.',
      });
    }

    const sectionLabel = SECTION_LABELS[sectionSlug] || sectionSlug;

    // Fetch the category by slug AND verify it belongs to the correct section
    const item = await InventoryItem.findOne({ slug: categorySlug, gender: sectionSlug }).lean();
    if (!item) {
      console.log('[inventoryController] Category not found — slug:', categorySlug, 'section:', sectionSlug);
      return res.status(404).render('error', {
        title: 'الصنف غير موجود',
        statusCode: 404,
        message: 'الصنف المطلوب غير موجود أو لا ينتمي لهذا القسم.',
      });
    }

    // Validation: category belongs to the correct section
    if (item.gender !== sectionSlug) {
      console.log('[inventoryController] Category mismatch — item.gender:', item.gender, '≠ sectionSlug:', sectionSlug);
      return res.status(404).render('error', {
        title: 'الصنف غير موجود',
        statusCode: 404,
        message: 'الصنف المطلوب لا ينتمي لهذا القسم.',
      });
    }

    // Pagination for products
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const skip  = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ itemId: item._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({ itemId: item._id }),
    ]);

    const pages = Math.ceil(total / limit);

    console.log('[inventoryController] getProducts — found', products.length, 'products in', item.name);

    res.render('inventory/products', {
      title: `Vero Admin — ${item.name}`,
      description: `منتجات صنف ${item.name}`,
      admin: req.admin,
      csrfToken: req.csrfToken(),
      sectionSlug,
      sectionLabel,
      item,
      products,
      total,
      page,
      pages,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSections,
  getCategories,
  getProducts,
  SECTION_LABELS,
  SEASON_LABELS,
};
