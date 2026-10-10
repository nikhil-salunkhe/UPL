import api from './api';

export const getPlayers = async () => {
  const response = await api.get('/players');
  return response.data;
};

export const createPlayer = async (payload) => {
  const response = await api.post('/players', payload);
  return response.data;
};

export const registerPlayer = async (payload) => {
  const response = await api.post('/players/register', payload);
  return response.data;
};

export const getAllPlayers = async ({ page = 1, limit = 25, status } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'all') params.set('status', status);
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
