import api from './api';

export const getOwners = async () => {
  const response = await api.get('/owners');
  return response.data;
};

export const createOwner = async (payload) => {
  const response = await api.post('/owners', payload);
  return response.data;
};

export const updateOwner = async (id, payload) => {
  const response = await api.put(`/owners/${id}`, payload);
  return response.data;
};

export const deleteOwner = async (id) => {
  const response = await api.delete(`/owners/${id}`);
  return response.data;
};
