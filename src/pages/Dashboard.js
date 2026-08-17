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
  Users,
  BarChart3,
  FileText,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { projects, loading, fetchProjects, createProject, deleteProject } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [deleteProjectTitle, setDeleteProjectTitle] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;
    setDeleteDialogOpen(false);
    const success = await deleteProject(deleteProjectId);
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
    });
    setCreating(false);
    if (result) {
      setCreateDialogOpen(false);
      setNewProject({ title: '', description: '' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const formatDate = (value) => {
    let date = new Date();
    if (value && typeof value === 'object' && typeof value._seconds === 'number') {
      date = new Date(value._seconds * 1000);
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredProjects = projects.filter((project) => {
    const q = searchQuery.toLowerCase();
    return (
      project.title?.toLowerCase().includes(q) ||
      project.description?.toLowerCase().includes(q)
    );
  });

  const totalBeforeForms = projects.reduce(
    (sum, p) => sum + (p.before_form ? 1 : 0),
    0
  );
  const totalAfterForms = projects.reduce(
    (sum, p) => sum + (p.after_form ? 1 : 0),
    0
  );
  const totalReports = projects.reduce(
    (sum, p) => sum + (p.reports_count || 0),
    0
  );

  const initials = (user?.full_name || user?.email || 'U')
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: ClipboardList, tint: 'bg-cyan-50 text-cyan-600' },
    { label: 'Before Forms', value: totalBeforeForms, icon: FileText, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'After Forms', value: totalAfterForms, icon: Layers, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Reports', value: totalReports, icon: BarChart3, tint: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">BFAR Assessment</p>
              <h1 className="text-lg font-bold text-slate-900">Projects</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white">
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
              onClick={handleLogout}
              className="text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Welcome back</p>
              <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">
                {user?.full_name ? `${user.full_name.split(' ')[0]}, manage your assessment projects` : 'Manage your assessment projects'}
              </h2>
              <p className="max-w-2xl text-base text-slate-300">
                Create projects to organize Before and After questionnaires, compare results, and generate narrative reports.
              </p>
              <div className="mt-6">
                <Button onClick={() => setCreateDialogOpen(true)} className="bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{stat.label}</p>
                      <p className="mt-1.5 text-3xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.tint}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by title or description..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>
          </section>

          <section>
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="h-full w-full rounded-2xl bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
                  <Inbox className="h-10 w-10" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">No projects found</h3>
                <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">
                  {searchQuery
                    ? 'No projects match your search. Try another keyword.'
                    : 'Create your first project to start building Before and After questionnaires.'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setCreateDialogOpen(true)} className="bg-cyan-600 text-white hover:bg-cyan-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-cyan-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                        Project
                      </span>
                      <Button
                        onClick={() => openDeleteDialog(project)}
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="p-5">
                      <h3 className="mb-1.5 line-clamp-2 text-lg font-bold text-slate-900">{project.title}</h3>
                      <p className="mb-5 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-500">
                        {project.description || 'No description provided.'}
                      </p>

                      <div className="mb-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-xs text-slate-400">Before Form</p>
                          <p className="text-xl font-bold text-slate-900">
                            {project.before_form ? (
                              <span className="text-emerald-600">Yes</span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl bg-indigo-50/70 px-4 py-3">
                          <p className="text-xs text-indigo-500">After Form</p>
                          <p className="text-xl font-bold text-indigo-700">
                            {project.after_form ? (
                              <span className="text-indigo-600">Yes</span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="w-full bg-slate-900 text-white hover:bg-slate-800"
                      >
                        <Users className="mr-2 h-4 w-4" /> Open Project
                      </Button>

                      <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> {formatDate(project.created_at ?? project.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this project?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteProjectTitle}"? This will also delete all associated questionnaires and reports. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteProject}>
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Create New Project</DialogTitle>
              <DialogDescription>
                Give your project a title and optional description. You can add questionnaires later.
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject} disabled={creating} className="bg-cyan-600 text-white hover:bg-cyan-700">
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
