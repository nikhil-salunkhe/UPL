import api from './api';

export const getPlayers = async () => {
  const response = await api.get('/players');
  return response.data;
};

export const searchPlayers = async ({ name, role } = {}) => {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (role) params.set('role', role);
  const response = await api.get(`/players/search?${params.toString()}`);
  return response.data;
};

export const createPlayer = async (payload) => {
  const response = await api.post('/players', payload);
  return response.data;
};

export const registerPlayer = async (payload) => {
  // Self-registration uploads a photo (multipart) and can first hit Render's
  // sleeping free instance, which takes 20–40s to wake. Give this single
  // request far more time than the 15s timeout used by the paginated list
  // endpoints — deliberately NOT raised for list requests, so genuinely slow
  // queries still fail fast instead of hiding the problem.
  const response = await api.post('/players/register', payload, { timeout: 45000 });
  return response.data;
};

export const getAllPlayers = async ({ page = 1, limit = 25, status, search, exclude } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'all') params.set('status', status);
  if (search && String(search).trim()) params.set('search', String(search).trim());
  // Ids to hide from the list (e.g. the players already on the team). They are
  // excluded server-side so the pagination totals stay correct.
  const excludeIds = (Array.isArray(exclude) ? exclude : exclude ? [exclude] : [])
    .map((id) => String(id))
    .filter(Boolean);
  if (excludeIds.length) params.set('exclude', excludeIds.join(','));
  const response = await api.get(`/players/all?${params.toString()}`);
  const body = response.data;
  // Older backends return a bare array (no envelope). Normalize so both shapes
  // work regardless of which service deploys first.
  if (Array.isArray(body)) {
    return { success: true, data: body, pagination: null, counts: null };
  }
  return body;
};

export const approvePlayer = async (id) => {
  const response = await api.patch(`/players/${id}/approve`);
  return response.data;
};

export const updatePlayer = async (id, payload) => {
  const response = await api.put(`/players/${id}`, payload);
  return response.data;
};

export const deletePlayer = async (id) => {
  const response = await api.delete(`/players/${id}`);
  return response.data;
};
