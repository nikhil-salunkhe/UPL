import api from './api';

export const getAdvertisements = async () => {
  const response = await api.get('/advertisements');
  return response.data;
};

export const getAllAdvertisements = async () => {
  const response = await api.get('/advertisements/all');
  return response.data;
};

const toAdFormData = (payload) => {
  // Banner uploads need multipart; plain objects can go as FormData too.
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'banner' && typeof value !== 'string') {
      formData.append('banner', value);
    } else if (typeof value === 'boolean') {
      formData.append(key, value ? 'true' : 'false');
    } else {
      formData.append(key, value);
    }
  });
  return formData;
};

export const createAdvertisement = async (payload) => {
  const hasFile = payload?.banner && typeof payload.banner !== 'string';
  const body = hasFile ? toAdFormData(payload) : payload;
  const response = await api.post('/advertisements', body);
  return response.data;
};

export const updateAdvertisement = async (id, payload) => {
  const hasFile = payload?.banner && typeof payload.banner !== 'string';
  const body = hasFile ? toAdFormData(payload) : payload;
  const response = await api.put(`/advertisements/${id}`, body);
  return response.data;
};

export const deleteAdvertisement = async (id) => {
  const response = await api.delete(`/advertisements/${id}`);
  return response.data;
};
