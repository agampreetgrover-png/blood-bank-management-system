import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { readSession, saveSession, clearSession, subscribe } from '../services/session';

const AuthContext = createContext(null);

const savedAdmin = () => readSession('admin')?.profile || null;

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(savedAdmin);

  // Follows the session when it ends after a 401 (services/api.js) or changes in another tab
  useEffect(() => subscribe('admin', () => setAdmin(savedAdmin())), []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    saveSession('admin', response.data.token, response.data.admin);
    return response.data;
  };

  const logout = () => clearSession('admin');

  return (
    <AuthContext.Provider value={{ admin, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
