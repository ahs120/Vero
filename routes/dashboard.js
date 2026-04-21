"use strict";

const express = require("express");

const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Route (all /inventory routes moved to routes/inventory.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /dashboard
 * @desc    Main dashboard: orders, inventory categories, sales summary
 * @access  Private
 */
router.get("/dashboard", verifyToken, dashboardController.getDashboard);

module.exports = router;
