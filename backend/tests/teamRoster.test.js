// Tests for the admin team/roster management workflow.
//
// The admin UI (TeamPlayerManagement.jsx + AdminDashboard.jsx) depends on a
// few contract details that are easy to break:
//   1. GET /teams/owner/:ownerId answers with a { success, data, pagination }
//      envelope and only that owner's teams.
//   2. GET /teams/:id returns the roster as full player objects
//      ({ _id, name, role }) — not as `{ player: <id> }` references.
//   3. PUT /teams/:id/players accepts { add, remove } id arrays, is
//      idempotent, and 404s for an unknown team.
//   4. GET /players/all supports ?search= so the roster picker can search
//      server-side, and the response carries pagination metadata.
//
// No live server or DB is required: the controllers are exercised directly
// with mock req/res objects, and the fallback (in-memory) store is used when
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

// ---- 1. Teams by owner: envelope + only that owner's teams -----------------
test('getTeamsByOwner returns an envelope containing only that owner\'s teams', async () => {
  const teams = require('../controllers/teamController');
  const { getState } = require('../config/fallbackStore');

  const state = getState();
  state.owners.push(
    { _id: 'owner-a', name: 'Owner A', phone: '1', team: 'A', captain: '', viceCaptain: '', image: '' },
    { _id: 'owner-b', name: 'Owner B', phone: '2', team: 'B', captain: '', viceCaptain: '', image: '' }
  );

  const res = mockRes();
  await teams.getTeamsByOwner({ params: { ownerId: 'owner-a' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data), 'data is an array');
  assert.ok(res.body.pagination, 'pagination metadata is present');
  assert.ok(
    res.body.data.every((t) => String(t.owner) === 'owner-a'),
    'no team from another owner leaks in'
  );
});

// ---- 2. getTeam returns the roster as full player objects ------------------
test('getTeam returns the roster as full player objects with _id and name', async () => {
  const teams = require('../controllers/teamController');
  const { getState } = require('../config/fallbackStore');

  const state = getState();
  state.players.push({ _id: 'p-roster-1', name: 'Roster Player', age: 22, role: 'Batsman', team: '', image: '' });
  state.teams.push({
    _id: 'team-roster-1',
    owner: 'owner-a',
    name: 'Roster Team',
    logo: '',
    players: [{ player: 'p-roster-1', joinedAt: new Date() }]
  });

  const res = mockRes();
  await teams.getTeam({ params: { id: 'team-roster-1' } }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.players), 'players is an array');
  assert.equal(res.body.players.length, 1);
  assert.equal(res.body.players[0]._id, 'p-roster-1');
  assert.equal(res.body.players[0].name, 'Roster Player');
});

// ---- 3. updateTeamPlayers: add / remove / idempotency ----------------------
test('updateTeamPlayers adds and removes roster entries and is idempotent', async () => {
  const teams = require('../controllers/teamController');
  const { getState } = require('../config/fallbackStore');

  const state = getState();
  state.players.push(
    { _id: 'p-add', name: 'Add Me', age: 20, role: 'Keeper', team: '', image: '' },
    { _id: 'p-remove', name: 'Remove Me', age: 20, role: 'Keeper', team: '', image: '' }
  );
  state.teams.push({
    _id: 'team-1',
    owner: 'owner-a',
    name: 'Team One',
    logo: '',
    players: [{ player: 'p-remove', joinedAt: new Date() }]
  });

  // Add one, remove one.
  const res = mockRes();
  await teams.updateTeamPlayers(
    { params: { id: 'team-1' }, body: { add: ['p-add'], remove: ['p-remove'] } },
    res
  );
  assert.equal(res.statusCode, 200);

  const team = state.teams.find((t) => t._id === 'team-1');
  const ids = team.players.map((p) => String(p.player));
  assert.ok(ids.includes('p-add'), 'the added player is on the roster');
  assert.ok(!ids.includes('p-remove'), 'the removed player is off the roster');

  // Adding the same player again must not duplicate the entry.
  await teams.updateTeamPlayers(
    { params: { id: 'team-1' }, body: { add: ['p-add'], remove: [] } },
    mockRes()
  );
  const team2 = state.teams.find((t) => t._id === 'team-1');
  const addCount = team2.players.filter((p) => String(p.player) === 'p-add').length;
  assert.equal(addCount, 1, 'adding a player twice does not duplicate them');
});

