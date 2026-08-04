const mongoose = require('mongoose');

const checkSchema = new mongoose.Schema({
  label:         { type: String, required: true },
  expectedValue: { type: String, default: '' },
  result:        { type: String, enum: ['pass', 'fail', 'flag', 'na', 'pending'], default: 'pending' },
  notes:         { type: String, default: '' },
  photos:        [{ url: String, key: String }],
}, { _id: false });

const qcItemSchema = new mongoose.Schema({
  product_id:   { type: String, required: true },
  productName:  { type: String, default: '' },
  productImage: { type: String, default: '' },
  quantity:     { type: Number, default: 1 },
  checks:       [checkSchema],
  overallResult: { type: String, enum: ['pass', 'fail', 'flagged', 'pending'], default: 'pending' },
  notes:        { type: String, default: '' },
}, { _id: false });

const qcInspectionSchema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  poId:       { type: mongoose.Schema.Types.ObjectId, ref: 'POVersion', required: true },
  poNumber:   { type: String, default: '' },
  vendorName: { type: String, default: '' },
  clientName: { type: String, default: '' },

  type:   { type: String, enum: ['receiving', 'pre_delivery'], required: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },

  inspector: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:   { type: String, default: '' },
    email:  { type: String, default: '' },
  },

  overallResult: { type: String, enum: ['pass', 'fail', 'flagged', 'pending'], default: 'pending' },
  items:         [qcItemSchema],

  signature:    { url: { type: String, default: '' }, signedAt: Date },
  pdfUrl:       { type: String, default: '' },
  notes:        { type: String, default: '' },
  startedAt:    { type: Date, default: Date.now },
  completedAt:  { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('QCInspection', qcInspectionSchema);
