const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  finish: {
    type: String,
    default: ''
  },
  fabric: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: ''
  },
  insetPanel: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    url: String,
    key: String
  },
  model: {
    url: String,
    key: String
  },
  inStock: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
});

const productSchema = new mongoose.Schema({
  product_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  category: {
    type: String,
    default: 'General'
  },
  collection: {
    type: String,
    default: 'General'
  },
  dimension: {
    type: String,
    required: false
  },
  basePrice: {
    type: Number,
    required: true
  },
  attributes: {
    finish: {
      type: Boolean,
      default: false
    },
    fabric: {
      type: Boolean,
      default: false
    }
  },
  variants: [variantSchema],
  
  // ✅ NEW: Support for multiple images
  images: [{
    url: String,
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // ✅ NEW: Support for uploaded images (binary storage)
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
  
  // ✅ NEW: Dynamic custom attributes (flexible key-value pairs)
  customAttributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // ✅ NEW: Track source
  sourceType: {
    type: String,
    enum: ['admin-created', 'custom-order'],
    default: 'admin-created'
  },
  
  // ✅ NEW: Link to order if created from custom order
  createdFromOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
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

productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;