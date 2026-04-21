'use strict';

/**
 * productOrder.js
 *
 * Handles Step 2: Product selection + cart
 *   - Fetches products from /api/public/products
 *   - Renders product cards with size/qty selectors
 *   - Cart management (add/remove/update)
 *   - Promo code AJAX validation
 *   - Saves cart to server-side session
 */

(function () {
  let cart = []; // { productId, productName, selectedSize, quantity, priceBeforeDiscount, priceAfterDiscount, product }
  let products = [];

  // ── Helpers ─────────────────────────────────────────
  function getCsrf() { return sessionStorage.getItem('vero_csrf_token') || ''; }
  function getSessionId() { return sessionStorage.getItem('vero_session_id') || ''; }

  async function api(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': getCsrf(),
      },
      credentials: 'same-origin',
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api/public' + path, opts);
    return res.json();
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Fetch Products ──────────────────────────────────
  async function loadProducts() {
    const loading = document.getElementById('products-loading');
    const grid = document.getElementById('products-grid');

    try {
      const data = await api('GET', '/products');
      loading.style.display = 'none';

      if (!data.success || !data.products.length) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">لا توجد منتجات متاحة حاليًا.</p>';
        return;
      }

      products = data.products;
      renderProducts();
    } catch (err) {
      loading.innerHTML = '<p style="color:var(--error);">فشل تحميل المنتجات.</p>';
    }
  }

  // ── Render Product Cards ────────────────────────────
  function renderProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    products.forEach(function (p) {
      const priceAfter = p.price - (p.discount || 0);
      const hasDiscount = p.discount > 0;
      const imgSrc = p.images && p.images.length > 0
        ? '/uploads/products/' + p.images[0]
        : '';
      const imgTag = imgSrc
        ? '<img src="' + esc(imgSrc) + '" alt="' + esc(p.name) + '" class="product-card-img" />'
        : '<div class="product-card-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">لا توجد صورة</div>';

      const sizeBtns = p.sizes.map(function (s) {
        return '<button type="button" class="size-btn" data-size="' + esc(s.size) + '" data-qty="' + s.quantity + '">' + esc(s.size) + '</button>';
      }).join('');

      const card = document.createElement('div');
      card.className = 'product-card';
      card.setAttribute('data-product-id', p._id);
      card.innerHTML =
        imgTag +
        '<div class="product-card-body">' +
          '<h3 class="product-card-name">' + esc(p.name) + '</h3>' +
          '<div class="product-card-price">' +
            (hasDiscount ? '<span class="price-original">' + p.price + ' ج.م</span>' : '') +
            '<span class="price-discounted">' + priceAfter + ' ج.م</span>' +
          '</div>' +
          '<div class="product-card-sizes">' + sizeBtns + '</div>' +
          '<div class="qty-controls">' +
            '<button type="button" class="qty-btn qty-minus">−</button>' +
            '<span class="qty-value">1</span>' +
            '<button type="button" class="qty-btn qty-plus">+</button>' +
          '</div>' +
          '<button type="button" class="btn-add-cart" disabled>أضف للسلة</button>' +
        '</div>';

      grid.appendChild(card);

      // Size selection
      const sizeBtnEls = card.querySelectorAll('.size-btn');
      let selectedSize = null;

      sizeBtnEls.forEach(function (btn) {
        btn.addEventListener('click', function () {
          sizeBtnEls.forEach(function (b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
          selectedSize = btn.getAttribute('data-size');
          card.querySelector('.btn-add-cart').disabled = false;
        });
      });

      // Quantity controls
      const qtyEl = card.querySelector('.qty-value');
      let qty = 1;

      card.querySelector('.qty-minus').addEventListener('click', function () {
        if (qty > 1) qty--;
        qtyEl.textContent = qty;
      });

      card.querySelector('.qty-plus').addEventListener('click', function () {
        if (qty < 99) qty++;
        qtyEl.textContent = qty;
      });

      // Add to cart
      card.querySelector('.btn-add-cart').addEventListener('click', function () {
        if (!selectedSize) return;

        const existIdx = cart.findIndex(function (ci) {
          return ci.productId === p._id && ci.selectedSize === selectedSize;
        });

        const priceB = p.price * qty;
        const priceA = (p.price - (p.discount || 0)) * qty;

        if (existIdx !== -1) {
          cart[existIdx].quantity += qty;
          cart[existIdx].priceBeforeDiscount = p.price * cart[existIdx].quantity;
          cart[existIdx].priceAfterDiscount = (p.price - (p.discount || 0)) * cart[existIdx].quantity;
        } else {
          cart.push({
            productId: p._id,
            productName: p.name,
            selectedSize: selectedSize,
            quantity: qty,
            priceBeforeDiscount: priceB,
            priceAfterDiscount: priceA,
            product: p,
          });
        }

        renderCart();
      });
    });
  }

  // ── Render Cart ─────────────────────────────────────
  function renderCart() {
    const emptyEl = document.getElementById('cart-empty');
    const tableWrap = document.getElementById('cart-table-wrap');
    const tbody = document.getElementById('cart-body');
    const btnPayment = document.getElementById('btn-to-payment');

    if (cart.length === 0) {
      emptyEl.style.display = 'block';
      tableWrap.style.display = 'none';
      btnPayment.disabled = true;
      updateSummary();
      return;
    }

    emptyEl.style.display = 'none';
    tableWrap.style.display = 'block';
    btnPayment.disabled = false;

    tbody.innerHTML = '';
    cart.forEach(function (item, idx) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(item.productName) + '</td>' +
        '<td>' + esc(item.selectedSize) + '</td>' +
        '<td>' + item.quantity + '</td>' +
        '<td>' + item.priceBeforeDiscount + ' ج.م</td>' +
        '<td style="color:var(--accent);font-weight:600;">' + item.priceAfterDiscount + ' ج.م</td>' +
        '<td><button class="cart-remove-btn" data-idx="' + idx + '">✕</button></td>';
      tbody.appendChild(tr);
    });

    // Remove buttons
    tbody.querySelectorAll('.cart-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-idx'));
        cart.splice(idx, 1);
        renderCart();
      });
    });

    updateSummary();
  }

  // ── Update Summary ──────────────────────────────────
  function updateSummary() {
    let totalBefore = 0;
    let totalAfter = 0;

    cart.forEach(function (item) {
      totalBefore += item.priceBeforeDiscount;
      totalAfter += item.priceAfterDiscount;
    });

    document.getElementById('total-before').textContent = totalBefore + ' ج.م';
    document.getElementById('total-after').textContent = totalAfter + ' ج.م';
    document.getElementById('final-total').textContent = totalAfter + ' ج.م';

    // Enable promo code input if cart has items
    const promoInput = document.getElementById('promo-code');
    const promoBtn = document.getElementById('btn-apply-promo');
    if (cart.length > 0) {
      promoInput.addEventListener('input', function () {
        promoBtn.disabled = promoInput.value.trim().length === 0;
      });
    }
  }

  // ── Promo Code ──────────────────────────────────────
  function initPromo() {
    const promoBtn = document.getElementById('btn-apply-promo');
    const promoInput = document.getElementById('promo-code');
    const promoMsg = document.getElementById('promo-message');

    promoBtn.addEventListener('click', async function () {
      const code = promoInput.value.trim();
      if (!code) return;

      promoBtn.disabled = true;
      promoBtn.textContent = '...';

      try {
        // First save cart to session so server knows the total
        await saveCartToSession();

        const result = await api('POST', '/promo/validate', {
          sessionId: getSessionId(),
          code: code,
        });

        if (result.success) {
          promoMsg.textContent = result.message;
          promoMsg.className = 'promo-message success';
          document.getElementById('final-total').textContent =
            result.promo.finalTotal + ' ج.م';
        } else {
          promoMsg.textContent = result.message;
          promoMsg.className = 'promo-message error';
        }
      } catch (e) {
        promoMsg.textContent = 'خطأ في الاتصال.';
        promoMsg.className = 'promo-message error';
      }

      promoBtn.disabled = false;
      promoBtn.textContent = 'تطبيق';
    });
  }

  // ── Save Cart to Server ─────────────────────────────
  async function saveCartToSession() {
    const items = cart.map(function (c) {
      return {
        productId: c.productId,
        selectedSize: c.selectedSize,
        quantity: c.quantity,
      };
    });

    return api('PUT', '/session/cart', {
      sessionId: getSessionId(),
      items: items,
    });
  }

  // ── Proceed to Payment ──────────────────────────────
  function initPaymentButton() {
    const btn = document.getElementById('btn-to-payment');

    btn.addEventListener('click', async function () {
      if (cart.length === 0) return;

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'جاري الحفظ...';

      try {
        const result = await saveCartToSession();

        if (result.success) {
          window.location.href = '/order/payment';
        } else {
          alert(result.message || 'حدث خطأ.');
          btn.disabled = false;
          btn.querySelector('.btn-text').textContent = 'تأكيد الطلب';
        }
      } catch (e) {
        alert('خطأ في الاتصال.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'تأكيد الطلب';
      }
    });
  }

  // ── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    if (!getSessionId()) {
      window.location.href = '/order/info';
      return;
    }

    loadProducts();
    initPromo();
    initPaymentButton();
  });
})();
