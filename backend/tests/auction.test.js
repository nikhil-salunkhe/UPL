// Tests for the auction-driven roster.
//
// The auction result is the single source of truth for a team's squad, captain
// and vice-captain. These tests pin down the contract:
//
//   1. Saving an auction stores the squad and the leadership roles.
//   2. The captain and the vice-captain must be members of the squad.
//   3. Saving again replaces the previous result (one result per team).
//   4. The team document mirrors the auction result.
//   5. Players who leave the squad are released from the team.
//
// No live server or DB is required: the controllers are exercised directly
// with mock req/res objects and the fallback (in-memory) store is used when
// MongoDB is not connected.

const test = require('node:test');
const assert = require('node:assert/strict');

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    set() { return this; },
    send() { return this; }
  };
}

function seedFixture(prefix) {
  const { getState } = require('../config/fallbackStore');
  const state = getState();
  state.players.push(
    { _id: `${prefix}-p1`, name: 'Alpha', age: 22, role: 'Batsman', team: '', image: '' },
    { _id: `${prefix}-p2`, name: 'Beta', age: 23, role: 'Bowler', team: '', image: '' },
    { _id: `${prefix}-p3`, name: 'Gamma', age: 24, role: 'Keeper', team: '', image: '' }
  );
  state.owners.push({
    _id: `${prefix}-owner`, name: 'Owner', phone: '1', team: 'T', captain: '', viceCaptain: '', image: ''
  });
  state.teams.push({
    _id: `${prefix}-team`,
    owner: `${prefix}-owner`,
    name: 'Auction Team',
    logo: '',
    captain: null,
    viceCaptain: null,
    players: []
  });
  return { teamId: `${prefix}-team`, ownerId: `${prefix}-owner` };
}

// ---- 1. Saving an auction stores squad + leadership -------------------------
test('saving an auction stores the squad, the captain and the vice-captain', async () => {
  const auctions = require('../controllers/auctionController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a1');

  const res = mockRes();
  await auctions.saveTeamAuctionResult(
    {
      params: { teamId },
      body: { players: ['a1-p1', 'a1-p2'], captain: 'a1-p1', viceCaptain: 'a1-p2' }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.players, ['a1-p1', 'a1-p2']);
  assert.equal(res.body.data.captain, 'a1-p1');
  assert.equal(res.body.data.viceCaptain, 'a1-p2');

  // The persisted auction result holds the same data.
  const state = getState();
  const stored = state.auctions.find((a) => String(a.team) === teamId);
  assert.ok(stored, 'an auction result was persisted');
  assert.deepEqual(stored.players, ['a1-p1', 'a1-p2']);
});

// ---- 2. The captain must be part of the squad -------------------------------
test('a captain outside the squad is rejected', async () => {
  const auctions = require('../controllers/auctionController');
  const { teamId } = seedFixture('a2');

  const res = mockRes();
  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a2-p1'], captain: 'a2-p3', viceCaptain: '' } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Captain must be one of the selected squad/);
});

// ---- 3. The vice-captain must be part of the squad ---------------------------
test('a vice-captain outside the squad is rejected', async () => {
  const auctions = require('../controllers/auctionController');
  const { teamId } = seedFixture('a3');

  const res = mockRes();
  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a3-p1'], captain: '', viceCaptain: 'a3-p3' } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Vice Captain must be one of the selected squad/);
});

// ---- 4. Captain and vice-captain must differ --------------------------------
test('the captain and the vice-captain must be different', async () => {
  const auctions = require('../controllers/auctionController');
  const { teamId } = seedFixture('a4');

  const res = mockRes();
  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a4-p1'], captain: 'a4-p1', viceCaptain: 'a4-p1' } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /must be different/);
});

// ---- 5. An empty squad is rejected ------------------------------------------
test('an empty squad is rejected', async () => {
  const auctions = require('../controllers/auctionController');
  const { teamId } = seedFixture('a5');

  const res = mockRes();
  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: [], captain: '', viceCaptain: '' } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /at least one player/);
});

// ---- 6. An unknown team is a 404 ---------------------------------------------
test('saving an auction for an unknown team answers 404', async () => {
  const auctions = require('../controllers/auctionController');

  const res = mockRes();
  await auctions.saveTeamAuctionResult(
    { params: { teamId: 'nope' }, body: { players: ['x1'], captain: '', viceCaptain: '' } },
    res
  );

  assert.equal(res.statusCode, 404);
});

