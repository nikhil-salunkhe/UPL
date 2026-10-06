const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, default: null },
  role: { type: String, required: true, trim: true },
  team: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  image: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved'], default: 'approved' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Player', playerSchema);
