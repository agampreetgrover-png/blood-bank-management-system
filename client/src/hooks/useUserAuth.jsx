import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Public website accounts - kept separate from the admin session in useAuth
const UserAuthContext = createContext(null);

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const saveSession = ({ token, user: userData }) => {
    localStorage.setItem('userToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (identifier, password) => {
    const response = await api.post('/users/login', { identifier, password });
    saveSession(response.data);
    return response.data;
  };

  const register = async (details) => {
    const response = await api.post('/users/register', details);
    saveSession(response.data);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <UserAuthContext.Provider value={{ user, login, register, logout, loading, isLoggedIn: !!user }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
}
