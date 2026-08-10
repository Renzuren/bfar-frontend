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
  Filter,
  Clock,
  CalendarDays,
  Brain
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
      toast.success(`Status updated to ${newStatus === 'unknown' ? 'Unknown' : newStatus}`);
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

  const getStatusStyles = (status) => {
    if (status === 'active') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'draft') {
      return 'bg-slate-100 text-slate-700';
    }
    if (status === 'closed') {
      return 'bg-rose-100 text-rose-700';
    }
    return 'bg-slate-100 text-slate-700';
  };

  const getQuestionCount = (form) => {
    if (typeof form.questions === 'number') return form.questions;
    return Array.isArray(form.questions) ? form.questions.length : 0;
  };

  const formatCreatedAtDate = (createdAt) => {
    const date = createdAt ? new Date(createdAt) : new Date();
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCreatedAtTime = (createdAt) => {
    const date = createdAt ? new Date(createdAt) : new Date();
    if (isNaN(date.getTime())) {
      return new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getResponseCount = (form) => {
    return form.response_count ?? form.responses ?? 0;
  };

  const filteredForms = forms.filter((form) => {
    const normalizedStatus = form.status?.toString().toLowerCase() || 'unknown';
    const matchesSearch =
      form.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || normalizedStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50/80 to-blue-50">
      <div className="pointer-events-none absolute top-0 right-0 w-[520px] h-[520px] bg-cyan-100/25 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[520px] h-[520px] bg-blue-100/25 rounded-full blur-3xl" />

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 shadow-sm w-full">
        <div className="w-full px-2 sm:px-4 lg:px-6 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">General Assessment e-Forms</p>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-900">{user?.full_name || 'User'}</span>
              <span className="text-xs text-slate-500">{user?.email || 'user@example.com'}</span>
            </div>
            <Button
              data-testid="logout-button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-2 sm:px-4 lg:px-6 py-6 space-y-6 relative z-10">
        <section className="rounded-[2rem] border border-slate-200/70 bg-white/90 shadow-xl shadow-slate-900/5 p-6 overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-2 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-600 mb-3">Welcome back</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-4">
                Manage your surveys with clean insights
              </h2>
              <p className="max-w-2xl text-base text-slate-600 leading-8">
                Quickly find forms, monitor response counts, and act on your most important surveys from a single control center.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-900/95 p-5 text-white shadow-lg shadow-cyan-500/10">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300 mb-3">Forms</p>
                <p className="text-4xl font-bold">{forms.length}</p>
                <p className="text-sm text-slate-200 mt-2">Active and draft forms</p>
              </div>
              <div className="rounded-3xl bg-cyan-50 p-5 shadow-lg shadow-cyan-500/10">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-600 mb-3">Status</p>
                <p className="text-4xl font-bold text-slate-900">{filterStatus === 'all' ? 'All' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</p>
                <p className="text-sm text-slate-500 mt-2">Filter is currently active</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white border border-slate-200/70 shadow-lg shadow-slate-900/5 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search forms..."
                  className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-2xl shadow-sm focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {['all', 'active', 'draft', 'closed'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilterStatus(status)}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      filterStatus === status
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/15'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total Forms', value: forms.length, gradient: 'from-cyan-400 to-blue-500', icon: FileText },
                { label: 'Responses', value: forms.reduce((sum, form) => sum + getResponseCount(form), 0), gradient: 'from-blue-400 to-indigo-500', icon: Eye },
                { label: 'Active', value: forms.filter((form) => form.status === 'active').length, gradient: 'from-teal-400 to-cyan-500', icon: BarChart3 },
                { label: 'Drafts', value: forms.filter((form) => form.status === 'draft').length, gradient: 'from-slate-400 to-slate-600', icon: Trash2 }
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg shadow-slate-900/10 mb-4`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-2">{stat.label}</p>
                    <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200/70 shadow-lg shadow-slate-900/5 p-6">
            <div className="mb-6">
              <div>
                <p className="text-sm text-slate-500">Quick actions</p>
                <h3 className="text-xl font-semibold text-slate-900">Get started</h3>
              </div>
            </div>
            <div className="flex gap-3 mb-6">
              <Button
                onClick={() => navigate('/forms/new')}
                className="flex-1 bg-gradient-to-r from-[#0a2540] to-[#1a5490] text-white hover:shadow-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Form
              </Button>
              <Button
                onClick={() => navigate('/ml-upload')}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-xl"
              >
                <Brain className="w-4 h-4 mr-2" />
                ML Analysis
              </Button>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Recommended</p>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Use the search and status filters to narrow down active surveys quickly.
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Tip</p>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Duplicate frequently used forms to keep your workflow moving.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          {loading ? (
            <div className="rounded-3xl bg-white border border-slate-200/70 shadow-lg shadow-slate-900/5 p-12 text-center">
              <p className="text-base text-slate-500">Loading your dashboard...</p>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-12 text-center shadow-sm">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700">
                <FileText className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-2">No forms found</h3>
              <p className="max-w-xl mx-auto text-slate-600 mb-6">
                {searchQuery
                  ? 'No forms match your search. Try another keyword or reset the filters.'
                  : 'You do not have any forms yet. Create your first form to start collecting responses.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate('/forms/new')} className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Form
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredForms.map((form) => (
                <Card key={form.id} className="group overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 mb-2">
                          {(form.status?.toString().charAt(0).toUpperCase() + form.status?.toString().slice(1)) || 'Status'}
                        </p>
                        <h3 className="text-xl font-semibold text-slate-900 leading-tight mb-2 line-clamp-2">{form.title}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{form.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`rounded-2xl px-3 py-2 text-xs font-semibold ${getStatusStyles(form.status)}`}>
                          {(form.status?.toString().charAt(0).toUpperCase() + form.status?.toString().slice(1)) || 'Unknown'}
                        </div>
                        <select
                          value={form.status || 'unknown'}
                          onChange={(e) => handleUpdateStatus(form.id, e.target.value)}
                          disabled={updatingStatus === form.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-cyan-400"
                        >
                          <option value="unknown">Unknown</option>
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Questions</p>
                        <p className="text-2xl font-semibold text-slate-900">{getQuestionCount(form)}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Responses</p>
                        <p className="text-2xl font-semibold text-cyan-600">{getResponseCount(form)}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <Button
                        onClick={() => navigate(`/forms/${form.id}/edit`)}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => navigate(`/forms/${form.id}/analytics`)}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        Analytics
                      </Button>
                      <Button
                        onClick={() => navigate(`/forms/${form.id}/responses`)}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        onClick={() => copyFormLink(form.id)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        onClick={() => openDeleteDialog(form)}
                        size="sm"
                        variant="outline"
                        className="flex-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 text-xs text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <CalendarDays className="w-3 h-3" />
                        {formatCreatedAtDate(form.createdAt)}
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatCreatedAtTime(form.createdAt)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

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
                Yes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Dashboard;
