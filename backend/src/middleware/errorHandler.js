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
function errorHandler(req, res, next) { // BUG B5: missing 'err' as first param
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}

module.exports = errorHandler;
