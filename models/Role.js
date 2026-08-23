const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  isSystem: {
    type: Boolean,
    default: false,
  },
  permissions: {
    type: [String],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
