'use strict';

const fs           = require('fs');
const path         = require('path');
const { validationResult } = require('express-validator');
const InventoryItem = require('../models/InventoryItem');
const Product       = require('../models/Product');

const ITEM_UPLOAD_DIR    = path.join(__dirname, '..', 'public', 'uploads', 'items');
const PRODUCT_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'products');

/** Delete a single item-upload file safely (path-traversal protected). */
const safeDeleteItemImage = (relativePath) => {
  if (!relativePath) return;
  const filename  = path.basename(relativePath);
  const resolved  = path.resolve(ITEM_UPLOAD_DIR, filename);
  if (resolved.startsWith(ITEM_UPLOAD_DIR) && fs.existsSync(resolved)) {
    try { fs.unlinkSync(resolved); } catch (_) { /* non-fatal */ }
  }
};

/** Delete a single product-upload file safely (path-traversal protected). */
const safeDeleteProductImage = (relativePath) => {
  if (!relativePath) return;
  const filename  = path.basename(relativePath);
  const resolved  = path.resolve(PRODUCT_UPLOAD_DIR, filename);
  if (resolved.startsWith(PRODUCT_UPLOAD_DIR) && fs.existsSync(resolved)) {
    try { fs.unlinkSync(resolved); } catch (_) { /* non-fatal */ }
  }
};

// ─────────────────────────────────────────────────────────
// GET /inventory/add-item
// ─────────────────────────────────────────────────────────
const VALID_GENDERS = ['men', 'women', 'kids', 'perfumes', 'sports'];

const getAddItem = (req, res) => {
  const defaultGender = VALID_GENDERS.includes(req.query.gender) ? req.query.gender : '';
  res.render('inventory/addItem', {
    title:         'Vero Admin — إضافة صنف',
    description:   'إضافة صنف جديد إلى المخزون',
    admin:         req.admin,
    csrfToken:     req.csrfToken(),
    error:         req.flashError || null,
    formData:      req.flashFormData || {},
    defaultGender,
  });
};

