const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  auctionDate: { type: Date, required: true },
  matchStartDate: { type: Date, default: null },
  matchEndDate: { type: Date, default: null },
  lotA: { type: String, default: 'Lot A', trim: true },
  lotB: { type: String, default: 'Lot B', trim: true },
  lotADay: { type: Number, default: 1 },
  lotBDay: { type: Number, default: 2 },
  venue: { type: String, default: 'जुगाइदेवी स्टेडियम उरूल', trim: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tournament', tournamentSchema);