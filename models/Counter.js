// models/Counter.js
// Generic atomic counter using MongoDB findOneAndUpdate
// Used for autoincrement sequences (e.g. proposal numbers)

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id:  { type: String, required: true }, // e.g. 'proposalNumber'
  seq:  { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);