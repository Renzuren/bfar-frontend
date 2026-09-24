import React, { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { getAuthItem, setAuthItem, removeAuthItem, clearAuthStorage } from '../lib/authStorage';

const AuthContext = createContext();

// How often an open tab checks whether the account signed in on another device.
const SESSION_CHECK_INTERVAL = 60000;

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
    const onUnauthorized = (event) => {
      clearAuthStorage();
      setUser(null);
      if (event.detail?.code === 'SESSION_REPLACED') {
        toast.error('You were signed out because your account was signed in on another device.', {
          id: 'session-replaced',
        });
      }
    };
    window.addEventListener('bfar:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bfar:unauthorized', onUnauthorized);
  }, []);

  // Notice a login on another device even while this tab sits idle: check the
  // session periodically and whenever the tab regains focus. A replaced session
  // gets a 401 that fires 'bfar:unauthorized' above.
  useEffect(() => {
    if (!user) return undefined;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      api.get('/auth/session', { retry: 0 }).catch(() => {});
    };
    const timer = setInterval(check, SESSION_CHECK_INTERVAL);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [user]);

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
        session_id,
        user: userData
      } = response.data || {};

      // A non-persistent login must not leave an old persistent session behind
      if (!rememberMe) clearAuthStorage();

      // Store tokens (persist in localStorage only when "remember me" is set)
      setAuthItem('token', access_token, rememberMe);
      setAuthItem('refreshToken', refreshToken ?? response.data?.refresh_token, rememberMe);
      setAuthItem('expiresIn', expiresIn, rememberMe);
      if (session_id) setAuthItem('sessionId', session_id, rememberMe);

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
    // Best-effort server activity log of the logout for system-wide Data
    // Maintenance coverage; never blocks the local sign-out.
    try {
      api.post('/auth/logout').catch(() => {});
    } catch (e) {
      // ignore
    }
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
