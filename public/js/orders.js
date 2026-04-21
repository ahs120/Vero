'use strict';

/**
 * ── STATUS TRANSITION MAP (mirrors server-side logic) ──
 */
const STATUS_TRANSITIONS = {
  pending_review:      ['pending_preparation'],
  pending_preparation: ['pending_delivery'],
  pending_delivery:    ['completed'],
  completed:           [],
};

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.order-row').forEach(function(row) {
    // Add event listener to each row safely without inline handlers
    row.addEventListener('click', function() {
      const orderId = row.getAttribute('data-id');
      if (orderId) {
        window.location.href = '/orders/' + orderId;
      }
    });

    // Support keyboard accessibility (Enter key)
    row.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        const orderId = row.getAttribute('data-id');
        if (orderId) {
          window.location.href = '/orders/' + orderId;
        }
      }
    });
  });
});

/** AJAX call to update order status. Used in details page */
async function changeStatus(orderId, newStatus, newLabel) {
  const btn = document.getElementById('changeStatusBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/orders/${orderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': window.__CSRF,
      },
      body: JSON.stringify({ status: newStatus, _csrf: window.__CSRF }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || 'حدث خطأ أثناء تحديث الحالة');
      if (btn) btn.disabled = false;
      return;
    }

    // Refresh the page to show new status and update UI cleanly
    window.location.reload();

  } catch (err) {
    alert('خطأ في الاتصال بالخادم');
    if (btn) btn.disabled = false;
  }
}
