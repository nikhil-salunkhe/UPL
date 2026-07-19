import api from './api';

export const getTournament = async () => {
  const response = await api.get('/tournament');
  return response.data;
};

export const saveTournament = async (payload) => {
  const response = await api.post('/tournament', payload);
  return response.data;
};