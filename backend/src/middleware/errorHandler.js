/**
 * Global Express error-handling middleware.
 *
 * ============================================================
 * BUG B5: This function only has 3 parameters (req, res, next).
 * Express identifies error handlers by their ARITY (4 params).
 * With only 3 params, Express treats this as a regular middleware,
 * NOT an error handler — errors passed via next(err) are silently
 * dropped and the request hangs or falls through to Express's
 * default handler, which returns plain-text 500 HTML, not JSON.
 * ============================================================
 *
 * FIX: Change signature to (err, req, res, next)
 */
function errorHandler(err, req, res, next) { // BUG B5: missing 'err' as first param
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode;
  }
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
}

module.exports = errorHandler;
