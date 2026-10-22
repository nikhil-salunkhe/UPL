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

// Escapes a user-supplied search term so it can be used inside a Mongo $regex
// literally. Without this, characters like `(`, `+` or `?` would change the
// meaning of the expression and could even throw a regex compile error.
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Free-text search across name / role / team. Returns a Mongo filter when
// `text` is a non-empty string, otherwise an empty filter (matches all).
function searchFilter(text, fields = ['name', 'role', 'team']) {
  const term = typeof text === 'string' ? text.trim() : '';
  if (!term) return {};

  const pattern = new RegExp(escapeRegex(term), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

// Same rule as searchFilter, for in-memory lists (fallback store / tests).
function matchesSearch(player, text, fields = ['name', 'role', 'team']) {
  const term = typeof text === 'string' ? text.trim().toLowerCase() : '';
  if (!term) return true;
  return fields.some((field) => {
    const value = player?.[field];
    return typeof value === 'string' && value.toLowerCase().includes(term);
  });
}

// "Added after" date filter for player lists. A player's "adding time" is the
// document's createdAt (registration / approval time). Accepts YYYY-MM-DD, a
// partial ISO-8601 string, or anything Date.parse understands.
function addedAfterFilter(value) {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (!parsed) return {};
  const date = Date.parse(parsed);
  if (Number.isNaN(date)) {
    return { error: 'addedAfter must be a valid date (YYYY-MM-DD or ISO-8601)' };
  }
  return { createdAt: { $gte: new Date(date) } };
}

// Same rule as addedAfterFilter, for in-memory lists (fallback store / tests).
function matchesAddedAfter(player, value) {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (!parsed) return true;
  const date = Date.parse(parsed);
  if (Number.isNaN(date)) return false;

  const createdAt = player?.createdAt;
  let playerMs;
  if (typeof createdAt === 'number') {
    playerMs = createdAt;
  } else if (createdAt instanceof Date) {
    playerMs = createdAt.getTime();
  } else if (typeof createdAt === 'string') {
    playerMs = Date.parse(createdAt);
  } else {
    playerMs = NaN;
  }
  // No recorded adding time (fallback store writes): keep the player in the
  // result rather than silently hiding it from a date filter that cannot see
  // its creation time.
  if (playerMs === undefined || Number.isNaN(playerMs)) return true;
  return playerMs >= date;
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  STATUSES,
  parsePagination,
  statusFilter,
  matchesStatus,
  countByStatus,
  escapeRegex,
  searchFilter,
  matchesSearch,
  addedAfterFilter,
  matchesAddedAfter
};
