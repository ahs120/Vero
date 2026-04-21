'use strict';

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { sanitizeParam, inventoryItemValidationRules, editItemValidationRules } = require('../middleware/validation');
const {
  productValidationRules,
  validateProduct,
} = require('../middleware/productValidation');

const inventoryController     = require('../controllers/inventoryController');
const inventoryItemController = require('../controllers/inventoryItemController');
const productController       = require('../controllers/productController');

const upload = require('../middleware/upload');
const { uploadItem } = require('../middleware/upload');
const multer = require('multer');

// ─────────────────────────────────────────────────────────────────────────────
// Multer error handler for single-image upload routes
// ─────────────────────────────────────────────────────────────────────────────
const handleItemUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    req.flashError = err.code === 'LIMIT_FILE_SIZE'
      ? 'حجم الصورة يجب أن يكون أقل من 1 ميجابايت'
      : 'خطأ في رفع الملف';
    return next();
  }
  if (err && err.message === 'Only image files are allowed!') {
    req.flashError = 'يجب أن يكون الملف المرفوع صورة';
    return next();
  }
  next(err);
};

// ─────────────────────────────────────────────────────────────────────────────
// BROWSING ROUTES — Inventory → Section → Category → Products
//
// URL structure:
//   /inventory                        → Sections page
//   /inventory/:sectionSlug           → Categories page for a section
//   /inventory/:sectionSlug/:categorySlug → Products page for a category
//
// ⚠️  Route ORDER matters in Express — specific paths BEFORE wildcards.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /inventory
 * @desc   Inventory landing page — shows all sections
 * @access Private
 */
router.get(
  '/inventory',
  verifyToken,
  inventoryController.getSections,
);

// ─────────────────────────────────────────────────────────────────────────────
// ITEM (InventoryItem) CRUD ROUTES
// These use /inventory/add-item and /inventory/item/:id/edit
// They MUST come BEFORE /inventory/:sectionSlug to avoid conflicts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET  /inventory/add-item
 * @route  POST /inventory/add-item
 * @desc   Show and handle the Add InventoryItem form
 * @access Private
 */
router.get(
  '/inventory/add-item',
  verifyToken,
  inventoryItemController.getAddItem,
);
router.post(
  '/inventory/add-item',
  verifyToken,
  (req, res, next) => uploadItem.single('image')(req, res, (err) => handleItemUploadError(err, req, res, next)),
  inventoryItemValidationRules,
  inventoryItemController.postAddItem,
);

/**
 * @route  GET  /inventory/item/:id/edit
 * @route  POST /inventory/item/:id/edit
 * @desc   Edit an existing InventoryItem
 * @access Private
 */
router.get(
  '/inventory/item/:id/edit',
  verifyToken,
  sanitizeParam('id'),
  inventoryItemController.getEditItem,
);
router.post(
  '/inventory/item/:id/edit',
  verifyToken,
  sanitizeParam('id'),
  (req, res, next) => uploadItem.single('image')(req, res, (err) => handleItemUploadError(err, req, res, next)),
  editItemValidationRules,
  inventoryItemController.postEditItem,
);

/**
 * @route  DELETE /inventory/item/:id
 * @desc   Delete an InventoryItem and all its products + images
 * @access Private
 */
router.delete(
  '/inventory/item/:id',
  verifyToken,
  sanitizeParam('id'),
  inventoryItemController.deleteItem,
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION BROWSING ROUTE
// /inventory/:sectionSlug → Categories page
// Must come AFTER /inventory/add-item and /inventory/item/:id/edit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /inventory/:sectionSlug
 * @desc   Section page — shows categories (InventoryItems) within a section
 * @access Private
 */
router.get(
  '/inventory/:sectionSlug',
  verifyToken,
  sanitizeParam('sectionSlug'),
  inventoryController.getCategories,
);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CRUD ROUTES
// These use /inventory/:sectionSlug/:categorySlug/products/*
// The "add" route MUST come BEFORE /inventory/:sectionSlug/:categorySlug
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET  /inventory/:sectionSlug/:categorySlug/products/add
 * @route  POST /inventory/:sectionSlug/:categorySlug/products/add
 * @desc   Show and handle the Add Product form (category auto-selected from URL)
 * @access Private
 */
router.get(
  '/inventory/:sectionSlug/:categorySlug/products/add',
  verifyToken,
  sanitizeParam('sectionSlug'),
  sanitizeParam('categorySlug'),
  productController.getAddProductForm,
);
router.post(
  '/inventory/:sectionSlug/:categorySlug/products/add',
  verifyToken,
  sanitizeParam('sectionSlug'),
  sanitizeParam('categorySlug'),
  upload.array('images', 5),
  productValidationRules,
  validateProduct,
  productController.createProduct,
);

/**
 * @route  GET    /inventory/:sectionSlug/:categorySlug/products/:id/edit
 * @route  POST   /inventory/:sectionSlug/:categorySlug/products/:id/edit
 * @route  DELETE /inventory/:sectionSlug/:categorySlug/products/:id
 * @desc   Edit or delete a product
 * @access Private
 */
router.get(
  '/inventory/:sectionSlug/:categorySlug/products/:id/edit',
  verifyToken,
  sanitizeParam('sectionSlug'),
  sanitizeParam('categorySlug'),
  sanitizeParam('id'),
  productController.getEditProductForm,
);
router.post(
  '/inventory/:sectionSlug/:categorySlug/products/:id/edit',
  verifyToken,
  sanitizeParam('sectionSlug'),
  sanitizeParam('categorySlug'),
  sanitizeParam('id'),
  upload.array('images', 5),
  productValidationRules,
  validateProduct,
  productController.updateProduct,
);
router.delete(
  '/inventory/:sectionSlug/:categorySlug/products/:id',
  verifyToken,
  sanitizeParam('sectionSlug'),
  sanitizeParam('categorySlug'),
  sanitizeParam('id'),
  productController.deleteProduct,
);

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY BROWSING ROUTE (must be LAST among :sectionSlug/:xxx routes)
// /inventory/:sectionSlug/:categorySlug → Products page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /inventory/:sectionSlug/:categorySlug
 * @desc   Category page — shows products for a specific InventoryItem (by slug)
 * @access Private
 */
router.get(
  '/inventory/:sectionSlug/:categorySlug',
  verifyToken,
  sanitizeParam('sectionSlug'),
  sanitizeParam('categorySlug'),
  inventoryController.getProducts,
);

module.exports = router;
