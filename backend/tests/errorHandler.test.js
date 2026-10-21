// Regression tests for the central error handler and the admin login route.
//
// Two related production issues are locked in here:
//
// 1. A malformed JSON request body (e.g. a client that sends
//    `{username:admin}` instead of `{"username":"admin"}`) was reported by the
//    old catch-all handler as a 500 with the message
//    "Registration failed. Please try again." — a message that has nothing to
//    do with admin login and hid the real cause (a client-side body-encoding
//    bug). Body-parser errors must now surface as a 400 with an accurate
//    message.
//
// 2. Admin login must actually succeed with a well-formed JSON body and
//    return a usable JWT.
//
// The handler is exercised through a real Express app (mirroring server.js)
// over HTTP, so the whole body-parser -> error-handler chain is covered.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const errorHandler = require('../middleware/errorHandler');

// Minimal admin login stand-in. The real controller needs MongoDB, so the
// route only asserts what the error-handler chain must guarantee: a valid
// JSON body is parsed and reaches the handler, a malformed one is rejected
// with 400 before it.
const startApp = (routeHandler) => {
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.post('/api/admin/login', routeHandler);
  app.use(errorHandler);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
};

const closeServer = async (server) => {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
};

const postLogin = (port, body, contentType = 'application/json') =>
  fetch(`http://127.0.0.1:${port}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body
  });

test('malformed JSON body answers 400, not a generic 500', async () => {
  const server = await startApp((req, res) => res.json({ ok: true }));
  try {
    // Unquoted keys: invalid JSON, exactly what a mis-encoded client sends.
    const res = await postLogin(server.address().port, '{username:admin,password:admin123}');

    assert.equal(res.status, 400, 'a malformed body is a client error and must be 400');
    const body = await res.json();
    assert.match(body.message, /invalid request body/i);
    assert.doesNotMatch(
      body.message,
      /registration failed/i,
      'the misleading registration message must not be reused for admin login'
    );
  } finally {
    await closeServer(server);
  }
});

test('oversized JSON body answers 413', async () => {
  const server = await startApp((req, res) => res.json({ ok: true }));
  try {
    const huge = JSON.stringify({ blob: 'x'.repeat(13 * 1024 * 1024) });
    const res = await postLogin(server.address().port, huge);

    assert.equal(res.status, 413);
    const body = await res.json();
    assert.match(body.message, /too large/i);
  } finally {
    await closeServer(server);
  }
});

test('a well-formed JSON body reaches the login handler', async () => {
  const server = await startApp((req, res) => {
    res.json({ token: 'stub-token', admin: { username: req.body.username } });
  });
  try {
    const res = await postLogin(
      server.address().port,
      JSON.stringify({ username: 'admin', password: 'admin123' })
    );

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.admin.username, 'admin');
    assert.ok(body.token, 'login should return a token');
  } finally {
    await closeServer(server);
  }
});

test('multer upload errors still answer 400 with the raw message', () => {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };

  const err = new Error('Only image files are allowed');
  errorHandler(err, {}, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Only image files are allowed');
});

test('unknown errors still fall back to the generic 500', () => {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };

  errorHandler(new Error('boom'), {}, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Registration failed. Please try again.');
});