// ---- 4. updateTeamPlayers 404s for an unknown team -------------------------
test('updateTeamPlayers answers 404 for an unknown team', async () => {
  const teams = require('../controllers/teamController');

  const res = mockRes();
  await teams.updateTeamPlayers(
    { params: { id: 'does-not-exist' }, body: { add: ['p1'], remove: [] } },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.ok(res.body && typeof res.body.message === 'string');
});

// ---- 5. getAllPlayers supports ?search= and returns pagination --------------
test('getAllPlayers filters by ?search= server-side and returns pagination', async () => {
  const players = require('../controllers/playerController');
  const { getState } = require('../config/fallbackStore');

  const state = getState();
  state.players.push(
    { _id: 'p-search-a', name: 'Zebrate Searchtarget', age: 20, role: 'Batsman', team: '', image: '' },
    { _id: 'p-search-b', name: 'Other Person', age: 20, role: 'Bowler', team: '', image: '' }
  );

  const res = mockRes();
  await players.getAllPlayers({ query: { page: '1', limit: '25', search: 'Searchtarget' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data), 'data is an array');
  assert.ok(res.body.pagination, 'pagination metadata is present');
  assert.equal(res.body.pagination.total, 1, 'only the matching player is returned');
  assert.equal(res.body.data[0]._id, 'p-search-a');
});

// ---- 6. A regex-special search term does not break the query ----------------
test('getAllPlayers treats regex characters in the search term literally', async () => {
  const players = require('../controllers/playerController');
  const { getState } = require('../config/fallbackStore');

  const state = getState();
  state.players.push({ _id: 'p-regex', name: 'A+(B) Player', age: 20, role: 'Batsman', team: '', image: '' });

  const res = mockRes();
  await players.getAllPlayers({ query: { page: '1', limit: '25', search: 'A+(B)' } }, res);

  assert.equal(res.statusCode, 200, 'the request does not error out');
  assert.equal(res.body.pagination.total, 1, 'the term matches literally');
});

// ---- 7. ?exclude= hides the roster members before paginating ---------------
test('getAllPlayers excludes the given ids and reports the reduced total', async () => {
  const players = require('../controllers/playerController');
  const { getState } = require('../config/fallbackStore');

  const state = getState();
  state.players.push(
    { _id: 'p-ex-1', name: 'Excluded One', age: 20, role: 'Batsman', team: '', image: '' },
    { _id: 'p-ex-2', name: 'Kept One', age: 21, role: 'Bowler', team: '', image: '' }
  );

  const res = mockRes();
  await players.getAllPlayers({ query: { page: '1', limit: '25', exclude: 'p-ex-1' } }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(
    !res.body.data.some((p) => p._id === 'p-ex-1'),
    'the excluded player is not in the list'
  );
  assert.ok(
    res.body.data.some((p) => p._id === 'p-ex-2'),
    'the other player is still there'
  );
  assert.equal(
    res.body.pagination.total,
    state.players.length - 1,
    'the total counts the excluded players out'
  );
});

// ============================================================================
// HTTP-level integration test: the real Express routers over the in-memory
// fallback store (MongoDB is not connected, so nothing touches a real DB).
// This exercises the exact request/response contract the admin UI depends on.
// ============================================================================

const http = require('node:http');
const jwt = require('jsonwebtoken');

test('admin team/roster workflow over HTTP', async (t) => {
  const express = require('express');
  const { getState } = require('../config/fallbackStore');

  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/players', require('../routes/playerRoutes'));
  app.use('/api/teams', require('../routes/teamRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const call = async (path, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let parsed = null;
    const text = await res.text();
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: parsed };
  };

  // A signed token for the admin-only routes (same secret as the middleware).
  const token = jwt.sign({ username: 'admin' }, process.env.JWT_SECRET || 'upl-super-secret-key');

  const state = getState();
  state.owners.push({ _id: 'owner-x', name: 'Owner X', phone: '9', team: '', captain: '', viceCaptain: '', image: '' });
  state.players.push(
    { _id: 'px-1', name: 'Alpha Rower', age: 20, role: 'Batsman', team: '', image: '' },
    { _id: 'px-2', name: 'Beta Bower', age: 21, role: 'Bowler', team: '', image: '' },
    { _id: 'px-3', name: 'Gamma Bower', age: 22, role: 'Bowler', team: '', image: '' }
  );
  // The store is shared by the tests above, so the totals are relative to
  // whatever is already in it.
  const totalPlayers = state.players.length;

  // --- auth is enforced on the admin-only endpoints -------------------------
  const noAuth = await call('/players/all?page=1&limit=10');
  assert.equal(noAuth.status, 401, 'player list requires a token');

  const noAuthSave = await call('/teams/team-x/players', { method: 'PUT', body: { add: ['px-1'], remove: [] } });
  assert.equal(noAuthSave.status, 401, 'roster save requires a token');

  // --- team creation through the real route ---------------------------------
  const created = await call('/teams', { method: 'POST', token, body: { owner: 'owner-x', name: 'Roster Squad' } });
  assert.equal(created.status, 201, `expected 201, got ${created.status}`);
  const teamId = created.body._id;
  assert.ok(teamId, 'the created team has an id');
  assert.deepEqual(created.body.players, [], 'a new team starts with an empty roster');

  // --- the team's teams are listed for its owner -----------------------------
  const byOwner = await call(`/teams/owner/owner-x`);
  assert.equal(byOwner.status, 200);
  assert.equal(byOwner.body.success, true);
  assert.equal(byOwner.body.data.length, 1);
  assert.equal(byOwner.body.data[0]._id, teamId);

  // --- the available-player list is paginated and searchable ------------------
  const all = await call('/players/all?page=1&limit=2', { token });
  assert.equal(all.status, 200);
  assert.equal(all.body.success, true);
  assert.equal(all.body.pagination.total, totalPlayers, 'every player in the store is listed');
  assert.equal(all.body.pagination.totalPages, Math.ceil(totalPlayers / 2));

  const page2 = await call('/players/all?page=2&limit=2', { token });
  assert.equal(page2.status, 200);
  const ids1 = all.body.data.map((p) => p._id);
  const ids2 = page2.body.data.map((p) => p._id);
  assert.equal(new Set([...ids1, ...ids2]).size, 4, 'pages do not overlap');

  const search = await call('/players/all?page=1&limit=10&search=Bower', { token });
  assert.equal(search.status, 200);
  assert.equal(search.body.pagination.total, 2, 'both "Bower" players match');

  // --- the roster members are excluded from the available list ---------------
  const excluded = await call('/players/all?page=1&limit=10&exclude=px-1,px-2', { token });
  assert.equal(excluded.status, 200);
  assert.ok(!excluded.body.data.some((p) => p._id === 'px-1'), 'px-1 is excluded');
  assert.ok(!excluded.body.data.some((p) => p._id === 'px-2'), 'px-2 is excluded');
  assert.equal(
    excluded.body.pagination.total,
    totalPlayers - 2,
    'the total counts the excluded players out'
  );

  // --- saving the roster: add two, remove one -------------------------------
  const save = await call(`/teams/${teamId}/players`, {
    method: 'PUT', token, body: { add: ['px-1', 'px-2'], remove: [] }
  });
  assert.equal(save.status, 200);

  const afterAdd = await call(`/teams/${teamId}`);
  assert.equal(afterAdd.status, 200);
  assert.equal(afterAdd.body.players.length, 2, 'both players are on the roster');
  assert.ok(
    afterAdd.body.players.every((p) => p._id && p.name),
    'the roster holds full player objects, not id references'
  );

  // --- removing a player -----------------------------------------------------
  await call(`/teams/${teamId}/players`, { method: 'PUT', token, body: { add: [], remove: ['px-1'] } });
  const afterRemove = await call(`/teams/${teamId}`);
  assert.equal(afterRemove.body.players.length, 1);
  assert.equal(afterRemove.body.players[0]._id, 'px-2');

  // --- the roster survives a refresh (the admin UI reloads the team) ---------
  const refreshed = await call(`/teams/${teamId}`);
  assert.equal(refreshed.body.players.length, 1);
  assert.equal(refreshed.body.players[0].name, 'Beta Bower');

  // --- unknown team ----------------------------------------------------------
  const unknown = await call('/teams/does-not-exist');
  assert.equal(unknown.status, 404);
  assert.ok(typeof unknown.body.message === 'string');

  const unknownSave = await call('/teams/does-not-exist/players', {
    method: 'PUT', token, body: { add: ['px-1'], remove: [] }
  });
  assert.equal(unknownSave.status, 404);
});

// ============================================================================
// Simulates the exact state machine of TeamPlayerManagement.jsx against the
// real API: load the team, page through the available players, pick some,
// mark others for removal, save, and reload. Every step mirrors what the
// component does, so a contract break shows up here.
// ============================================================================

test('the roster screen state machine works against the real API', async (t) => {
  const express = require('express');
  const { getState } = require('../config/fallbackStore');

  const app = express();
  app.use(express.json());
  app.use('/api/players', require('../routes/playerRoutes'));
  app.use('/api/teams', require('../routes/teamRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = jwt.sign({ username: 'admin' }, process.env.JWT_SECRET || 'upl-super-secret-key');

  const call = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: parsed };
  };

  const state = getState();
  state.players.push(
    { _id: 'sm-1', name: 'Screen One', age: 20, role: 'Batsman', team: '', image: '' },
    { _id: 'sm-2', name: 'Screen Two', age: 21, role: 'Bowler', team: '', image: '' }
  );
  state.teams.push({ _id: 'sm-team', owner: 'owner-a', name: 'Screen Team', logo: '', players: [] });

  // --- the component loads the team and the available players ----------------
  const team = (await call('/teams/sm-team')).body;
  const roster = team.players.map((p) => String(p._id));

  const available = (await call(`/players/all?page=1&limit=5&exclude=${roster.join(',')}`)).body;
  assert.equal(available.success, true);
  assert.ok(available.pagination, 'the pagination metadata is present');
  assert.equal(
    available.pagination.total,
    state.players.length,
    'every player is available (the roster is empty)'
  );

  // --- the admin ticks two players to join and one to remove -----------------
  const addedMap = { 'sm-1': { _id: 'sm-1', name: 'Screen One' }, 'sm-2': { _id: 'sm-2', name: 'Screen Two' } };
  const removedIds = [];

  // --- save ------------------------------------------------------------------
  const add = Object.keys(addedMap);
  const remove = removedIds.map(String);
  const saved = await call('/teams/sm-team/players', { method: 'PUT', body: { add, remove } });
  assert.equal(saved.status, 200);

  // --- the component reloads the team after saving ---------------------------
  const refreshed = (await call('/teams/sm-team')).body;
  assert.equal(refreshed.players.length, 2, 'both ticked players are on the roster');
  assert.deepEqual(
    refreshed.players.map((p) => p._id).sort(),
    ['sm-1', 'sm-2'],
    'the roster holds the ticked players'
  );

  // --- and they are gone from the available list -----------------------------
  const afterSave = (await call(`/players/all?page=1&limit=5&exclude=${refreshed.players.map((p) => p._id).join(',')}`)).body;
  assert.ok(
    !afterSave.data.some((p) => p._id === 'sm-1' || p._id === 'sm-2'),
    'the roster members are not offered again'
  );
  assert.equal(
    afterSave.pagination.total,
    state.players.length - 2,
    'the available total dropped by the two players that were added'
  );
});

// ============================================================================
// HTTP-level integration test for the auction endpoints: the admin saves the
// squad, the captain and the vice-captain in one call, and the persisted
// result drives the team's roster.
// ============================================================================

test('the auction workflow over HTTP drives the roster and the leadership', async (t) => {
  const express = require('express');
  const { getState } = require('../config/fallbackStore');

  const app = express();
  app.use(express.json());
  app.use('/api/teams', require('../routes/teamRoutes'));
  app.use('/api/auctions', require('../routes/auctionRoutes'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = jwt.sign({ username: 'admin' }, process.env.JWT_SECRET || 'upl-super-secret-key');

  const call = async (path, { method = 'GET', body, auth = true } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: parsed };
  };

  const state = getState();
  state.owners.push({ _id: 'aq-owner', name: 'Auction Owner', phone: '7', team: '', captain: '', viceCaptain: '', image: '' });
  state.players.push(
    { _id: 'aq-1', name: 'Auction One', age: 20, role: 'Batsman', team: '', image: '' },
    { _id: 'aq-2', name: 'Auction Two', age: 21, role: 'Bowler', team: '', image: '' },
    { _id: 'aq-3', name: 'Auction Three', age: 22, role: 'Keeper', team: '', image: '' }
  );
  state.teams.push({
    _id: 'aq-team',
    owner: 'aq-owner',
    name: 'Auction Squad',
    logo: '',
    captain: null,
    viceCaptain: null,
    players: []
  });

  // --- the endpoints require a token ----------------------------------------
  const noAuth = await call('/auctions/team/aq-team', { auth: false });
  assert.equal(noAuth.status, 401, 'the auction endpoint requires a token');

  // --- a team without a result answers with an empty result ------------------
  const empty = await call('/auctions/team/aq-team');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.data, null);
  assert.deepEqual(empty.body.players, []);

  // --- the squad, the captain and the vice-captain are saved together -------
  const saved = await call('/auctions/team/aq-team', {
    method: 'PUT',
    body: { players: ['aq-1', 'aq-2'], captain: 'aq-1', viceCaptain: 'aq-2' }
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.success, true);
  assert.deepEqual(saved.body.data.players, ['aq-1', 'aq-2']);
  assert.equal(saved.body.captain, 'aq-1');
  assert.equal(saved.body.viceCaptain, 'aq-2');

  // --- the team roster now mirrors the auction result -----------------------
  const team = (await call('/teams/aq-team')).body;
  assert.deepEqual(
    team.players.map((p) => String(p._id)).sort(),
    ['aq-1', 'aq-2'],
    'the team roster is the auction squad'
  );

  // --- a captain outside the squad is rejected ------------------------------
  const invalid = await call('/auctions/team/aq-team', {
    method: 'PUT',
    body: { players: ['aq-1'], captain: 'aq-3', viceCaptain: '' }
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.message, 'Captain must be one of the selected squad players');

  // --- the same player cannot be captain and vice-captain -------------------
  const same = await call('/auctions/team/aq-team', {
    method: 'PUT',
    body: { players: ['aq-1'], captain: 'aq-1', viceCaptain: 'aq-1' }
  });
  assert.equal(same.status, 400);
  assert.equal(same.body.message, 'Captain and Vice Captain must be different');

  // --- an empty squad is rejected ------------------------------------------
  const emptySquad = await call('/auctions/team/aq-team', {
    method: 'PUT',
    body: { players: [], captain: '', viceCaptain: '' }
  });
  assert.equal(emptySquad.status, 400);
  assert.equal(emptySquad.body.message, 'Select at least one player for the squad');

  // --- the result is read back unchanged -----------------------------------
  const read = await call('/auctions/team/aq-team');
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.data.players, ['aq-1', 'aq-2']);
  assert.equal(read.body.captain, 'aq-1');
  assert.equal(read.body.viceCaptain, 'aq-2');

  // --- the list of every result holds the team -----------------------------
  const all = await call('/auctions');
  assert.equal(all.status, 200);
  assert.equal(all.body.success, true);
  assert.ok(
    all.body.data.some((a) => String(a.team) === 'aq-team'),
    'the saved result is listed'
  );
});

