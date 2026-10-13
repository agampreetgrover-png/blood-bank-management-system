import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { readSession, saveSession, clearSession, subscribe } from '../services/session';

// Public website accounts - kept separate from the admin session in useAuth
const UserAuthContext = createContext(null);

const savedUser = () => readSession('user')?.profile || null;

// Same rules as server/utils/passwords.js. Returns a message, or '' when the new password is fine.
export function passwordProblem(password, confirmation) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (new TextEncoder().encode(password).length > 72) return 'Password is too long. Use at most 72 characters.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(savedUser);

  // Follows the session when it ends after a 401 (services/api.js) or changes in another tab
  useEffect(() => subscribe('user', () => setUser(savedUser())), []);

  const startSession = (data) => {
    saveSession('user', data.token, data.user);
    return data;
  };

  // Sign up, login and password reset all email a code first. These request calls resolve to
  // { email, resend_in, expires_in } - seconds before another code can be sent, and before this one expires.
  const requestSignupOtp = async (details) => {
    const response = await api.post('/users/signup/request-otp', details);
    return response.data;
  };

  // Creates the account
  const verifySignup = async (email, code) => {
    const response = await api.post('/users/signup/verify', { email, code });
    return startSession(response.data);
  };

  // Login is two-factor: the right password emails a code (email comes back masked), then verifyLogin
  // with that code starts the session. Calling login again sends a fresh code.
  const login = async (identifier, password) => {
    const response = await api.post('/users/login', { identifier, password });
    return response.data;
  };

  const verifyLogin = async (identifier, code) => {
    const response = await api.post('/users/login/verify', { identifier, code });
    return startSession(response.data);
  };

  const requestResetOtp = async (email) => {
    const response = await api.post('/users/password/request-otp', { email });
    return response.data;
  };

  // Sets a new password, signs out every other session and logs in here
  const resetPassword = async (email, code, password) => {
    const response = await api.post('/users/password/reset', { email, code, password });
    return startSession(response.data);
  };

  const logout = () => clearSession('user');

  return (
    <UserAuthContext.Provider
      value={{
        user,
        requestSignupOtp,
        verifySignup,
        login,
        verifyLogin,
        requestResetOtp,
        resetPassword,
        logout,
        isLoggedIn: !!user
      }}
    >
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
