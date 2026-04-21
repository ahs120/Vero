/**
 * Vero Admin — Login Page Client-Side Logic
 *
 * Handles:
 * - Frontend input validation (empty fields, suspicious patterns)
 * - Password visibility toggle
 * - Form submission via native HTML form POST (method="POST" action="/admin/login")
 * - Error/success message display
 *
 * NOTE: No token handling — authentication is cookie-only (httpOnly).
 * The form submits natively as URL-encoded data. The server handles
 * redirect on success and re-renders the login view with errors on failure.
 */

(function () {
  'use strict';

  // ============================================
  // DOM References
  // ============================================

  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  const usernameGroup = document.getElementById('usernameGroup');
  const passwordGroup = document.getElementById('passwordGroup');
  const loginBtn = document.getElementById('loginBtn');
  const passwordToggle = document.getElementById('passwordToggle');
  const eyeOpen = passwordToggle.querySelector('.eye-open');
  const eyeClosed = passwordToggle.querySelector('.eye-closed');

  // ============================================
  // Suspicious Pattern Detection
  // ============================================

  /**
   * Patterns that indicate potential injection attempts.
   * Blocks MongoDB operators ($, {}) and HTML/JS tags (<, >).
   */
  const SUSPICIOUS_PATTERNS = /[<>{}$]/;

  /**
   * Check if a string contains suspicious injection patterns.
   * @param {string} value - The input string to check.
   * @returns {boolean} True if suspicious patterns are found.
   */
  function hasSuspiciousPatterns(value) {
    return SUSPICIOUS_PATTERNS.test(value);
  }

  // ============================================
  // Validation Functions
  // ============================================

  /**
   * Validate the username field.
   * @returns {boolean} True if valid.
   */
  function validateUsername() {
    const value = usernameInput.value.trim();

    if (!value) {
      showFieldError(usernameGroup, usernameError, 'اسم المستخدم مطلوب.');
      return false;
    }

    if (value.length < 3 || value.length > 30) {
      showFieldError(usernameGroup, usernameError, 'يجب أن يكون اسم المستخدم بين 3 و 30 حرفًا.');
      return false;
    }

    if (hasSuspiciousPatterns(value)) {
      showFieldError(usernameGroup, usernameError, 'اسم المستخدم يحتوي على أحرف غير صالحة.');
      return false;
    }

    clearFieldError(usernameGroup, usernameError);
    return true;
  }

  /**
   * Validate the password field.
   * @returns {boolean} True if valid.
   */
  function validatePassword() {
    const value = passwordInput.value;

    if (!value) {
      showFieldError(passwordGroup, passwordError, 'كلمة المرور مطلوبة.');
      return false;
    }

    if (value.length < 8) {
      showFieldError(passwordGroup, passwordError, 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.');
      return false;
    }

    clearFieldError(passwordGroup, passwordError);
    return true;
  }

  // ============================================
  // UI Helpers
  // ============================================

  /**
   * Display an error on a form field.
   */
  function showFieldError(group, errorSpan, message) {
    group.classList.add('error');
    errorSpan.textContent = message;
  }

  /**
   * Clear the error state from a form field.
   */
  function clearFieldError(group, errorSpan) {
    group.classList.remove('error');
    errorSpan.textContent = '';
  }

  /**
   * Toggle loading state on the submit button.
   * @param {boolean} loading - Whether to show loading state.
   */
  function setLoading(loading) {
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    loginBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoader.style.display = loading ? 'inline-flex' : 'none';
  }

  // ============================================
  // Password Toggle
  // ============================================

  passwordToggle.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeOpen.style.display = isPassword ? 'none' : 'block';
    eyeClosed.style.display = isPassword ? 'block' : 'none';
  });

  // ============================================
  // Real-time Validation (on blur)
  // ============================================

  usernameInput.addEventListener('blur', validateUsername);
  passwordInput.addEventListener('blur', validatePassword);

  // Clear errors on input
  usernameInput.addEventListener('input', () => clearFieldError(usernameGroup, usernameError));
  passwordInput.addEventListener('input', () => clearFieldError(passwordGroup, passwordError));

  // ============================================
  // Form Submission
  // ============================================

  form.addEventListener('submit', (e) => {
    // --- Client-side validation ---
    const isUsernameValid = validateUsername();
    const isPasswordValid = validatePassword();

    if (!isUsernameValid || !isPasswordValid) {
      // Prevent native form submission if client-side validation fails
      e.preventDefault();
      return;
    }

    // Validation passed — show loading spinner and let the form submit natively.
    // The browser will POST to /admin/login as URL-encoded form data.
    // The server will either redirect to /dashboard (success) or
    // re-render the login page with an error message (failure).
    setLoading(true);
  });
})();