// ---- 7. One auction result per team -----------------------------------------
test('saving an auction again replaces the previous result for that team', async () => {
  const auctions = require('../controllers/auctionController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a7');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a7-p1', 'a7-p2'], captain: 'a7-p1', viceCaptain: '' } },
    mockRes()
  );
  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a7-p3'], captain: 'a7-p3', viceCaptain: '' } },
    mockRes()
  );

  const state = getState();
  const mine = state.auctions.filter((a) => String(a.team) === teamId);
  assert.equal(mine.length, 1, 'the team still has exactly one auction result');
  assert.deepEqual(mine[0].players, ['a7-p3'], 'the squad was replaced');
  assert.equal(mine[0].captain, 'a7-p3');
});

// ---- 8. The team document mirrors the auction result ------------------------
test('the team document mirrors the saved auction result', async () => {
  const auctions = require('../controllers/auctionController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a8');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a8-p1', 'a8-p2'], captain: 'a8-p1', viceCaptain: 'a8-p2' } },
    mockRes()
  );

  const state = getState();
  const team = state.teams.find((t) => String(t._id) === teamId);
  assert.deepEqual(
    team.players.map((p) => String(p.player)).sort(),
    ['a8-p1', 'a8-p2'],
    'the team roster holds the squad'
  );
  assert.equal(team.captain, 'a8-p1', 'the team holds the captain');
  assert.equal(team.viceCaptain, 'a8-p2', 'the team holds the vice-captain');

  // The legacy owner record keeps the captain as a NAME.
  const owner = state.owners.find((o) => String(o._id) === 'a8-owner');
  assert.equal(owner.captain, 'Alpha', 'the owner record holds the captain name');
  assert.equal(owner.viceCaptain, 'Beta', 'the owner record holds the vice-captain name');
});

// ---- 9. Players who leave the squad are released ----------------------------
test('a player removed from the squad is released from the team', async () => {
  const auctions = require('../controllers/auctionController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a9');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a9-p1', 'a9-p2'], captain: 'a9-p1', viceCaptain: '' } },
    mockRes()
  );

  let state = getState();
  assert.equal(state.players.find((p) => p._id === 'a9-p1').teamId, teamId, 'the player plays for the team');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a9-p1'], captain: 'a9-p1', viceCaptain: '' } },
    mockRes()
  );

  state = getState();
  assert.equal(state.players.find((p) => p._id === 'a9-p2').team, '', 'the removed player has no team');
  assert.equal(state.players.find((p) => p._id === 'a9-p2').teamId, null, 'the removed player has no team id');
});

