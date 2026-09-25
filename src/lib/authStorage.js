// src/lib/authStorage.js
// Centralized auth-token persistence.
// "Remember me" sessions persist in localStorage; otherwise sessionStorage.
// Readers always check localStorage first, then sessionStorage, so an
// existing session survives a reload regardless of how it was created.

export const AUTH_KEYS = ['token', 'refreshToken', 'expiresIn', 'sessionId', 'user'];

export const getAuthItem = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);

export const setAuthItem = (key, value, persist) => {
  const store = persist ? localStorage : sessionStorage;
  store.setItem(key, value);
};

export const removeAuthItem = (key) => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

export const clearAuthStorage = () => {
  AUTH_KEYS.forEach(removeAuthItem);
};

// Replace the current session's tokens (after a refresh or a password
// change), keeping them in whichever store the session already lives in.
export const storeSessionTokens = ({ access_token: token, refreshToken, expiresIn }) => {
  if (!token) return;
  const persist = localStorage.getItem('token') !== null;
  setAuthItem('token', token, persist);
  if (refreshToken) setAuthItem('refreshToken', refreshToken, persist);
  if (expiresIn) setAuthItem('expiresIn', expiresIn, persist);
};
