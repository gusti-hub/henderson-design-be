const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  clientCode: {
    type: String,
    unique: true, // Make the name (client code) field unique
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\S+@\S+\.\S+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  unitNumber: {
    type: String,
    required: [false, 'Please add a unit number']
  },
  floorPlan: {
    type: String,
    required: false,
    enum: [
      "Residence 00A", "Residence 01B", "Residence 03A",
      "Residence 05A", "Residence 08", "Residence 10A/12A",
      "Residence 03B", "Residence 05B", "Residence 07B",
      "Residence 09B", "Residence 10/12", "Residence 11B",
      "Residence 13A"
    ]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Only hash password on new user creation
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Add method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);