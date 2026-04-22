const mongoose = require('mongoose');

// ─── SKU Parser ────────────────────────────────────────────────────────────
// SKU format: ST-11-N-0A-00-MD-19-00-00-00
//  segments:   0   1  2  3  4   5   6  7  8   9
// [5] = Wood Finish (MD / DK)
// [6] = Fabric code (19, 20, 08 … 0T)
// [7][8][9] = Others (WV SD LT FX LR SH — skip '00')
const WOOD_CODES   = ['MD', 'DK'];
const FABRIC_CODES = [
  '19','20','08','09','02','03','11','12',
  '05','06','14','15','17','18','0B','0C',
  '0E','0F','0I','0H','0L','0K','0O','0N','0U','0T'
];
const OTHER_CODES  = ['WV','SD','MD','DK','LT','FX','LR','SH'];

const parseSku = (sku) => {
  if (!sku) return { woodFinish: '', fabric: '', others: [] };
  const parts = sku.toUpperCase().split('-');
  return {
    woodFinish: WOOD_CODES.includes(parts[5])   ? parts[5] : '',
    fabric:     FABRIC_CODES.includes(parts[6]) ? parts[6] : '',
    others:     [parts[7], parts[8], parts[9]]
                  .filter(Boolean)
                  .filter(p => p !== '00' && OTHER_CODES.includes(p)),
  };
};

// ─── Schema ────────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema({
  // Identity
  product_id:  { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  category:    { type: String, default: 'General' },
  collection:  { type: String, default: 'General' },
  package:     { type: String, enum: ['', 'Lani', 'Nalu', 'Mainland'], default: '' },

  // Specs
  dimension: { type: String, default: '' },
  price:     { type: Number, required: true, default: 0 },

  // Finish attributes — auto-parsed from SKU, overridable
  woodFinish: { type: String, enum: ['', 'MD', 'DK'], default: '' },
  fabric:     { type: String, default: '' },   // one of FABRIC_CODES or ''
  others:     { type: [String], default: [] },  // subset of OTHER_CODES

  // Primary image
  image: {
    url: { type: String, default: '' },
    key: { type: String, default: '' },
  },

  // Additional uploaded images
  uploadedImages: [{
    filename:    String,
    contentType: String,
    url:         String,
    key:         { type: String, default: '' },
    size:        Number,
    uploadedAt:  { type: Date, default: Date.now }
  }],

  // Dynamic key-value attributes
  customAttributes: {
    type: Map, of: mongoose.Schema.Types.Mixed, default: new Map()
  },

  sourceType: {
    type: String, enum: ['admin-created', 'custom-order'], default: 'admin-created'
  },
  createdFromOrder: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Auto-parse SKU on create/change — only fills empty fields
productSchema.pre('save', function (next) {
  if (this.isModified('product_id') || this.isNew) {
    const parsed = parseSku(this.product_id);
    if (!this.woodFinish && parsed.woodFinish)       this.woodFinish = parsed.woodFinish;
    if (!this.fabric     && parsed.fabric)           this.fabric     = parsed.fabric;
    if (!this.others?.length && parsed.others?.length) this.others   = parsed.others;
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports         = Product;
module.exports.parseSku     = parseSku;
module.exports.WOOD_CODES   = WOOD_CODES;
module.exports.FABRIC_CODES = FABRIC_CODES;
module.exports.OTHER_CODES  = OTHER_CODES;