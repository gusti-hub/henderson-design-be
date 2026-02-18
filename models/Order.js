// models/Order.js
// ✅ UPDATED: Added Status Report fields to selectedOptions + order-level installation fields

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

  // ✅ NEW: Installation info (order-level, used in status report headers)
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
      // ── Install Binder fields ──
      poNumber: String,
      vendorOrderNumber: String,
      trackingInfo: String,
      deliveryStatus: String,

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

      // ✅ NEW: Status Report fields
      room: String,                    // Room location (e.g. "Living Room", "Primary Bedroom")
      statusCategory: String,          // Category for grouping (e.g. "Items Delivered")
      proposalNumber: String,          // Proposal reference number
      shipTo: String,                  // Ship-to address
      orderDate: String,               // Date order was placed
      expectedShipDate: String,        // Expected ship date
      dateReceived: String,            // Date item was received
      estimatedDeliveryDate: String,   // Estimated delivery to residence (client-facing)
      shippingCarrier: String,         // Carrier name (UPS, FedEx, etc.)
      orderStatus: String,             // Expediting order status

            // Pricing - Purchase Cost
      units: String,                          // "Each", "Set", "Pair", etc.
      msrp: Number,                           // Manufacturer's Suggested Retail Price
      discountPercent: Number,                // Discount % off MSRP
      noNetPurchaseCost: Boolean,             // Skip net cost calculation
      discountTaken: String,                  // Discount taken notes
      shippingCost: Number,                   // Shipping cost
      otherCost: Number,                      // Other costs

      // Pricing - Selling Cost
      markupPercent: Number,                  // Product markup %
      shippingMarkupPercent: Number,          // Shipping markup %
      otherMarkupPercent: Number,             // Other cost markup %
      depositPercent: Number,                 // Client deposit %
      vendorDepositPercent: Number,           // Vendor deposit requested %
      salesTaxRate: Number,                   // Sales tax rate %

      // Pricing - Taxable flags
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