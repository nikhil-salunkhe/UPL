const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'UPL API is running' });
});

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/owners', require('./routes/ownerRoutes'));
app.use('/api/sponsors', require('./routes/sponsorRoutes'));
app.use('/api/tournament', require('./routes/tournamentRoutes'));
app.use('/api/matches', require('./routes/matchRoutes'));

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is not configured.");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('MongoDB connected');

    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({ username: 'admin', password: hashedPassword });
      console.log('Default admin seeded');
    }

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.warn('MongoDB unavailable, continuing with fallback store:', error.message);
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
