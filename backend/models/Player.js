const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, default: null },
  role: { type: String, required: true, trim: true },
  team: { type: String, default: '', trim: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  phone: { type: String, default: '', trim: true },
  image: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved'], default: 'approved' },
  createdAt: { type: Date, default: Date.now }
});

// List queries: public list filters by status and both lists sort newest-first.
playerSchema.index({ status: 1, createdAt: -1 });
playerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Player', playerSchema);
