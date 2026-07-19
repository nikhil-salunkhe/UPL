const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  teamA: { type: String, required: true, trim: true },
  teamB: { type: String, required: true, trim: true },
  matchDate: { type: Date, required: true },
  matchTime: { type: String, default: '10:00 AM', trim: true },
  lot: { type: String, default: 'Lot A', trim: true },
  venue: { type: String, default: 'जुगाइदेवी स्टेडियम उरूल', trim: true },
  status: { type: String, default: 'Scheduled', enum: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);