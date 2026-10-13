// Tests for the advertisement banner flow.
//
// Production bug: the admin dashboard converts the picked banner into a
// base64 data URL (FileReader) and stores it in form state, but the submit
// handler skipped any string value, so ads were created with banner: '' and
// GET /advertisements/:id/image answered 404 — a broken image icon on Home.
//
// These tests lock in the backend side of the fix:
//   1. createAdvertisement accepts a base64 data-URL banner sent in the body
//      (the dashboard's FileReader flow) as well as an uploaded file.
//   2. getAdvertisementImage serves the stored banner as a real image.
//   3. The public list keeps excluding the heavy banner payload.
//
// No live server or DB is required: the controllers are exercised directly
// with mock req/res objects, and the fallback (in-memory) store is used when
// MongoDB is not connected.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdvertisement,
  getAdvertisementImage,
  getAdvertisements
} = require('../controllers/advertisementController');
const { isMongoConnected } = require('../config/fallbackStore');

// 1x1 transparent PNG.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    sent: undefined,
    redirectedTo: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    send(payload) { this.sent = payload; return this; },
    redirect(url) { this.redirectedTo = url; return this; }
  };
}

// These tests exercise the in-memory fallback store; skip them when a real
// MongoDB connection is present so they never touch a live database.
const skipIfMongo = isMongoConnected() ? 'MongoDB is connected' : false;

test('createAdvertisement stores a base64 banner sent in the body', { skip: skipIfMongo }, async () => {
  const req = {
    body: {
      team: 'Rane Studikers',
      title: 'Khel Abhimana, Vijay Rajancha',
      description: 'Sponsor banner',
      link: '',
      isActive: 'true',
      displayOrder: '0',
      banner: PNG_DATA_URL
    },
    file: undefined
  };
  const res = mockRes();
  await createAdvertisement(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.banner, PNG_DATA_URL, 'banner data URL from the body should be stored');
});

test('getAdvertisementImage serves the stored banner as an image', { skip: skipIfMongo }, async () => {
  const createRes = mockRes();
  await createAdvertisement(
    { body: { team: 'T', title: 'With image', banner: PNG_DATA_URL }, file: undefined },
    createRes
  );
  assert.equal(createRes.statusCode, 201);

  const res = mockRes();
  await getAdvertisementImage({ params: { id: createRes.body._id } }, res);

  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.ok(Buffer.isBuffer(res.sent), 'image endpoint should send a Buffer');
  assert.equal(res.sent.toString('base64'), PNG_DATA_URL.split(',')[1], 'bytes should match the stored banner');
});

test('getAdvertisementImage 404s when the ad has no banner', { skip: skipIfMongo }, async () => {
  const createRes = mockRes();
  await createAdvertisement(
    { body: { team: 'T', title: 'No banner' }, file: undefined },
    createRes
  );
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.banner, '', 'ad without an image stores an empty banner');

  const res = mockRes();
  await getAdvertisementImage({ params: { id: createRes.body._id } }, res);
  assert.equal(res.statusCode, 404);
});

test('public advertisement list excludes the banner payload', { skip: skipIfMongo }, async () => {
  const res = mockRes();
  await getAdvertisements({}, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body) && res.body.length > 0, 'list should contain the created ads');
  for (const ad of res.body) {
    assert.ok(!('banner' in ad), 'banner should be projected out of the public list');
  }
});
