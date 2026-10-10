const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  statusFilter,
  matchesStatus,
  countByStatus
} = require('../utils/queryHelper');

test('parsePagination uses defaults when no query params are given', () => {
  const parsed = parsePagination({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.limit, DEFAULT_LIMIT);
  assert.equal(parsed.skip, 0);
  assert.equal(parsed.status, undefined);
});

test('parsePagination accepts valid page and limit', () => {
  const parsed = parsePagination({ page: '3', limit: '50' });
  assert.equal(parsed.page, 3);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.skip, 100);
});

test('parsePagination clamps oversized limits to MAX_LIMIT', () => {
  const parsed = parsePagination({ limit: String(MAX_LIMIT + 500) });
  assert.equal(parsed.limit, MAX_LIMIT);
});

test('parsePagination rejects invalid page values', () => {
  assert.ok(parsePagination({ page: '0' }).error);
  assert.ok(parsePagination({ page: '-2' }).error);
  assert.ok(parsePagination({ page: 'abc' }).error);
  assert.ok(parsePagination({ page: '2.5' }).error);
});

test('parsePagination rejects invalid limit values', () => {
  assert.ok(parsePagination({ limit: '0' }).error);
  assert.ok(parsePagination({ limit: 'ten' }).error);
  assert.ok(parsePagination({ limit: '-1' }).error);
});

test('parsePagination accepts known statuses and "all"', () => {
  assert.equal(parsePagination({ status: 'pending' }).status, 'pending');
  assert.equal(parsePagination({ status: 'approved' }).status, 'approved');
  assert.equal(parsePagination({ status: 'all' }).status, undefined);
});

test('parsePagination rejects unknown statuses', () => {
  assert.ok(parsePagination({ status: 'rejected' }).error);
  assert.ok(parsePagination({ status: 'bogus' }).error);
});

test('statusFilter builds correct Mongo filters', () => {
  assert.deepEqual(statusFilter('pending'), { status: 'pending' });
  assert.deepEqual(statusFilter('approved'), { status: { $in: ['approved', null] } });
  assert.deepEqual(statusFilter(undefined), {});
  assert.deepEqual(statusFilter('all'), {});
});

test('matchesStatus treats missing status as approved (legacy documents)', () => {
  assert.equal(matchesStatus({ status: 'pending' }, 'pending'), true);
  assert.equal(matchesStatus({ status: 'approved' }, 'pending'), false);
  assert.equal(matchesStatus({}, 'pending'), false);
  assert.equal(matchesStatus({}, 'approved'), true);
  assert.equal(matchesStatus({ status: 'approved' }, 'approved'), true);
  assert.equal(matchesStatus({ status: 'pending' }, undefined), true);
});

test('countByStatus counts pending separately and the rest as approved', () => {
  const counts = countByStatus([
    { status: 'pending' },
    { status: 'pending' },
    { status: 'approved' },
    {} // legacy doc without status
  ]);
  assert.deepEqual(counts, { all: 4, pending: 2, approved: 2 });
});
