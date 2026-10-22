const mongoose = require('mongoose');

// The record of an auction for one team: which players were sold to it and
// who leads it. A team's roster is never edited freely - it is exactly the
// set of players recorded here for that team.
const auctionResultSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  viceCaptain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  createdAt: { type: Date, default: Date.now }
});

// One auction result per team - the roster has a single source of truth.
auctionResultSchema.index({ team: 1 }, { unique: true });

module.exports = mongoose.model('AuctionResult', auctionResultSchema);