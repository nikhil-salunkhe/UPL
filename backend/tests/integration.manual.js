// Manual end-to-end test for the admin player-list fix.
//
// SAFETY: refuses to run unless the target database name contains "test",
// so it can never touch production data (upl_tournament). It only writes to
// the Player collection of that test database (120 synthetic players).
//
// Usage:
//   1. Start the server against the SAME test database:
//        MONGODB_URI=<test uri> PORT=5050 node server.js
//   2. Run:
//        TEST_MONGODB_URI=<test uri> TEST_BASE_URL=http://localhost:5050/api \
//        node tests/integration.manual.js
//
// Not part of `npm test` (filename does not match *.test.js).

const mongoose = require('mongoose');

const TEST_URI = process.env.TEST_MONGODB_URI;
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5050/api';

if (!TEST_URI) {
  console.error('REFUSED: set TEST_MONGODB_URI to an isolated *test* database.');
  process.exit(2);
}
const dbName = (TEST_URI.split('?')[0].split('/').pop() || '');
if (!/test/i.test(dbName)) {
  console.error(`REFUSED: database "${dbName}" does not look like a test database.`);
  process.exit(2);
}

let pass = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name} ${detail}`);
  }
};

const jsonHeaders = (token) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  'Content-Type': 'application/json'
});

async function req(path, opts = {}) {
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, opts);
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, headers: response.headers, text, body, ms: Date.now() - started, bytes: Buffer.byteLength(text) };
}

async function seed() {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
  const Player = require('../models/Player');
  await Player.deleteMany({}); // test database only (guarded above)

  // ~150 KB base64 photos — same order of magnitude as production photos.
  const photo = 'data:image/png;base64,' + Buffer.alloc(150 * 1024).fill('UPL-PHOTO-BYTES').toString('base64');
  const docs = [];
  for (let i = 0; i < 120; i += 1) {
    docs.push({
      name: `Test Player ${String(i + 1).padStart(3, '0')}`,
      age: 18 + (i % 15),
      role: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'][i % 4],
      team: i % 3 === 0 ? '' : `Team ${(i % 8) + 1}`,
      phone: `90000000${String(i % 100).padStart(2, '0')}`,
      image: i === 119 ? '' : photo, // last player has no photo
      status: i % 3 === 0 ? 'pending' : 'approved', // 40 pending / 80 approved
      createdAt: new Date(Date.now() - i * 60000)
    });
  }
  await Player.insertMany(docs);
  await mongoose.disconnect();
  console.log('Seeded 120 synthetic players (40 pending / 80 approved) into', dbName);
}

async function run() {
  const results = {};

  // --- auth ---------------------------------------------------------------
  const noAuth = await req('/players/all?page=1&limit=25');
  check('admin list rejects requests without a token (401)', noAuth.status === 401);

  const badAuth = await req('/players/all?page=1&limit=25', { headers: jsonHeaders('not-a-real-token') });
  check('admin list rejects invalid tokens (401)', badAuth.status === 401);

  const login = await req('/admin/login', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  check('admin login works', login.status === 200 && !!login.body?.token);
  const token = login.body?.token;
  if (!token) throw new Error('cannot continue without token');

  // --- pagination ---------------------------------------------------------
  const p1 = await req('/players/all?page=1&limit=25', { headers: jsonHeaders(token) });
  results.page = p1;
  check('page 1 returns 200', p1.status === 200);
  check('page 1 returns envelope with data[]', Array.isArray(p1.body?.data));
  check('page 1 has exactly 25 players', p1.body?.data?.length === 25, `got ${p1.body?.data?.length}`);
  check('page 1 excludes image field', p1.body?.data?.every((p) => p.image === undefined));
  check('pagination total = 120', p1.body?.pagination?.total === 120, JSON.stringify(p1.body?.pagination));
  check('totalPages = 5', p1.body?.pagination?.totalPages === 5);
  check('counts = 120/40/80', JSON.stringify(p1.body?.counts) === JSON.stringify({ all: 120, pending: 40, approved: 80 }), JSON.stringify(p1.body?.counts));
  check('page 1 payload < 100 KB', p1.bytes < 100 * 1024, `${p1.bytes} bytes`);
  check('page 1 responds < 10s (old axios timeout)', p1.ms < 10000, `${p1.ms}ms`);

  const p5 = await req('/players/all?page=5&limit=25', { headers: jsonHeaders(token) });
  check('page 5 returns remaining 20 players', p5.body?.data?.length === 20, `got ${p5.body?.data?.length}`);

  const p6 = await req('/players/all?page=6&limit=25', { headers: jsonHeaders(token) });
  check('page beyond range returns empty data + 200 (graceful)', p6.status === 200 && p6.body?.data?.length === 0 && p6.body?.pagination?.total === 120);

  // --- validation ---------------------------------------------------------
  check('page=0 → 400', (await req('/players/all?page=0', { headers: jsonHeaders(token) })).status === 400);
  check('limit=abc → 400', (await req('/players/all?limit=abc', { headers: jsonHeaders(token) })).status === 400);
  check('status=bogus → 400', (await req('/players/all?status=bogus', { headers: jsonHeaders(token) })).status === 400);

  // --- status filtering ---------------------------------------------------
  const pending = await req('/players/all?page=1&limit=50&status=pending', { headers: jsonHeaders(token) });
  check('status=pending filters correctly', pending.body?.pagination?.total === 40 && pending.body?.data?.every((p) => p.status === 'pending'), `total=${pending.body?.pagination?.total}`);

  const approved = await req('/players/all?page=1&limit=100&status=approved', { headers: jsonHeaders(token) });
  check('status=approved filters correctly', approved.body?.pagination?.total === 80 && approved.body?.data?.every((p) => p.status !== 'pending'), `total=${approved.body?.pagination?.total}`);

  // --- legacy (old client) shape -----------------------------------------
  const legacy = await req('/players/all', { headers: jsonHeaders(token) });
  results.legacy = legacy;
  check('no params → bare array (old-client compatibility)', Array.isArray(legacy.body));
  check('legacy array still excludes images', Array.isArray(legacy.body) && legacy.body.every((p) => p.image === undefined));
  check('legacy array returns all 120 players', Array.isArray(legacy.body) && legacy.body.length === 120);

  // --- public list --------------------------------------------------------
  const pub = await req('/players');
  results.public = pub;
  check('public list returns array of approved only', Array.isArray(pub.body) && pub.body.length === 80, `len=${Array.isArray(pub.body) ? pub.body.length : 'n/a'}`);
  check('public list excludes pending players', Array.isArray(pub.body) && pub.body.every((p) => p.status !== 'pending'));
  check('public list excludes images', Array.isArray(pub.body) && pub.body.every((p) => p.image === undefined));
  check('public list payload < 100 KB', pub.bytes < 100 * 1024, `${pub.bytes} bytes`);
  check('public list responds < 10s', pub.ms < 10000, `${pub.ms}ms`);

  // --- on-demand image endpoint ------------------------------------------
  const withPhoto = p1.body.data[1];
  const img = await req(`/players/${withPhoto._id}/image`);
  check('image endpoint returns 200 with image content-type', img.status === 200 && (img.headers.get('content-type') || '').startsWith('image/'), img.headers.get('content-type'));
  check('image endpoint sends real bytes', img.bytes > 100 * 1024, `${img.bytes} bytes`);
  check('image endpoint sets cache header', (img.headers.get('cache-control') || '').includes('max-age'));

  const p5List = (await req('/players/all?page=5&limit=25', { headers: jsonHeaders(token) })).body?.data || [];
  const noPhoto = p5List.find((p) => p.name === 'Test Player 120');
  const img404 = noPhoto ? await req(`/players/${noPhoto._id}/image`) : { status: -1 };
  check('player without photo → 404 JSON', img404.status === 404, `status=${img404.status}`);
  check('invalid id → 400', (await req('/players/not-an-id/image')).status === 400);
  check('unknown player id → 404', (await req('/players/000000000000000000000000/image')).status === 404);

  // --- unknown route → JSON 404 ------------------------------------------
  const notFound = await req('/definitely-not-a-route');
  check('unknown API route → JSON 404', notFound.status === 404 && !!notFound.body?.message, `${notFound.status}`);

  // --- approval workflow (synthetic player, test DB only) -----------------
  const reg = await req('/players/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Workflow Probe', role: 'Bowler', team: '' })
  });
  check('public registration creates a pending player', reg.status === 201 && reg.body?.status === 'pending', `status=${reg.body?.status}`);
  const probeId = reg.body?._id;

  const afterRegister = await req('/players/all?page=1&limit=1', { headers: jsonHeaders(token) });
  check('registered player appears as pending in admin list', afterRegister.body?.counts?.pending === 41 && afterRegister.body?.counts?.all === 121, JSON.stringify(afterRegister.body?.counts));

  const approve = await req(`/players/${probeId}/approve`, { method: 'PATCH', headers: jsonHeaders(token) });
  check('admin can approve a pending player', approve.status === 200 && approve.body?.status === 'approved', `status=${approve.status}`);

  const afterApprove = await req('/players/all?page=1&limit=1&status=pending', { headers: jsonHeaders(token) });
  check('approved player leaves the pending list', afterApprove.body?.pagination?.total === 40, `total=${afterApprove.body?.pagination?.total}`);

  const pubAfterApprove = await req('/players');
  check('approved player shows in public list', Array.isArray(pubAfterApprove.body) && pubAfterApprove.body.length === 81, `len=${Array.isArray(pubAfterApprove.body) ? pubAfterApprove.body.length : 'n/a'}`);

  const reject = await req(`/players/${probeId}`, { method: 'DELETE', headers: jsonHeaders(token) });
  check('admin can reject (delete) a player', reject.status === 200);

  const afterReject = await req('/players/all?page=1&limit=1', { headers: jsonHeaders(token) });
  check('rejected player is gone, totals restored', afterReject.body?.counts?.all === 120 && afterReject.body?.counts?.pending === 40, JSON.stringify(afterReject.body?.counts));

  // --- edit keeps photo (list has no image field) -------------------------
  const editTarget = p1.body.data[0];
  const editForm = new FormData();
  editForm.append('name', editTarget.name);
  editForm.append('role', editTarget.role);
  editForm.append('team', editTarget.team || '');
  // FormData: send ONLY Authorization — fetch must set the multipart
  // boundary itself (a manual Content-Type would break parsing).
  const edit = await req(`/players/${editTarget._id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: editForm });
  check('edit without image field succeeds', edit.status === 200, `status=${edit.status}`);
  const editImg = await req(`/players/${editTarget._id}/image`);
  check('edit preserves the existing photo', editImg.status === 200, `status=${editImg.status}`);

  // --- concurrency (15 parallel paginated requests) -----------------------
  const concStarted = Date.now();
  const conc = await Promise.all(
    Array.from({ length: 15 }, (_, i) => req(`/players/all?page=${(i % 5) + 1}&limit=25`, { headers: jsonHeaders(token) }))
  );
  const concMs = Date.now() - concStarted;
  results.concurrency = { ms: concMs };
  check('15 concurrent admin list requests all succeed', conc.every((r) => r.status === 200));
  check('concurrent burst finishes < 10s', concMs < 10000, `${concMs}ms`);

  const allPages = await Promise.all([1, 2, 3, 4, 5].map((pg) => req(`/players/all?page=${pg}&limit=25`, { headers: jsonHeaders(token) })));
  const ids = allPages.flatMap((r) => r.body.data.map((p) => p._id));
  check('no duplicate players across pages 1-5 (120 unique)', new Set(ids).size === 120, `unique=${new Set(ids).size}`);

  // --- report -------------------------------------------------------------
  console.log('\n=== PERFORMANCE (local server -> Atlas test DB, 120 players w/ photos) ===');
  console.log(`GET /players/all?page=1&limit=25 : ${results.page.ms}ms, ${results.page.bytes} bytes`);
  console.log(`GET /players/all (legacy array)  : ${results.legacy.ms}ms, ${results.legacy.bytes} bytes`);
  console.log(`GET /players (public, 80 players): ${results.public.ms}ms, ${results.public.bytes} bytes`);
  console.log(`15 concurrent admin requests     : ${results.concurrency.ms}ms total`);
  console.log(`\n=== RESULT: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    failures.forEach((f) => console.log('  FAILED:', f));
    process.exit(1);
  }
  process.exit(0);
}

(async () => {
  try {
    await seed();
    await run();
  } catch (error) {
    console.error('INTEGRATION TEST ERROR:', error.message);
    process.exit(1);
  }
})();


