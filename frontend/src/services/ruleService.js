import api from './api';

export const getRules = async () => {
  const response = await api.get('/rules');
  return response.data;
};

export const getAllRules = async () => {
  const response = await api.get('/rules/all');
  return response.data;
};

export const createRule = async (payload) => {
  const response = await api.post('/rules', payload);
  return response.data;
};

export const updateRule = async (id, payload) => {
  const response = await api.put(`/rules/${id}`, payload);
  return response.data;
};

export const deleteRule = async (id) => {
  const response = await api.delete(`/rules/${id}`);
  return response.data;
};
