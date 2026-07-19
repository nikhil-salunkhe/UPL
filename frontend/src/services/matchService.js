import api from './api';

export const getMatches = async () => {
  const response = await api.get('/matches');
  return response.data;
};

export const createMatch = async (payload) => {
  const response = await api.post('/matches', payload);
  return response.data;
};

export const updateMatch = async (id, payload) => {
  const response = await api.put(`/matches/${id}`, payload);
  return response.data;
};

export const deleteMatch = async (id) => {
  const response = await api.delete(`/matches/${id}`);
  return response.data;
};