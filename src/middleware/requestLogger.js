// middlewares/requestLogger.js
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    logger.info({
      type: 'request',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      clinicId: req.clinic?.id || null,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
}

module.exports = requestLogger;