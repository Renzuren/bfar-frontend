import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  BarChart3,
  ListChecks,
  Layers,
  FileBarChart2,
  DatabaseBackup,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const PROJECT_SIDEBAR_ITEMS = [
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
export const PROJECT_BREADCRUMB_LABELS = {
  'create-questionnaire': 'Edit Questionnaire',
  'before': 'Before',
  'after': 'After',
  'report': 'Analysis Report',
  'responses': 'View Responses',
  'profiles': 'View Profiles',
  'analytics': 'View Analytics',
  'narrative-report': 'Narrative Report',
  'backup': 'Data Backup & Import',
};

const ProjectDashboard = () => {
  const { currentProject } = useProject();

  return <ProjectOverview project={currentProject} />;
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
