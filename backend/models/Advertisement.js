const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  team: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  link: { type: String, default: '', trim: true },
  banner: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Index to speed up public list queries: filter isActive + sort displayOrder.
// Created before model compile so MongoDB can build the index on deploy.
advertisementSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('Advertisement', advertisementSchema);
