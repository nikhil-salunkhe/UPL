// Unit tests for the self-registration duplicate guard.
// Covers normalize, photo fingerprinting, identity comparison, and the
// 10-minute retry window. No server or DB required.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeForCompare,
  imageFingerprint,
  isRecentDuplicatePlayer,
  createdAtWithinWindow
} = require('../utils/registrationGuard');

const NOW = Date.now();

test('normalizeForCompare lowercases and trims values', () => {
  assert.equal(normalizeForCompare('  Aarav Singh '), 'aarav singh');
  assert.equal(normalizeForCompare(''), '');
  assert.equal(normalizeForCompare(undefined), '');
});

test('imageFingerprint hashes data-URL payloads', () => {
  const a = 'data:image/png;base64,AAAA';
  const b = 'data:image/png;base64,BBBB';
  assert.equal(imageFingerprint(a), imageFingerprint(a));
  assert.notEqual(imageFingerprint(a), imageFingerprint(b));
  assert.equal(imageFingerprint('uploads/old.png'), null);
  assert.equal(imageFingerprint(undefined), null);
});

test('createdAtWithinWindow honours the 10-minute window', () => {
  assert.equal(createdAtWithinWindow(NOW - 5 * 60 * 1000), true);
  assert.equal(createdAtWithinWindow(NOW - 11 * 60 * 1000), false);
  assert.equal(createdAtWithinWindow(undefined), true);
});

test('isRecentDuplicatePlayer: same identity with blank teams returns true', () => {
  const existing = {
    _id: 'p1', name: 'Aarav Singh', role: 'Batsman', team: '',
    image: '', status: 'pending', createdAt: NOW
  };
  const incoming = { name: 'Aarav Singh', role: 'Batsman', team: '', image: '', status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming), true);
});

test('isRecentDuplicatePlayer: different team returns false', () => {
  const existing = {
    _id: 'p1', name: 'Aarav Singh', role: 'Batsman', team: 'Gulmohar Lions',
    image: '', status: 'pending', createdAt: NOW
  };
  const incoming = { name: 'Aarav Singh', role: 'Batsman', team: 'Suryanagar Strikers', image: '', status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming), false);
});

test('isRecentDuplicatePlayer: identical data-URL photo returns true', () => {
  const img = 'data:image/png;base64,1234';
  const existing = { _id: 'p1', name: 'Aarav', role: 'Batsman', team: '', image: img, status: 'pending', createdAt: NOW };
  const incoming = { name: 'Aarav', role: 'Batsman', team: '', image: img, status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming), true);
});

test('isRecentDuplicatePlayer: different photos return false', () => {
  const existing = { _id: 'p1', name: 'Aarav', role: 'Batsman', team: '', image: 'data:image/png;base64,1234', status: 'pending', createdAt: NOW };
  const incoming = { name: 'Aarav', role: 'Batsman', team: '', image: 'data:image/png;base64,5678', status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming), false);
});

test('isRecentDuplicatePlayer: photo missing falls back to team', () => {
  const existing = { _id: 'p1', name: 'Aarav', role: 'Batsman', team: 'Chennai', status: 'pending', createdAt: NOW };
  const incoming = { name: 'Aarav', role: 'Batsman', team: 'Chennai', image: '', status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming), true);
});

test('isRecentDuplicatePlayer: different name / different role / different status return false', () => {
  const existing = { _id: 'p1', name: 'Aarav', role: 'Batsman', team: '', image: '', status: 'pending', createdAt: NOW };
  assert.equal(isRecentDuplicatePlayer(existing, { name: 'Aarav', role: 'Batsman', team: '', image: '', status: 'pending' }), true);
  assert.equal(isRecentDuplicatePlayer(existing, { name: 'Vivaan', role: 'Bowler', team: '', image: '', status: 'pending' }), false);
  assert.equal(isRecentDuplicatePlayer(existing, { name: 'Vivaan', role: 'Batsman', team: '', image: '', status: 'pending' }), false);
  assert.equal(isRecentDuplicatePlayer(existing, { name: 'Aarav', role: 'Bowler', team: '', image: '', status: 'pending' }), false);
  assert.equal(isRecentDuplicatePlayer(existing, { name: 'Aarav', role: 'Batsman', team: 'Gulmohar Lions', image: '', status: 'pending' }), false);
});

test('isRecentDuplicatePlayer: expired window returns false', () => {
  const existing = {
    _id: 'p1', name: 'Aarav', role: 'Batsman', team: '', image: '', status: 'pending', createdAt: NOW - 30 * 60 * 1000
  };
  const incoming = { name: 'Aarav', role: 'Batsman', team: '', image: '', status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming, 10 * 60 * 1000, NOW), false);
});

test('isRecentDuplicatePlayer: non-pending record is never a duplicate', () => {
  const existing = { _id: 'p1', name: 'Aarav', role: 'Batsman', team: '', image: '', status: 'approved', createdAt: NOW };
  const incoming = { name: 'Aarav', role: 'Batsman', team: '', image: '', status: 'pending' };
  assert.equal(isRecentDuplicatePlayer(existing, incoming), false);
});
