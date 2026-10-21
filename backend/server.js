const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
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
   gzip compression
   Shrinks every JSON/text response (typically 3–5× smaller). Critical on the
   free Render tier where egress + cold-start latency dominate page load.
============================ */

app.use(compression());

/* ============================
   Rate limiting
   Protects the public write/read endpoints from a single client hammering the
   database (spam registrations, scraping). Login gets a tighter limit to slow
   brute-force attempts. Limits are generous for normal village traffic.
============================ */

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests / minute / IP — far above normal browsing
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' }
});

// Apply the general limiter to all API routes. A tighter, brute-force-focused
// limiter is added directly on the login route in adminRoutes.
app.use('/api', apiLimiter);

/* ============================
   Short-lived caching for public read endpoints
   These collections change rarely during a tournament day. A 30s browser/CDN
   cache absorbs the "everyone refreshes at once" spike and cuts repeat hits to
   Mongo + Render cold starts. Admin/mutating routes are never cached.
============================ */

// Authenticated requests (e.g. /players/all, /rules/all, /advertisements/all)
// share these path prefixes with their public counterparts. A `public` header
// on those would let shared caches (CDN/proxy) store admin-only payloads and
// replay them to anonymous visitors — so admin traffic is explicitly
// uncacheable, and the Authorization variant is called out via Vary.
const publicCache = (seconds) => (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.headers.authorization) {
    res.set('Cache-Control', 'no-store');
    return next();
  }
  res.set('Cache-Control', `public, max-age=${seconds}`);
  res.vary('Authorization');
  next();
};
app.use('/api/players', publicCache(30));
app.use('/api/owners', publicCache(30));
app.use('/api/sponsors', publicCache(60));
app.use('/api/advertisements', publicCache(60));
app.use('/api/rules', publicCache(60));
app.use('/api/tournament', publicCache(30));
app.use('/api/matches', publicCache(15));

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
app.use('/api/advertisements', require('./routes/advertisementRoutes'));
app.use('/api/teams', require('./routes/teamRoutes'));
app.use('/api/rules', require('./routes/ruleRoutes'));
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
