'use strict';

/**
 * public/js/inventory.js
 * 
 * Manages product sizes via Input -> Add -> List Pattern.
 * Used in Add Product and Edit Product forms.
 * 
 * Flow:
 * - State array `sizes` holds { size, quantity }
 * - On 'Add', validate sizing (non empty string, positive number), update state, re-render
 * - Renders a visually pleasing list for UI
 * - Renders hidden inputs for form submission
 */

let sizes = [];

/**
 * Simple toast notification using DOM elements.
 */
function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'error' ? 'var(--error, #ef4444)' : 'var(--success, #22c55e)'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  `;
  document.body.appendChild(toast);
  
  // Show
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  // Hide and remove after 3s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Escape string for HTML attribute
 */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape text for HTML content
 */
function escapeHtml(str) {
  return escapeAttr(str);
}

/**
 * Renders the UI list and updates hidden inputs.
 */
function renderSizes() {
  const listContainer = document.getElementById('sizesList');
  const hiddenContainer = document.getElementById('sizesHiddenInputs');
  
  if (!listContainer || !hiddenContainer) return;
  
  // Clear containers
  listContainer.innerHTML = '';
  hiddenContainer.innerHTML = '';
  
  if (sizes.length === 0) {
    listContainer.innerHTML = '<div style="color: var(--gray-500); font-size: 0.9rem; padding: 10px; text-align: center; background: var(--surface-light); border: 1px dashed var(--surface-glass-border); border-radius: 8px;">لا توجد مقاسات مضافة. يرجى إضافة مقاس واحد على الأقل.</div>';
    return;
  }
  
  sizes.forEach((s, index) => {
    // 1. Create visually pleasing list item
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface-light); border: 1px solid var(--surface-glass-border); border-radius: 8px;';
    
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-weight: bold; color: var(--gray-50); background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 4px;">[ ${escapeHtml(s.size)} ]</span>
        <span style="color: var(--gray-300); font-size: 0.95rem;">الكمية: <strong style="color: var(--gray-50);">${s.quantity}</strong></span>
      </div>
      <button type="button" class="delete-size-btn" data-index="${index}" style="background: var(--error); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">حذف</button>
    `;
    listContainer.appendChild(row);
    
    // 2. Create hidden inputs for the form
    hiddenContainer.insertAdjacentHTML('beforeend', `
      <input type="hidden" name="sizes[${index}][size]" value="${escapeAttr(s.size)}">
      <input type="hidden" name="sizes[${index}][quantity]" value="${s.quantity}">
    `);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const sizeInput = document.getElementById('sizeInput');
  const qtyInput = document.getElementById('qtyInput');
  const addBtn = document.getElementById('addSizeBtn');
  const listContainer = document.getElementById('sizesList');
  const form = document.querySelector('form');
  
  // 1. Init existing sizes if available
  if (listContainer) {
    let existingSizes = [];

    try {
      const raw = listContainer.dataset.existingSizes;
      console.log('RAW DATA:', raw); // debug step

      if (raw && raw !== 'undefined') {
        existingSizes = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Failed to parse existing sizes', err);
      existingSizes = [];
    }

    if (Array.isArray(existingSizes) && existingSizes.length > 0) {
      existingSizes.forEach(s => {
        if (s && s.size) {
          sizes.push({
            size: s.size.trim(),
            quantity: parseInt(s.quantity, 10) || 1
          });
        }
      });
    }
  }
  
  // Initial render
  renderSizes();
  
  // 2. Handle adding new size
  if (addBtn && sizeInput && qtyInput) {
    addBtn.addEventListener('click', () => {
      const sizeVal = sizeInput.value.trim();
      const qtyVal = parseInt(qtyInput.value, 10);
      
      // Validation
      if (!sizeVal) {
        showToast('يرجى إدخال اسم المقاس', 'error');
        sizeInput.focus();
        return;
      }
      if (isNaN(qtyVal) || qtyVal <= 0) {
        showToast('يرجى إدخال كمية صحيحة (أكبر من صفر)', 'error');
        qtyInput.focus();
        return;
      }
      
      // Prevent duplicates (case-insensitive)
      const exists = sizes.some(s => s.size.toLowerCase() === sizeVal.toLowerCase());
      if (exists) {
        showToast('هذا المقاس مضاف بالفعل', 'error');
        sizeInput.focus();
        return;
      }
      
      // Add and clear
      sizes.push({ size: sizeVal, quantity: qtyVal });
      renderSizes();
      
      sizeInput.value = '';
      qtyInput.value = '';
      sizeInput.focus();
    });
  }
  
  // 3. Event delegation for deleting
  if (listContainer) {
    listContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-size-btn');
      if (deleteBtn) {
        const index = parseInt(deleteBtn.dataset.index, 10);
        if (!isNaN(index)) {
          sizes.splice(index, 1);
          renderSizes();
        }
      }
    });
  }
  
  // 4. Form Submit Validation (ensure at least one size exists)
  if (form && document.getElementById('sizesHiddenInputs')) {
    form.addEventListener('submit', (e) => {
      if (sizes.length === 0) {
        e.preventDefault();
        showToast('يرجى إضافة مقاس واحد على الأقل قبل حفظ المنتج', 'error');
        if (sizeInput) sizeInput.focus();
      }
    });
  }
});
