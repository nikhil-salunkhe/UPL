const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  logo: { type: String, default: '' },
  sponsoredPrice: { type: String, default: '', trim: true },
  phone: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sponsor', sponsorSchema);
