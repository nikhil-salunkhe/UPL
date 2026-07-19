const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ============================
   Create uploads folder if missing
============================ */

const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Uploads folder created');
}

/* ============================
   CORS
============================ */

const allowedOrigins = [
  'http://localhost:5173',
  'https://upl2026.netlify.app',
  process.env.CLIENT_URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS Not Allowed'));
      }
    },
    credentials: true
  })
);

/* ============================
   Middleware
============================ */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadDir));

/* ============================
   Health Check
============================ */

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'UPL API is running'
  });
});

/* ============================
   Routes
============================ */

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/owners', require('./routes/ownerRoutes'));
app.use('/api/sponsors', require('./routes/sponsorRoutes'));
app.use('/api/tournament', require('./routes/tournamentRoutes'));
app.use('/api/matches', require('./routes/matchRoutes'));

/* ============================
   MongoDB Connection
============================ */

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI not found in environment variables.');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('✅ MongoDB Connected Successfully');

    const existingAdmin = await Admin.findOne({
      username: 'admin'
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });

      console.log('✅ Default Admin Created');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Failed');
    console.error(err.message);
    process.exit(1);
  });