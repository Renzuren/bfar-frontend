import React, { useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Menu,
  Check,
  ArrowLeft,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import Sidebar from './Sidebar';
import { useProject } from '../../context/ProjectContext';

// Persistent shell for project pages: fixed collapsible sidebar + sticky top
// navbar. The sidebar never unmounts and never reloads — only the `children`
// in the main content area swap when the route changes.
export default function ProjectLayout({ sidebarItems, breadcrumbLabels = {}, children }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { updateProject, currentProject, setCurrentProject } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Breadcrumb segments for nested pages (e.g. Projects > Final Test > Before > View Responses)
  const subSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .slice(2); // skip 'projects' and ':id'
  const typeParam = searchParams.get('type'); // tab context: 'before' | 'after'

  const breadcrumbCrumbs = [];
  if (subSegments.length > 0) {
    // Insert the Before/After tab crumb when the page was opened from a tab (?type=)
    if (typeParam && breadcrumbLabels[typeParam]) {
      breadcrumbCrumbs.push({
        key: `tab-${typeParam}`,
        label: breadcrumbLabels[typeParam],
        to: `/projects/${id}/${typeParam}`,
      });
    }
    subSegments.forEach((seg) => {
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

      {/* Persistent Sidebar */}
      <Sidebar
        items={sidebarItems}
        project={currentProject}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => {
          if (window.innerWidth < 1024) {
            setSidebarOpen(false);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }}
        onNavigate={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Persistent Navbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="flex w-full items-center gap-2 px-3 py-4 sm:gap-3 sm:px-5">
            {/* Mobile-only trigger to open the sidebar */}
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

            {/* Back to Dashboard */}
            <button
              onClick={() => navigate('/dashboard')}
              title="Back to Dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>

            {/* Status dropdown */}
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

        {/* Page content — this is the ONLY part that swaps on navigation */}
        <main className="w-full flex-1 px-3 pb-24 pt-0 sm:px-4">{children}</main>
      </div>
    </div>
  );
};