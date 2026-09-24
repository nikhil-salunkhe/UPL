// Convert an uploaded file (multer memory storage) into a data URL that can
// be stored directly in MongoDB. Render's local disk is ephemeral, so saving
// only a `/uploads/...` path means the file vanishes after redeploy/restart.
// A data URL travels with the document, so images survive forever.
const fileToDataUrl = (file) => {
  if (!file || !file.buffer) return '';
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};

// Old records may still hold `/uploads/...` paths whose files no longer exist
// on disk; new records hold data URLs. Both shapes pass through untouched.
const resolveImageInput = (bodyValue, file) => {
  if (file && file.buffer) return fileToDataUrl(file);
  if (typeof bodyValue === 'string' && bodyValue.startsWith('data:image')) {
    return bodyValue;
  }
  return undefined;
};

module.exports = { fileToDataUrl, resolveImageInput };
