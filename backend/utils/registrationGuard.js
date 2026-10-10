// Pure helpers for the self-registration duplicate guard.
//
// A first registration can be saved by the server while its response is lost
// (Render free instance waking up, slow mobile uplink with a photo upload).
// The retry must return the already-saved record instead of creating a second
// pending player. Two genuinely different registrations are never merged.
//
// "Same person" = name + role, with the same photo (data URLs) OR the same
// team when photos are missing; the 10-minute window (configurable) keeps the
// guard from swallowing new players.

const crypto = require('crypto');

function normalizeForCompare(value) {
  return String(value || '').trim().toLowerCase();
}

// Fingerprint only data-URL images (the format this app stores in MongoDB).
// Non-data-URL images (e.g. legacy /uploads paths) cannot be fingerprinted,
// so identity is judged by the team comparison below.
function imageFingerprint(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const match = /^data:[^;,]+;base64,(.*)$/s.exec(dataUrl);
  return match ? crypto.createHash('sha256').update(match[1]).digest('hex') : null;
}

// True when `existing` is a recent retry of `incoming`:
//   - still pending
//   - same name + role
//   - same photo (data-URLs only) OR same team when photos are missing
//   - within `windowMs` (default 10 minutes)
// `now` is injected for deterministic tests.
function isRecentDuplicatePlayer(existing, incoming, windowMs = 10 * 60 * 1000, now = Date.now()) {
  if (existing.status !== 'pending') return false;
  if (!createdAtWithinWindow(existing.createdAt, now, windowMs)) return false;
  if (normalizeForCompare(existing.name) !== normalizeForCompare(incoming.name)) return false;
  if (normalizeForCompare(existing.role) !== normalizeForCompare(incoming.role)) return false;

  const incomingImage = incoming.image;
  const existingImage = existing.image;
  const bothDataUrls =
    typeof existingImage === 'string' && existingImage.startsWith('data:') &&
    typeof incomingImage === 'string' && incomingImage.startsWith('data:');

  if (bothDataUrls) {
    return imageFingerprint(existingImage) === imageFingerprint(incomingImage);
  }

  // No (or mismatched) photo on at least one side: team must also match.
  // Two blank teams are a strong signal of a retry, since the form never
  // asks for a team on this submission.
  return normalizeForCompare(existing.team) === normalizeForCompare(incoming.team);
}

// True when `createdAt` is within `windowMs` of `now`. A missing createdAt
// (e.g. in-memory store records) is treated as recent.
function createdAtWithinWindow(createdAt, now = Date.now(), windowMs = 10 * 60 * 1000) {
  if (!createdAt) return true;
  const age = typeof createdAt.getTime === 'function'
    ? now - createdAt.getTime()
    : now - new Date(createdAt).getTime();
  return age <= windowMs;
}

module.exports = { normalizeForCompare, imageFingerprint, isRecentDuplicatePlayer, createdAtWithinWindow };
