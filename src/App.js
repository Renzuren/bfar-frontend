import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import FormBuilder from './pages/FormBuilder';
import FormFill from './pages/FormFill';
import FormResponses from './pages/FormResponses';
import FormProfiles from './pages/FormProfiles';
import FormAnalytics from './pages/FormAnalytics';
import MLUpload from './pages/MLUpload';
import ProjectDashboard from './pages/ProjectDashboard';
import NoBaselineDashboard from './pages/NoBaselineDashboard';
import QuestionnaireBuilder from './pages/QuestionnaireBuilder';
import BeforeTab from './pages/BeforeTab';
import AfterTab from './pages/AfterTab';
import BeneficiaryTab from './pages/BeneficiaryTab';
import NonBeneficiaryTab from './pages/NonBeneficiaryTab';
import ReportTab from './pages/ReportTab';
import NarrativeReport from './pages/NarrativeReport';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
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

const ProjectRoute = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchProject, currentProject, setCurrentProject } = useProject();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProject(id).then((data) => {
        if (!data) navigate('/dashboard');
        setLoading(false);
      });
    }
    return () => setCurrentProject(null);
  }, [id, fetchProject, navigate, setCurrentProject]);

  if (loading || !currentProject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (currentProject.has_baseline === false) {
    return <NoBaselineDashboard />;
  }
  return <ProjectDashboard />;
};

const BeforeRoute = () => {
  const { currentProject } = useProject();
  return currentProject?.has_baseline === false ? <BeneficiaryTab /> : <BeforeTab />;
};

const AfterRoute = () => {
  const { currentProject } = useProject();
  return currentProject?.has_baseline === false ? <NonBeneficiaryTab /> : <AfterTab />;
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

            {/* Project routes — wrapper picks baseline vs no-baseline dashboard */}
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectRoute /></ProtectedRoute>}>
              <Route path="create-questionnaire" element={<QuestionnaireBuilder />} />
              <Route path="before" element={<BeforeRoute />} />
              <Route path="after" element={<AfterRoute />} />
              <Route path="report" element={<ProtectedRoute><ReportTab /></ProtectedRoute>} />
              <Route path="responses" element={<ProtectedRoute><FormResponses embedded /></ProtectedRoute>} />
              <Route path="profiles" element={<ProtectedRoute><FormProfiles embedded /></ProtectedRoute>} />
              <Route path="narrative-report" element={<NarrativeReport />} />
            </Route>

            {/* Legacy form routes */}
            <Route path="/forms/new" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
            <Route path="/forms/:id/edit" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
            <Route path="/forms/:id/responses" element={<ProtectedRoute><FormResponses /></ProtectedRoute>} />
            <Route path="/forms/:id/profiles" element={<ProtectedRoute><FormProfiles /></ProtectedRoute>} />
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
