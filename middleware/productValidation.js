"use strict";

const { body, validationResult } = require("express-validator");
const Product = require("../models/Product");
const dashboardService = require("../services/dashboardService");

/**
 * Validation rules for the create/update product endpoint.
 * - Trims and escapes inputs to prevent XSS/HTML injection.
 * - Validates types, lengths, and required fields.
 * - Sizes validated as array of { size: string, quantity: number ≥ 1 }.
 */
const productValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required.")
    .isLength({ max: 200 })
    .withMessage("Product name cannot exceed 200 characters.")
    .escape(),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required.")
    .escape(),

  body("price")
    .notEmpty()
    .withMessage("Price is required.")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number."),

  body("discount")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Discount must be a positive number."),

  body("sizes")
    .optional()
    .customSanitizer((value) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // fallback — not valid JSON
        }
      }
      return value;
    })
    .isArray()
    .withMessage("Sizes must be an array.")
    .custom((value) => {
      // Each entry must be { size: string, quantity: number ≥ 1 }
      if (!Array.isArray(value)) return true; // handled by isArray above
      for (const entry of value) {
        if (typeof entry !== "object" || entry === null) {
          throw new Error(
            "Each size entry must be an object with size and quantity.",
          );
        }
        if (typeof entry.size !== "string" || entry.size.trim() === "") {
          throw new Error("Each size must have a non-empty label.");
        }
        const qty = Number(entry.quantity);
        if (!Number.isFinite(qty) || qty < 1) {
          throw new Error("Quantity must be a positive number.");
        }
      }
      return true;
    }),
];

/**
 * Middleware: check validation results and re-render the appropriate form
 * with the error message. Detects add vs edit route to render the correct view.
 */
const validateProduct = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    try {
      const firstError = errors.array()[0];
      const { category } = req.params;
      const isEditRoute = req.originalUrl.includes("/edit");
      const categories = dashboardService.getInventoryCategories();
      const currentCategory = categories.find((c) => c.slug === category);

      if (isEditRoute) {
        // Re-render edit form — fetch current product data to pre-populate
        const { id } = req.params;
        const product = await Product.findOne({ _id: id, category }).lean();
        return res.status(422).render("inventory/editProduct", {
          title: `Vero Admin — تعديل: ${product ? product.name : "منتج"}`,
          description: "تعديل بيانات المنتج",
          admin: req.admin,
          category,
          categoryLabel: currentCategory ? currentCategory.label : category,
          product: product || {},
          csrfToken: req.csrfToken(),
          error: firstError.msg,
          formData: req.body,
        });
      }

      // Add product form
      return res.status(422).render("inventory/addProduct", {
        title: `Vero Admin — Add Product (${currentCategory ? currentCategory.label : category})`,
        description: "إضافة منتج جديد",
        admin: req.admin,
        category,
        categoryLabel: currentCategory ? currentCategory.label : category,
        csrfToken: req.csrfToken(),
        error: firstError.msg,
      });
    } catch (err) {
      return next(err);
    }
  }

  next();
};

module.exports = {
  productValidationRules,
  validateProduct,
};
