'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────
// EXISTING: Product image upload (multi-file, no size cap
// here — checked in controller against 5MB total)
// ─────────────────────────────────────────────────────────

const productUploadPath = path.join(__dirname, '../public/uploads/products');
if (!fs.existsSync(productUploadPath)) {
  fs.mkdirSync(productUploadPath, { recursive: true });
}

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Default export — used by existing product routes
const upload = multer({
  storage: productStorage,
  fileFilter: imageFileFilter,
});

// ─────────────────────────────────────────────────────────
// NEW: Single-image upload for InventoryItems & Expenses
// Hard 1 MB per-file limit, saves to public/uploads/items/
// ─────────────────────────────────────────────────────────

const itemUploadPath = path.join(__dirname, '../public/uploads/items');
if (!fs.existsSync(itemUploadPath)) {
  fs.mkdirSync(itemUploadPath, { recursive: true });
}

const itemStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, itemUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadItem = multer({
  storage: itemStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB hard cap
  fileFilter: imageFileFilter,
});

// ─────────────────────────────────────────────────────────
// PAYMENT PROOF: Secure upload OUTSIDE /public directory.
// Files are NOT directly accessible via URL — served only
// through a controlled endpoint with token verification.
// ─────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');

const paymentProofPath = path.join(__dirname, '../uploads/payment-proofs');
if (!fs.existsSync(paymentProofPath)) {
  fs.mkdirSync(paymentProofPath, { recursive: true });
}

const paymentProofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, paymentProofPath),
  filename: (req, file, cb) => {
    // UUID filename — original name never stored
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `proof-${uuidv4()}${ext}`);
  },
});

// Strict MIME filter — only JPEG, PNG, WebP
const paymentProofFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WebP images are allowed.'), false);
  }
  cb(null, true);
};

const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB hard cap
  fileFilter: paymentProofFilter,
});

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

module.exports = upload;                             // backwards-compatible default
module.exports.uploadItem = uploadItem;              // inventory items
module.exports.uploadPaymentProof = uploadPaymentProof; // payment proofs (secure)
