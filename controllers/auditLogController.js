// controllers/auditLogController.js
// Handles:
//   GET  /api/orders/:orderId/audit-log          — full order history (paginated)
//   GET  /api/orders/:orderId/audit-log/product/:productId — product-specific history
//   POST /api/orders/:orderId/audit-log/:logId/rollback   — rollback one log entry

const OrderAuditLog = require('../models/OrderAuditLog');
const Order         = require('../models/Order');
const { logOrderChanges } = require('../utils/auditLogger');

// ── Helper: apply a single rollback to an order and save ─────────────────────
// We find the log entry, extract its `changes`, and for each change we
// patch the field back to oldValue on the matching product (or order level).
const applyRollback = async (order, logEntry) => {
  const { action, productId, changes } = logEntry;

  if (action === 'order_field_changed') {
    changes.forEach(change => {
      if (change.oldValue !== undefined) {
        order[change.field] = change.oldValue;
      }
    });
    return;
  }

  if (action === 'product_edited') {
    const product = (order.selectedProducts || []).find(
      p => p._id?.toString() === productId
    );
    if (!product) throw new Error(`Product ${productId} not found in order`);

    changes.forEach(change => {
      const { field, oldValue } = change;
      if (field.startsWith('selectedOptions.')) {
        const optField = field.slice('selectedOptions.'.length);
        if (!product.selectedOptions) product.selectedOptions = {};
        product.selectedOptions[optField] = oldValue;
      } else {
        product[field] = oldValue;
      }
    });
    return;
  }

  if (action === 'product_added') {
    // Rollback an add → remove the product
    order.selectedProducts = (order.selectedProducts || []).filter(
      p => p._id?.toString() !== productId
    );
    return;
  }

  if (action === 'product_removed') {
    // Rollback a remove → we cannot restore without a snapshot.
    // We stored the product name/id only, so we cannot fully restore.
    throw new Error(
      'Cannot rollback a product removal — the full product snapshot was not stored. ' +
      'Please re-add the product manually.'
    );
  }
};

// ── GET /api/orders/:orderId/audit-log ────────────────────────────────────────
// Returns paginated audit log entries for the whole order.
// Query params: page (default 1), limit (default 50), productId (filter)
const getAuditLog = async (req, res) => {
  try {
    const { orderId } = req.params;
    const page       = Math.max(1, parseInt(req.query.page)  || 1);
    const limit      = Math.min(200, parseInt(req.query.limit) || 50);
    const productId  = req.query.productId || null;

    const query = { orderId };
    if (productId) query.productId = productId;

    const [total, logs] = await Promise.all([
      OrderAuditLog.countDocuments(query),
      OrderAuditLog.find(query)
        .populate('performedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[auditLog] getAuditLog error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/orders/:orderId/audit-log/product/:productId ─────────────────────
// Returns all audit events for a specific product within an order.
const getProductAuditLog = async (req, res) => {
  try {
    const { orderId, productId } = req.params;

    const logs = await OrderAuditLog.find({ orderId, productId })
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[auditLog] getProductAuditLog error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/orders/:orderId/audit-log/:logId/rollback ───────────────────────
// Rolls back the changes in the specified log entry.
// Creates a new audit log entry for the rollback action.
const rollbackAuditEntry = async (req, res) => {
  try {
    const { orderId, logId } = req.params;

    // ── 1. Fetch the log entry to roll back ──────────────────────────────────
    const logEntry = await OrderAuditLog.findOne({ _id: logId, orderId });
    if (!logEntry) {
      return res.status(404).json({ message: 'Audit log entry not found' });
    }

    if (logEntry.action === 'rollback') {
      return res.status(400).json({
        message: 'Cannot rollback a rollback entry. Locate the original edit to roll back.'
      });
    }

    // ── 2. Load the order ────────────────────────────────────────────────────
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Snapshot before rollback
    const beforeSnapshot = order.toObject();

    // ── 3. Apply rollback ────────────────────────────────────────────────────
    await applyRollback(order, logEntry);
    order.updatedBy = req.user.id;
    const savedOrder = await order.save();

    // Snapshot after rollback
    const afterSnapshot = savedOrder.toObject();

    // ── 4. Write rollback audit entry ────────────────────────────────────────
    // Invert changes: oldValue ↔ newValue to show what changed in the rollback
    const rollbackChanges = logEntry.changes.map(c => ({
      field:    c.field,
      label:    c.label,
      oldValue: c.newValue,   // was the "after" value
      newValue: c.oldValue,   // restored to the "before" value
    }));

    await OrderAuditLog.create({
      orderId,
      performedBy:     req.user.id,
      performedByName: req.user.name || 'Unknown',
      action:          'rollback',
      productId:       logEntry.productId || null,
      productName:     logEntry.productName || null,
      changes:         rollbackChanges,
      rollbackOf:      logEntry._id,
    });

    console.log(`[audit] Rollback of ${logId} applied by ${req.user.name || req.user.id}`);

    res.json({
      success: true,
      message: 'Rollback applied successfully',
      data:    afterSnapshot,
    });

  } catch (err) {
    console.error('[auditLog] rollbackAuditEntry error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/orders/:orderId/audit-log/stats ──────────────────────────────────
// Quick stats: total edits, most-edited products, last activity
const getAuditStats = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [total, byAction, byProduct, lastEntry] = await Promise.all([
      OrderAuditLog.countDocuments({ orderId }),
      OrderAuditLog.aggregate([
        { $match: { orderId: require('mongoose').Types.ObjectId.createFromHexString(orderId) } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ]),
      OrderAuditLog.aggregate([
        {
          $match: {
            orderId: require('mongoose').Types.ObjectId.createFromHexString(orderId),
            productId: { $ne: null },
            action: 'product_edited',
          },
        },
        { $group: { _id: '$productId', name: { $first: '$productName' }, editCount: { $sum: 1 } } },
        { $sort: { editCount: -1 } },
        { $limit: 5 },
      ]),
      OrderAuditLog.findOne({ orderId })
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        totalEvents: total,
        byAction:    Object.fromEntries(byAction.map(a => [a._id, a.count])),
        mostEditedProducts: byProduct,
        lastActivity: lastEntry
          ? {
              at:   lastEntry.createdAt,
              by:   lastEntry.performedByName || lastEntry.performedBy?.name,
              action: lastEntry.action,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('[auditLog] getAuditStats error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAuditLog,
  getProductAuditLog,
  rollbackAuditEntry,
  getAuditStats,
};