// ─────────────────────────────────────────────────────────
// POST /inventory/add-item
// ─────────────────────────────────────────────────────────
const postAddItem = async (req, res, next) => {
  try {
    // Validation errors from express-validator middleware
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) safeDeleteItemImage(`/uploads/items/${req.file.filename}`);
      req.flashError    = errors.array()[0].msg;
      req.flashFormData = req.body;
      return getAddItem(req, res, next);
    }

    const imagePath = req.file ? `/uploads/items/${req.file.filename}` : null;

    await InventoryItem.create({
      name:   req.body.name,
      season: req.body.season,
      gender: req.body.gender,
      image:  imagePath,
    });

    res.redirect(`/inventory/${req.body.gender}`);
  } catch (error) {
    if (req.file) safeDeleteItemImage(`/uploads/items/${req.file.filename}`);
    if (error.name === 'ValidationError') {
      req.flashError    = Object.values(error.errors).map((e) => e.message).join(' — ');
      req.flashFormData = req.body;
      return getAddItem(req, res, next);
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// GET /inventory/items/:gender
// ─────────────────────────────────────────────────────────
const getItemsByGender = async (req, res, next) => {
  try {
    const { gender } = req.params;
    const VALID_GENDERS = ['men', 'women', 'kids', 'perfumes', 'sports'];

    if (!VALID_GENDERS.includes(gender)) {
      return res.status(404).render('error', {
        title:      'الصفحة غير موجودة',
        statusCode: 404,
        message:    'التصنيف المطلوب غير موجود.',
      });
    }

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryItem.find({ gender })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments({ gender }),
    ]);

    const genderLabels = { men: 'رجالي', women: 'حريمي', kids: 'أطفال', perfumes: 'عطور', sports: 'رياضي' };

    res.render('inventory/itemList', {
      title:       `Vero Admin — ${genderLabels[gender] || gender}`,
      description: `صفحة أصناف ${genderLabels[gender] || gender}`,
      admin:       req.admin,
      csrfToken:   req.csrfToken(),
      gender,
      genderLabel: genderLabels[gender] || gender,
      items,
      page,
      pages:       Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// GET /inventory/item/:id/edit
// ─────────────────────────────────────────────────────────
const getEditItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).render('error', {
        title:      'الصنف غير موجود',
        statusCode: 404,
        message:    'الصنف المطلوب غير موجود.',
      });
    }

    res.render('inventory/editItem', {
      title:       `Vero Admin — تعديل: ${item.name}`,
      description: 'تعديل بيانات الصنف',
      admin:       req.admin,
      csrfToken:   req.csrfToken(),
      item,
      error:       req.flashError || null,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// POST /inventory/item/:id/edit
// ─────────────────────────────────────────────────────────
const postEditItem = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) safeDeleteItemImage(`/uploads/items/${req.file.filename}`);
      req.flashError = errors.array()[0].msg;
      return getEditItem(req, res, next);
    }

    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      if (req.file) safeDeleteItemImage(`/uploads/items/${req.file.filename}`);
      return res.status(404).render('error', {
        title:      'الصنف غير موجود',
        statusCode: 404,
        message:    'الصنف المطلوب غير موجود.',
      });
    }

    // Replace image if a new one was uploaded
    let imagePath = item.image;
    if (req.file) {
      safeDeleteItemImage(item.image); // remove old
      imagePath = `/uploads/items/${req.file.filename}`;
    }

    item.name   = req.body.name;
    item.season = req.body.season;
    // gender is not changed on edit (it's the category grouping)
    item.image  = imagePath;
    await item.save();

    res.redirect(`/inventory/${item.gender}`);
  } catch (error) {
    if (req.file) safeDeleteItemImage(`/uploads/items/${req.file.filename}`);
    if (error.name === 'ValidationError') {
      req.flashError = Object.values(error.errors).map((e) => e.message).join(' — ');
      return getEditItem(req, res, next);
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// GET /inventory/item/:id/products
// ─────────────────────────────────────────────────────────
const getItemProducts = async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).render('error', {
        title:      'الصنف غير موجود',
        statusCode: 404,
        message:    'الصنف المطلوب غير موجود.',
      });
    }

    const products = await Product.find({ itemId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    res.render('inventory/itemProducts', {
      title:       `Vero Admin — منتجات: ${item.name}`,
      description: `المنتجات المرتبطة بصنف ${item.name}`,
      admin:       req.admin,
      csrfToken:   req.csrfToken(),
      item,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// POST /inventory/item/:id/products — link product and/or update sizes
// ─────────────────────────────────────────────────────────
const updateItemProducts = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const item = await InventoryItem.findById(req.params.id).lean();
    if (!item) {
      if (req.method === 'POST' && req.headers['content-type'] !== 'application/json') {
        req.flashError = 'الصنف غير موجود';
        return res.redirect('back');
      }
      return res.status(404).json({ success: false, message: 'الصنف غير موجود' });
    }

    // Identify product to update
    const productId = req.body.productId || req.params.productId;
    if (!productId) {
      if (req.headers['content-type'] !== 'application/json') {
        req.flashError = 'productId مطلوب';
        return res.redirect('back');
      }
      return res.status(400).json({ success: false, message: 'productId مطلوب' });
    }

    const updateData = { itemId: req.params.id };

    // 7.3 SAVE PRODUCT SIZES
    if (req.body.sizes) {
      let sizes = req.body.sizes;
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes); }
        catch (e) { sizes = []; }
      }
      
      // Filter out invalid/empty entries if submitted via standard form arrays
      if (Array.isArray(sizes)) {
         sizes = sizes.filter(s => s && s.size);
      }

      if (!Array.isArray(sizes)) {
        throw new Error('Invalid sizes');
      }

      sizes.forEach(s => {
        const qty = parseInt(s.quantity, 10);
        if (!s.size || isNaN(qty) || qty < 1) {
          throw new Error('Invalid size or quantity');
        }
        s.quantity = qty;
      });

      updateData.sizes = sizes;
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!product) {
      if (req.headers['content-type'] !== 'application/json') {
        req.flashError = 'المنتج غير موجود';
        return res.redirect('back');
      }
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }

    if (req.headers['content-type'] === 'application/json') {
       return res.json({ success: true, message: 'تم ربط المنتج بالصنف وتحديث المقاسات بنجاح.' });
    }
    
    // Redirect if it was a standard form post
    res.redirect(`/inventory/item/${req.params.id}/products`);
  } catch (error) {
    if (error.message === 'Invalid sizes' || error.message === 'Quantity must be greater than 0' || error.message === 'Invalid size or quantity') {
      if (req.headers['content-type'] !== 'application/json') {
        req.flashError = error.message;
        return res.redirect('back');
      }
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// DELETE /inventory/item/:id
// ─────────────────────────────────────────────────────────
const deleteItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'الصنف غير موجود' });
    }

    // 1. Collect and delete all images belonging to this item's products
    const products = await Product.find({ itemId: item._id }).lean();
    products.forEach((product) => {
      if (product.images && product.images.length > 0) {
        product.images.forEach((imgPath) => safeDeleteProductImage(imgPath));
      }
    });

    // 2. Delete all products in DB (after images removed from FS)
    await Product.deleteMany({ itemId: item._id });

    // 3. Delete item's own image from filesystem
    if (item.image) safeDeleteItemImage(item.image);

    // 4. Delete the InventoryItem itself
    await item.deleteOne();

    return res.json({ success: true, message: 'تم حذف الصنف وجميع منتجاته بنجاح' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddItem,
  postAddItem,
  getItemsByGender,
  getEditItem,
  postEditItem,
  getItemProducts,
  updateItemProducts,
  deleteItem,
};
