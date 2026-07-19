import api from './api';

export const getPlayers = async () => {
  const response = await api.get('/players');
  return response.data;
};

export const createPlayer = async (payload) => {
  const response = await api.post('/players', payload);
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
