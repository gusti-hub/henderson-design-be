// models/Order.js — selectedOptions additions
// Add these new fields to the selectedOptions sub-schema
// (Merge into your existing Order.js — find the selectedOptions block and add the missing fields)

// ── NEW FIELDS TO ADD TO selectedOptions ──
/*
  // General Info (new)
  sidemark: String,
  group: String,
  tags: [String],
  itemClass: String,
  vendorDescription: String,

  // Shipping (new)
  shipToName: String,
  shippingStreet: String,
  shippingCity: String,
  shippingState: String,
  shippingPostalCode: String,

  // Status (new)
  expectedArrivalDate: String,
  dateInspected: String,
  nextStep: String,
  nextStepDate: String,
  warehouseReceivingNumber: String,
*/

// ════════════════════════════════════════════════════════════
// FULL UPDATED Order.js (complete file, ready to use)
// ════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  customFloorPlan: {
    filename: String,
    contentType: String,
    data: Buffer,
    url: String,
    key: String,
    size: Number,
    notes: String,
    uploadedAt: Date
  },

  packageType: {
    type: String,
    enum: ['investor', 'custom', 'library'],
    default: 'investor'
  },

  clientInfo: {
    name: String,
    unitNumber: String,
    floorPlan: String
  },

  selectedPlan: {
    id: String,
    title: String,
    description: String,
    image: String,
    details: [String],
    clientInfo: {
      name: String,
      unitNumber: String,
      floorPlan: String
    }
  },

  Package: String,

  installationDate: String,
  installationNotes: String,

  selectedProducts: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    product_id: String,
    name: String,
    category: String,
    spotName: String,
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: Number,
    finalPrice: Number,
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: false
    },
    sourceType: {
      type: String,
      enum: ['library', 'manual'],
      default: 'manual'
    },
    isEditable: {
      type: Boolean,
      default: true
    },
    selectedOptions: {

      // ── General Info ──
      sidemark: String,
      group: String,
      tags: [String],
      itemClass: String,
      cfaSampleApproval: String,        // ✅ NEW
      vendorDescription: String,

      // ── Product spec fields ──
      finish: String,
      fabric: String,
      size: String,
      insetPanel: String,
      image: String,
      images: [String],
      links: [String],
      specifications: String,
      notes: String,

      // ── Shipping ──
      shipToVendorId: {                 // ✅ NEW — stores the vendor _id for the Ship To dropdown
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false,
        default: null,
      },
      shipToName: String,
      shippingStreet: String,
      shippingCity: String,
      shippingState: String,
      shippingPostalCode: String,
      shippingCountry: String,          // ✅ NEW
      shipToPhone: String,              // ✅ NEW

      // ── Install Binder fields ──
      poNumber: String,
      vendorOrderNumber: String,
      trackingInfo: String,
      deliveryStatus: String,

      // ── Status Report fields ──
      room: String,
      statusCategory: String,
      proposalNumber: String,
      shipTo: String,
      orderDate: String,
      expectedShipDate: String,
      expectedArrivalDate: String,       // ✅ NEW
      dateReceived: String,
      dateInspected: String,             // ✅ NEW
      estimatedDeliveryDate: String,
      shippingCarrier: String,
      orderStatus: String,
      nextStep: String,                  // ✅ NEW
      nextStepDate: String,              // ✅ NEW
      warehouseReceivingNumber: String,  // ✅ NEW

      // ── Pricing - Purchase Cost ──
      units: String,
      msrp: Number,
      discountPercent: Number,
      netCostOverride: Number,           // ✅ NEW — stores direct net cost input
      noNetPurchaseCost: Boolean,
      discountTaken: String,
      shippingCost: Number,
      otherCost: Number,

      // ── Pricing - Selling Cost ──
      markupPercent: Number,
      shippingMarkupPercent: Number,
      otherMarkupPercent: Number,
      depositPercent: Number,
      vendorDepositPercent: Number,
      salesTaxRate: Number,

      // ── Pricing - Taxable flags ──
      taxableCost: { type: Boolean, default: true },
      taxableMarkup: { type: Boolean, default: true },
      taxableShippingCost: { type: Boolean, default: true },
      taxableShippingMarkup: { type: Boolean, default: true },
      taxableOtherCost: { type: Boolean, default: true },
      taxableOtherMarkup: { type: Boolean, default: true },

      uploadedImages: [{
        filename: String,
        contentType: String,
        data: Buffer,
        url: String,
        key: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }],
      customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
      }
    },
    placement: {
      spotKey: String,
      coordinates: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        rotation: { type: Number, default: 0 }
      }
    }
  }],

  occupiedSpots: {
    type: Map,
    of: {
      furnitureId: String,
      label: String,
      area: String,
      coordinates: mongoose.Schema.Types.Mixed,
      originalCoordinates: mongoose.Schema.Types.Mixed,
      rotation: { type: Number, default: 0 },
      isPlaced: Boolean,
      sourceConfig: String,
      sourceSpot: String,
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
    },
    default: {}
  },

  status: {
    type: String,
    enum: ['ongoing', 'completed', 'confirmed', 'cancelled', 'review'],
    default: 'ongoing'
  },

  step: {
    type: Number,
    default: 1
  },

  proposalVersions: [{
    version: Number,
    notes: String,
    createdAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);