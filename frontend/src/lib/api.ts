import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_PATH_RE = /\/auth\/(login|register|forgot-password|reset-password)/i;

function isPublicAppPath(pathname: string) {
  return (
    pathname.includes('/login') ||
    pathname.includes('/register') ||
    pathname.includes('/forgot-password') ||
    pathname.includes('/reset-password')
  );
}

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle token expiration — never wipe a successful login with a stale 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl = String(error.config?.url || '');
      const onPublicPage = isPublicAppPath(window.location.pathname);

      // Failed login/register must not clear storage or force a full reload
      if (!AUTH_PATH_RE.test(requestUrl) && !onPublicPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
