 // models/OrderAuditLog.js
// Audit log for all editable field changes in orders (product-level and order-level)
// Each document = one atomic change event (one field, one product, one save)

const mongoose = require('mongoose');

// ── Represents a single field change within one save event ───────────────────
const fieldChangeSchema = new mongoose.Schema({
  field:        { type: String, required: true },  // e.g. "selectedOptions.msrp"
  label:        { type: String, default: '' },      // human-readable label
  oldValue:     { type: mongoose.Schema.Types.Mixed, default: null },
  newValue:     { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const orderAuditLogSchema = new mongoose.Schema({

  // ── Scope ──────────────────────────────────────────────────────────────────
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  },

  // ── Actor ──────────────────────────────────────────────────────────────────
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  performedByName: { type: String, default: '' }, // denormalized — survives user rename

  // ── Action type ────────────────────────────────────────────────────────────
  action: {
    type: String,
    enum: [
      'product_added',
      'product_removed',
      'product_edited',
      'order_field_changed',
      'rollback',
    ],
    required: true,
  },

  // ── Product context (null for order-level changes) ─────────────────────────
  productId:   { type: String, default: null },  // selectedProducts._id (string)
  productName: { type: String, default: null },

  // ── Changes ────────────────────────────────────────────────────────────────
  // For product_added / product_removed: changes = [{ field: 'product', newValue: {...snapshot} }]
  // For product_edited: one entry per changed field
  // For order_field_changed: one entry per changed field
  changes: [fieldChangeSchema],

  // ── Rollback metadata ──────────────────────────────────────────────────────
  // Populated only when action === 'rollback'
  rollbackOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderAuditLog',
    default: null,
  },

  // ── Snapshot ───────────────────────────────────────────────────────────────
  // Full product snapshot stored on add/remove so rollback has all data
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  // ── Timestamp (explicit for clarity, also on schema level) ────────────────
  createdAt: { type: Date, default: Date.now, index: true },

}, {
  // No updatedAt — audit entries are immutable
  timestamps: { createdAt: true, updatedAt: false },
});

// Compound index: fetch all logs for an order sorted by time
orderAuditLogSchema.index({ orderId: 1, createdAt: -1 });
// Fetch all logs for a specific product within an order
orderAuditLogSchema.index({ orderId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.models['OrderAuditLog'] ||
  mongoose.model('OrderAuditLog', orderAuditLogSchema);