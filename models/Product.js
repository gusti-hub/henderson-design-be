const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  finish: {
    type: String,
    enum: ['Light', 'Dark', ''],
    default: ''
  },
  fabric: {
    type: String,
    enum: ['Cream', 'Tan', 'Beige', 'Blue', ''],
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    url: String,
    key: String // Store the S3 object key
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