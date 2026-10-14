const mongoose = require('mongoose');

const fieldChangeSchema = new mongoose.Schema({
  field:    { type: String, required: true },
  label:    { type: String, default: '' },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const logisticAuditLogSchema = new mongoose.Schema({
  orderId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  performedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, default: '' },
  action:          { type: String, enum: ['product_edited', 'rollback'], required: true },
  productId:       { type: String, default: null },
  productName:     { type: String, default: null },
  changes:         [fieldChangeSchema],
  // What the edited item was at the time of the edit (so the audit stays readable even if the item changes later)
  context: {
    poNumber:    { type: String, default: '' },
    vendor:      { type: String, default: '' },
    sku:         { type: String, default: '' },
    unit:        { type: String, default: '' },
    client:      { type: String, default: '' },
    projectCode: { type: String, default: '' },
    room:        { type: String, default: '' },
    orderNumber: { type: Number, default: null },
  },
  rollbackOf:      { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticAuditLog', default: null },
  createdAt:       { type: Date, default: Date.now, index: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

logisticAuditLogSchema.index({ orderId: 1, createdAt: -1 });
logisticAuditLogSchema.index({ orderId: 1, productId: 1, createdAt: -1 });
logisticAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.models['LogisticAuditLog'] ||
  mongoose.model('LogisticAuditLog', logisticAuditLogSchema, 'logisticauditlogs');
