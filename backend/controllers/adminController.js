const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { verifyAdmin, isMongoConnected } = require('../config/fallbackStore');

exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    let admin;
    if (isMongoConnected()) {
      admin = await Admin.findOne({ username });
      if (!admin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      admin = await verifyAdmin(username, password);
      if (!admin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    const isMatch = isMongoConnected() ? await bcrypt.compare(password, admin.password) : true;
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id || admin.username, username: admin.username }, process.env.JWT_SECRET || 'upl-super-secret-key', {
      expiresIn: '8h'
    });

    res.json({ token, admin: { id: admin._id || admin.username, username: admin.username } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

exports.seedAdmin = async (req, res) => {
  try {
    const existing = await Admin.findOne({ username: 'admin' });
    if (existing) {
      return res.json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
    res.json({ message: 'Admin seeded successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Seeding failed', error: error.message });
  }
};
