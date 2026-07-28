let app;
try {
  app = require('../backend/server.js');
} catch (err) {
  console.error('❌ Failed to load backend/server.js:', err);
  app = (req, res) => {
    res.status(500).json({
      error: 'Failed to load backend server module',
      message: err.message,
      stack: err.stack
    });
  };
}

module.exports = app;
