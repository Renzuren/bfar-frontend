import React from 'react';
import { NavLink } from 'react-router-dom';
import { FolderKanban, LayoutGrid, Menu } from 'lucide-react';

// Persistent app sidebar. Uses NavLink (never `<a href>`) so navigation is
// fully client-side: the sidebar itself never unmounts or reloads. The active
// route is highlighted both with a background + a blue accent bar.
export default function Sidebar({
  items,
  project,
  open,
  collapsed,
  onToggleCollapse,
  onNavigate,
}) {
  const projectId = project?.id;

  const linkClasses = ({ isActive }) =>
    `group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
      collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
    } ${
      isActive
        ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  const projectLinkClasses = ({ isActive }) =>
    `group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
      collapsed ? 'justify-center px-2 py-3' : 'gap-3 pl-10 pr-4 py-3'
    } ${
      isActive
        ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  const renderAccentBar = (isActive) =>
    isActive && <span className="absolute left-0 h-8 w-[3px] rounded-r-full bg-blue-600" />;

  const iconColor = (isActive) =>
    `h-[18px] w-[18px] shrink-0 transition-colors ${
      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
    }`;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'lg:w-[68px]' : 'lg:w-72'}`}
    >
      {/* Sidebar header */}
      <div
        className={`flex items-center gap-3 border-b border-slate-100 ${
          collapsed ? 'justify-center px-2 py-6' : 'px-6 py-6'
        }`}
      >
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5" />
        </button>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Project
            </p>
            <h2 className="truncate text-sm font-bold text-slate-900">
              {project?.title || 'Loading...'}
            </h2>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const to = `/projects/${projectId}/${item.path}`;
            const inner = (isActive) => (
              <>
                {renderAccentBar(isActive)}
                <Icon className={iconColor(isActive)} />
                {!collapsed && <span>{item.label}</span>}
              </>
            );
            return (
              <li key={item.path}>
                {projectId ? (
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={linkClasses}
                  >
                    {({ isActive }) => inner(isActive)}
                  </NavLink>
                ) : (
                  <span className={`${linkClasses({ isActive: false })} cursor-default`}>
                    {inner(false)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Projects section */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          {!collapsed && (
            <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Projects
            </p>
          )}
          <ul className="space-y-1">
            <li>
              <NavLink
                to="/dashboard"
                onClick={onNavigate}
                title={collapsed ? 'Projects' : undefined}
                className={linkClasses}
              >
                {({ isActive }) => (
                  <>
                    {renderAccentBar(isActive)}
                    <LayoutGrid className={iconColor(isActive)} />
                    {!collapsed && <span>Projects</span>}
                  </>
                )}
              </NavLink>
            </li>
            {projectId && (
              <li>
                <NavLink
                  to={`/projects/${projectId}`}
                  end
                  onClick={onNavigate}
                  title={collapsed ? project?.title || 'Project' : undefined}
                  className={projectLinkClasses}
                >
                  {({ isActive }) => (
                    <>
                      {renderAccentBar(isActive)}
                      <FolderKanban className={iconColor(isActive)} />
                      {!collapsed && (
                        <span className="truncate">{project?.title || 'Loading...'}</span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            )}
          </ul>
        </div>
      </nav>

      {/* Sidebar footer */}
      {!collapsed && (
        <div className="border-t border-slate-100 px-6 py-6">
          {project?.description ? (
            <p className="text-xs leading-relaxed text-slate-400">
              {project.description.length > 100
                ? project.description.slice(0, 100) + '...'
                : project.description}
            </p>
          ) : (
            <p className="text-xs text-slate-300 italic">No description</p>
          )}
        </div>
      )}
    </aside>
  );
}