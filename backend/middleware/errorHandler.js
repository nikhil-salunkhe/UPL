const multer = require('multer');

// Central error handler. Extracted from server.js so it can be unit-tested
// without booting the whole app (which needs a live MongoDB connection).
//
// Three classes of failure get their own, accurate status + message:
//   1. multer upload errors (file too large / not an image) -> 400
//   2. body-parser errors (malformed JSON, oversized body) -> 400 / 413
//   3. anything else -> 500 with the generic fallback message
//
// Class 2 matters for admin login: a malformed JSON body used to be reported
// as a 500 "Registration failed. Please try again.", which hid the real
// cause (a client-side body-encoding bug) behind an unrelated message.
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
    return res.status(400).json({ message: err.message });
  }

  // Malformed request body (invalid JSON, wrong content-type, ...). This is a
  // client mistake, not a server failure.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid request body. Please check the data and try again.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }

  console.error('Unexpected server error:', err);
  return res.status(500).json({ message: 'Registration failed. Please try again.' });
}

module.exports = errorHandler;
