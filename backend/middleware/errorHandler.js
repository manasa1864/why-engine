const config = require('../config');
const logger = require('../utils/logger');

// 404 handler
exports.notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};

// Global error handler
exports.errorHandler = (err, req, res, next) => {
  logger.error('Server', err.message, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
  });
};
