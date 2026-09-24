const multer = require('multer');
const path = require('path');

// Memory storage: file stays in req.file.buffer so controllers can store it
// as a data URL inside MongoDB. Disk storage (backend/uploads) is ephemeral
// on Render — files vanish on every redeploy/restart, which is why images
// disappeared after some time.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2.5 * 1024 * 1024 },
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
