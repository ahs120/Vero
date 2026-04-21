'use strict';

const { governorates } = require('../config/egyptData');

/**
 * Public page controllers — render EJS views for the customer flow.
 * These are completely isolated from admin controllers.
 * No admin middleware, no admin data, no admin navigation.
 */

// GET /order — Landing page
const renderLanding = (req, res) => {
  res.render('customer/landing', {
    title: 'Vero — اطلب الآن',
    description: 'اطلب منتجاتك من Vero بسهولة',
  });
};

// GET /order/info — Customer info form
const renderCustomerInfo = (req, res) => {
  res.render('customer/info', {
    title: 'Vero — بيانات العميل',
    description: 'أدخل بياناتك وعنوان التوصيل',
    governorates: governorates.map((g) => ({
      name: g.name,
      areas: g.areas,
    })),
  });
};

// GET /order/products — Product listing + cart
const renderProducts = (req, res) => {
  res.render('customer/products', {
    title: 'Vero — اختر منتجاتك',
    description: 'اختر المنتجات وأضفها إلى السلة',
  });
};

// GET /order/payment — Payment method selection
const renderPayment = (req, res) => {
  res.render('customer/payment', {
    title: 'Vero — طريقة الدفع',
    description: 'اختر طريقة الدفع المناسبة',
  });
};

// GET /order/confirm — Confirmation page
const renderConfirmation = (req, res) => {
  res.render('customer/confirmation', {
    title: 'Vero — تأكيد الطلب',
    description: 'تم تقديم طلبك بنجاح',
  });
};

module.exports = {
  renderLanding,
  renderCustomerInfo,
  renderProducts,
  renderPayment,
  renderConfirmation,
};
