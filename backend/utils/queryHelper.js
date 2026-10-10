// Shared helpers for building list queries. Kept pure (no database, no
// Express) so they can be unit tested with `npm test` (node --test).

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 1000;
const STATUSES = ['pending', 'approved'];

// Parses ?page, ?limit and ?status for paginated list endpoints.
// Returns { page, limit, skip, status } on success or { error } on invalid input.
function parsePagination(query = {}) {
  const result = {
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
    skip: 0,
    status: undefined
  };

  if (query.page !== undefined) {
    const page = Number(query.page);
    if (!Number.isInteger(page) || page < 1) {
      return { error: 'page must be a positive integer' };
    }
    result.page = page;
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      return { error: 'limit must be a positive integer' };
    }
    result.limit = Math.min(limit, MAX_LIMIT);
  }

  if (query.status !== undefined && query.status !== 'all') {
    if (!STATUSES.includes(query.status)) {
      return { error: `status must be one of: ${STATUSES.join(', ')}` };
    }
    result.status = query.status;
  }

  result.skip = (result.page - 1) * result.limit;
  return result;
}

// Mongo filter for a status. 'approved' also matches legacy documents stored
// before the status field existed (null / missing), matching the public list.
function statusFilter(status) {
  if (status === 'pending') return { status: 'pending' };
  if (status === 'approved') return { status: { $in: ['approved', null] } };
  return {};
}

// Same rule as statusFilter, for in-memory lists (fallback store / tests).
function matchesStatus(player, status) {
  if (status === 'pending') return player.status === 'pending';
  if (status === 'approved') return !player.status || player.status === 'approved';
  return true;
}

// Counts used by the admin filter chips. Documents without a status count as approved.
function countByStatus(list) {
  const pending = list.filter((player) => player.status === 'pending').length;
  return { all: list.length, pending, approved: list.length - pending };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  STATUSES,
  parsePagination,
  statusFilter,
  matchesStatus,
  countByStatus
};
