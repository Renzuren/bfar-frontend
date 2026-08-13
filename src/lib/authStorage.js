// src/lib/authStorage.js
// Centralized auth-token persistence.
// "Remember me" sessions persist in localStorage; otherwise sessionStorage.
// Readers always check localStorage first, then sessionStorage, so an
// existing session survives a reload regardless of how it was created.

const TOKEN_KEYS = ['token', 'refreshToken', 'expiresIn', 'user'];

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
  TOKEN_KEYS.forEach(removeAuthItem);
};
