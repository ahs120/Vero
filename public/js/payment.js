'use strict';

/**
 * payment.js
 *
 * Handles Step 3: Payment method selection + order submission
 *   - Payment method card selection
 *   - COD deposit calculation (50%)
 *   - Payment proof file upload
 *   - Final order submission with idempotency key
 */

(function () {
  let selectedMethod = null;
  let fileUploaded = false;

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

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ── Load Session Data ───────────────────────────────
  async function loadSessionData() {
    try {
      const data = await api('GET', '/session/' + getSessionId());
      if (!data.success) {
        window.location.href = '/order/info';
        return;
      }

      const pricing = data.session.pricing || {};

      document.getElementById('payment-total').textContent =
        (pricing.totalAfterDiscount || 0) + ' ج.م';

      if (pricing.promoCode && pricing.promoDiscount > 0) {
        document.getElementById('promo-row').style.display = 'flex';
        document.getElementById('payment-promo-discount').textContent =
          '- ' + pricing.promoDiscount + ' ج.م';
      }

      document.getElementById('payment-final').textContent =
        (pricing.finalTotal || pricing.totalAfterDiscount || 0) + ' ج.م';
    } catch (e) {
      console.error('Failed to load session', e);
    }
  }

  // ── Payment Method Selection ────────────────────────
  function initPaymentMethods() {
    const radios = document.querySelectorAll('.payment-radio');
    const codSection = document.getElementById('cod-deposit-section');
    const submitBtn = document.getElementById('btn-submit-order');

    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        selectedMethod = radio.value;
        submitBtn.disabled = false;

        if (selectedMethod === 'cash_on_delivery') {
          codSection.style.display = 'block';
          // Calculate 50% deposit
          const finalText = document.getElementById('payment-final').textContent;
          const total = parseFloat(finalText.replace(/[^\d.]/g, '')) || 0;
          const deposit = Math.ceil(total * 0.5);
          document.getElementById('deposit-amount').textContent = deposit + ' ج.م';
        } else {
          codSection.style.display = 'none';
        }
      });
    });
  }

  // ── File Upload ─────────────────────────────────────
  function initUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('payment-proof-file');
    const placeholder = document.getElementById('upload-placeholder');
    const preview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-img');
    const removeBtn = document.getElementById('btn-remove-upload');
    const errorEl = document.getElementById('upload-error');

    uploadArea.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', async function () {
      const file = fileInput.files[0];
      if (!file) return;

      // Client-side checks
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        errorEl.textContent = 'نوع الملف غير مسموح. يُسمح فقط بـ JPEG, PNG, WebP.';
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        errorEl.textContent = 'حجم الملف يتجاوز الحد الأقصى (2 ميجا).';
        return;
      }

      errorEl.textContent = '';

      // Upload to server
      const formData = new FormData();
      formData.append('paymentProof', file);
      formData.append('sessionId', getSessionId());

      try {
        const res = await fetch('/api/public/upload/payment-proof', {
          method: 'POST',
          headers: {
            'x-csrf-token': getCsrf(),
          },
          credentials: 'same-origin',
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          // Show preview
          const reader = new FileReader();
          reader.onload = function (e) {
            previewImg.src = e.target.result;
            placeholder.style.display = 'none';
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
          fileUploaded = true;
        } else {
          errorEl.textContent = data.message || 'فشل رفع الملف.';
        }
      } catch (e) {
        errorEl.textContent = 'خطأ في رفع الملف.';
      }
    });

    removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fileInput.value = '';
      preview.style.display = 'none';
      placeholder.style.display = 'block';
      fileUploaded = false;
    });
  }

  // ── Order Submission ────────────────────────────────
  function initSubmit() {
    const btn = document.getElementById('btn-submit-order');

    btn.addEventListener('click', async function () {
      if (!selectedMethod) {
        alert('اختر طريقة الدفع أولاً.');
        return;
      }

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'جاري الإرسال...';

      try {
        const idempotencyKey = generateUUID();

        const res = await fetch('/api/public/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrf(),
            'x-idempotency-key': idempotencyKey,
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            sessionId: getSessionId(),
            paymentMethod: selectedMethod,
          }),
        });

        const data = await res.json();

        if (data.success) {
          // Store result for confirmation page
          sessionStorage.setItem('vero_order_result', JSON.stringify({
            orderCode: data.order.orderCode,
            trackingToken: data.order.trackingToken,
            finalTotal: data.order.finalTotal,
            depositRequired: data.order.depositRequired,
          }));

          window.location.href = '/order/confirm';
        } else {
          alert(data.message || 'حدث خطأ. حاول مرة أخرى.');
          btn.disabled = false;
          btn.querySelector('.btn-text').textContent = 'إتمام الطلب';
        }
      } catch (e) {
        alert('خطأ في الاتصال. حاول مرة أخرى.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'إتمام الطلب';
      }
    });
  }

  // ── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    if (!getSessionId()) {
      window.location.href = '/order/info';
      return;
    }

    loadSessionData();
    initPaymentMethods();
    initUpload();
    initSubmit();
  });
})();
