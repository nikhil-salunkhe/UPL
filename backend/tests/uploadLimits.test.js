// Regression tests for multipart upload limits (multer middleware).
//
// Production bug: the admin dashboard converts the ad banner into a base64
// data URL (~1.37x the raw file size) and sends it as a multipart TEXT field.
// multer's configured limits only capped `fileSize` (2.5MB, applies to file
// parts); text fields fell back to busboy's default `fieldSize` of 1MB. Any
// banner over ~750KB raw therefore aborted parsing with
// `MulterError: Field value too long`, which server.js maps to 400 — the
// update failed before reaching the controller.
//
// These tests exercise the REAL upload middleware through a live HTTP server
// (Node 22 global fetch + FormData), mirroring server.js's error handling.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const multer = require('multer');

const upload = require('../middleware/upload');

// A base64 data URL the way handleAdBannerChange produces it: raw image bytes
// are base64-encoded, so a ~2.2MB photo becomes a ~3MB string field.
const buildBannerField = () => `data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`;

const startApp = () => {
  const app = express();
  app.post('/ad', upload.single('banner'), (req, res) => {
    res.status(200).json({
      bannerLength: (req.body.banner || '').length,
      team: req.body.team || ''
    });
  });
  // Same mapping as server.js: multer failures answer 400 with the raw message.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
};

const closeServer = async (server) => {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
};

test('multipart text fields may carry a large base64 banner without a 400', async () => {
  const server = await startApp();
  try {
    const banner = buildBannerField();
    const form = new FormData();
    form.append('team', 'Rane Studikers');
    form.append('banner', banner);

    const res = await fetch(`http://127.0.0.1:${server.address().port}/ad`, {
      method: 'POST',
      body: form
    });

    // Read the body once, then branch — the assert message must not consume it.
    const raw = await res.text();
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${raw}`);
    const body = JSON.parse(raw);
    assert.equal(body.bannerLength, banner.length, 'full data URL should survive parsing');
    assert.equal(body.team, 'Rane Studikers');
  } finally {
    await closeServer(server);
  }
});

test('file parts are still capped at 2.5MB (fileSize limit intact)', async () => {
  const server = await startApp();
  try {
    const form = new FormData();
    form.append('team', 'Too Big FC');
    form.append('banner', new Blob([Buffer.alloc(3 * 1024 * 1024)], { type: 'image/png' }), 'big.png');

    const res = await fetch(`http://127.0.0.1:${server.address().port}/ad`, {
      method: 'POST',
      body: form
    });

    assert.equal(res.status, 400, 'oversized file upload must still be rejected');
    const body = await res.json();
    assert.match(body.message, /too large|File too large/i);
  } finally {
    await closeServer(server);
  }
});
