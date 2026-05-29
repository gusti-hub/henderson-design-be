const mongoose = require('mongoose');

const billInvoiceSchema = new mongoose.Schema({
  // Link back to source
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order',      required: true },
  vendorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor',     required: true },
  poVersionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'POVersion',  required: true, unique: true },

  // Identifiers
  poNumber:   { type: String, default: '' }, // Source PO number (reference only)
  billNumber: { type: String, default: '' }, // BI-{poNumber}

  // Header (editable by accountant)
  orderDate:      { type: Date,   default: Date.now },
  accountNumber:  String,
  repName:        String,
  repPhone:       String,
  repEmail:       String,
  terms:          String,
  estimateNumber: String,

  // Ship To
  shipTo: {
    name:      { type: String, default: 'HFS - SF (SHIP TO ONLY) - PRIMARY' },
    address:   { type: String, default: '2964 Alvarado Street' },
    city:      { type: String, default: 'San Leandro, CA 94577' },
    attention: String,
    phone:     { type: String, default: '(800) 576-7621' },
  },

  // Client Info
  clientInfo: {
    name:       String,
    unitNumber: String,
    floorPlan:  String,
  },

  // Vendor Info (snapshot at time of creation)
  vendorInfo: {
    name:                 String,
    vendorCode:           String,
    representativeName:   String,
    website:              String,
    address: {
      street:  { type: String, default: '' },
      city:    { type: String, default: '' },
      state:   { type: String, default: '' },
      zip:     { type: String, default: '' },
      country: { type: String, default: '' },
    },
    contactInfo: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      fax:   { type: String, default: '' },
    },
    accountNumber: String,
  },

  // Original PO product prices — snapshot at creation, never edited
  originalProducts: [{
    product_id: String,
    name:       String,
    quantity:   { type: Number, default: 1 },
    unitPrice:  { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
  }],

  // Products (editable — accountant can adjust prices)
  products: [{
    product_id:  String,
    name:        String,
    category:    String,
    spotName:    String,
    quantity:    { type: Number, default: 1 },
    unitPrice:   { type: Number, default: 0 },
    totalPrice:  { type: Number, default: 0 },
    description: String,
    selectedOptions: {
      finish:       String,
      fabric:       String,
      size:         String,
      insetPanel:   String,
      specifications: String,
      image:        String,
      images:       [String],
      notes:        String,
      poNumber:     String,
    },
  }],

  // Additional lines (editable)
  additionalLines: [{
    description: { type: String, default: '' },
    lineType:    { type: String, default: 'Other' },
    amount:      { type: Number, default: 0 },
  }],

  // Totals
  subTotal: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  others:   { type: Number, default: 0 },
  total:    { type: Number, default: 0 },

  comments: { type: String, default: '' },
  notes:    { type: String, default: '' },

  status: {
    type: String,
    enum: ['draft', 'confirmed', 'synced'],
    default: 'draft',
  },

  // QuickBooks tracking
  quickbooksId:       { type: String, default: null },
  quickbooksSyncedAt: { type: Date,   default: null },
  quickbooksStatus:   { type: String, enum: ['synced', 'failed', null], default: null },
  quickbooksError:    { type: String, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

billInvoiceSchema.index({ orderId: 1, vendorId: 1 });

module.exports = mongoose.models['BillInvoice'] || mongoose.model('BillInvoice', billInvoiceSchema);
