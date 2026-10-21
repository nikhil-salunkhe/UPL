import api from './api';

export const getTeams = async ({ page = 1, limit = 24 } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await api.get(`/teams?${params.toString()}`);
  return response.data;
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
