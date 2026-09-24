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

// Auto-logout: if the stored admin token is missing, expired (8h) or was
// issued before JWT_SECRET changed, the API answers 401. Clear the stale
// token and send the admin back to the login page instead of failing silently.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isLoginAttempt = requestUrl.includes('/admin/login');

    if (status === 401 && !isLoginAttempt && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('adminToken');
      if (window.location.pathname !== '/admin/login') {
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
