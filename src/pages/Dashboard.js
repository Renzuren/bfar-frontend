import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Trash2,
  LogOut,
  Search,
  CalendarDays,
  Inbox,
  ClipboardList,
  FileText,
  CheckCircle2,
  Brain,
  Shield,
  Settings,
  ArrowUpDown,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { getSavedAnalyses, renameAnalysis } from '../lib/analysisStore';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { projects, loading, fetchProjects, createProject, deleteProject } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('baseline');
  const [sortBy, setSortBy] = useState('date-desc');
  const [mlSearchQuery, setMlSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [deleteProjectTitle, setDeleteProjectTitle] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', hasBaseline: true });
  const [creating, setCreating] = useState(false);
  const [renameAnalysisId, setRenameAnalysisId] = useState(null);
  const [renameAnalysisTitle, setRenameAnalysisTitle] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
    if (user) fetchProjects();
  }, [user, fetchProjects, navigate]);

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;
    setDeleteDialogOpen(false);
    await deleteProject(deleteProjectId);
    setDeleteProjectId(null);
    setDeleteProjectTitle('');
  };

  const openDeleteDialog = (project) => {
    setDeleteProjectId(project.id);
    setDeleteProjectTitle(project.title || 'this project');
    setDeleteDialogOpen(true);
  };

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    setCreating(true);
    const result = await createProject({
      title: newProject.title.trim(),
      description: newProject.description.trim(),
      has_baseline: newProject.hasBaseline,
    });
    setCreating(false);
    if (result) {
      setCreateDialogOpen(false);
      setNewProject({ title: '', description: '', hasBaseline: true });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const startRenameAnalysis = (analysis) => {
    setRenameAnalysisId(analysis.id);
    setRenameAnalysisTitle(analysis.title || '');
  };

  const commitRenameAnalysis = () => {
    const trimmed = renameAnalysisTitle.trim();
    if (!trimmed) {
      setRenameAnalysisId(null);
      setRenameAnalysisTitle('');
      return;
    }
    renameAnalysis(renameAnalysisId, trimmed);
    toast.success('Analysis renamed');
    setRenameAnalysisId(null);
    setRenameAnalysisTitle('');
  };

  const cancelRenameAnalysis = () => {
    setRenameAnalysisId(null);
    setRenameAnalysisTitle('');
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    let date;
    if (typeof value === 'object' && typeof value._seconds === 'number') {
      date = new Date(value._seconds * 1000);
    } else {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const baselineProjects = projects.filter((p) => p.has_baseline !== false);
  const noBaselineProjects = projects.filter((p) => p.has_baseline === false);
  const visibleProjects = (activeTab === 'no-baseline' ? noBaselineProjects : baselineProjects).filter(
    (project) => {
      const q = searchQuery.toLowerCase();
      return (
        project.title?.toLowerCase().includes(q) ||
        project.description?.toLowerCase().includes(q)
      );
    }
  );

  const savedAnalyses = getSavedAnalyses();
  const formatMoney = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? `₱${n.toFixed(2)}` : '—';
  };

  const toDate = (value) => {
    if (!value) return 0;
    if (typeof value === 'object' && value._seconds != null) return value._seconds * 1000;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const sortList = (items, getTitle, getDate) =>
    [...items].sort((a, b) => {
      switch (sortBy) {
        case 'a-z':
          return String(getTitle(a)).localeCompare(String(getTitle(b)));
        case 'z-a':
          return String(getTitle(b)).localeCompare(String(getTitle(a)));
        case 'date-asc':
          return toDate(getDate(a)) - toDate(getDate(b));
        default:
          return toDate(getDate(b)) - toDate(getDate(a));
      }
    });

  const sortedProjects = sortList(
    visibleProjects,
    (p) => p.title,
    (p) => p.created_at ?? p.createdAt
  );
  const sortedAnalyses = sortList(
    savedAnalyses,
    (a) => a.title,
    (a) => a.createdAt
  );
  const filteredAnalyses = sortedAnalyses.filter((analysis) => {
    const q = mlSearchQuery.toLowerCase();
    return (
      analysis.title?.toLowerCase().includes(q) ||
      analysis.fileName?.toLowerCase().includes(q) ||
      analysis.outcomeColumn?.toLowerCase().includes(q)
    );
  });

  const totalBaseline = projects.filter((p) => p.has_baseline !== false).length;
  const totalNoBaseline = projects.filter((p) => p.has_baseline === false).length;
  const activeProjects = projects.filter(
    (p) => p.before_form || p.after_form
  ).length;
  const draftProjects = projects.filter(
    (p) => !p.before_form && !p.after_form
  ).length;

  const initials = (user?.full_name || user?.email || 'U')
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  const statColors = ['cyan', 'indigo', 'violet', 'emerald', 'amber'];
  const statIcons = [ClipboardList, CheckCircle2, FileText, FolderKanban, Inbox];
  const statLabels = ['Total Projects', 'Total Baseline', 'Total No Baseline', 'Total Active', 'Total Drafts'];
  const statValues = [projects.length, totalBaseline, totalNoBaseline, activeProjects, draftProjects];

  const accentColors = {
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    violet: 'bg-violet-500',
  };

  const iconBgColors = {
    cyan: 'bg-cyan-50',
    indigo: 'bg-indigo-50',
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50',
    violet: 'bg-violet-50',
  };

  const iconTextColors = {
    cyan: 'text-cyan-600',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
        <div className="flex w-full items-center justify-between px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20 transition-shadow hover:shadow-cyan-500/40">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">General Assessment</p>
              <h1 className="text-lg font-bold text-slate-900">Projects</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="hidden items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 hover:text-violet-800 sm:inline-flex"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Panel
              </button>
            )}
            <div className="hidden items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-sm sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-md shadow-cyan-500/20">
                {initials}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-500">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings')}
              className="text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-3 pb-24 pt-0 sm:px-4">
        <div className="space-y-8">

          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 px-6 py-8 sm:px-10 sm:py-12 text-white shadow-2xl shadow-slate-900/20 text-left">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Welcome back</p>
              <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">
                {user?.full_name ? `${user.full_name.split(' ')[0]}, manage your assessment projects` : 'Manage your assessment projects'}
              </h2>
              <p className="max-w-2xl text-base text-slate-300">
                Create projects to organize Before and After questionnaires, compare results, and generate narrative reports.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 transition-all hover:bg-cyan-400 hover:shadow-xl hover:shadow-cyan-500/40"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
                <Button
                  onClick={() => navigate('/ml-upload')}
                  variant="outline"
                  className="border-2 border-violet-400/40 bg-violet-500/10 text-violet-200 backdrop-blur-sm transition-all hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-white"
                >
                  <Brain className="mr-2 h-4 w-4" />
                  ML Analysis
                </Button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
            {statColors.map((color, idx) => {
              const Icon = statIcons[idx];
              return (
                <div
                  key={statLabels[idx]}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`absolute inset-y-0 left-0 w-1 ${accentColors[color]}`} />
                  <div className="pl-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBgColors[color]}`}>
                        <Icon className={`h-5 w-5 ${iconTextColors[color]}`} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">{statLabels[idx]}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{statValues[idx]}</p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'baseline', label: 'Baseline', icon: ClipboardList, count: baselineProjects.length },
                { key: 'no-baseline', label: 'No Baseline', icon: FileText, count: noBaselineProjects.length },
                { key: 'ml', label: 'ML Analysis Result', icon: Brain, count: savedAnalyses.length },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setRenameAnalysisId(null); setRenameAnalysisTitle(''); setActiveTab(tab.key); }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
                      activeTab === tab.key
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {activeTab !== 'ml' && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects by title or description..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-11 w-44 gap-2 text-sm">
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a-z" className="text-sm">A to Z</SelectItem>
                      <SelectItem value="z-a" className="text-sm">Z to A</SelectItem>
                      <SelectItem value="date-desc" className="text-sm">Newest first</SelectItem>
                      <SelectItem value="date-asc" className="text-sm">Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'ml' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">ML Analysis Results</h2>
                <p className="text-xs text-slate-500">
                  Saved propensity-score / impact analyses from your uploads.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 w-40 gap-2 text-sm">
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a-z" className="text-sm">A to Z</SelectItem>
                    <SelectItem value="z-a" className="text-sm">Z to A</SelectItem>
                    <SelectItem value="date-desc" className="text-sm">Newest first</SelectItem>
                    <SelectItem value="date-asc" className="text-sm">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/ml-upload')}
                  className="gap-2 border-slate-200 text-sm"
                >
                  <Brain className="h-4 w-4" />
                  <span className="hidden sm:inline">New Analysis</span>
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={mlSearchQuery}
                    onChange={(e) => setMlSearchQuery(e.target.value)}
                    placeholder="Search analyses by title or outcome..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {filteredAnalyses.length === 0 ? (
              <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Brain className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {savedAnalyses.length === 0 ? 'No saved analyses yet' : 'No analyses match your search'}
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                  {savedAnalyses.length === 0
                    ? 'Run an analysis on the ML Data Upload page, then save the results here so they appear on your dashboard.'
                    : 'Try a different keyword or clear the search.'}
                </p>
                {savedAnalyses.length === 0 && (
                  <Button
                    onClick={() => navigate('/ml-upload')}
                    className="mt-5 gap-2 bg-blue-600 text-sm shadow-sm hover:bg-blue-700"
                  >
                    <Brain className="h-4 w-4" /> Go to ML Data Upload
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAnalyses.map((analysis) => {
                  const att = analysis.analysisResults?.att_result || {};
                  return (
                    <div
                      key={analysis.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/ml-analysis/${analysis.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/ml-analysis/${analysis.id}`);
                        }
                      }}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> ML Analysis
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(analysis.createdAt)}
                        </span>
                      </div>
                      {renameAnalysisId === analysis.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); commitRenameAnalysis(); }}
                          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commitRenameAnalysis(); }}
                          onClick={(e) => e.stopPropagation()}
                          className="mb-3 flex items-center gap-2"
                        >
                          <input
                            autoFocus
                            value={renameAnalysisTitle}
                            onChange={(e) => setRenameAnalysisTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelRenameAnalysis();
                              }
                            }}
                            placeholder="Analysis title"
                            className="w-full rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            type="submit"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); cancelRenameAnalysis(); }}
                            className="shrink-0 rounded-lg px-1.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="line-clamp-2 text-base font-bold text-slate-900">
                            {analysis.title}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startRenameAnalysis(analysis); }}
                            title="Rename analysis"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 opacity-0 transition group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-slate-50 px-2 py-2">
                          <p className="text-[10px] font-medium text-slate-400">Matched Pairs</p>
                          <p className="text-sm font-bold text-slate-800">
                            {att.matched_pairs ?? '—'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-teal-50/70 px-2 py-2">
                          <p className="text-[10px] font-medium text-teal-500">Mean ATT</p>
                          <p className="text-sm font-bold text-teal-700">
                            {formatMoney(att.att_mean)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-indigo-50/70 px-2 py-2">
                          <p className="text-[10px] font-medium text-indigo-500">Outcome</p>
                          <p className="truncate text-sm font-bold text-indigo-700">
                            {analysis.outcomeColumn || 'Auto'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

          {activeTab !== 'ml' && (
          <section>
            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="h-full w-full rounded-2xl bg-slate-100/80" />
                  </div>
                ))}
              </div>
            ) : visibleProjects.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-left">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Inbox className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">
                  {activeTab === 'no-baseline' ? 'No no-baseline projects yet' : 'No baseline projects yet'}
                </h3>
                <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">
                  {searchQuery
                    ? 'No projects match your search. Try another keyword or clear the search.'
                    : activeTab === 'no-baseline'
                      ? 'Create your first no-baseline project to compare Beneficiary and Non-Beneficiary respondents.'
                      : 'Create your first baseline project to start building Before and After questionnaires.'}
                </p>
                {searchQuery === '' && (
                  <button
                    onClick={() => {
                      setNewProject((p) => ({ ...p, hasBaseline: activeTab === 'baseline' }));
                      setCreateDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    {activeTab === 'no-baseline' ? 'Create Your First No-Baseline Project' : 'Create Your First Baseline Project'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {sortedProjects.map((project) => {
                  const hasBefore = !!project.before_form;
                  const hasAfter = !!project.after_form;
                  const projectIsBaseline = project.has_baseline !== false;
                  const beforeLabel = projectIsBaseline ? 'Before Form' : 'Beneficiary Form';
                  const afterLabel = projectIsBaseline ? 'After Form' : 'Non-Beneficiary Form';
                  return (
                    <div
                      key={project.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className={`h-1 w-full ${hasBefore || hasAfter ? 'bg-emerald-500' : 'bg-amber-400'}`} />

                      <div className="flex items-center justify-between px-6 pt-4 pb-0">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          hasBefore || hasAfter
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            hasBefore || hasAfter ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                          {hasBefore || hasAfter ? 'Active' : 'Draft'}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          projectIsBaseline
                            ? 'bg-blue-50 text-blue-700 ring-blue-200'
                            : 'bg-violet-50 text-violet-700 ring-violet-200'
                        }`}>
                          {projectIsBaseline ? 'Baseline' : 'No Baseline'}
                        </span>
                        <Button
                          onClick={() => openDeleteDialog(project)}
                          size="sm"
                          variant="ghost"
                          className="text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="p-6">
                        <h3 className="mb-1.5 line-clamp-2 text-lg font-bold text-slate-900 text-left">{project.title}</h3>
                        <p className="mb-5 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-500">
                          {project.description || 'No description provided.'}
                        </p>

                        <div className="mb-5 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <p className="text-xs text-slate-400">{beforeLabel}</p>
                            <p className="text-xl font-bold text-slate-900">
                              {hasBefore ? (
                                <span className="text-emerald-600">Yes</span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl bg-indigo-50/70 px-4 py-3">
                            <p className="text-xs text-indigo-500">{afterLabel}</p>
                            <p className="text-xl font-bold text-indigo-700">
                              {hasAfter ? (
                                <span className="text-indigo-600">Yes</span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <Button
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="w-full bg-slate-900 text-white transition-colors hover:bg-slate-800"
                        >
                          <FolderKanban className="mr-2 h-4 w-4" /> Open Project
                        </Button>

                        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(project.created_at ?? project.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Delete this project?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteProjectTitle}"? This will also delete all associated questionnaires and reports. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">No</AlertDialogCancel>
              <AlertDialogAction className="rounded-xl bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteProject}>
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Create New Project</DialogTitle>
              <DialogDescription>
                Give your project a title, optional description, and choose a comparison type. You can add questionnaires later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Project Title *</label>
                <Input
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                  placeholder="e.g., Community Livelihood Assessment 2026"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <Textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Brief description of the assessment project..."
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Comparison Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, hasBaseline: true })}
                    className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                      newProject.hasBaseline
                        ? 'border-cyan-500 bg-cyan-50/80 shadow-sm shadow-cyan-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`block text-sm font-bold ${newProject.hasBaseline ? 'text-cyan-700' : 'text-slate-900'}`}>
                      Baseline
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-slate-500">
                      Before &amp; After tabs — compare results before vs. after the intervention.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, hasBaseline: false })}
                    className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                      !newProject.hasBaseline
                        ? 'border-cyan-500 bg-cyan-50/80 shadow-sm shadow-cyan-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`block text-sm font-bold ${!newProject.hasBaseline ? 'text-cyan-700' : 'text-slate-900'}`}>
                      No Baseline
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-slate-500">
                      Beneficiary &amp; Non-Beneficiary tabs — compare beneficiary vs. non-beneficiary respondents.
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleCreateProject} disabled={creating} className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
                {creating ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Dashboard;
