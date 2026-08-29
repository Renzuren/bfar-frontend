import React, { useState, useEffect, useCallback } from 'react';
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
import { api } from '../lib/apiMiddleware';

const SIDEBAR_ITEMS = [
  {
    label: 'Create Questionnaire',
    path: 'create-questionnaire',
    icon: FileText,
  },
  {
    label: 'Beneficiary',
    path: 'before',
    icon: Layers,
  },
  {
    label: 'Non-Beneficiary',
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

const BREADCRUMB_LABELS = {
  'create-questionnaire': 'Edit Questionnaire',
  'before': 'Beneficiary',
  'after': 'Non-Beneficiary',
  'report': 'Analysis Report',
  'responses': 'View Responses',
  'profiles': 'View Profiles',
  'narrative-report': 'Narrative Report',
  'backup': 'Data Backup & Import',
};

const NoBaselineDashboard = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { fetchProject, updateProject, currentProject, setCurrentProject } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const isOverview = location.pathname === `/projects/${id}`;

  const subSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .slice(2);
  const typeParam = searchParams.get('type');

  let breadcrumbCrumbs = [];
  if (subSegments.length > 0) {
    if (typeParam && BREADCRUMB_LABELS[typeParam]) {
      breadcrumbCrumbs.push({
        key: `tab-${typeParam}`,
        label: BREADCRUMB_LABELS[typeParam],
        to: `/projects/${id}/${typeParam}`,
      });
    }
    subSegments.forEach(seg => {
      breadcrumbCrumbs.push({
        key: seg,
        label: BREADCRUMB_LABELS[seg] || seg,
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
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-72'}`}
      >
        <div className={`flex items-center gap-3 border-b border-slate-100 ${sidebarCollapsed ? 'justify-center px-2 py-6' : 'px-6 py-6'}`}>
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

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const to = `/projects/${id}/${item.path}`;
              return (
                <li key={item.path}>
                  <NavLink
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
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
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="flex w-full items-center gap-2 px-3 py-4 sm:gap-3 sm:px-5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
              title="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb */}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 sm:hidden">
              {breadcrumbCrumbs.length > 0
                ? breadcrumbCrumbs[breadcrumbCrumbs.length - 1].label
                : currentProject?.title || '...'}
            </span>
            <nav className="hidden min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm sm:flex">
              <button
                onClick={() => navigate('/dashboard')}
                className="shrink-0 text-slate-400 transition hover:text-slate-700"
              >
                Projects
              </button>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              {breadcrumbCrumbs.length > 0 ? (
                <>
                  <button
                    onClick={() => navigate(`/projects/${id}`)}
                    className="shrink-0 font-semibold text-slate-500 transition hover:text-slate-900"
                  >
                    {currentProject?.title || '...'}
                  </button>
                  {breadcrumbCrumbs.map((crumb, i) => (
                    <React.Fragment key={crumb.key}>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      {i < breadcrumbCrumbs.length - 1 ? (
                        <button
                          onClick={() => navigate(crumb.to)}
                          className="shrink-0 font-semibold text-slate-500 transition hover:text-slate-900"
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

            <button
              onClick={() => navigate('/dashboard')}
              title="Back to Dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>

            {currentProject && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={statusUpdating}
                    title="Change project status"
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60 ${getStatusColor(
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

        <main className="w-full flex-1 px-3 pb-24 pt-0 sm:px-4">
          {isOverview ? (
            <NoBaselineOverview project={currentProject} />
          ) : (
            <Outlet context={{ project: currentProject }} />
          )}
        </main>
      </div>
    </div>
  );
};

const NoBaselineOverview = ({ project }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [beneficiaryCount, setBeneficiaryCount] = useState(null);
  const [nonBeneficiaryCount, setNonBeneficiaryCount] = useState(null);

  const fetchResponseCounts = useCallback(async () => {
    const tasks = [];
    if (project?.before_form) {
      tasks.push(api.get(`/forms/${project.before_form}/responses`).catch(() => ({ data: [] })));
    } else {
      tasks.push(Promise.resolve({ data: [] }));
    }
    if (project?.after_form) {
      tasks.push(api.get(`/forms/${project.after_form}/responses`).catch(() => ({ data: [] })));
    } else {
      tasks.push(Promise.resolve({ data: [] }));
    }
    const [benRes, nonBenRes] = await Promise.all(tasks);
    setBeneficiaryCount(benRes.data?.length ?? 0);
    setNonBeneficiaryCount(nonBenRes.data?.length ?? 0);
  }, [project?.before_form, project?.after_form]);

  useEffect(() => {
    if (project?.before_form || project?.after_form) fetchResponseCounts();
  }, [project?.before_form, project?.after_form, fetchResponseCounts]);

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
      desc: 'Build a new Beneficiary or Non-Beneficiary questionnaire',
      icon: FileText,
      color: 'bg-cyan-50 text-cyan-600',
      hover: 'hover:border-cyan-200',
      onClick: () => navigate(`/projects/${id}/create-questionnaire`),
    },
    {
      label: 'Beneficiary',
      desc: project.before_form
        ? beneficiaryCount !== null
          ? `${beneficiaryCount} ${beneficiaryCount === 1 ? 'response' : 'responses'} — click to view`
          : 'Loading responses...'
        : 'No form yet — click to create',
      icon: Layers,
      color: 'bg-indigo-50 text-indigo-600',
      hover: 'hover:border-indigo-200',
      onClick: () => navigate(`/projects/${id}/before`),
    },
    {
      label: 'Non-Beneficiary',
      desc: project.after_form
        ? nonBeneficiaryCount !== null
          ? `${nonBeneficiaryCount} ${nonBeneficiaryCount === 1 ? 'response' : 'responses'} — click to view`
          : 'Loading responses...'
        : 'No form yet — click to create',
      icon: ListChecks,
      color: 'bg-emerald-50 text-emerald-600',
      hover: 'hover:border-emerald-200',
      onClick: () => navigate(`/projects/${id}/after`),
    },
    {
      label: 'Narrative Report',
      desc:
        project.before_form && project.after_form
          ? 'Compare Beneficiary vs. Non-Beneficiary results'
          : 'Complete both questionnaires to compare',
      icon: BarChart3,
      color: 'bg-amber-50 text-amber-600',
      hover: 'hover:border-amber-200',
      onClick: () => navigate(`/projects/${id}/narrative-report`),
    },
  ];

  return (
    <div className="space-y-8">
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
            <span className="inline-flex items-center rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/30 backdrop-blur">
              No Baseline
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

export default NoBaselineDashboard;
