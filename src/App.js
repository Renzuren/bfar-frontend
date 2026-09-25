import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import UpdateNotifier from './components/UpdateNotifier';
import PageLoader from './components/common/PageLoader';
import ProjectLayout from './components/layout/ProjectLayout';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { ProtectedRoute, AdminRoute } from './routes/guards';
import { getProjectNavigation } from './config/projectNavigation';
import lazyWithRetry from './lib/lazyWithRetry';
import './App.css';

// Every page is its own chunk, downloaded when first visited. Respondents
// opening a questionnaire link no longer download the report, PDF, Excel and
// map libraries the admin pages use.
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const VerifyAccount = lazyWithRetry(() => import('./pages/VerifyAccount'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const VerifyResetCode = lazyWithRetry(() => import('./pages/VerifyResetCode'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const FormFill = lazyWithRetry(() => import('./pages/FormFill'));
const FormBuilder = lazyWithRetry(() => import('./pages/FormBuilder'));
const FormResponses = lazyWithRetry(() => import('./pages/FormResponses'));
const FormProfiles = lazyWithRetry(() => import('./pages/FormProfiles'));
const FormAnalytics = lazyWithRetry(() => import('./pages/FormAnalytics'));
const MLUpload = lazyWithRetry(() => import('./pages/MLUpload'));
const AnalysisResult = lazyWithRetry(() => import('./pages/AnalysisResult'));
const ProjectDashboard = lazyWithRetry(() => import('./pages/ProjectDashboard'));
const NoBaselineDashboard = lazyWithRetry(() => import('./pages/NoBaselineDashboard'));
const QuestionnaireBuilder = lazyWithRetry(() => import('./pages/QuestionnaireBuilder'));
const QuestionnaireTab = lazyWithRetry(() => import('./pages/QuestionnaireTab'));
const ReportTab = lazyWithRetry(() => import('./pages/ReportTab'));
const NoBaselineAnalysisReport = lazyWithRetry(() => import('./pages/NoBaselineAnalysisReport'));
const NarrativeReport = lazyWithRetry(() => import('./pages/NarrativeReport'));
const ProjectBackup = lazyWithRetry(() => import('./pages/ProjectBackup'));
const ResponsesTab = lazyWithRetry(() => import('./pages/ResponsesTabRebuilt'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

const ProjectRoute = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchProject, currentProject } = useProject();
  const [loading, setLoading] = useState(!currentProject || currentProject.id !== id);

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    // If we already have this project cached, show it instantly and refresh
    // in the background instead of flashing a loader. Otherwise show a loader
    // only in the content area — the sidebar shell never disappears.
    if (currentProject?.id !== id) setLoading(true);
    fetchProject(id).then((data) => {
      if (!active) return;
      setLoading(false);
      if (!data) navigate('/dashboard');
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { sidebarItems, breadcrumbLabels } = getProjectNavigation(currentProject?.has_baseline !== false);

  return (
    <ProjectLayout sidebarItems={sidebarItems} breadcrumbLabels={breadcrumbLabels}>
      {loading || !currentProject ? (
        <PageLoader />
      ) : (
        <Suspense fallback={<PageLoader />}>
          <Outlet context={{ project: currentProject }} />
        </Suspense>
      )}
    </ProjectLayout>
  );
};

// Baseline and No Baseline projects share URLs but not every page.
const ByProjectDesign = ({ baseline, noBaseline }) => {
  const { currentProject } = useProject();
  return currentProject?.has_baseline === false ? noBaseline : baseline;
};

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader fullScreen />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-account" element={<VerifyAccount />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/verify-reset-code" element={<VerifyResetCode />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/f/:id" element={<FormFill />} />

              <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
              <Route path="/settings" element={protectedPage(<Settings />)} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/cleanup" element={<Navigate to="/admin" replace />} />

              {/* The wrapper's ProtectedRoute covers every nested project page. */}
              <Route path="/projects/:id" element={protectedPage(<ProjectRoute />)}>
                <Route index element={<ByProjectDesign baseline={<ProjectDashboard />} noBaseline={<NoBaselineDashboard />} />} />
                <Route path="create-questionnaire" element={<QuestionnaireBuilder />} />
                {/* key: a fresh page when switching between the two slots */}
                <Route path="before" element={<QuestionnaireTab key="before" slot="before" />} />
                <Route path="after" element={<QuestionnaireTab key="after" slot="after" />} />
                <Route path="report" element={<ByProjectDesign baseline={<ReportTab />} noBaseline={<NoBaselineAnalysisReport />} />} />
                <Route path="responses" element={<FormResponses embedded />} />
                <Route path="profiles" element={<FormProfiles embedded />} />
                <Route path="analytics" element={<FormAnalytics embedded />} />
                <Route path="all-responses" element={<ResponsesTab />} />
                <Route path="narrative-report" element={<NarrativeReport />} />
                <Route path="backup" element={<ProjectBackup />} />
              </Route>

              {/* Legacy form routes */}
              <Route path="/forms/new" element={protectedPage(<FormBuilder />)} />
              <Route path="/forms/:id/edit" element={protectedPage(<FormBuilder />)} />
              <Route path="/forms/:id/responses" element={protectedPage(<FormResponses />)} />
              <Route path="/forms/:id/profiles" element={protectedPage(<FormProfiles />)} />
              <Route path="/forms/:id/analytics" element={protectedPage(<FormAnalytics />)} />
              <Route path="/ml-upload" element={protectedPage(<MLUpload />)} />
              <Route path="/ml-analysis/:id" element={protectedPage(<AnalysisResult />)} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster />
          <UpdateNotifier />
        </BrowserRouter>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
