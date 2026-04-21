/**
 * Global error-handling middleware.
 * Catches unhandled errors, logs them in development, and returns
 * either an HTML error page or JSON depending on the request type.
 */
const errorHandler = (err, req, res, _next) => {
  // Log full error in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 Error:', err);
  }

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.'
      : err.message || 'خطأ في الخادم الداخلي';

  // Render error view for page requests, JSON for API
  if (!req.path.startsWith('/api/')) {
    return res.status(statusCode).render('error', {
      title: `Error ${statusCode}`,
      statusCode,
      message,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
