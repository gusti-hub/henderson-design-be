// models/Vendor.js

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
    default: ''
  },
  defaultMarkup: {
    type: Number,
    required: [true, 'Please add a default markup'],
    min: 0,
    max: 1000,
    default: 0
  },
  // ✅ NEW: Default Discount
  defaultDiscount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // ✅ NEW: Vendor Deposit Requested
  vendorDepositRequested: {
    type: Number,
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
    },
    // ✅ NEW: Fax
    fax: {
      type: String,
      default: ''
    }
  },
  address: {
    street: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    zip: {
      type: String,
      default: ''
    },
    // ✅ NEW: Country
    country: {
      type: String,
      default: ''
    }
  },
  // ✅ NEW: Account Number
  accountNumber: {
    type: String,
    default: ''
  },
  // ✅ NEW: Tags (as comma-separated string)
  tags: {
    type: String,
    default: ''
  },
  // ✅ NEW: Login Credentials
  loginCredentials: {
    username: {
      type: String,
      default: ''
    },
    password: {
      type: String,
      default: ''
    },
    vendorRepName: {
      type: String,
      default: ''
    }
  },
  // ✅ NEW: Terms & Payment Info
  termsAndPayment: {
    orderMethod: {
      type: String,
      enum: ['', 'Online', 'Email', 'Phone'],
      default: ''
    },
    paymentMethod: {
      type: String,
      enum: ['', 'Credit Card', 'Check', 'ACH/Wire', 'Net 30 - CC', 'Net 30 - Check'],
      default: ''
    },
    terms: {
      type: String,
      default: ''
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

// ✅ Generate next vendor code - OPTIMIZED
vendorSchema.statics.generateNextCode = async function() {
  // Use aggregation to find the highest vendor code number efficiently
  const result = await this.aggregate([
    {
      $match: {
        vendorCode: { $regex: /^VND\d+$/ }
      }
    },
    {
      $project: {
        vendorNumber: {
          $toInt: { $substr: ['$vendorCode', 3, -1] }
        }
      }
    },
    {
      $sort: { vendorNumber: -1 }
    },
    {
      $limit: 1
    }
  ]);
  
  const lastNumber = result.length > 0 ? result[0].vendorNumber : 0;
  const nextNumber = lastNumber + 1;
  
  return `VND${String(nextNumber).padStart(3, '0')}`;
};

// ✅ Check if vendor code exists
vendorSchema.statics.codeExists = async function(code) {
  const vendor = await this.findOne({ vendorCode: code.toUpperCase() });
  return !!vendor;
};

module.exports = mongoose.model('Vendor', vendorSchema);