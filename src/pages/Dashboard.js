import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  BarChart3,
  Trash2,
  Edit,
  LogOut,
  Copy,
  Eye,
  Search,
  Clock,
  CalendarDays,
  Brain,
  ChevronDown,
  Inbox,
  Users,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/apiMiddleware';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  closed: 'bg-rose-50 text-rose-700 ring-rose-200'
};

const STATUS_LABELS = { active: 'Active', draft: 'Draft', closed: 'Closed', unknown: 'Unknown' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' }
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFormId, setDeleteFormId] = useState(null);
  const [deleteFormTitle, setDeleteFormTitle] = useState('');

  useEffect(() => {
    if (user) {
      fetchForms();
    }
  }, [user]);

  const fetchForms = async () => {
    try {
      const response = await api.get(`/forms`);
      setForms(response.data);
    } catch (error) {
      toast.error('Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForm = async (formId) => {
    try {
      await api.delete(`/forms/${formId}`);
      toast.success('Form deleted successfully');
      fetchForms();
    } catch (error) {
      toast.error('Failed to delete form');
    }
  };

  const openDeleteDialog = (form) => {
    setDeleteFormId(form.id);
    setDeleteFormTitle(form.title || 'this form');
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteFormId) return;
    setDeleteDialogOpen(false);
    await handleDeleteForm(deleteFormId);
    setDeleteFormId(null);
    setDeleteFormTitle('');
  };

  const handleDeleteDialogOpenChange = (open) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteFormId(null);
      setDeleteFormTitle('');
    }
  };

  const copyFormLink = (formId) => {
    const link = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(link);
    toast.success('Form link copied to clipboard!');
  };

  const handleUpdateStatus = async (formId, newStatus) => {
    setUpdatingStatus(formId);
    const currentForm = forms.find((form) => form.id === formId);
    if (!currentForm) {
      toast.error('Form not found');
      setUpdatingStatus(null);
      return;
    }

    const payload = {
      ...currentForm,
      status: newStatus === 'unknown' ? null : newStatus
    };

    try {
      await api.put(`/forms/${formId}`, payload);
      setForms((prev) =>
        prev.map((form) =>
          form.id === formId ? { ...form, status: payload.status } : form
        )
      );
      toast.success(`Status updated to ${STATUS_LABELS[newStatus] || newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const getStatusStyles = (status) => STATUS_STYLES[status] || STATUS_STYLES.draft;

  const getQuestionCount = (form) => {
    if (typeof form.questions === 'number') return form.questions;
    return Array.isArray(form.questions) ? form.questions.length : 0;
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

  const getResponseCount = (form) => {
    return form.response_count ?? form.responses ?? 0;
  };

  const totalResponses = forms.reduce((sum, form) => sum + getResponseCount(form), 0);
  const activeCount = forms.filter((form) => form.status === 'active').length;
  const draftCount = forms.filter((form) => form.status === 'draft').length;

  const filteredForms = forms.filter((form) => {
    const normalizedStatus = form.status?.toString().toLowerCase() || 'unknown';
    const matchesSearch =
      form.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || normalizedStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const initials = (user?.full_name || user?.email || 'U')
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  const stats = [
    { label: 'Total Forms', value: forms.length, icon: ClipboardList, tint: 'bg-cyan-50 text-cyan-600' },
    { label: 'Total Responses', value: totalResponses, icon: Users, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Active', value: activeCount, icon: BarChart3, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Drafts', value: draftCount, icon: FileText, tint: 'bg-amber-50 text-amber-600' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">GA e-Forms</p>
              <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
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
              data-testid="logout-button"
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
                {user?.full_name ? `${user.full_name.split(' ')[0]}, let's collect great data` : 'Let\'s collect great data'}
              </h2>
              <p className="max-w-2xl text-base text-slate-300">
                Create, share, and analyze your assessment forms from a single control center.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => navigate('/forms/new')} className="bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Form
                </Button>
                <Button onClick={() => navigate('/ml-upload')} className="bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20">
                  <Brain className="mr-2 h-4 w-4" />
                  ML Analysis
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search forms by title or description..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setFilterStatus(filter.value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      filterStatus === filter.value
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
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
            ) : filteredForms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
                  <Inbox className="h-10 w-10" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">No forms found</h3>
                <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">
                  {searchQuery
                    ? 'No forms match your search. Try another keyword or reset the filters.'
                    : 'You do not have any forms yet. Create your first form to start collecting responses.'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => navigate('/forms/new')} className="bg-cyan-600 text-white hover:bg-cyan-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Form
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredForms.map((form) => (
                  <Card
                    key={form.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusStyles(form.status)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {STATUS_LABELS[form.status] || 'Unknown'}
                      </span>
                      <select
                        value={form.status || 'unknown'}
                        onChange={(e) => handleUpdateStatus(form.id, e.target.value)}
                        disabled={updatingStatus === form.id}
                        aria-label="Change form status"
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 disabled:opacity-50"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-5">
                      <h3 className="mb-1.5 line-clamp-2 text-lg font-bold text-slate-900">{form.title}</h3>
                      <p className="mb-5 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-500">
                        {form.description || 'No description provided.'}
                      </p>

                      <div className="mb-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-xs text-slate-400">Questions</p>
                          <p className="text-xl font-bold text-slate-900">{getQuestionCount(form)}</p>
                        </div>
                        <div className="rounded-xl bg-cyan-50/70 px-4 py-3">
                          <p className="text-xs text-cyan-500">Responses</p>
                          <p className="text-xl font-bold text-cyan-700">{getResponseCount(form)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button onClick={() => navigate(`/forms/${form.id}/edit`)} size="sm" variant="outline" className="w-full">
                          <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button onClick={() => navigate(`/forms/${form.id}/analytics`)} size="sm" variant="outline" className="w-full">
                          <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Analytics
                        </Button>
                        <Button onClick={() => navigate(`/forms/${form.id}/responses`)} size="sm" variant="outline" className="w-full">
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button onClick={() => copyFormLink(form.id)} size="sm" variant="ghost" className="w-full text-slate-600">
                          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Link
                        </Button>
                        <Button
                          onClick={() => openDeleteDialog(form)}
                          size="sm"
                          variant="ghost"
                          className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>

                      <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> {formatDate(form.created_at ?? form.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this form?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteFormTitle}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteConfirm}>
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Dashboard;
