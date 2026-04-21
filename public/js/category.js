document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const configData = document.querySelector(".config-data");
  if (!configData) return;

  const sectionSlug = configData.dataset.category;        // e.g., 'men', 'women'
  const categorySlug = configData.dataset.categorySlug;  // e.g., 't-shirts', 'dresses'
  const csrfToken = configData.dataset.csrf;
  const productsList = document.querySelector(".products-list");

  if (!productsList) return; // no products on page

  // تحميل البيانات
  let productsMap = {};

  try {
    const raw = document.getElementById('products-data');
    if (raw) {
      const data = JSON.parse(raw.textContent);
      data.forEach(p => {
        productsMap[p._id] = p;
      });
    }
  } catch (e) {
    console.error('Failed to load products data', e);
  }

  // ─────────────────────────────────────────────
  // Delete countdown timers
  // ─────────────────────────────────────────────
  const deleteTimers = {};

  const requestDelete = (id, btn) => {
    const wrapper = btn.closest(".delete-wrapper");
    const overlay = wrapper.querySelector(".confirm-overlay");
    const confirmBtn = wrapper.querySelector(".confirm-delete-btn");
    const countdownText = wrapper.querySelector(".countdown-text");

    overlay.style.display = "flex";
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = "0.5";
    confirmBtn.style.cursor = "not-allowed";
    countdownText.style.display = "block";
    let count = 3;
    countdownText.textContent = count;

    if (deleteTimers[id]) clearInterval(deleteTimers[id]);
    deleteTimers[id] = setInterval(() => {
      count--;
      if (count > 0) {
        countdownText.textContent = count;
      } else {
        clearInterval(deleteTimers[id]);
        delete deleteTimers[id];
        countdownText.style.display = "none";
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
        confirmBtn.style.cursor = "pointer";
      }
    }, 1000);
  };

  const cancelDelete = (btn) => {
    const wrapper = btn.closest(".delete-wrapper");
    const overlay = wrapper.querySelector(".confirm-overlay");
    for (const id in deleteTimers) {
      clearInterval(deleteTimers[id]);
      delete deleteTimers[id];
    }
    overlay.style.display = "none";
  };

  const executeDelete = async (id, btn) => {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "...";

    try {
      const response = await fetch(`/inventory/${sectionSlug}/${categorySlug}/products/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": csrfToken,
        },
      });

      let data;
      try { data = await response.json(); } catch (_) { data = {}; }

      if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      // Smooth removal from DOM
      const row = btn.closest(".product-row");
      if (row) {
        row.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        row.style.opacity = "0";
        row.style.transform = "translateX(20px)";
        setTimeout(() => row.remove(), 310);
      }
    } catch (err) {
      console.error("deleteProduct error:", err);
      // Show error inside the confirm overlay instead of alert()
      const wrapper = btn.closest(".delete-wrapper");
      if (wrapper) {
        const overlay = wrapper.querySelector(".confirm-overlay");
        let errSpan = overlay ? overlay.querySelector(".delete-error-msg") : null;
        if (overlay && !errSpan) {
          errSpan = document.createElement("span");
          errSpan.className = "delete-error-msg";
          errSpan.style.cssText = "color:var(--error);font-size:0.8rem;display:block;margin-top:4px;";
          overlay.appendChild(errSpan);
        }
        if (errSpan) {
          errSpan.textContent = "خطأ: " + (err.message || "يرجى المحاولة مرة أخرى");
        }
      }
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  // ─────────────────────────────────────────────
  // View Product Modal (lazy-injected on first open)
  // ─────────────────────────────────────────────
  let modalInjected = false;
  let backdropEl = null;
  let lastFocusedElement = null;

  /** Inject modal HTML into DOM once */
  const injectModal = () => {
    if (modalInjected) return;
    modalInjected = true;

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "تفاصيل المنتج");
    backdrop.innerHTML = `
      <div class="modal-card" style="position: relative;">
        <button class="modal-close-btn" data-modal-close type="button" aria-label="إغلاق">×</button>
        <div id="modalImages" class="modal-images-row"></div>
        <div class="modal-field">
          <div class="modal-field-label">اسم المنتج</div>
          <div class="modal-field-value" id="modalName" style="font-size: 1.3rem; font-weight: 700;"></div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">التصنيف</div>
          <div class="modal-field-value" id="modalCategory"></div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">الوصف</div>
          <div class="modal-field-value" id="modalDescription" style="line-height: 1.6;"></div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">المقاسات والكمية</div>
          <ul class="modal-size-list" id="modalSizes"></ul>
        </div>
        <div style="display: flex; gap: 24px;">
          <div class="modal-field" style="flex: 1;">
            <div class="modal-field-label">السعر</div>
            <div class="modal-field-value" id="modalPrice"></div>
          </div>
          <div class="modal-field" style="flex: 1;">
            <div class="modal-field-label">الخصم</div>
            <div class="modal-field-value" id="modalDiscount"></div>
          </div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">إجمالي المخزون</div>
          <div class="modal-field-value" id="modalStock"></div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">تاريخ الإنشاء</div>
          <div class="modal-field-value" id="modalCreatedAt"></div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdropEl = backdrop;

    // Close on backdrop click
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Close on close button
    backdrop
      .querySelector("[data-modal-close]")
      .addEventListener("click", closeModal);
  };

  /** Open modal and populate with product data */
  const openModal = (productData) => {
    injectModal();
    lastFocusedElement = document.activeElement;

    // Images
    const imagesContainer = backdropEl.querySelector("#modalImages");
    imagesContainer.innerHTML = "";
    if (productData.images && productData.images.length > 0) {
      productData.images.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = productData.name;
        imagesContainer.appendChild(img);
      });
    } else {
      imagesContainer.innerHTML =
        '<span style="color: var(--gray-500);">بدون صور</span>';
    }

    // Fields
    backdropEl.querySelector("#modalName").textContent = productData.name || "";
    backdropEl.querySelector("#modalCategory").textContent =
      productData.category || "";
    backdropEl.querySelector("#modalDescription").textContent =
      productData.description || "";

    // Sizes & Quantities
    const sizesList = backdropEl.querySelector("#modalSizes");
    sizesList.innerHTML = "";
    let totalStock = 0;
    if (productData.sizes && productData.sizes.length > 0) {
      productData.sizes.forEach((s) => {
        const li = document.createElement("li");
        if (typeof s === "object" && s !== null) {
          const qty = s.quantity || 1;
          totalStock += qty;
          li.textContent = `${s.size || s} × ${qty} قطعة`;
        } else {
          totalStock += 1;
          li.textContent = `${s} × 1 قطعة`;
        }
        sizesList.appendChild(li);
      });
    } else {
      sizesList.innerHTML =
        '<li style="color: var(--gray-500);">لا توجد مقاسات</li>';
    }

    backdropEl.querySelector("#modalPrice").textContent =
      `${productData.price} ج.م`;
    const discount = productData.discount || 0;
    backdropEl.querySelector("#modalDiscount").textContent =
      discount > 0 ? `${discount}%` : "لا يوجد";

    backdropEl.querySelector("#modalStock").textContent =
      totalStock > 0 ? `${totalStock} قطعة` : "غير محدد";

    // Format date in Arabic
    if (productData.createdAt) {
      try {
        const date = new Date(productData.createdAt);
        backdropEl.querySelector("#modalCreatedAt").textContent =
          date.toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
      } catch (e) {
        backdropEl.querySelector("#modalCreatedAt").textContent =
          productData.createdAt;
      }
    }

    // Show modal
    backdropEl.classList.add("is-open");

    // Focus trap
    document.addEventListener("keydown", modalKeyHandler);
    // Focus the close button
    const closeBtn = backdropEl.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  };

  /** Close modal and restore focus */
  const closeModal = () => {
    if (!backdropEl) return;
    backdropEl.classList.remove("is-open");
    document.removeEventListener("keydown", modalKeyHandler);
    if (lastFocusedElement) lastFocusedElement.focus();
  };

  /** Keyboard handler for modal: Escape to close, Tab focus trap */
  const modalKeyHandler = (e) => {
    if (e.key === "Escape") {
      closeModal();
      return;
    }
    if (e.key === "Tab" && backdropEl) {
      const focusable = backdropEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  // ─────────────────────────────────────────────
  // Event delegation on products-list container
  // ─────────────────────────────────────────────
  productsList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const productId = btn.dataset.productId;

    switch (action) {
      case "view": {
        const row = btn.closest(".product-row");
        const rowId = row ? row.getAttribute("data-product-id") : null;
        if (!rowId) return;
        try {
          const productData = productsMap[rowId];
          if (productData) {
            openModal(productData);
          } else {
            console.error('Product not found');
          }
        } catch (parseErr) {
          console.error("Failed to read product data:", parseErr);
        }
        break;
      }
      case "edit": {
        // New route: /inventory/:sectionSlug/:categorySlug/products/:id/edit
        window.location.href = `/inventory/${sectionSlug}/${categorySlug}/products/${productId}/edit`;
        break;
      }
      case "delete-request": {
        requestDelete(productId, btn);
        break;
      }
      case "confirm-delete": {
        executeDelete(productId, btn);
        break;
      }
      case "cancel-delete": {
        cancelDelete(btn);
        break;
      }
    }
  });
});
