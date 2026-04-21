"use strict";

const fs = require("fs");
const path = require("path");
const Product = require("../models/Product");
const InventoryItem = require("../models/InventoryItem");
const dashboardService = require("../services/dashboardService");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "products");

/**
 * Safely resolve and validate a file path under the uploads directory.
 * Prevents path-traversal attacks by ensuring the resolved path
 * stays within UPLOAD_DIR.
 * @param {string} relativePath - The relative image path stored in DB
 * @returns {string|null} Absolute path if safe, null otherwise
 */
const safeImagePath = (relativePath) => {
  const resolved = path.resolve(UPLOAD_DIR, path.basename(relativePath));
  if (resolved.startsWith(UPLOAD_DIR)) return resolved;
  return null;
};

/**
 * Validate uploaded file MIME types (not just extension).
 * @param {object[]} files - multer file objects
 * @returns {string|null} Error message in Arabic if invalid, null if OK
 */
const validateImageMimes = (files) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];
  for (const file of files) {
    if (!allowed.includes(file.mimetype)) {
      return `نوع ملف غير مسموح: ${file.originalname} (${file.mimetype})`;
    }
  }
  return null;
};

/**
 * Parse sizes from the request body.
 * Accepts JSON string or already-parsed array of {size, quantity} objects.
 * Throws an Error if a size is invalid or quantity < 1 (requested).
 * @param {*} raw - req.body.sizes value
 * @returns {Array<{size: string, quantity: number}>}
 */
const parseSizes = (raw) => {
  let sizes = raw || [];
  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch (e) {
      sizes = [];
    }
  }
  if (!Array.isArray(sizes)) sizes = [sizes];

  const parsed = [];
  for (const entry of sizes) {
    if (entry && typeof entry === "object" && entry.size && entry.size.trim() !== "") {
      const quantity = parseInt(entry.quantity, 10);
      if (isNaN(quantity) || quantity < 1) {
        throw new Error('Quantity must be greater than 0');
      }
      parsed.push({ size: entry.size.trim(), quantity });
    }
  }
  return parsed;
};

/**
 * @desc Render the Add Product form
 * @route GET /inventory/:sectionSlug/:categorySlug/products/add
 */
