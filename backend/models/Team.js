const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
  name: { type: String, required: true, trim: true },
  logo: { type: String, default: '' },
  players: [{
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    joinedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

teamSchema.index({ owner: 1 });
teamSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Team', teamSchema);