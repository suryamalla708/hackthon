/**
 * errorCapture.js — Phase 2 error logging middleware
 *
 * This middleware has a proper 4-parameter signature and IS recognized by
 * Express as an error handler (unlike errorHandler.js which has Bug B5).
 *
 * It logs every error as structured JSON to stdout so the Phase 2 failure
 * collector can parse it. After logging, it passes the error forward via
 * next(err) to demonstrate that the broken errorHandler (B5) still fails.
 *
 * IMPORTANT: This does NOT fix Bug B5 — it only adds observability.
 */
function errorCapture(err, req, res, next) {
  const timestamp = new Date().toISOString();

  // Structured JSON error log — parsed by collectFailures.js
  const errorLog = {
    type: 'EXPRESS_ERROR',
    timestamp,
    request: {
      method: req.method,
      path: req.originalUrl,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      },
      body: req.body,
    },
    error: {
      name: err.name || 'Error',
      message: err.message,
      status: err.status || err.statusCode || 500,
      stack: err.stack,
      // Mongoose validation errors have a .errors object
      validationErrors: err.errors
        ? Object.entries(err.errors).map(([field, e]) => ({
            field,
            message: e.message,
            kind: e.kind,
            value: e.value,
          }))
        : undefined,
    },
  };

  console.error(`[CAPTURE] ${JSON.stringify(errorLog)}`);

  // Pass to next error handler — errorHandler.js has Bug B5 (3 params)
  // so Express will ignore it and use its own default 500 handler
  next(err);
}

module.exports = errorCapture;
