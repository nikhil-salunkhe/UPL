const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, default: 'General', trim: true },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Index to speed up public list queries: filter isActive + sort displayOrder.
// Created before model compile so MongoDB can build the index on deploy.
ruleSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('Rule', ruleSchema);