// ---- 10. Reading the auction result -----------------------------------------
test('the auction result of a team can be read back with its squad', async () => {
  const auctions = require('../controllers/auctionController');
  const { teamId } = seedFixture('a10');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a10-p1', 'a10-p2'], captain: 'a10-p1', viceCaptain: 'a10-p2' } },
    mockRes()
  );

  const res = mockRes();
  await auctions.getTeamAuctionResult({ params: { teamId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.players, ['a10-p1', 'a10-p2']);
  assert.equal(res.body.captain, 'a10-p1');
  assert.equal(res.body.players.length, 2, 'the squad is resolved to player objects');
  assert.ok(res.body.players.every((p) => p.name), 'the squad holds full player objects');
});

// ---- 11. A team without an auction result -----------------------------------
test('a team without an auction result answers with an empty result', async () => {
  const auctions = require('../controllers/auctionController');
  const { teamId } = seedFixture('a11');

  const res = mockRes();
  await auctions.getTeamAuctionResult({ params: { teamId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data, null);
  assert.deepEqual(res.body.players, []);
});

// ---- 12. The legacy roster endpoint keeps the auction in step ---------------
test('the legacy roster endpoint re-derives the auction result', async () => {
  const teams = require('../controllers/teamController');
  const auctions = require('../controllers/auctionController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a12');

  await teams.updateTeamPlayers(
    { params: { id: teamId }, body: { add: ['a12-p1', 'a12-p2'], remove: [] } },
    mockRes()
  );

  const state = getState();
  const stored = state.auctions.find((a) => String(a.team) === teamId);
  assert.ok(stored, 'the roster edit created an auction result');
  assert.deepEqual(stored.players.sort(), ['a12-p1', 'a12-p2']);

  // The auction endpoint now sees the same squad.
  const res = mockRes();
  await auctions.getTeamAuctionResult({ params: { teamId } }, res);
  assert.deepEqual(res.body.data.players.sort(), ['a12-p1', 'a12-p2']);
});

// ---- 13. A deleted player leaves the squad ---------------------------------
test('a deleted player is removed from the squad and from the leadership', async () => {
  const auctions = require('../controllers/auctionController');
  const players = require('../controllers/playerController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a13');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a13-p1', 'a13-p2'], captain: 'a13-p1', viceCaptain: 'a13-p2' } },
    mockRes()
  );

  const res = mockRes();
  await players.deletePlayer({ params: { id: 'a13-p1' } }, res);
  assert.equal(res.statusCode, 200);

  const state = getState();
  const stored = state.auctions.find((a) => String(a.team) === teamId);

  assert.ok(stored, 'the auction result still exists');
  assert.ok(!stored.players.includes('a13-p1'), 'the deleted player left the squad');
  assert.deepEqual(stored.players, ['a13-p2'], 'the rest of the squad is untouched');
  assert.equal(stored.captain, null, 'the deleted captain was cleared');
  assert.equal(stored.viceCaptain, 'a13-p2', 'the vice-captain is untouched');

  // The team document mirrors the auction result.
  const team = state.teams.find((t) => String(t._id) === teamId);
  assert.ok(!team.players.some((p) => String(p.player) === 'a13-p1'), 'the team roster is in step');
  assert.equal(team.captain, null, 'the team captain was cleared');
});

// ---- 14. A deleted vice-captain leaves the squad ---------------------------
test('a deleted vice-captain is removed from the squad and the leadership', async () => {
  const auctions = require('../controllers/auctionController');
  const players = require('../controllers/playerController');
  const { getState } = require('../config/fallbackStore');
  const { teamId } = seedFixture('a14');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a14-p1', 'a14-p2'], captain: 'a14-p1', viceCaptain: 'a14-p2' } },
    mockRes()
  );

  await players.deletePlayer({ params: { id: 'a14-p2' } }, mockRes());

  const state = getState();
  const stored = state.auctions.find((a) => String(a.team) === teamId);

  assert.deepEqual(stored.players, ['a14-p1']);
  assert.equal(stored.captain, 'a14-p1', 'the captain is untouched');
  assert.equal(stored.viceCaptain, null, 'the deleted vice-captain was cleared');
});

// ---- 15. The owner record keeps the leader names in step -------------------
test('the owner record follows the auction leadership', async () => {
  const auctions = require('../controllers/auctionController');
  const { getState } = require('../config/fallbackStore');
  const { teamId, ownerId } = seedFixture('a15');

  await auctions.saveTeamAuctionResult(
    { params: { teamId }, body: { players: ['a15-p1', 'a15-p2'], captain: 'a15-p1', viceCaptain: 'a15-p2' } },
    mockRes()
  );

  const state = getState();
  const owner = state.owners.find((o) => String(o._id) === ownerId);

  assert.equal(owner.captain, 'Alpha', 'the owner holds the captain name');
  assert.equal(owner.viceCaptain, 'Beta', 'the owner holds the vice-captain name');
});

// ---- 16. The auction routes require an administrator -----------------------
test('the auction routes are guarded by the admin middleware', () => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const auth = require('../middleware/auth');
  const adminOnly = require('../middleware/adminOnly');
  const router = require('../routes/auctionRoutes');

  // The router mounts `auth` and `adminOnly` on every auction endpoint.
  const layers = router.stack.filter((layer) => layer.route);
  assert.equal(layers.length, 3, 'the auction router exposes three endpoints');

  layers.forEach((layer) => {
    const names = layer.route.stack.map((l) => l.name);
    assert.ok(names.includes('authMiddleware'), `${layer.route.path} requires a signed-in admin`);
    assert.ok(names.includes('adminOnly'), `${layer.route.path} requires the admin role`);
  });

  // A token without the admin role is rejected by `adminOnly`.
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  const token = jwt.sign({ username: 'viewer', role: 'viewer' }, process.env.JWT_SECRET || 'upl-super-secret-key');
  const req = { headers: { authorization: `Bearer ${token}` } };

  auth(req, res, () => adminOnly(req, res, () => {
    throw new Error('adminOnly should have rejected this token');
  }));

  assert.equal(res.statusCode, 403, 'a non-admin token is rejected');
  assert.equal(res.body.message, 'Admin access required');
});
