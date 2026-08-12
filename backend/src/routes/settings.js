const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Get system status
router.get('/status', (req, res) => {
  res.json({
    dbConnected: mongoose.connection.readyState === 1,
    backendUp: true,
    aiProvider: 'Claude',
    aiConfigured: !!process.env.ANTHROPIC_API_KEY,
    githubConfigured: true
  });
});

// Dynamically discover all API endpoints
router.get('/endpoints', (req, res) => {
  const routes = [];
  const app = req.app;
  if (!app || !app._router || !app._router.stack) {
    return res.json({ endpoints: [] });
  }

  app._router.stack.forEach((middleware) => {
    if (middleware.name === 'router' && middleware.regexp) {
      // Guess the base path from Express router regexp
      let prefix = '';
      const match = middleware.regexp.toString().match(/^\/\^\\(\/.*?)\\\/\?\(\?\=\\\/\|\$\)\/i/);
      if (match) {
        prefix = match[1].replace(/\\/g, ''); 
      }

      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase());
          methods.forEach(method => {
            const fullPath = prefix + (path === '/' ? '' : path);
            routes.push({
              method,
              path: fullPath,
              describeKey: `${method} ${fullPath}`
            });
          });
        }
      });
    }
  });

  // Filter out internal/meta endpoints to keep the monitor focused on user/product APIs
  const filtered = routes.filter(r => 
    !r.path.startsWith('/api/settings') && 
    !r.path.startsWith('/api/repairs') &&
    !r.path.startsWith('/api/github')
  );

  res.json({ endpoints: filtered });
});

module.exports = router;
