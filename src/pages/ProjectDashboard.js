import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Outlet, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  BarChart3,
  ClipboardList,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const SIDEBAR_ITEMS = [
  {
    label: 'Create Questionnaire (Before)',
    path: 'questionnaire-before',
    icon: FileText,
    description: 'Build a survey for before the intervention',
  },
  {
    label: 'Create Questionnaire (After)',
    path: 'questionnaire-after',
    icon: ClipboardList,
    description: 'Build a survey for after the intervention',
  },
  {
    label: 'Narrative Report',
    path: 'narrative-report',
    icon: BarChart3,
    description: 'View comparison charts and insights',
  },
  {
    label: 'Reports',
    path: 'reports',
    icon: FileText,
    description: 'List of all generated reports',
  },
];

const ProjectDashboard = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { fetchProject, currentProject, setCurrentProject } = useProject();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject(id).then((data) => {
        if (!data) navigate('/dashboard');
      });
    }
    return () => setCurrentProject(null);
  }, [id, fetchProject, navigate, setCurrentProject]);

  const isOverview = location.pathname === `/projects/${id}`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="shrink-0 text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Project</p>
              <h2 className="truncate text-sm font-bold text-slate-900">
                {currentProject?.title || 'Loading...'}
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-slate-500"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const to = `/projects/${id}/${item.path}`;
              return (
                <NavLink
                  key={item.path}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400">
            {currentProject?.description
              ? currentProject.description.slice(0, 80) + (currentProject.description.length > 80 ? '...' : '')
              : 'No description'}
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span
              className="cursor-pointer hover:text-slate-700"
              onClick={() => navigate('/dashboard')}
            >
              Projects
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-900">
              {currentProject?.title || '...'}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {isOverview ? (
            <ProjectOverview project={currentProject} />
          ) : (
            <Outlet context={{ project: currentProject }} />
          )}
        </main>
      </div>
    </div>
  );
};

const ProjectOverview = ({ project }) => {
  const navigate = useNavigate();
  const { id } = useParams();

  if (!project) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading project...
      </div>
    );
  }

  const formatDate = (value) => {
    let date = new Date();
    if (value && typeof value === 'object' && typeof value._seconds === 'number') {
      date = new Date(value._seconds * 1000);
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Project Overview</p>
          <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">{project.title}</h2>
          <p className="max-w-2xl text-base text-slate-300">
            {project.description || 'No description provided.'}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Created {formatDate(project.created_at ?? project.createdAt)}
          </p>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => navigate(`/projects/${id}/questionnaire-before`)}
          className="group rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-bold text-slate-900 group-hover:text-cyan-700">Before Questionnaire</h3>
          <p className="text-sm text-slate-500">
            {project.before_form ? 'Form created — click to edit' : 'No form yet — click to create'}
          </p>
        </button>

        <button
          onClick={() => navigate(`/projects/${id}/questionnaire-after`)}
          className="group rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-bold text-slate-900 group-hover:text-cyan-700">After Questionnaire</h3>
          <p className="text-sm text-slate-500">
            {project.after_form ? 'Form created — click to edit' : 'No form yet — click to create'}
          </p>
        </button>

        <button
          onClick={() => navigate(`/projects/${id}/narrative-report`)}
          className="group rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-bold text-slate-900 group-hover:text-cyan-700">Narrative Report</h3>
          <p className="text-sm text-slate-500">
            {project.before_form && project.after_form
              ? 'Compare Before vs. After results'
              : 'Complete both questionnaires to compare'}
          </p>
        </button>

        <button
          onClick={() => navigate(`/projects/${id}/reports`)}
          className="group rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-bold text-slate-900 group-hover:text-cyan-700">Reports</h3>
          <p className="text-sm text-slate-500">View and download generated reports</p>
        </button>
      </section>
    </div>
  );
};

export default ProjectDashboard;
