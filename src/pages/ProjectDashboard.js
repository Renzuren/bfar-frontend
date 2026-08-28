import React, { useState } from 'react';
import { useNavigate, useParams, useLocation, Outlet, NavLink, useSearchParams } from 'react-router-dom';
import {
  FileText,
  BarChart3,
  ClipboardList,
  Menu,
  ChevronRight,
  ChevronDown,
  ListChecks,
  Layers,
  ArrowLeft,
  FileBarChart2,
  Check,
  Loader2,
  DatabaseBackup,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useProject } from '../context/ProjectContext';

const SIDEBAR_ITEMS = [
  {
    label: 'Create Questionnaire',
    path: 'create-questionnaire',
    icon: FileText,
  },
  {
    label: 'Before',
    path: 'before',
    icon: Layers,
  },
  {
    label: 'After',
    path: 'after',
    icon: ListChecks,
  },
  {
    label: 'Analysis Report',
    path: 'report',
    icon: FileBarChart2,
  },
  {
    label: 'Narrative Report',
    path: 'narrative-report',
    icon: BarChart3,
  },
  {
    label: 'Data Backup & Import',
    path: 'backup',
    icon: DatabaseBackup,
  },
];

// Navbar breadcrumb labels for nested route segments
const BREADCRUMB_LABELS = {
  'create-questionnaire': 'Edit Questionnaire',
  'before': 'Before',
  'after': 'After',
  'report': 'Analysis Report',
  'responses': 'View Responses',
  'profiles': 'View Profiles',
  'narrative-report': 'Narrative Report',
  'backup': 'Data Backup & Import',
};

