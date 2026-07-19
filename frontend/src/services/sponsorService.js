import api from './api';

export const getSponsors = async () => {
  const response = await api.get('/sponsors');
  return response.data;
};

export const createSponsor = async (payload) => {
  const response = await api.post('/sponsors', payload);
  return response.data;
};

export const updateSponsor = async (id, payload) => {
  const response = await api.put(`/sponsors/${id}`, payload);
  return response.data;
};

export const deleteSponsor = async (id) => {
  const response = await api.delete(`/sponsors/${id}`);
  return response.data;
};
