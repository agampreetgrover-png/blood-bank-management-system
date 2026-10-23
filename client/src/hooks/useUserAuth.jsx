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

  // Every login needs the 6-digit code from the person's authenticator app.
  // The calls that can hand out backup codes return the data without starting the session: the page
  // shows the codes first and calls startSession(data) once the person has saved them.

  // Sign up step 1: checks the details and resolves to { setup_token, setup: { secret, qr } } to scan
  const startSignup = async (details) => {
    const response = await api.post('/users/signup', details);
    return response.data;
  };

  // Sign up step 2: the first code from the app creates the account. Resolves to { token, user, backup_codes }.
  const finishSignup = async (setupToken, code) => {
    const response = await api.post('/users/signup/verify', { setup_token: setupToken, code });
    return response.data;
  };

  // Right password -> { stage: 'verify', mfa_token } (ask for a code), or { stage: 'setup', mfa_token, setup }
  // for an account that has no authenticator yet
  const login = async (identifier, password) => {
    const response = await api.post('/users/login', { identifier, password });
    return response.data;
  };

  // Resolves to { token, user, backup_codes_left }, or { token, user, backup_codes } after a first setup
  const verifyLogin = async (mfaToken, code) => {
    const response = await api.post('/users/login/verify', { mfa_token: mfaToken, code });
    return response.data;
  };

  // Sets a new password with an authenticator or backup code, signs out every other session and logs in here
  const resetPassword = async (identifier, code, password) => {
    const response = await api.post('/users/password/reset', { identifier, code, password });
    return startSession(response.data);
  };

  // Replaces the backup codes (needs a current code from the app) and resolves to the new list
  const regenerateBackupCodes = async (code) => {
    const response = await api.post('/users/mfa/backup-codes', { code });
    return response.data.backup_codes;
  };

  const logout = () => clearSession('user');

  return (
    <UserAuthContext.Provider
      value={{
        user,
        startSignup,
        finishSignup,
        login,
        verifyLogin,
        resetPassword,
        regenerateBackupCodes,
        startSession,
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
