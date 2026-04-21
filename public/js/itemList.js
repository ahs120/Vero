'use strict';

/**
 * public/js/itemList.js
 *
 * Handles InventoryItem deletion on /inventory/items/:gender.
 *
 * - Event delegation on the items list container (no inline handlers).
 * - Professional confirmation modal (no browser confirm()).
 * - DELETE request with CSRF-Token header.
 * - Smooth DOM removal animation.
 * - Empty-state injection after last item is deleted.
 */

document.addEventListener('DOMContentLoaded', function () {

  // ───────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────

  /** Read CSRF token from main element's data attribute */
  var mainEl = document.querySelector('main.dashboard-container[data-csrf]');
  var csrfToken = mainEl ? mainEl.dataset.csrf : '';

  /**
   * Smoothly fade-out and remove an element from the DOM.
   * @param {HTMLElement} element
   */
  function removeElementSmoothly(element) {
    element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    element.style.opacity = '0';
    element.style.transform = 'translateX(20px)';
    setTimeout(function () { element.remove(); }, 310);
  }

  /**
   * Show the empty-state block if no items remain in the list.
   * @param {HTMLElement} listContainer - The flex column items list
   */
  function checkAndShowEmptyState(listContainer) {
    if (!listContainer || listContainer.children.length > 0) return;

    // Build dynamic empty-state HTML
    var section = listContainer.closest('section');
    if (!section) return;

    var addLink = mainEl
      ? mainEl.querySelector('a[href*="add-item"]')
      : null;
    var gender = addLink
      ? (new URL(addLink.href, window.location.origin)).searchParams.get('gender') || ''
      : '';

    var emptyDiv = document.createElement('div');
    emptyDiv.id = 'empty-state-dynamic';
    emptyDiv.style.cssText = 'text-align:center;padding:48px;color:var(--gray-500);';
    emptyDiv.innerHTML =
      '<p style="font-size:1rem;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0635\u0646\u0627\u0641 \u062d\u0627\u0644\u064a\u0627\u064b \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062a\u0635\u0646\u064a\u0641.</p>' +
      '<a href="/inventory/add-item' + (gender ? '?gender=' + encodeURIComponent(gender) : '') + '" ' +
      'style="display:inline-block;margin-top:16px;background:var(--primary);color:white;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">' +
      '+ \u0625\u0636\u0627\u0641\u0629 \u0623\u0648\u0644 \u0635\u0646\u0641</a>';

    // Remove the list container and replace with empty state
    listContainer.replaceWith(emptyDiv);
  }

  // ───────────────────────────────────────────────────────
  // Modal implementation
  // ───────────────────────────────────────────────────────

  var modalEl = null;
  var lastFocusedEl = null;

  /** Inject the confirmation modal into the DOM (once) */
  function injectModal() {
    if (modalEl) return;

    var backdrop = document.createElement('div');
    backdrop.id = 'deleteItemModal';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'deleteModalTitle');
    backdrop.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;' +
      'align-items:center;justify-content:center;padding:20px;';

    backdrop.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--surface-glass-border);border-radius:16px;' +
      'max-width:460px;width:100%;padding:28px;position:relative;">' +

        // Close button
        '<button id="modalCloseBtn" type="button" aria-label="\u0625\u063a\u0644\u0627\u0642" ' +
        'style="position:absolute;top:14px;left:14px;background:none;border:none;color:var(--gray-400);' +
        'font-size:1.4rem;cursor:pointer;line-height:1;">&#x2715;</button>' +

        // Title
        '<h2 id="deleteModalTitle" style="margin:0 0 14px;font-size:1.1rem;color:var(--gray-50);">' +
        '\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u0630\u0641</h2>' +

        // Message
        '<p id="modalMessage" style="margin:0 0 10px;color:var(--gray-300);font-size:0.95rem;line-height:1.5;"></p>' +

        // Warning
        '<p style="margin:0 0 22px;color:var(--error);font-size:0.85rem;line-height:1.5;">' +
        '\u0633\u064a\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0635\u0646\u0641 \u0648\u062c\u0645\u064a\u0639 \u0645\u0646\u062a\u062c\u0627\u062a\u0647 \u0646\u0647\u0627\u0626\u064a\u0627\u064b \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u062a\u0631\u0627\u062c\u0639 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0625\u062c\u0631\u0627\u0621.</p>' +

        // Error area
        '<p id="modalError" style="display:none;margin:0 0 14px;color:var(--error);font-size:0.9rem;"></p>' +

        // Buttons
        '<div style="display:flex;gap:12px;justify-content:flex-end;">' +
          '<button id="modalCancelBtn" type="button" ' +
          'style="background:var(--surface-light);color:var(--gray-300);border:1px solid var(--surface-glass-border);' +
          'padding:10px 22px;border-radius:8px;cursor:pointer;font-size:0.95rem;">' +
          '\u0625\u0644\u063a\u0627\u0621</button>' +

          '<button id="modalConfirmBtn" type="button" ' +
          'style="background:var(--error);color:white;border:none;' +
          'padding:10px 22px;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;">' +
          '\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u0630\u0641</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);
    modalEl = backdrop;

    // Close by clicking backdrop background
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });

    // Close button
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

    // Cancel button
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);

    // Keyboard: Escape closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && modalEl.style.display === 'flex') {
        closeModal();
      }
    });
  }

  /** Open the confirmation modal for a specific item */
  function openModal(itemId, itemName, itemRow) {
    injectModal();
    lastFocusedEl = document.activeElement;

    var msgEl = document.getElementById('modalMessage');
    var errEl = document.getElementById('modalError');
    var confirmBtn = document.getElementById('modalConfirmBtn');

    // Reset state
    errEl.style.display = 'none';
    errEl.textContent = '';
    confirmBtn.disabled = false;
    confirmBtn.textContent = '\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u0630\u0641';

    // Set message using textContent to prevent XSS
    msgEl.textContent = '\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0627\u0644\u0635\u0646\u0641 "' + itemName + '"\u061f';

    // Wire up the confirm action (replace listener each time)
    var newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', function () {
      executeDelete(itemId, itemRow, newConfirmBtn);
    });

    // Show modal
    modalEl.style.display = 'flex';

    // Focus confirm button for accessibility
    setTimeout(function () { newConfirmBtn.focus(); }, 50);
  }

  /** Close the confirmation modal */
  function closeModal() {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  // ───────────────────────────────────────────────────────
  // Delete logic
  // ───────────────────────────────────────────────────────

  /**
   * Send DELETE request to server and handle result.
   * @param {string} itemId
   * @param {HTMLElement} itemRow
   * @param {HTMLButtonElement} confirmBtn
   */
  async function executeDelete(itemId, itemRow, confirmBtn) {
    // Loading state
    confirmBtn.disabled = true;
    var originalText = confirmBtn.textContent;
    confirmBtn.textContent = '...';

    var errEl = document.getElementById('modalError');
    errEl.style.display = 'none';
    errEl.textContent = '';

    try {
      var response = await fetch('/inventory/item/' + itemId, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
        },
      });

      var data;
      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || '\u062d\u062f\u062b \u062e\u0637\u0623 HTTP ' + response.status);
      }

      // Success: close modal, smoothly remove item row
      closeModal();
      var listContainer = itemRow.parentElement;
      removeElementSmoothly(itemRow);

      // Check if list is now empty
      setTimeout(function () {
        checkAndShowEmptyState(listContainer);
      }, 350);

    } catch (err) {
      console.error('deleteItem error:', err);
      errEl.textContent = '\u062d\u062f\u062b \u062e\u0637\u0623: ' + (err.message || '\u064a\u0631\u062c\u0649 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649');
      errEl.style.display = 'block';
      // Re-enable button
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
  }

  // ───────────────────────────────────────────────────────
  // Event Delegation — items list container
  // ───────────────────────────────────────────────────────

  // Support both categories page (.inv-section) and item list page (.dashboard-section)
  var delegateContainer = document.querySelector('.inv-section') ||
                          document.querySelector('.dashboard-section');
  if (!delegateContainer) return;

  delegateContainer.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="delete-item"]');
    if (!btn) return;

    var itemId   = btn.dataset.itemId;
    var itemName = btn.dataset.itemName || '\u0647\u0630\u0627 \u0627\u0644\u0635\u0646\u0641';
    var itemRow  = btn.closest('.inv-card') ||
                   btn.closest('[style*="background:var(--surface-light)"]') ||
                   btn.closest('div[style]');

    if (!itemId || !itemRow) return;

    openModal(itemId, itemName, itemRow);
  });

});
