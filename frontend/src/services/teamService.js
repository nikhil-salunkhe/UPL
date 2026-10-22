import api from './api';

export const getTeams = async ({ page = 1, limit = 24 } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await api.get(`/teams?${params.toString()}`);
  const body = response.data;
  // Older backends return a bare array; normalize to the envelope shape.
  if (Array.isArray(body)) {
    return { success: true, data: body, pagination: null };
  }
  return body;
};

export const getTeamsByOwner = async (ownerId) => {
  const response = await api.get(`/teams/owner/${ownerId}`);
  const body = response.data;
  // Older backends return a bare array; normalize to the envelope shape.
  if (Array.isArray(body)) {
    return { success: true, data: body, pagination: null };
  }
  return body;
};

export const getTeam = async (id) => {
  const response = await api.get(`/teams/${id}`);
  return response.data;
};

export const createTeam = async (payload) => {
  const hasFile = payload?.logo && typeof payload.logo !== 'string';
  const body = hasFile ? (() => {
    const fd = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'logo' && typeof value !== 'string') fd.append('logo', value);
      else if (typeof value === 'boolean') fd.append(key, value ? 'true' : 'false');
      else fd.append(key, value);
    });
    return fd;
  })() : payload;
  const response = await api.post('/teams', body);
  return response.data;
};

export const updateTeamPlayers = async (id, { add = [], remove = [] } = {}) => {
  const response = await api.put(`/teams/${id}/players`, { add, remove });
  return response.data;
};

export const updateTeam = async (id, payload) => {
  const hasFile = payload?.logo && typeof payload.logo !== 'string';
  const body = hasFile ? (() => {
    const fd = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'logo' && typeof value !== 'string') fd.append('logo', value);
      else if (typeof value === 'boolean') fd.append(key, value ? 'true' : 'false');
      else fd.append(key, value);
    });
    return fd;
  })() : payload;
  const response = await api.put(`/teams/${id}`, body);
  return response.data;
};

export const deleteTeam = async (id) => {
  const response = await api.delete(`/teams/${id}`);
  return response.data;
};

// ---------------------------------------------------------------------------
// Auctions
//
// The auction result is the single source of truth for a team's squad,
// captain and vice-captain.
// ---------------------------------------------------------------------------

export const getTeamAuction = async (teamId) => {
  const response = await api.get(`/auctions/team/${teamId}`);
  return response.data;
};

export const getAuctionResults = async () => {
  const response = await api.get('/auctions');
  return response.data;
};

export const saveTeamAuction = async (teamId, { players = [], captain = '', viceCaptain = '' } = {}) => {
  const response = await api.put(`/auctions/team/${teamId}`, { players, captain, viceCaptain });
  return response.data;
};
