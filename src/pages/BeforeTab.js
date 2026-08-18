import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import {
  Plus,
  Layers,
  Eye,
  ExternalLink,
  Copy,
  Trash2,
  Pencil,
  BarChart3,
  Inbox,
  CalendarDays,
  HelpCircle,
  MoreVertical,
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
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { useProject } from '../context/ProjectContext';

const BeforeTab = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const { fetchProject } = useProject();
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!project) return;
      try {
        if (project.before_form) {
          const [formRes, responsesRes] = await Promise.all([
            api.get(`/forms/${project.before_form}`),
            api.get(`/forms/${project.before_form}/responses`).catch(() => ({ data: [] })),
          ]);
          setForm(formRes.data);
          setResponses(responsesRes.data || []);
        }
      } catch (error) {
        toast.error('Failed to load Before questionnaire');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [project]);

  const copyFormLink = () => {
    if (!project?.before_form) return;
    const link = `${window.location.origin}/f/${project.before_form}`;
    navigator.clipboard.writeText(link);
    toast.success('Questionnaire link copied!');
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

  const handleDeleteForm = async () => {
    if (!project?.before_form) return;
    try {
      await api.delete(`/forms/${project.before_form}`);
      await api.put(`/projects/${projectId}`, { before_form: null });
      await fetchProject(projectId);
      setForm(null);
      setResponses([]);
      toast.success('Before questionnaire deleted');
    } catch (error) {
      toast.error('Failed to delete questionnaire');
    }
    setDeleteDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading Before questionnaire...
      </div>
    );
  }

  if (!project?.before_form) {
    return (
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative">
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">Before Questionnaires</p>
            <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">Before Intervention</h2>
            <p className="max-w-2xl text-base text-slate-300">
              Create a questionnaire to be distributed to respondents before the intervention or program begins.
            </p>
            <div className="mt-6">
              <Button
                onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=before`)}
                className="bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-400"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Before Questionnaire
              </Button>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-600">
            <Inbox className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No Before Questionnaire Yet</h3>
          <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">
            Create a Before questionnaire to collect baseline data from respondents prior to the intervention.
          </p>
          <Button
            onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=before`)}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Before Questionnaire
          </Button>
        </div>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">Before Questionnaires</p>
          <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">Before Intervention</h2>
          <p className="max-w-2xl text-base text-slate-300">
            All questionnaires distributed before the intervention to collect baseline data.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Forms</p>
          <p className="mt-1.5 text-3xl font-bold text-indigo-600">1</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Questions</p>
          <p className="mt-1.5 text-3xl font-bold text-cyan-600">{getQuestionCount()}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Responses</p>
          <p className="mt-1.5 text-3xl font-bold text-emerald-600">{responses.length}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
          <p className={`mt-1.5 text-3xl font-bold ${status === 'Active' ? 'text-emerald-600' : 'text-amber-500'}`}>{status}</p>
        </Card>
      </section>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">Before Questionnaires</h3>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">{form?.title || 'Untitled'}</h4>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                      status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}>
                      <span className={`mr-1 h-1 w-1 rounded-full ${status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {status}
                    </span>
                  </div>
                  {form?.description && (
                    <p className="mt-1 text-sm text-slate-500">{form.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> {getQuestionCount()} questions
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5" /> {responses.length} responses
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> Created {formatDate(form?.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=before`)}
                  size="sm"
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  onClick={() => navigate(`/forms/${project.before_form}/analytics`, { state: { project_id: projectId, questionnaire_type: 'before' } })}
                  size="sm"
                  variant="outline"
                  className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                >
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Analytics
                </Button>
                <Button
                  onClick={() => navigate(`/forms/${project.before_form}/responses`, { state: { project_id: projectId, questionnaire_type: 'before' } })}
                  size="sm"
                  variant="outline"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                </Button>
                <Button
                  onClick={copyFormLink}
                  size="sm"
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Link
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/create-questionnaire?type=before`)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/forms/${project.before_form}/analytics`, { state: { project_id: projectId, questionnaire_type: 'before' } })}>
                      <BarChart3 className="mr-2 h-4 w-4" /> Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/forms/${project.before_form}/responses`, { state: { project_id: projectId, questionnaire_type: 'before' } })}>
                      <ExternalLink className="mr-2 h-4 w-4" /> View Responses
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyFormLink}>
                      <Copy className="mr-2 h-4 w-4" /> Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-rose-600 focus:text-rose-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Before Questionnaire?</AlertDialogTitle>
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

export default BeforeTab;
