'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// file-type is ESM-only from v17+. We use dynamic import.
let fileTypeFromFile;

/**
 * Initialise the ESM file-type module.
 * Must be called once at startup (see server.js).
 */
const init = async () => {
  const mod = await import('file-type');
  fileTypeFromFile = mod.fileTypeFromFile;
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Post-upload middleware:
 *   1. Validates magic bytes (not trusting MIME or extension)
 *   2. Strips EXIF / metadata via sharp
 *   3. Rejects and deletes suspicious files
 */
const validateAndSanitizeUpload = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملف.',
    });
  }

  const filePath = req.file.path;

  try {
    // 1. Magic byte check
    const type = fileTypeFromFile
      ? await fileTypeFromFile(filePath)
      : null;

    if (!type || !ALLOWED_TYPES.has(type.mime)) {
      fs.unlinkSync(filePath);
      logger.warn('File upload rejected: invalid magic bytes', {
        ip: req.ip,
        claimed: req.file.mimetype,
        actual: type ? type.mime : 'unknown',
      });
      return res.status(400).json({
        success: false,
        message: 'نوع الملف غير مسموح. يُسمح فقط بصور JPEG و PNG و WebP.',
      });
    }

    // 2. Strip metadata + re-encode via sharp
    //    (We dynamically require sharp so the rest of the app
    //     still works if sharp fails to install on some systems.)
    try {
      const sharp = require('sharp');
      const sanitizedBuffer = await sharp(filePath)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      fs.writeFileSync(filePath, sanitizedBuffer);
    } catch (sharpErr) {
      // sharp not available — log warning but allow the file
      logger.warn('sharp unavailable, skipping metadata strip', {
        error: sharpErr.message,
      });
    }

    next();
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    logger.error('File processing error', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'فشل في معالجة الملف.',
    });
  }
};

module.exports = { init, validateAndSanitizeUpload };
