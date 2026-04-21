'use strict';

const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const Expense = require('../models/Expense');

// ─────────────────────────────────────────────
// Category metadata — single source of truth
// Maps English slug → Arabic display label
// ─────────────────────────────────────────────
const INVENTORY_CATEGORIES = [
  { slug: 'women',    label: 'حريمي' },
  { slug: 'men',      label: 'رجالي' },
  { slug: 'kids',     label: 'أطفال' },
  { slug: 'perfumes', label: 'عطور'  },
  { slug: 'sports',   label: 'رياضي' },
];

const VALID_CATEGORIES = new Set(INVENTORY_CATEGORIES.map((c) => c.slug));

/**
 * Returns order counts grouped by status.
 *
 * MongoDB pipeline:
 *   $group by status → count each group
 *   Then massage into a flat object for easy view access.
 *
 * @returns {Promise<{pending_review: number, preparing: number, delivering: number, completed: number}>}
 */
const getOrderStats = async () => {
  const pipeline = [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ];

  const results = await Order.aggregate(pipeline);

  // Build defaults so the view always has a value, even with an empty collection
  const stats = {
    pending_review:      0,
    pending_preparation: 0,
    pending_delivery:    0,
    completed:           0,
  };

  for (const row of results) {
    if (Object.prototype.hasOwnProperty.call(stats, row._id)) {
      stats[row._id] = row.count;
    }
  }

  return stats;
};

/**
 * Returns the static list of inventory categories with their Arabic labels.
 * This is pure metadata — no DB call needed.
 *
 * @returns {Array<{slug: string, label: string}>}
 */
const getInventoryCategories = () => INVENTORY_CATEGORIES;

/**
 * Returns sub-categories for a given category slug.
 * Only used on the inventory category page.
 *
 * MongoDB pipeline:
 *   $match category → $group by subCategory → distinct list
 *
 * @param {string} category - Validated category slug
 * @returns {Promise<string[]>}
 */
const getSubCategories = async (category) => {
  const pipeline = [
    { $match: { category } },
    {
      $group: {
        _id: '$subCategory',
      },
    },
    { $sort: { _id: 1 } },
  ];

  const results = await Inventory.aggregate(pipeline);
  return results.map((r) => r._id);
};

/**
 * Returns sales revenue grouped by order status + grand total.
 *
 * MongoDB pipeline:
 *   $group by status → sum totalAmount per group
 *   + one extra $group for grand total
 *
 * @returns {Promise<{
 *   byStatus: {pending_review: number, preparing: number, delivering: number, completed: number},
 *   total: number
 * }>}
 */
const getSalesStats = async () => {
  const pipeline = [
    {
      $group: {
        _id: '$status',
        revenue: { $sum: '$totalAmount' },
      },
    },
  ];

  const results = await Order.aggregate(pipeline);

  const byStatus = {
    pending_review:      0,
    pending_preparation: 0,
    pending_delivery:    0,
    completed:           0,
  };

  let total = 0;

  for (const row of results) {
    if (Object.prototype.hasOwnProperty.call(byStatus, row._id)) {
      byStatus[row._id] = row.revenue;
    }
    total += row.revenue;
  }

  return { byStatus, total };
};

/**
 * Returns the total sum of all expenses.
 *
 * MongoDB pipeline:
 *   $group all → $sum amount
 *
 * @returns {Promise<number>}
 */
const getExpensesTotal = async () => {
  const pipeline = [
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ];

  const result = await Expense.aggregate(pipeline);
  return result.length > 0 ? result[0].total : 0;
};

/**
 * Builds the complete analytics payload for the analytics page.
 * Combines sales + expenses and computes profit.
 *
 * @returns {Promise<{sales: object, expenses: number, profit: number}>}
 */
const getAnalyticsData = async () => {
  const [salesStats, expenses] = await Promise.all([
    getSalesStats(),
    getExpensesTotal(),
  ]);

  const profit = salesStats.total - expenses;

  return {
    sales:    salesStats,
    expenses,
    profit,
  };
};

module.exports = {
  getOrderStats,
  getInventoryCategories,
  getSubCategories,
  getSalesStats,
  getExpensesTotal,
  getAnalyticsData,
  INVENTORY_CATEGORIES,
  VALID_CATEGORIES,
};
