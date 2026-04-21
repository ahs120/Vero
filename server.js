require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const logger = require('./config/logger');
const seedAdmin = require('./seeders/adminSeeder');

// ── Admin route imports (existing) ────────────────────
const adminAuthRoutes = require('./routes/adminAuth');
const dashboardRoutes  = require('./routes/dashboard');
const analyticsRoutes  = require('./routes/analytics');
const ordersRoutes     = require('./routes/orders');
const inventoryRoutes  = require('./routes/inventory');

// ── Customer route imports (NEW) ──────────────────────
const publicPageRoutes = require('./routes/publicPages');
const publicApiRoutes  = require('./routes/publicApi');

// ── Middleware imports ────────────────────────────────
const errorHandler = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Ensure required directories exist
// ============================================

const uploadsDir = path.join(__dirname, 'uploads', 'payment-proofs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ============================================
// View Engine (EJS)
// ============================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// Request Logger (structured — Winston)
// ============================================

app.use(requestLogger);

// ============================================
// Security Middleware
// ============================================

const crypto = require('crypto');

// Generate CSP nonce per request
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Helmet: sets various HTTP security headers (CSP, X-Frame-Options, etc.)
// Updated CSP to allow Leaflet CDN + OpenStreetMap tiles for customer pages
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://unpkg.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: [
          "'self'",
          'https://unpkg.com',
          (req, res) => `'nonce-${res.locals.nonce}'`,
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https://*.tile.openstreetmap.org',
        ],
        connectSrc: ["'self'"],
      },
    },
  })
);

// CORS: restrict origins — no wildcard even in development
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5000',
    credentials: true,
  })
);

// Rate limiting: prevent brute-force attacks on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per window
  handler: (req, res) => {
    res.status(429).render('auth/login', {
      title: 'Vero Admin — Login',
      error: 'Too many login attempts. Please try again after 15 minutes.',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// Body Parsing & Sanitization
// ============================================

app.use(express.json({ limit: '10kb' }));          // Limit body size
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sanitize data to prevent MongoDB operator injection (strips $ and . from keys)
app.use(mongoSanitize());

// ============================================
// CSRF Protection (Admin only)
//
// Public customer flow uses its own Double-Submit
// Cookie CSRF — see middleware/publicCsrf.js.
// We skip csurf for /api/public/* and /order/*
// ============================================

app.use(session({
  secret: process.env.SESSION_SECRET || 'yourSecretKey',
  resave: false,
  saveUninitialized: false,
}));

const csrf = require('csurf');
const csrfProtection = csrf();

// Conditional CSRF: only apply csurf to admin routes
const conditionalCsrf = (req, res, next) => {
  // Skip csurf for public customer routes — they have their own CSRF.
  //
  // IMPORTANT: We check for '/order/' (with trailing slash) or exact '/order'
  // to avoid matching '/orders' (the admin orders page).
  //   '/order'          → customer landing  → SKIP csurf  ✓
  //   '/order/info'     → customer info     → SKIP csurf  ✓
  //   '/orders'         → admin orders page → APPLY csurf ✓
  //   '/orders/:id/...' → admin order AJAX  → APPLY csurf ✓
  if (
    req.path.startsWith('/api/public') ||
    req.path === '/order' ||
    req.path.startsWith('/order/')
  ) {
    return next();
  }
  csrfProtection(req, res, next);
};

app.use(conditionalCsrf);

app.use((req, res, next) => {
  // Only set csrfToken for admin routes that have csurf active
  if (typeof req.csrfToken === 'function') {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

// ============================================
// Static Files (CSS, JS assets only)
// ============================================

app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// Routes — Customer (Public, NO auth)
// ============================================
// IMPORTANT: These MUST be mounted BEFORE admin
// routes so /order/* is handled before the admin
// catch-all redirect.

// Customer-facing pages (NO auth, NO admin CSRF)
app.use('/order', publicPageRoutes);

// Customer-facing API (own CSRF, own rate limiting)
app.use('/api/public', publicApiRoutes);

// ============================================
// Routes — Admin (Protected, existing)
// ============================================

// Apply rate limiter specifically to login endpoint
app.use('/admin/login', loginLimiter);

// Mount the main router (handles /, /admin/login, /admin/logout)
app.use('/', adminAuthRoutes);

// Dashboard routes (/dashboard only — inventory routes moved to dedicated router)
app.use('/', dashboardRoutes);

// Inventory routes (/inventory, /inventory/:section, /inventory/:section/:itemId, CRUD)
app.use('/', inventoryRoutes);

// Analytics routes (/analytics, /analytics/add-expense)
app.use('/', analyticsRoutes);

// Orders routes (/orders, /orders/:id/status)
app.use('/', ordersRoutes);

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist.',
  });
});

// ============================================
// Global Error Handler
// ============================================

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send('Invalid CSRF Token');
  }
  next(err);
});

app.use(errorHandler);

// ============================================
// Start Server
// ============================================

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Seed admin account on first run
    await seedAdmin();

    // Initialize file-type module (ESM dynamic import)
    const fileValidator = require('./middleware/fileValidator');
    await fileValidator.init();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`Vero Server running on port ${PORT}`);
      console.log(`\n🚀 Vero Server running on http://localhost:${PORT}`);
      console.log(`📋 Admin Login:    http://localhost:${PORT}/`);
      console.log(`📊 Dashboard:      http://localhost:${PORT}/dashboard`);
      console.log(`🛒 Customer Order: http://localhost:${PORT}/order\n`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};
startServer();
