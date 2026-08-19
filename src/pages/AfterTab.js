import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import {
  Plus,
  ListChecks,
  Eye,
  ExternalLink,
  Trash2,
  Pencil,
  BarChart3,
  Inbox,
  Copy,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { useProject } from '../context/ProjectContext';

const AfterTab = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const { fetchProject } = useProject();
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!project) return;
      try {
        if (project.after_form) {
          const [formRes, responsesRes] = await Promise.all([
            api.get(`/forms/${project.after_form}`),
            api.get(`/forms/${project.after_form}/responses`).catch(() => ({ data: [] })),
          ]);
          setForm(formRes.data);
          setResponses(responsesRes.data || []);
        }
      } catch (error) {
        toast.error('Failed to load After questionnaire');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [project]);

  const copyFormLink = () => {
    if (!project?.after_form) return;
    const link = `${window.location.origin}/f/${project.after_form}`;
    navigator.clipboard.writeText(link);
    toast.success('Questionnaire link copied!');
  };

  const copyFromBefore = async () => {
    if (!project?.before_form) {
      toast.error('No Before questionnaire to copy from');
      return;
    }
    setCopying(true);
    try {
      const beforeRes = await api.get(`/forms/${project.before_form}`);
      const beforeForm = beforeRes.data;

      const payload = {
        title: beforeForm.title ? `${beforeForm.title} (After)` : 'After Assessment',
        description: beforeForm.description || '',
        questions: (beforeForm.questions || []).map(q => ({ ...q })),
        sections: (beforeForm.sections || []).map(sec => ({
          ...sec,
          id: `section_${sec.section_type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          questions: (sec.questions || []).map(q => ({ ...q })),
        })),
        csvHeaders: beforeForm.csvHeaders || '',
        csvColumnCount: beforeForm.csvColumnCount || 0,
        project_id: projectId,
        questionnaire_type: 'after',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await api.post('/forms', payload);
      const newFormId = response.data.id;

      await api.put(`/projects/${projectId}`, { after_form: newFormId });
      await fetchProject(projectId);

      setForm({ ...payload, id: newFormId });
      setResponses([]);
      toast.success('After questionnaire created from Before template! You can now edit it.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to copy Before questionnaire');
    } finally {
      setCopying(false);
    }
  };

  const getQuestionCount = () => {
    if (!form) return 0;
    if (form.sections) return form.sections.flatMap((s) => s.questions || []).length;
    return (form.questions || []).length;
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
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getStatus = () => {
    if (!form) return 'Draft';
    const qCount = getQuestionCount();
    if (qCount === 0) return 'Draft';
    if (responses.length === 0) return 'Active';
    return 'Active';
  };

  const getLastResponseDate = () => {
    if (responses.length === 0) return 'N/A';
    const latest = responses.reduce((best, r) => {
      const d = r.createdAt || r.submittedAt;
      if (!d) return best;
      const date = typeof d === 'object' && typeof d._seconds === 'number' ? d._seconds : new Date(d).getTime() / 1000;
      if (!best || date > best.ts) return { ts: date, raw: d };
      return best;
    }, null);
    return latest ? formatDate(latest.raw) : 'N/A';
  };

  const handleDeleteForm = async () => {
    if (!project?.after_form) return;
    try {
      await api.delete(`/forms/${project.after_form}`);
      await api.put(`/projects/${projectId}`, { after_form: null });
      await fetchProject(projectId);
      setForm(null);
      setResponses([]);
      toast.success('After questionnaire deleted');
    } catch (error) {
      toast.error('Failed to delete questionnaire');
    }
    setDeleteDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading After questionnaire...
      </div>
    );
  }

  if (!project?.after_form) {
    return (
      <div className="mx-auto space-y-8 px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 px-8 py-10 text-white shadow-2xl shadow-purple-900/20 sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl" />
          <div className="relative text-left">
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-violet-200">After Questionnaires</p>
            <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">After Intervention</h2>
            <p className="max-w-2xl text-base text-purple-100">
              Create a questionnaire to measure changes after the intervention or program has been completed.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {project?.before_form && (
                <Button
                  onClick={copyFromBefore}
                  disabled={copying}
                  className="bg-white px-5 py-2.5 text-purple-700 shadow-lg shadow-purple-500/30 hover:bg-purple-50"
                >
                  {copying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copying ? 'Copying...' : 'Copy from Before'}
                </Button>
              )}
              <Button
                onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=after`)}
                variant="outline"
                className="border-white/30 px-5 py-2.5 text-white hover:bg-white/10"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Blank
              </Button>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-left shadow-sm">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600">
            <Inbox className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No After Questionnaire Yet</h3>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            {project?.before_form
              ? 'Copy your Before questionnaire to ensure matching structures for accurate Narrative Report comparisons, or create a blank one.'
              : 'Create an After questionnaire to measure the impact and changes after the intervention.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {project?.before_form && (
              <button
                onClick={copyFromBefore}
                disabled={copying}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
              >
                {copying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copying ? 'Copying...' : 'Copy from Before'}
              </button>
            )}
            <button
              onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=after`)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Create Blank
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 px-8 py-10 text-white shadow-2xl shadow-purple-900/20 sm:px-12 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="relative flex items-start justify-between text-left">
          <div className="flex items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <ListChecks className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{form?.title || 'After Assessment'}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  status === 'Active'
                    ? 'bg-emerald-400/20 text-emerald-100 ring-emerald-400/30'
                    : 'bg-amber-400/20 text-amber-100 ring-amber-400/30'
                }`}>
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {status}
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-purple-200">
                  <BarChart3 className="h-3.5 w-3.5" /> {responses.length} {responses.length === 1 ? 'response' : 'responses'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Grid */}
      <section className="grid grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">Questions</p>
          <p className="mt-1.5 text-left text-3xl font-bold text-violet-600">{getQuestionCount()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">Responses</p>
          <p className="mt-1.5 text-left text-3xl font-bold text-emerald-600">{responses.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">Last Response</p>
          <p className="mt-1.5 text-left text-lg font-bold text-slate-700">{getLastResponseDate()}</p>
        </div>
      </section>

      {/* Action Grid */}
      <section className="grid grid-cols-2 gap-5">
        <button
          onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=after`)}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-blue-200"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
            <Pencil className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">Edit</p>
            <p className="text-xs text-slate-500">Modify questions and settings</p>
          </div>
        </button>

        <button
          onClick={() => navigate(`/forms/${project.after_form}/responses`, { state: { project_id: projectId, questionnaire_type: 'after' } })}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
            <Eye className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">View Responses</p>
            <p className="text-xs text-slate-500">Browse submitted responses</p>
          </div>
        </button>

        <button
          onClick={() => navigate(`/forms/${project.after_form}/analytics`, { state: { project_id: projectId, questionnaire_type: 'after' } })}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-violet-200"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition-colors group-hover:bg-violet-100">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">Analytics</p>
            <p className="text-xs text-slate-500">View charts and insights</p>
          </div>
        </button>

        <button
          onClick={copyFormLink}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-amber-200"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">Copy Link</p>
            <p className="text-xs text-slate-500">Share questionnaire URL</p>
          </div>
        </button>
      </section>

      {/* Delete Button */}
      <div className="flex justify-start">
        <button
          onClick={() => setDeleteDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 className="h-4 w-4" />
          Delete Questionnaire
        </button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete After Questionnaire?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this questionnaire and all its responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteForm}>
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AfterTab;
