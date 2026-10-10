const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
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
   Request logging: method, path, status, duration.
   Path only never headers, bodies, tokens or query strings.
============================ */

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const line = `${req.method} ${req.originalUrl.split('?')[0]} -> ${res.statusCode} in ${durationMs.toFixed(0)}ms`;
    if (res.statusCode >= 500 || durationMs >= 1000) {
      console.warn(`${line}`);
    } else {
      console.log(line);
    }
  });
  next();
});

/* ============================
   Middleware
============================ */

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

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

// Unknown API paths answer with JSON (never HTML) and a correct 404.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Turn multer upload errors (file too large / not an image) into clean JSON
// responses. The public registration form otherwise receives an HTML 500
// plus a generic failure message — exactly what users see when their first
// submit 'fails' on a slow connection (the timeout kills the response, but
// the server still saved the player). The client retry now returns the
// original record instead of creating a duplicate pending player.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
    return res.status(400).json({ message: err.message });
  }
  console.error('Unexpected server error:', err);
  res.status(500).json({ message: 'Registration failed. Please try again.' });
});

/* ============================
   MongoDB Connection
============================ */

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI not found in environment variables.');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('MongoDB Connected Successfully');

    const existingAdmin = await Admin.findOne({
      username: 'admin'
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });

      console.log('Default Admin Created');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Failed');
    console.error(err.message);
    process.exit(1);
  });