const getAddProductForm = async (req, res, next) => {
  try {
    const { sectionSlug, categorySlug } = req.params;
    console.log('[productController] getAddProductForm — sectionSlug:', sectionSlug, 'categorySlug:', categorySlug);

    // Validate section exists
    if (!dashboardService.VALID_CATEGORIES.has(sectionSlug)) {
      return res.status(404).render("error", {
        title: "الصفحة غير موجودة",
        statusCode: 404,
        message: "القسم المطلوب غير موجود.",
      });
    }

    // Fetch the category (InventoryItem) by slug and verify it belongs to the section
    const item = await InventoryItem.findOne({ slug: categorySlug, gender: sectionSlug }).lean();
    if (!item) {
      return res.status(404).render("error", {
        title: "الصنف غير موجود",
        statusCode: 404,
        message: "الصنف المطلوب غير موجود أو لا ينتمي لهذا القسم.",
      });
    }

    const categories = dashboardService.getInventoryCategories();
    const currentSection = categories.find((c) => c.slug === sectionSlug);

    res.render("inventory/addProduct", {
      title: `Vero Admin — إضافة منتج في: ${item.name}`,
      description: "إضافة منتج جديد",
      admin: req.admin,
      sectionSlug,
      sectionLabel: currentSection ? currentSection.label : sectionSlug,
      categorySlug,
      item, // Pass the full item object (includes _id for itemId)
      csrfToken: req.csrfToken(),
      error: req.flashError || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create a new product
 * @route POST /inventory/:sectionSlug/:categorySlug/products/add
 */
const createProduct = async (req, res, next) => {
  try {
    const { sectionSlug, categorySlug } = req.params;

    // Validate section exists
    if (!dashboardService.VALID_CATEGORIES.has(sectionSlug)) {
      return res.status(404).render("error", {
        title: "الصفحة غير موجودة",
        statusCode: 404,
        message: "القسم المطلوب غير موجود.",
      });
    }

    // Fetch the category (InventoryItem) to get its _id
    const item = await InventoryItem.findOne({ slug: categorySlug, gender: sectionSlug }).lean();
    if (!item) {
      return res.status(404).render("error", {
        title: "الصنف غير موجود",
        statusCode: 404,
        message: "الصنف المطلوب غير موجود أو لا ينتمي لهذا القسم.",
      });
    }

    // 1. Validate total uploaded images size (<= 5MB)
    if (req.files && req.files.length > 0) {
      const totalSize = req.files.reduce((acc, file) => acc + file.size, 0);
      if (totalSize > 5 * 1024 * 1024) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
        req.flashError = "مجموع كل الصور يجب ألا يتجاوز 5 ميجابايت";
        return getAddProductForm(req, res, next);
      }

      // Validate MIME types server-side
      const mimeError = validateImageMimes(req.files);
      if (mimeError) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
        req.flashError = mimeError;
        return getAddProductForm(req, res, next);
      }
    }

    // 2. Process images
    const images = req.files
      ? req.files.map((f) => `/uploads/products/${f.filename}`)
      : [];

    // 3. Process sizes (new format: [{size, quantity}])
    const sizes = parseSizes(req.body.sizes);

    // 4. Create the product with automatic category linking
    // itemId is auto-set from the URL params, not from user input
    const newProduct = await Product.create({
      name: req.body.name,
      description: req.body.description,
      category: sectionSlug,
      sizes: sizes,
      price: parseFloat(req.body.price),
      discount: req.body.discount ? parseFloat(req.body.discount) : 0,
      images: images,
      itemId: item._id, // Auto-linked to the category from URL
    });

    console.log(`[productController] Product created: ${newProduct._id} linked to item: ${item._id}`);

    // Redirect to the category products page (where the product will now appear)
    res.redirect(`/inventory/${sectionSlug}/${categorySlug}`);
  } catch (error) {
    console.error("Error creating product:", error);
    // Map known Mongoose errors to user-friendly Arabic messages
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      req.flashError = messages.join(" — ");
      return getAddProductForm(req, res, next);
    }
    if (error.message === 'Quantity must be greater than 0') {
      req.flashError = error.message;
      return getAddProductForm(req, res, next);
    }
    next(error);
  }
};

/**
 * @desc Render the Edit Product form, pre-populated with current data
 * @route GET /inventory/:sectionSlug/:categorySlug/products/:id/edit
 */
const getEditProductForm = async (req, res, next) => {
  try {
    const { sectionSlug, categorySlug, id } = req.params;

    // Validate section exists
    if (!dashboardService.VALID_CATEGORIES.has(sectionSlug)) {
      return res.status(404).render("error", {
        title: "الصفحة غير موجودة",
        statusCode: 404,
        message: "القسم المطلوب غير موجود.",
      });
    }

    // Fetch the category to verify it exists and belongs to the section
    const item = await InventoryItem.findOne({ slug: categorySlug, gender: sectionSlug }).lean();
    if (!item) {
      return res.status(404).render("error", {
        title: "الصنف غير موجود",
        statusCode: 404,
        message: "الصنف المطلوب غير موجود أو لا ينتمي لهذا القسم.",
      });
    }

    // Fetch product by _id AND verify it belongs to the section/category
    const product = await Product.findOne({ _id: id, category: sectionSlug }).lean();

    if (!product) {
      return res.status(404).render("error", {
        title: "المنتج غير موجود",
        statusCode: 404,
        message: "المنتج المطلوب غير موجود أو لا ينتمي لهذا القسم/الصنف.",
      });
    }

    const categories = dashboardService.getInventoryCategories();
    const currentSection = categories.find((c) => c.slug === sectionSlug);

    res.render("inventory/editProduct", {
      title: `Vero Admin — تعديل: ${product.name}`,
      description: "تعديل بيانات المنتج",
      admin: req.admin,
      sectionSlug,
      sectionLabel: currentSection ? currentSection.label : sectionSlug,
      categorySlug,
      item, // Pass the full item object
      product,
      csrfToken: req.csrfToken(),
      error: req.flashError || null,
      formData: req.flashFormData || {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update an existing product
 * @route POST /inventory/:sectionSlug/:categorySlug/products/:id/edit
 */
const updateProduct = async (req, res, next) => {
  try {
    const { sectionSlug, categorySlug, id } = req.params;

    // Validate section exists
    if (!dashboardService.VALID_CATEGORIES.has(sectionSlug)) {
      return res.status(404).render("error", {
        title: "الصفحة غير موجودة",
        statusCode: 404,
        message: "القسم المطلوب غير موجود.",
      });
    }

    // Fetch the category to verify it exists and belongs to the section
    const item = await InventoryItem.findOne({ slug: categorySlug, gender: sectionSlug }).lean();
    if (!item) {
      return res.status(404).render("error", {
        title: "الصنف غير موجود",
        statusCode: 404,
        message: "الصنف المطلوب غير موجود أو لا ينتمي لهذا القسم.",
      });
    }

    // 1. Validate total uploaded images size (<= 5MB)
    if (req.files && req.files.length > 0) {
      const totalSize = req.files.reduce((acc, file) => acc + file.size, 0);
      if (totalSize > 5 * 1024 * 1024) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
        req.flashError = "مجموع كل الصور يجب ألا يتجاوز 5 ميجابايت";
        req.flashFormData = req.body;
        return getEditProductForm(req, res, next);
      }

      const mimeError = validateImageMimes(req.files);
      if (mimeError) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
        req.flashError = mimeError;
        req.flashFormData = req.body;
        return getEditProductForm(req, res, next);
      }
    }

    // 2. Process new images (append to existing)
    const newImages = req.files
      ? req.files.map((f) => `/uploads/products/${f.filename}`)
      : [];

    // 3. Process images to remove (comma-separated filenames from hidden field)
    const imagesToRemoveRaw = req.body.imagesToRemove || "";
    const imagesToRemove = imagesToRemoveRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    // 4. Process sizes (new format)
    const sizes = parseSizes(req.body.sizes);

    // 5. Build update object
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      sizes: sizes,
      price: parseFloat(req.body.price),
      discount: req.body.discount ? parseFloat(req.body.discount) : 0,
      // Ensure itemId stays linked to the current category (from URL)
      itemId: item._id,
    };

    // 6. Fetch current product to merge images (verify it belongs to section)
    const currentProduct = await Product.findOne({ _id: id, category: sectionSlug }).lean();
    if (!currentProduct) {
      return res.status(404).render("error", {
        title: "المنتج غير موجود",
        statusCode: 404,
        message: "المنتج المطلوب غير موجود أو لا ينتمي لهذا التصنيف.",
      });
    }

    // Remove specified images from the list and delete from disk
    let existingImages = currentProduct.images || [];
    const keptImages = existingImages.filter(
      (img) => !imagesToRemove.includes(path.basename(img)),
    );

    // Delete removed image files from disk (with path-traversal protection)
    for (const imgName of imagesToRemove) {
      const safePath = safeImagePath(imgName);
      if (safePath && fs.existsSync(safePath)) {
        try {
          fs.unlinkSync(safePath);
        } catch (unlinkErr) {
          console.error(
            "Failed to delete image file:",
            safePath,
            unlinkErr.message,
          );
        }
      }
    }

    updateData.images = [...keptImages, ...newImages];

    // 7. Perform the update
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, category: sectionSlug },
      updateData,
      { new: true, runValidators: true },
    );

    if (!updatedProduct) {
      return res.status(404).render("error", {
        title: "المنتج غير موجود",
        statusCode: 404,
        message: "المنتج المطلوب غير موجود أو لا ينتمي لهذا القسم/الصنف.",
      });
    }

    console.log(`[productController] Product updated: ${updatedProduct._id} linked to item: ${item._id}`);

    // Redirect to the category products page
    res.redirect(`/inventory/${sectionSlug}/${categorySlug}`);
  } catch (error) {
    console.error("Error updating product:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      req.flashError = messages.join(" — ");
      req.flashFormData = req.body;
      return getEditProductForm(req, res, next);
    }
    if (error.message === 'Quantity must be greater than 0') {
      req.flashError = error.message;
      req.flashFormData = req.body;
      return getEditProductForm(req, res, next);
    }
    next(error);
  }
};

/**
 * @desc Delete a product
 * @route DELETE /inventory/:sectionSlug/:categorySlug/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { sectionSlug, categorySlug, id } = req.params;

    // Validate the category exists and belongs to the section
    const item = await InventoryItem.findOne({ slug: categorySlug, gender: sectionSlug }).lean();
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "الصنف المطلوب غير موجود أو لا ينتمي لهذا القسم.",
      });
    }

    const product = await Product.findOneAndDelete({
      _id: id,
      category: sectionSlug,
    });

    if (!product) {
      return res
        .status(404)
        .json({
          success: false,
          message: "المنتج غير موجود أو لا ينتمي لهذا القسم.",
        });
    }

    // Remove associated image files from disk (with path-traversal protection)
    if (product.images && product.images.length > 0) {
      product.images.forEach((imagePath) => {
        const fullPath = path.join(__dirname, "..", "public", imagePath);
        // Ensure resolved path is under public/uploads/products
        const resolved = path.resolve(fullPath);
        const allowedDir = path.resolve(
          path.join(__dirname, "..", "public", "uploads", "products"),
        );
        if (resolved.startsWith(allowedDir) && fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
        }
      });
    }

    res.json({ success: true, message: "تم حذف المنتج بنجاح." });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء الحذف." });
  }
};

module.exports = {
  getAddProductForm,
  createProduct,
  getEditProductForm,
  updateProduct,
  deleteProduct,
};
