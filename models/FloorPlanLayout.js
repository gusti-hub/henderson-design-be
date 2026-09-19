const mongoose = require('mongoose');

const pinSchema = new mongoose.Schema({
  productId:  { type: String, default: '' },
  skuLabel:   { type: String, default: '' },
  roomLabel:  { type: String, default: '' },
  vendorName: { type: String, default: '' },
  x:          { type: Number, default: 50 },  // % of image width
  y:          { type: Number, default: 50 },  // % of image height
  rotation:   { type: Number, default: 0  },  // degrees
  scale:      { type: Number, default: 1  },
}, { _id: true });

const floorPlanLayoutSchema = new mongoose.Schema({
  clientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['full', 'room'], required: true },
  room:         { type: String, default: '' },
  imageUrl:     { type: String, required: true },
  imageKey:     { type: String, required: true },
  pins:         { type: [pinSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('FloorPlanLayout', floorPlanLayoutSchema);
