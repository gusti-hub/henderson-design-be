const mongoose = require('mongoose');

const sheetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  headers: [{ type: String }],
  rows: [{ type: mongoose.Schema.Types.Mixed }],
}, { _id: false });

const financialReviewSnapshotSchema = new mongoose.Schema({
  reportDate: { type: Date, index: true },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedByName: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },

  file: {
    filename: { type: String },
    key: { type: String },
    url: { type: String },
    size: { type: Number },
  },

  sheets: [sheetSchema],
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

financialReviewSnapshotSchema.index({ reportDate: -1 });

module.exports = mongoose.models['FinancialReviewSnapshot'] ||
  mongoose.model('FinancialReviewSnapshot', financialReviewSnapshotSchema);