const ProjectDashboard = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { fetchProject, updateProject, currentProject, setCurrentProject } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const isBaseline = currentProject?.has_baseline !== false;
  const tabLabels = {
    before: isBaseline ? 'Before' : 'Beneficiary',
    after: isBaseline ? 'After' : 'Non-Beneficiary',
  };

  const isOverview = location.pathname === `/projects/${id}`;

  // Breadcrumb segments for nested pages (e.g. Projects > Final Test > Before > View Responses)
  const subSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .slice(2); // skip 'projects' and ':id'
  const typeParam = searchParams.get('type'); // tab context: 'before' | 'after'

  let breadcrumbCrumbs = [];
  const breadcrumbLabels = { ...BREADCRUMB_LABELS, before: tabLabels.before, after: tabLabels.after };
  if (subSegments.length > 0) {
    // Insert the Before/After tab crumb when the page was opened from a tab (?type=)
    if (typeParam && breadcrumbLabels[typeParam]) {
      breadcrumbCrumbs.push({
        key: `tab-${typeParam}`,
        label: breadcrumbLabels[typeParam],
        to: `/projects/${id}/${typeParam}`,
      });
    }
    subSegments.forEach(seg => {
      breadcrumbCrumbs.push({
        key: seg,
        label: breadcrumbLabels[seg] || seg,
        to: `/projects/${id}/${seg}`,
      });
    });
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 ring-blue-200';
      case 'draft':
        return 'bg-amber-100 text-amber-700 ring-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  };

  const handleStatusChange = async (status) => {
    if (!currentProject || currentProject.status === status || statusUpdating) return;
    const prevStatus = currentProject.status;
    setCurrentProject({ ...currentProject, status });
    setStatusUpdating(true);
    const updated = await updateProject(id, { status });
    if (!updated) setCurrentProject({ ...currentProject, status: prevStatus });
    setStatusUpdating(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-72'}`}
      >
        {/* Sidebar header */}
        <div className={`flex items-center gap-3 border-b border-slate-100 ${sidebarCollapsed ? 'justify-center px-2 py-6' : 'px-6 py-6'}`}>
          {/* Hamburger — toggles sidebar open/close */}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setSidebarOpen(false);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="h-5 w-5" />
          </button>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Project
              </p>
              <h2 className="truncate text-sm font-bold text-slate-900">
                {currentProject?.title || 'Loading...'}
              </h2>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const label = tabLabels[item.path] || item.label;
              const to = `/projects/${id}/${item.path}`;
              return (
                <li key={item.path}>
                  <NavLink
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
                        sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
                      } ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 h-8 w-[3px] rounded-r-full bg-blue-600" />
                        )}
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                            isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        {!sidebarCollapsed && <span>{label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar footer */}
        {!sidebarCollapsed && (
          <div className="border-t border-slate-100 px-6 py-6">
            {currentProject?.description ? (
              <p className="text-xs leading-relaxed text-slate-400">
                {currentProject.description.length > 100
                  ? currentProject.description.slice(0, 100) + '...'
                  : currentProject.description}
              </p>
            ) : (
              <p className="text-xs text-slate-300 italic">No description</p>
            )}
          </div>
        )}
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="flex w-full items-center gap-3 px-3 py-4 sm:px-5">
            {/* Mobile-only trigger to open the sidebar (hamburger lives inside the sidebar) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
              title="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-slate-400 transition hover:text-slate-700"
              >
                Projects
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              {breadcrumbCrumbs.length > 0 ? (
                <>
                  <button
                    onClick={() => navigate(`/projects/${id}`)}
                    className="font-semibold text-slate-500 transition hover:text-slate-900"
                  >
                    {currentProject?.title || '...'}
                  </button>
                  {breadcrumbCrumbs.map((crumb, i) => (
                    <React.Fragment key={crumb.key}>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                      {i < breadcrumbCrumbs.length - 1 ? (
                        <button
                          onClick={() => navigate(crumb.to)}
                          className="font-semibold text-slate-500 transition hover:text-slate-900"
                        >
                          {crumb.label}
                        </button>
                      ) : (
                        <span className="truncate font-semibold text-slate-900">
                          {crumb.label}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <span className="truncate font-semibold text-slate-900">
                  {currentProject?.title || '...'}
                </span>
              )}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Back to Dashboard */}
            <button
              onClick={() => navigate('/dashboard')}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </button>

            {/* Status dropdown */}
            {currentProject && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={statusUpdating}
                    title="Change project status"
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60 ${getStatusColor(
                      currentProject.status
                    )}`}
                  >
                    {statusUpdating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                    {currentProject.status || 'Set status'}
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Project status
                  </DropdownMenuLabel>
                  {['Active', 'Draft'].map((option) => {
                    const isCurrent = (currentProject.status || '').toLowerCase() === option.toLowerCase();
                    return (
                      <DropdownMenuItem
                        key={option}
                        onSelect={() => handleStatusChange(option)}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Check className={`h-4 w-4 ${isCurrent ? 'text-emerald-600' : 'opacity-0'}`} />
                        <span className={`h-2 w-2 rounded-full ${option === 'Active' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        {option}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="w-full flex-1 px-3 pb-24 pt-0 sm:px-4">
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
  const isBaseline = project?.has_baseline !== false;
  const tabLabels = {
    before: isBaseline ? 'Before' : 'Beneficiary',
    after: isBaseline ? 'After' : 'Non-Beneficiary',
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading project...
      </div>
    );
  }

  const formatDate = (value) => {
    if (!value) return 'N/A';
    let date;
    if (typeof value === 'object' && typeof value._seconds === 'number') {
      date = new Date(value._seconds * 1000);
    } else {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const overviewCards = [
    {
      label: 'Create Questionnaire',
      desc: `Build a new ${tabLabels.before} or ${tabLabels.after} questionnaire`,
      icon: FileText,
      color: 'bg-cyan-50 text-cyan-600',
      hover: 'hover:border-cyan-200',
      onClick: () => navigate(`/projects/${id}/create-questionnaire`),
    },
    {
      label: tabLabels.before,
      desc: project.before_form ? 'Form created — click to view' : 'No form yet — click to create',
      icon: Layers,
      color: 'bg-indigo-50 text-indigo-600',
      hover: 'hover:border-indigo-200',
      onClick: () => navigate(`/projects/${id}/before`),
    },
    {
      label: tabLabels.after,
      desc: project.after_form ? 'Form created — click to view' : 'No form yet — click to create',
      icon: ListChecks,
      color: 'bg-emerald-50 text-emerald-600',
      hover: 'hover:border-emerald-200',
      onClick: () => navigate(`/projects/${id}/after`),
    },
    {
      label: 'Narrative Report',
      desc:
        project.before_form && project.after_form
          ? `Compare ${tabLabels.before} vs. ${tabLabels.after} results`
          : 'Complete both questionnaires to compare',
      icon: BarChart3,
      color: 'bg-amber-50 text-amber-600',
      hover: 'hover:border-amber-200',
      onClick: () => navigate(`/projects/${id}/narrative-report`),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 px-6 py-8 sm:px-10 sm:py-12 text-white shadow-xl text-left">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Project Overview
          </p>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              {project.title}
            </h2>
            <span className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 ring-1 ring-blue-400/30 backdrop-blur">
              Baseline
            </span>
          </div>
          <p className="max-w-2xl text-base text-slate-300">
            {project.description || 'No description provided.'}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Created {formatDate(project.created_at ?? project.createdAt)}
          </p>
        </div>
      </section>

      {/* Quick access cards */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 text-left">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={card.onClick}
              className={`group rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.hover}`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 text-sm font-bold text-slate-900 transition group-hover:text-blue-700">
                {card.label}
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">{card.desc}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
};

export default ProjectDashboard;
