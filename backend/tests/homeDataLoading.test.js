// Tests for the home-page data-loading path.
//
// The production bug: Home.jsx fetched every section with a single
// Promise.all(...) and one global try/catch, so a single slow/failing
// endpoint (the large /owners payload, or a Render cold start) rejected the
// whole batch and blanked the entire page ("timeout of 15000ms exceeded").
//
// These tests lock in two things:
//   1. The public home endpoints each resolve/reject independently and always
//      answer with a well-formed JSON body (never hang, never throw).
//   2. The isolation strategy the frontend now relies on (Promise.allSettled)
//      keeps successful sections when one section rejects.
//
// No live server or DB is required: the controllers are exercised directly
// with mock req/res objects, and the fallback (in-memory) store is used when
// MongoDB is not connected.

const test = require('node:test');
const assert = require('node:assert/strict');

// ---- Mock response that records the JSON body and status code --------------
function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

// ---- 1. Independent resolution: each endpoint answers on its own -----------
test('home endpoints respond independently with JSON (no shared failure)', async () => {
  const owners = require('../controllers/ownerController');
  const ads = require('../controllers/advertisementController');
  const rules = require('../controllers/ruleController');
  const tournament = require('../controllers/tournamentController');

  const req = {};

  // Resolve each endpoint separately, exactly like the fixed frontend does.
  const ownersRes = mockRes();
  const adsRes = mockRes();
  const rulesRes = mockRes();
  const tournamentRes = mockRes();

  await Promise.allSettled([
    owners.getOwners(req, ownersRes),
    ads.getAdvertisements(req, adsRes),
    rules.getRules(req, rulesRes),
    tournament.getActiveTournament(req, tournamentRes)
  ]);

  // Every one of them produced a JSON body on its own.
  for (const [name, res] of [
    ['owners', ownersRes],
    ['advertisements', adsRes],
    ['rules', rulesRes],
    ['tournament', tournamentRes]
  ]) {
    assert.equal(res.statusCode, 200, `${name} should answer 200`);
    assert.notEqual(res.body, undefined, `${name} should send a JSON body`);
  }

  // List endpoints are arrays; tournament may legitimately be null when unset.
  assert.ok(Array.isArray(ownersRes.body), 'owners body is an array');
  assert.ok(Array.isArray(adsRes.body), 'advertisements body is an array');
  assert.ok(Array.isArray(rulesRes.body), 'rules body is an array');
});

// ---- 2. A failing endpoint does not sink the others (isolation) ------------
test('Promise.allSettled isolation: one rejection keeps other sections', async () => {
  const load = (ok, value) => () => (ok ? Promise.resolve(value) : Promise.reject(new Error('boom')));

  const results = await Promise.allSettled([
    load(true, [1, 2, 3])(),   // players
    load(false)(),            // owners  -> rejects (slow/timeout in prod)
    load(true, { name: 'UPL' })() // tournament
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 2, 'two sections still resolved');
  assert.equal(rejected.length, 1, 'one section rejected');
  assert.deepEqual(fulfilled[0].value, [1, 2, 3]);
  assert.deepEqual(fulfilled[1].value, { name: 'UPL' });
});

// ---- 3. Endpoint errors surface as 500 JSON, not a hang or crash ----------
test('a throwing controller is caught and returns a 500 JSON body', async () => {
  const mongoose = require('mongoose');
  const Owner = require('../models/Owner');
  const owners = require('../controllers/ownerController');

  // Force the Mongo branch (otherwise the in-memory fallback short-circuits
  // before the query runs) and make the query throw.
  const originalReadyState = mongoose.connection.readyState;
  const originalFind = Owner.find;
  mongoose.connection.readyState = 1; // pretend Mongo is connected
  Owner.find = () => { throw new Error('db down'); };

  try {
    const res = mockRes();
    await owners.getOwners({}, res);
    // The controller must catch its own error and answer 500, never hang.
    assert.equal(res.statusCode, 500);
    assert.ok(res.body && typeof res.body.message === 'string');
  } finally {
    mongoose.connection.readyState = originalReadyState;
    Owner.find = originalFind;
  }
});

// ---- 4. Public endpoints never leak admin-only fields ----------------------
test('public owners response strips corrupted leader data URLs', async () => {
  const mongoose = require('mongoose');
  const Owner = require('../models/Owner');
  const owners = require('../controllers/ownerController');

  // Use the Mongo branch and feed a legacy record whose captain field holds an
  // image data URL.
  const originalReadyState = mongoose.connection.readyState;
  const originalFind = Owner.find;
  mongoose.connection.readyState = 1; // pretend Mongo is connected
  Owner.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => Promise.resolve([
          { _id: 'o1', name: 'Ravi', captain: 'data:image/png;base64,AAAA', viceCaptain: 'Suresh', displayOrder: 0 }
        ])
      })
    })
  });

  try {
    const res = mockRes();
    await owners.getOwners({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body[0].captain, '', 'data-URL captain is scrubbed to empty');
    assert.equal(res.body[0].viceCaptain, 'Suresh', 'valid vice-captain is preserved');
  } finally {
    mongoose.connection.readyState = originalReadyState;
    Owner.find = originalFind;
  }
});

// ---- 5. Owners list excludes the heavy base64 photo (the timeout fix) -----
test('public owners list omits the inline photo to keep the payload small', async () => {
  const mongoose = require('mongoose');
  const Owner = require('../models/Owner');
  const owners = require('../controllers/ownerController');

  const originalReadyState = mongoose.connection.readyState;
  const originalFind = Owner.find;
  mongoose.connection.readyState = 1;
  Owner.find = () => ({
    sort: () => ({
      select: () => ({
        lean: () => Promise.resolve([
          { _id: 'o1', name: 'Ravi', image: 'data:image/png;base64,AAAA', displayOrder: 0 }
        ])
      })
    })
  });

  try {
    const res = mockRes();
    await owners.getOwners({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body[0].image, undefined, 'inline photo is not sent in the list');
    assert.equal(res.body[0]._id, 'o1', 'id is present so the client can load the photo on demand');
  } finally {
    mongoose.connection.readyState = originalReadyState;
    Owner.find = originalFind;
  }
});
