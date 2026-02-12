const mongoose = require('mongoose');

const poVersionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  },
  
  // PO Header Info (editable)
  poNumber: {
    type: String,
    default: ''
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  accountNumber: String,
  repName: String,
  repPhone: String,
  repEmail: String,
  terms: String,
  estimateNumber: String,

  // Ship To Info
  shipTo: {
    name: { type: String, default: 'HFS - SF (SHIP TO ONLY) - PRIMARY' },
    address: { type: String, default: '2964 Alvarado Street' },
    city: { type: String, default: 'San Leandro, CA 94577' },
    attention: String,
    phone: { type: String, default: '(800) 576-7621' }
  },

  // Client Info (from order)
  clientInfo: {
    name: String,
    unitNumber: String,
    floorPlan: String
  },

  // ✅ FIXED: Vendor Info matching Vendor model structure
  vendorInfo: {
    name: String,
    vendorCode: String,
    representativeName: String,
    website: String,
    // Address as object (matching Vendor model)
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
      country: { type: String, default: '' }
    },
    // Contact info (matching Vendor model)
    contactInfo: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      fax: { type: String, default: '' }
    },
    accountNumber: String
  },

  // Products included in this PO (only products for this vendor)
  products: [{
    product_id: String,
    name: String,
    category: String,
    spotName: String,
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    description: String,
    selectedOptions: {
      finish: String,
      fabric: String,
      size: String,
      insetPanel: String,
      specifications: String,
      image: String,
      images: [String],
      notes: String,
      poNumber: String,
    }
  }],

  // Totals
  subTotal: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  others: { type: Number, default: 0 },
  total: { type: Number, default: 0 },

  // Comments & Notes
  comments: { type: String, default: '' },
  notes: { type: String, default: '' },
  versionNotes: { type: String, default: '' },

  status: {
    type: String,
    enum: ['draft', 'sent', 'confirmed', 'cancelled'],
    default: 'draft'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
poVersionSchema.index({ orderId: 1, vendorId: 1, version: -1 });

module.exports = mongoose.model('POVersion', poVersionSchema);