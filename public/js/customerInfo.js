'use strict';

/**
 * customerInfo.js
 *
 * Handles Step 1: Customer info form
 *   - Leaflet map location picker
 *   - Governorate → Area cascading dropdowns
 *   - Client-side validation
 *   - Server-side session creation + customer info save
 */

(function () {
  // ── Helper: read CSRF token from cookie ──────────────
  function getCsrf() {
    return sessionStorage.getItem('vero_csrf_token') || '';
  }

  function getSessionId() {
    return sessionStorage.getItem('vero_session_id') || '';
  }

  // ── Helper: API call ────────────────────────────────
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

  // ── Init: create session on first visit ─────────────
  async function ensureSession() {
    if (getSessionId()) return; // already have one

    try {
      const res = await fetch('/api/public/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('vero_session_id', data.sessionId);
        sessionStorage.setItem('vero_csrf_token', data.csrfToken);
      }
    } catch (e) {
      console.error('Session start failed', e);
    }
  }

  // ── Leaflet Map ─────────────────────────────────────
  function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    // Default center: Cairo
    const map = L.map('map').setView([30.0444, 31.2357], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    let marker = null;

    map.on('click', function (e) {
      const { lat, lng } = e.latlng;

      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng]).addTo(map);
      }

      document.getElementById('lat').value = lat.toFixed(6);
      document.getElementById('lng').value = lng.toFixed(6);
    });

    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
          marker = L.marker([latitude, longitude]).addTo(map);
          document.getElementById('lat').value = latitude.toFixed(6);
          document.getElementById('lng').value = longitude.toFixed(6);
        },
        function () {
          // Denied or error — keep Cairo
        },
      );
    }
  }

  // ── Cascading Dropdowns ─────────────────────────────
  function initDropdowns() {
    const govSelect = document.getElementById('governorate');
    const areaSelect = document.getElementById('area');

    govSelect.addEventListener('change', function () {
      const selected = govSelect.options[govSelect.selectedIndex];
      const areasJson = selected.getAttribute('data-areas');

      areaSelect.innerHTML = '<option value="">اختر المنطقة</option>';

      if (areasJson) {
        const areas = JSON.parse(areasJson);
        areas.forEach(function (a) {
          const opt = document.createElement('option');
          opt.value = a;
          opt.textContent = a;
          areaSelect.appendChild(opt);
        });
        areaSelect.disabled = false;
      } else {
        areaSelect.disabled = true;
      }
    });
  }

  // ── Client Validation ───────────────────────────────
  function validateForm() {
    let valid = true;
    const fields = [
      { id: 'fullName', check: (v) => v.length >= 3, msg: 'الاسم يجب أن يكون 3 أحرف على الأقل.' },
      { id: 'primaryPhone', check: (v) => /^01[0125]\d{8}$/.test(v), msg: 'رقم الهاتف غير صحيح.' },
      { id: 'governorate', check: (v) => v !== '', msg: 'اختر المحافظة.' },
      { id: 'area', check: (v) => v !== '', msg: 'اختر المنطقة.' },
      { id: 'detailedAddress', check: (v) => v.length >= 5, msg: 'العنوان يجب أن يكون 5 أحرف على الأقل.' },
      { id: 'buildingName', check: (v) => v.length > 0, msg: 'اسم أو رقم المبنى مطلوب.' },
      { id: 'floorNumber', check: (v) => v.length > 0, msg: 'رقم الطابق مطلوب.' },
      { id: 'apartmentNumber', check: (v) => v.length > 0, msg: 'رقم الشقة مطلوب.' },
    ];

    fields.forEach(function (f) {
      const el = document.getElementById(f.id);
      const errEl = document.getElementById(f.id + '-error');
      const val = el.value.trim();

      if (!f.check(val)) {
        el.classList.add('error');
        if (errEl) errEl.textContent = f.msg;
        valid = false;
      } else {
        el.classList.remove('error');
        if (errEl) errEl.textContent = '';
      }
    });

    // Optional secondary phone validation
    const secPhone = document.getElementById('secondaryPhone').value.trim();
    const secErr = document.getElementById('secondaryPhone-error');
    if (secPhone && !/^01[0125]\d{8}$/.test(secPhone)) {
      document.getElementById('secondaryPhone').classList.add('error');
      if (secErr) secErr.textContent = 'رقم الهاتف غير صحيح.';
      valid = false;
    } else {
      document.getElementById('secondaryPhone').classList.remove('error');
      if (secErr) secErr.textContent = '';
    }

    return valid;
  }

  // ── Form Submission ─────────────────────────────────
  function initForm() {
    const form = document.getElementById('customer-info-form');
    const btn = document.getElementById('btn-submit-info');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (!validateForm()) return;

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'جاري الحفظ...';

      try {
        const body = {
          sessionId: getSessionId(),
          customer: {
            fullName: document.getElementById('fullName').value.trim(),
            primaryPhone: document.getElementById('primaryPhone').value.trim(),
            secondaryPhone: document.getElementById('secondaryPhone').value.trim() || null,
          },
          address: {
            location: {
              lat: parseFloat(document.getElementById('lat').value) || null,
              lng: parseFloat(document.getElementById('lng').value) || null,
            },
            governorate: document.getElementById('governorate').value,
            area: document.getElementById('area').value,
            detailedAddress: document.getElementById('detailedAddress').value.trim(),
            landmark: document.getElementById('landmark').value.trim() || null,
            buildingName: document.getElementById('buildingName').value.trim(),
            floorNumber: document.getElementById('floorNumber').value.trim(),
            apartmentNumber: document.getElementById('apartmentNumber').value.trim(),
          },
        };

        const result = await api('PUT', '/session/customer-info', body);

        if (result.success) {
          window.location.href = '/order/products';
        } else {
          alert(result.message || 'حدث خطأ. حاول مرة أخرى.');
          btn.disabled = false;
          btn.querySelector('.btn-text').textContent = 'طلب توصيل';
        }
      } catch (err) {
        console.error(err);
        alert('حدث خطأ في الاتصال.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'طلب توصيل';
      }
    });
  }

  // ── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async function () {
    await ensureSession();
    initMap();
    initDropdowns();
    initForm();
  });
})();
