// models/ProposalVersion.js - UPDATE
const mongoose = require('mongoose');

const proposalVersionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  version: {
    type: Number,
    required: true
  },
  
  clientInfo: {
    name: String,
    unitNumber: String,
    email: String,
    address: String,
    phone: String
  },
  
  selectedProducts: [{
    _id: mongoose.Schema.Types.ObjectId,
    product_id: String,
    name: String,
    category: String,
    spotName: String,
    quantity: Number,
    unitPrice: Number,
    finalPrice: Number,
    selectedOptions: {
      finish: String,
      fabric: String,
      size: String,
      insetPanel: String,
      image: String,
      images: [String],
      specifications: String,
      notes: String,
      sidemark: String,
      itemClass: String,
      vendorDescription: String,
      room: String,
      units: String,
      msrp: Number,
      discountPercent: Number,
      netCostOverride: Number,
      markupPercent: Number,
      salesTaxRate: Number,
      uploadedImages: [{
        filename: String,
        contentType: String,
        url: String,
        key: String,
        size: Number,
        uploadedAt: Date
      }]
    }
  }],
  
  totals: {
    subtotal: Number,
    salesTax: Number,
    total: Number,
    deposit: Number
  },
  
  notes: {
    type: String,
    required: true
  },
  
  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'rejected'],
    default: 'draft'
  },

  quickbooksId: {
    type: String,
    default: null,
  },
  quickbooksSyncedAt: {
    type: Date,
    default: null,
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
proposalVersionSchema.index({ orderId: 1, version: -1 });

module.exports = mongoose.model('ProposalVersion', proposalVersionSchema);