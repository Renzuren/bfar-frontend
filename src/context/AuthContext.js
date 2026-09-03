import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../lib/apiMiddleware';
import { getAuthItem, setAuthItem, removeAuthItem, clearAuthStorage } from '../lib/authStorage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on refresh
  useEffect(() => {
    const token = getAuthItem('token');
    const savedUser = getAuthItem('user');

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        // console.error('Failed to parse user from localStorage');
        clearAuthStorage();
      }
    }

    setLoading(false);
  }, []);

  // When any API call returns 401, force-logout the live session so the UI
  // stops behaving as authenticated even though the token is gone.
  useEffect(() => {
    const onUnauthorized = () => {
      clearAuthStorage();
      setUser(null);
    };
    window.addEventListener('bfar:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bfar:unauthorized', onUnauthorized);
  }, []);

  // ✅ UPDATED LOGIN FUNCTION
  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await api.post(`/auth/login`, {
        email,
        password
      });

      const {
        access_token,
        refreshToken,
        expiresIn,
        user: userData
      } = response.data || {};

      // A non-persistent login must not leave an old persistent session behind
      if (!rememberMe) clearAuthStorage();

      // Store tokens (persist in localStorage only when "remember me" is set)
      setAuthItem('token', access_token, rememberMe);
      setAuthItem('refreshToken', refreshToken ?? response.data?.refresh_token, rememberMe);
      setAuthItem('expiresIn', expiresIn, rememberMe);

      // Store full user object including status (with defensive defaults so a
      // missing user payload can never crash the login flow).
      const userInfo = userData
        ? {
            email: userData.email || '',
            status: userData.status || 'active',
            full_name: userData.full_name || '',
            role: userData.role || 'user',
            org_id: userData.org_id || null,
            organization: userData.organization || null,
          }
        : { email: email.toLowerCase().trim(), status: 'active', full_name: '', role: 'user', org_id: null, organization: null };

      setAuthItem('user', JSON.stringify(userInfo), rememberMe);
      setUser(userInfo);

      return userInfo;

    } catch (error) {
      // console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  };

  const signup = async (first_name, middle_name, last_name, email, password, extraFields = {}) => {
    try {
      const response = await api.post(`/auth/register`, {
        first_name,
        middle_name: middle_name || '',
        last_name,
        email,
        password,
        ...extraFields,
      });

      return response.data;

    } catch (error) {
      // console.error('Signup error:', error.response?.data || error.message);
      throw error;
    }
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
  };

  // Persist an updated user object to whichever store currently holds it.
  const persistUser = (newUser) => {
    const raw = JSON.stringify(newUser);
    if (localStorage.getItem('token') !== null) {
      localStorage.setItem('user', raw);
    }
    if (sessionStorage.getItem('token') !== null) {
      sessionStorage.setItem('user', raw);
    }
  };

  // Update the local user object (UI state + storage). Setting a value to null
  // removes it, which is used after an email/account change clears the session.
  const updateUser = (userData) => {
    const next = userData === null ? null : { ...user, ...userData };
    setUser(next);
    if (next) {
      persistUser(next);
    } else {
      removeAuthItem('user');
    }
    return next;
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
