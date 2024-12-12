// models/Product.js
const mongoose = require('mongoose');

// models/Product.js
const variantSchema = new mongoose.Schema({
  finish: {
    type: String,
    enum: ['Light', 'Dark', ''], // Add empty string as valid option
    default: ''
  },
  fabric: {
    type: String,
    enum: ['Cream', 'Tan', 'Beige', 'Blue', ''], // Add empty string as valid option
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    data: Buffer,
    contentType: String
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

// Update the updatedAt timestamp before saving
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;