import axios from 'axios';
import { readSession, clearSession } from './session';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach the admin token inside the admin panel, and the public user token everywhere else
api.interceptors.request.use((config) => {
  const kind = window.location.pathname.startsWith('/admin') ? 'admin' : 'user';
  const token = readSession(kind)?.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.session = { kind, token };
  }
  return config;
});

// A 401 on a request that carried a token means that session is over (expired, deactivated or password reset).
// Ending it here lets the route guards send the person to the right login page.
// Requests without a token (e.g. a wrong password at login) never end a session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sent = error.config?.session;
    // Skip if a newer session was started while this request was in flight
    if (error.response?.status === 401 && sent && readSession(sent.kind)?.token === sent.token) {
      clearSession(sent.kind);
    }
    return Promise.reject(error);
  }
);

export default api;
