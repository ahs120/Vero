"use strict";

const dashboardService = require("../services/dashboardService");

/**
 * @desc  Render the main dashboard page
 *        (Orders section + Inventory categories + Sales summary)
 * @route GET /dashboard
 * @access Private
 */
const getDashboard = async (req, res, next) => {
  try {
    const [orderStats, salesStats, expenses] = await Promise.all([
      dashboardService.getOrderStats(),
      dashboardService.getSalesStats(),
      dashboardService.getExpensesTotal(),
    ]);

    const categories = dashboardService.getInventoryCategories();
    const profit = salesStats.total - expenses;

    return res.render("dashboard/index", {
      title: "Vero Admin — لوحة التحكم",
      description: "لوحة تحكم Vero الرئيسية",
      admin: req.admin,
      orderStats,
      categories,
      sales: salesStats.byStatus,
      salesTotal: salesStats.total,
      expenses,
      profit,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
};
