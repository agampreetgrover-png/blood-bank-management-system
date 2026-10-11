import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach the admin token inside the admin panel, and the public user token everywhere else
api.interceptors.request.use((config) => {
  const isAdminArea = window.location.pathname.startsWith('/admin');
  const token = localStorage.getItem(isAdminArea ? 'token' : 'userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Expired admin session: send staff back to the admin login (public pages are unaffected)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = window.location.pathname;
    // Only admin requests can expire the admin session; a failed public login must not log staff out
    if (error.response?.status === 401 && path.startsWith('/admin') && path !== '/admin/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
