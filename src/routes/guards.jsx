import React from 'react';
import { Navigate } from 'react-router-dom';
import PageLoader from '../components/common/PageLoader';
import { useAuth } from '../context/AuthContext';

/** Renders its page only for a signed-in user; others go to the login page. */
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader fullScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

// The admin API rejects other accounts anyway; this keeps them from landing on
// an admin page that can only show errors.
export const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
};
