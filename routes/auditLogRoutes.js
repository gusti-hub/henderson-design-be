// routes/auditLogRoutes.js
// Add these routes to your existing orderRoutes.js
// OR mount this as a separate router.
//
// If using separate file, in app.js / server.js add:
//   const auditLogRoutes = require('./routes/auditLogRoutes');
//   app.use('/api/orders', auditLogRoutes);
//
// If adding to orderRoutes.js, copy the route definitions
// into the file after the `router.use(protect)` line.

const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');

const {
  getAuditLog,
  getProductAuditLog,
  rollbackAuditEntry,
  getAuditStats,
} = require('../controllers/auditLogController');

// All audit routes are protected
router.use(protect);

// Full order audit log (paginated)
// GET /api/orders/:orderId/audit-log?page=1&limit=50&productId=xxx
router.get('/:orderId/audit-log', getAuditLog);

// Stats summary
// GET /api/orders/:orderId/audit-log/stats
router.get('/:orderId/audit-log/stats', getAuditStats);

// Product-specific audit log
// GET /api/orders/:orderId/audit-log/product/:productId
router.get('/:orderId/audit-log/product/:productId', getProductAuditLog);

// Rollback a specific log entry
// POST /api/orders/:orderId/audit-log/:logId/rollback
router.post('/:orderId/audit-log/:logId/rollback', rollbackAuditEntry);

module.exports = router;