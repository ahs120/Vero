'use strict';

const { validationResult } = require('express-validator');
const orderService = require('../services/orderService');

const STATUS_LABELS = {
  pending_review: 'قيد المراجعة',
  pending_preparation: 'قيد التحضير',
  pending_delivery: 'قيد التوصيل',
  completed: 'مكتملة',
};

// ─────────────────────────────────────────────────────────
// GET /orders?status=&date=&page=
// ─────────────────────────────────────────────────────────
const getOrders = async (req, res, next) => {
  try {
    const { status, date, page } = req.query;

    // Sanitize status
    const activeStatus = orderService.VALID_STATUSES.includes(status) ? status : null;

    // Sanitize date (must be YYYY-MM-DD)
    const activeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

    // Default to today if no date supplied
    const displayDate = activeDate || new Date().toISOString().slice(0, 10);

    const result = await orderService.getOrdersByStatusAndDate({
      status: activeStatus,
      date: displayDate,
      page: page,
      limit: 20,
    });

    res.render('orders/index', {
      title: 'Vero Admin — الطلبات',
      description: 'صفحة الطلبات',
      admin: req.admin,
      csrfToken: req.csrfToken(),
      orders: result.orders,
      total: result.total,
      currentPage: result.page,
      totalPages: result.pages,
      activeStatus,
      displayDate,
      VALID_STATUSES: orderService.VALID_STATUSES,
      STATUS_LABELS,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// POST /orders/:id/status
// ─────────────────────────────────────────────────────────
const updateStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { status } = req.body;

    // ID basic sanity check
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ success: false, message: 'معرّف الطلب غير صحيح' });
    }

    const updated = await orderService.updateOrderStatus(id, status);

    res.json({
      success: true,
      message: `تم تحديث حالة الطلب إلى "${STATUS_LABELS[status] || status}"`,
      order: {
        _id: updated._id,
        status: updated.status,
        label: STATUS_LABELS[updated.status],
      },
    });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 404) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};
const CustomerOrder = require('../models/CustomerOrder');

// ─────────────────────────────────────────────────────────
// GET /orders/:id
// ─────────────────────────────────────────────────────────
const getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(404).render('error', {
        title: 'Order Not Found',
        statusCode: 404,
        message: 'معرّف الطلب غير صحيح',
      });
    }

    const order = await CustomerOrder.findById(id).lean();

    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found',
        statusCode: 404,
        message: 'الطلب غير موجود',
      });
    }

    res.render('orders/details', {
      title: 'Vero Admin — تفاصيل الطلب',
      description: 'Order Details',
      admin: req.admin,
      csrfToken: req.csrfToken(),
      order,
      STATUS_LABELS,
      STATUS_TRANSITIONS: orderService.STATUS_TRANSITIONS
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getOrders, updateStatus, getOrderDetails };
