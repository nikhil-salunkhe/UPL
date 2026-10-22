const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
  name: { type: String, required: true, trim: true },
  logo: { type: String, default: '' },
  // Captain / vice-captain are always members of the auction-selected squad.
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  viceCaptain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  // The roster is a mirror of the team's AuctionResult. It is only ever
  // written by the auction flow - never by a free-form roster edit.
  players: [{
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    joinedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

teamSchema.index({ owner: 1 }, { unique: true });
teamSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Team', teamSchema);