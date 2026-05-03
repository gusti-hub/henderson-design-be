// models/Expense.js
const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  date:        { type: String, default: '' },
  serviceType: { type: String, default: 'design' },
  description: { type: String, default: '' },
  hours:       { type: Number, default: 1 },
  rate:        { type: Number, default: 0 },
  amount:      { type: Number, default: 0 },
  unit:        { type: String, default: 'hr' },
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  },
  expenseNumber: { type: String, required: true },
  expenseDate:   { type: String, default: '' },
  projectName:   { type: String, default: '' },
  clientInfo: {
    name:         { type: String, default: '' },
    email:        { type: String, default: '' },
    address:      { type: String, default: '' },
    cityStateZip: { type: String, default: '' },
  },
  lines:   { type: [lineItemSchema], default: [] },
  taxRate: { type: Number, default: 4.5 },
  notes:   { type: String, default: '' },
  status:  {
    type: String,
    enum: ['draft', 'review', 'confirmed', 'paid'],
    default: 'draft',
  },
  employeeName: { type: String, default: '' },

  // QuickBooks sync tracking
  quickbooksId:       { type: String, default: null },
  quickbooksSyncedAt: { type: Date,   default: null },
  quickbooksStatus:   { type: String, enum: ['synced', 'failed', null], default: null },
  quickbooksError:    { type: String, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

expenseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual: compute totals on the fly
expenseSchema.virtual('subtotal').get(function () {
  return this.lines.reduce((s, l) => s + (l.amount || 0), 0);
});

expenseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Expense', expenseSchema);