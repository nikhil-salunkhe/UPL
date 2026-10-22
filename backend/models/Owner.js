const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  team: { type: String, default: '', trim: true },
  captain: { type: String, default: '', trim: true },
  viceCaptain: { type: String, default: '', trim: true },
  // The squad the owner picked for their team. Like the captain and the
  // vice captain these are player NAMES, so the public pages can resolve
  // them against the player list without an extra lookup.
  players: { type: [String], default: [] },
  image: { type: String, default: '' },
  displayOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Owner', ownerSchema);
