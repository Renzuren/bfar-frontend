import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import FormBuilder from './pages/FormBuilder';
import FormFill from './pages/FormFill';
import FormResponses from './pages/FormResponses';
import FormAnalytics from './pages/FormAnalytics';
import MLUpload from './pages/MLUpload';
import ProjectDashboard from './pages/ProjectDashboard';
import QuestionnaireBuilder from './pages/QuestionnaireBuilder';
import BeforeTab from './pages/BeforeTab';
import AfterTab from './pages/AfterTab';
import NarrativeReport from './pages/NarrativeReport';
import ReportsList from './pages/ReportsList';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import VerifyAccount from './pages/VerifyAccount';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyResetCode from './pages/VerifyResetCode';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FDFF] flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/verify-account" element={<VerifyAccount />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-reset-code" element={<VerifyResetCode />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Project routes */}
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDashboard /></ProtectedRoute>}>
              <Route path="create-questionnaire" element={<QuestionnaireBuilder />} />
              <Route path="before" element={<BeforeTab />} />
              <Route path="after" element={<AfterTab />} />
              <Route path="narrative-report" element={<NarrativeReport />} />
              <Route path="reports" element={<ReportsList />} />
            </Route>

            {/* Legacy form routes */}
            <Route path="/forms/new" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
            <Route path="/forms/:id/edit" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
            <Route path="/forms/:id/responses" element={<ProtectedRoute><FormResponses /></ProtectedRoute>} />
            <Route path="/forms/:id/analytics" element={<ProtectedRoute><FormAnalytics /></ProtectedRoute>} />
            <Route path="/ml-upload" element={<ProtectedRoute><MLUpload /></ProtectedRoute>} />
            <Route path="/f/:id" element={<FormFill />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
