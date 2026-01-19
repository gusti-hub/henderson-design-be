const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  vendorCode: {
    type: String,
    unique: true,
    required: [true, 'Please add a vendor code'],
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Please add a vendor name']
  },
  website: {
    type: String,
    trim: true
  },
  representativeName: {
    type: String,
    required: [true, 'Please add a representative name']
  },
  defaultMarkup: {
    type: Number,
    required: [true, 'Please add a default markup'],
    min: 0,
    max: 100,
    default: 0
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Please add a phone number']
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      match: [/^\S+@\S+\.\S+$/, 'Please add a valid email']
    }
  },
  address: {
    street: {
      type: String,
      required: false
    },
    city: {
      type: String,
      required: false
    },
    state: {
      type: String,
      required: false
    },
    zip: {
      type: String,
      required: false
    }
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
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

// Update timestamp on save
vendorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate next vendor code
vendorSchema.statics.generateNextCode = async function() {
  const lastVendor = await this.findOne().sort({ createdAt: -1 });
  if (!lastVendor) {
    return 'VND001';
  }
  
  const lastNumber = parseInt(lastVendor.vendorCode.replace('VND', ''));
  const nextNumber = lastNumber + 1;
  return `VND${String(nextNumber).padStart(3, '0')}`;
};

module.exports = mongoose.model('Vendor', vendorSchema);