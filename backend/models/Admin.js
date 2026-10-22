const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  // Every account in this collection is an administrator of the panel.
  // The role is carried in the JWT so the protected routes can check it.
  role: { type: String, default: 'admin', enum: ['admin'] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', adminSchema);
