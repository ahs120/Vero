'use strict';

const Order = require('../models/Order');
const CustomerOrder = require('../models/CustomerOrder');

/**
 * Valid order statuses and allowed forward transitions.
 * pending_review → pending_preparation → pending_delivery → completed
 */
const VALID_STATUSES = [
  'pending_review',
  'pending_preparation',
  'pending_delivery',
  'completed',
];

const STATUS_TRANSITIONS = {
  pending_review:      ['pending_preparation'],
  pending_preparation: ['pending_delivery'],
  pending_delivery:    ['completed'],
  completed:           [], // terminal state
};

/**
 * Generates an atomic, unique daily order code in the format YYYYMMDD-N.
 * Uses MongoDB findOneAndUpdate with $inc to guarantee no race conditions.
 *
 * @returns {Promise<string>} e.g. "20260419-3"
 */
const generateOrderCode = async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const counter = await Counter.findOneAndUpdate(
    { date: today },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `${today}-${counter.seq}`;
};

/**
 * Fetch a paginated list of orders filtered by status and/or date.
 *
 * @param {object} opts
 * @param {string}  [opts.status]  - One of VALID_STATUSES or undefined (all)
 * @param {string}  [opts.date]    - ISO date string YYYY-MM-DD, defaults to today
 * @param {number}  [opts.page=1]  - 1-based page number
 * @param {number}  [opts.limit=20]
 * @returns {Promise<{orders: object[], total: number, page: number, pages: number}>}
 */
const getOrdersByStatusAndDate = async ({ status, date, page = 1, limit = 20 } = {}) => {
  const query = {};

  // Status filter
  if (status && VALID_STATUSES.includes(status)) {
    query.status = status;
  }

  // Date filter — default to today
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const referenceDate = targetDate
    ? new Date(targetDate)
    : new Date(new Date().toISOString().slice(0, 10));

  const dayStart = new Date(referenceDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(referenceDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  query.createdAt = { $gte: dayStart, $lte: dayEnd };

  const safePage  = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip      = (safePage - 1) * safeLimit;

  // Execute using the new CustomerOrder model
  const [customerOrders, total] = await Promise.all([
    CustomerOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    CustomerOrder.countDocuments(query),
  ]);

  // Map CustomerOrder to the identical schema expected by views/orders/index.ejs
  const mappedOrders = customerOrders.map(co => ({
    _id: co._id,
    orderCode: co.orderCode,
    orderNumber: co.orderCode, // fallback 
    status: co.status,
    customerName: (co.customer && co.customer.fullName) ? co.customer.fullName : undefined,
    totalAmount: (co.pricing && co.pricing.finalTotal) ? co.pricing.finalTotal : 0,
    items: co.items ? co.items.map(item => ({
      name: `${item.productName} (${item.selectedSize})`,
      quantity: item.quantity,
      unitPrice: item.priceAfterDiscount
    })) : [],
    transferImage: (co.payment && co.payment.paymentProofPath) ? co.payment.paymentProofPath : null,
    createdAt: co.createdAt
  }));

  return {
    orders: mappedOrders,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
    limit: safeLimit,
  };
};

/**
 * Update an order's status following the allowed transition map.
 * Throws if the transition is invalid or the order is not found.
 *
 * @param {string} id        - Order _id
 * @param {string} newStatus - Target status
 * @returns {Promise<object>} Updated order (lean)
 */
const updateOrderStatus = async (id, newStatus) => {
  if (!VALID_STATUSES.includes(newStatus)) {
    const err = new Error(`Invalid status: ${newStatus}`);
    err.statusCode = 400;
    throw err;
  }

  const order = await CustomerOrder.findById(id).lean();
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(
      `Cannot transition from "${order.status}" to "${newStatus}"`
    );
    err.statusCode = 400;
    throw err;
  }

  const updated = await CustomerOrder.findByIdAndUpdate(
    id,
    { status: newStatus },
    { new: true, runValidators: true }
  ).lean();

  return updated;
};

module.exports = {
  VALID_STATUSES,
  STATUS_TRANSITIONS,
  generateOrderCode,
  getOrdersByStatusAndDate,
  updateOrderStatus,
};
