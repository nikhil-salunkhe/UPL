import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000
});

const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';
export const apiBaseUrl = rawBaseUrl.replace(/\/api$/, '');

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
