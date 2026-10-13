const multer = require('multer');
const path = require('path');

// Memory storage: file stays in req.file.buffer so controllers can store it
// as a data URL inside MongoDB. Disk storage (backend/uploads) is ephemeral
// on Render — files vanish on every redeploy/restart, which is why images
// disappeared after some time.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 2.5 * 1024 * 1024,
    // Caps apply separately to FILE parts (fileSize, above) and TEXT fields
    // (fieldSize, here — busboy's default is only 1MB). The admin forms send
    // images as base64 data-URL strings in text fields (~1.37x the raw size),
    // so 1MB rejected any banner over ~750KB with `MulterError: Field value
    // too long` → 400 before the controller ran. 12MB matches the
    // express.json body limit in server.js.
    fieldSize: 12 * 1024 * 1024,
    fields: 32
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype.toLowerCase());
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

module.exports = upload;
