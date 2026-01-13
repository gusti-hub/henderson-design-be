// backend/models/Order.js
// UPDATE YOUR ORDER SCHEMA TO INCLUDE THESE FIELDS

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
    size: Number,
    notes: String,
    uploadedAt: Date
  },
  
  // ✅ ADD THIS NEW FIELD
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
  
  // ✅ Track source type
  sourceType: {
    type: String,
    enum: ['library', 'manual'],
    default: 'manual'
  },
  
  // ✅ Is this product editable?
  isEditable: {
    type: Boolean,
    default: true
  },
  
  selectedOptions: {
    finish: String,
    fabric: String,
    size: String,
    insetPanel: String,
    image: String, // Primary image URL
    images: [String], // Multiple image URLs
    links: [String], // Reference links
    specifications: String,
    notes: String,
    
    // ✅ NEW: Uploaded images stored as binary
    uploadedImages: [{
      filename: String,
      contentType: String,
      data: Buffer,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // ✅ NEW: Custom attributes (flexible)
    customAttributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    }
  },
  
  // For library products - placement info
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
  
  // ✅ ENHANCED FOR LIBRARY: Store dynamic furniture placements
  occupiedSpots: {
    type: Map,
    of: {
      furnitureId: String,
      label: String,
      area: String,
      coordinates: mongoose.Schema.Types.Mixed, // ✅ Allow any shape (polygon, curve, arc, rectangle)
      originalCoordinates: mongoose.Schema.Types.Mixed, // ✅ Store original shape
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

// Update timestamp on save
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);