import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import {
  Plus,
  Layers,
  ListChecks,
  ExternalLink,
  Trash2,
  Pencil,
  BarChart3,
  Inbox,
  Copy,
  Loader2,
  IdCard,
  QrCode,
  Eye,
} from 'lucide-react';
import ShareQrDialog from '../components/ShareQrDialog';
import QuickAction from '../components/common/QuickAction';
import PageLoader from '../components/common/PageLoader';
import ResponsesTable from '../components/responses/ResponsesTable';
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
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';
import { useProject } from '../context/ProjectContext';
import { copyToClipboard } from '../lib/utils';
import { formatDate, latestResponseTime } from '../lib/dates';

// Everything that differs between the project's two questionnaire slots.
// Baseline projects call them Before / After; No Baseline projects call them
// Beneficiary / Non-Beneficiary. Class names are written out in full so
// Tailwind keeps them.
const SLOTS = {
  before: {
    formKey: 'before_form',
    label: { baseline: 'Before', noBaseline: 'Beneficiary' },
    heading: { baseline: 'Before Intervention', noBaseline: 'Beneficiary Group' },
    intro: {
      baseline: 'Create a questionnaire to be distributed to respondents before the intervention or program begins.',
      noBaseline: 'Create a questionnaire to be distributed to beneficiary respondents.',
    },
    emptyText: {
      baseline: 'Create a Before questionnaire to collect baseline data from respondents prior to the intervention.',
      noBaseline: 'Create a Beneficiary questionnaire to collect data from beneficiary respondents.',
    },
    HeroIcon: Layers,
    theme: {
      hero: 'from-cyan-600 via-blue-600 to-blue-700 shadow-blue-900/20',
      blobA: 'bg-cyan-300/20',
      blobB: 'bg-blue-300/20',
      eyebrow: 'text-cyan-200',
      body: 'text-blue-100',
      meta: 'text-blue-200',
      heroButton: 'bg-white text-blue-700 shadow-lg shadow-blue-500/30 hover:bg-blue-50',
      emptyIcon: 'from-cyan-100 to-blue-100 text-cyan-600',
      emptyButton: 'bg-cyan-600 text-white hover:bg-cyan-700',
      overviewHeader: 'bg-cyan-50/50',
      overviewIcon: 'bg-cyan-100 text-cyan-600',
      questionCount: 'text-cyan-600',
      actionsHeader: 'bg-blue-50/50',
      actionsIcon: 'bg-blue-100 text-blue-600',
    },
  },
  after: {
    formKey: 'after_form',
    label: { baseline: 'After', noBaseline: 'Non-Beneficiary' },
    heading: { baseline: 'After Intervention', noBaseline: 'Non-Beneficiary Group' },
    intro: {
      baseline: 'Create a questionnaire to measure changes after the intervention or program has been completed.',
      noBaseline: 'Create a questionnaire to be distributed to non-beneficiary respondents for comparison.',
    },
    emptyText: {
      baseline: 'Create an After questionnaire to measure the impact and changes after the intervention.',
      noBaseline: 'Create a Non-Beneficiary questionnaire to collect data for comparison with the Beneficiary group.',
    },
    HeroIcon: ListChecks,
    theme: {
      hero: 'from-violet-600 via-purple-600 to-purple-700 shadow-purple-900/20',
      blobA: 'bg-violet-300/20',
      blobB: 'bg-purple-300/20',
      eyebrow: 'text-violet-200',
      body: 'text-purple-100',
      meta: 'text-purple-200',
      heroButton: 'bg-white px-5 py-2.5 text-purple-700 shadow-lg shadow-purple-500/30 hover:bg-purple-50',
      emptyIcon: 'from-violet-100 to-purple-100 text-violet-600',
      emptyButton: 'bg-violet-600 text-white hover:bg-violet-700',
      overviewHeader: 'bg-violet-50/50',
      overviewIcon: 'bg-violet-100 text-violet-600',
      questionCount: 'text-violet-600',
      actionsHeader: 'bg-purple-50/50',
      actionsIcon: 'bg-purple-100 text-purple-600',
    },
  },
};

const toResponseList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.responses)) return payload.responses;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const countQuestions = (form) => {
  if (!form) return 0;
  if (form.sections) return form.sections.flatMap((s) => s.questions || []).length;
  return (form.questions || []).length;
};

// A copy of the Before/Beneficiary questionnaire as a new After/Non-Beneficiary
// one, so both keep the same structure for the report comparisons.
const copyPayload = (source, label, projectId) => ({
  title: source.title ? `${source.title} (${label})` : `${label} Assessment`,
  description: source.description || '',
  questions: (source.questions || []).map((q) => ({ ...q })),
  sections: (source.sections || []).map((sec) => ({
    ...sec,
    id: `section_${sec.section_type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    questions: (sec.questions || []).map((q) => ({ ...q })),
  })),
  csvHeaders: source.csvHeaders || '',
  csvColumnCount: source.csvColumnCount || 0,
  project_id: projectId,
  questionnaire_type: 'after',
});

const SectionHeader = ({ icon: Icon, title, subtitle, className, iconClassName }) => (
  <div className={`flex items-center gap-3 border-b border-slate-100 px-6 py-4 ${className}`}>
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  </div>
);

const Stat = ({ label, children }) => (
  <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-5">
    <p className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
    {children}
  </div>
);

/**
 * One of a project's two questionnaires (slot "before" or "after"): an empty
 * state offering to create it, or its overview, quick actions and responses.
 */
const QuestionnaireTab = ({ slot }) => {
  const config = SLOTS[slot];
  const { theme, HeroIcon, formKey } = config;
  const project = useOutletContext()?.project;
  const isBaseline = project?.has_baseline !== false;
  const mode = isBaseline ? 'baseline' : 'noBaseline';
  const label = config.label[mode];
  const sourceLabel = SLOTS.before.label[mode];
  const formId = project?.[formKey] || null;
  const publicUrl = formId ? `${window.location.origin}/f/${formId}` : '';

  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const { fetchProject } = useProject();
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!project) return undefined;
    let active = true;
    const load = async () => {
      if (!formId) {
        setForm(null);
        setResponses([]);
        setLoading(false);
        return;
      }
      // Owner-only endpoint: it returns the full responses (name, location,
      // answers); the public one has only id / status / date.
      const [formResult, responsesResult] = await Promise.allSettled([
        api.get(`/forms/${formId}`),
        api.get(`/forms/${formId}/responses`),
      ]);
      if (!active) return;
      if (formResult.status === 'fulfilled') setForm(formResult.value.data);
      else toast.error(getApiErrorMessage(formResult.reason, `Failed to load the ${label} questionnaire`));
      if (responsesResult.status === 'fulfilled') {
        setResponses(toResponseList(responsesResult.value.data).map((r) => ({ ...r, _source: slot })));
      } else {
        toast.error(getApiErrorMessage(responsesResult.reason, `Failed to load ${label} responses`));
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [project, formId, slot, label]);

  const goToBuilder = () => navigate(`/projects/${projectId}/create-questionnaire?type=${slot}`);
  const goTo = (page) =>
    navigate(`/projects/${projectId}/${page}?type=${slot}`, {
      state: { project_id: projectId, questionnaire_type: slot },
    });

  const copyFormLink = async () => {
    if (!formId) return;
    if (await copyToClipboard(publicUrl)) toast.success('Questionnaire link copied!');
    else toast.error('Could not copy the link. Please copy it manually.');
  };

  const copyFromBefore = async () => {
    if (!project?.before_form) {
      toast.error(`No ${sourceLabel} questionnaire to copy from`);
      return;
    }
    setCopying(true);
    try {
      const source = (await api.get(`/forms/${project.before_form}`)).data;
      const payload = copyPayload(source, label, projectId);
      const newFormId = (await api.post('/forms', payload)).data.id;
      await api.put(`/projects/${projectId}`, { [formKey]: newFormId });
      await fetchProject(projectId);
      setForm({ ...payload, id: newFormId });
      setResponses([]);
      toast.success(`${label} questionnaire created from ${sourceLabel} template! You can now edit it.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to copy ${sourceLabel} questionnaire`));
    } finally {
      setCopying(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!formId) return;
    try {
      await api.delete(`/forms/${formId}`);
      await api.put(`/projects/${projectId}`, { [formKey]: null });
      await fetchProject(projectId);
      setForm(null);
      setResponses([]);
      toast.success(`${label} questionnaire deleted`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete questionnaire'));
    }
    setDeleteDialogOpen(false);
  };

  if (loading) return <PageLoader label={`Loading ${label} questionnaire...`} />;

  const canCopy = slot === 'after' && Boolean(project?.before_form);
  const copyIcon = copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />;
  const copyText = copying ? 'Copying...' : `Copy from ${sourceLabel}`;

  if (!formId) {
    return (
      <div className="w-full space-y-8">
        <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br px-5 py-8 text-white shadow-2xl sm:px-12 sm:py-12 ${theme.hero}`}>
          <div className={`pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl ${theme.blobA}`} />
          <div className={`pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full blur-3xl ${theme.blobB}`} />
          <div className="relative text-left">
            <p className={`mb-2 text-sm font-medium uppercase tracking-[0.2em] ${theme.eyebrow}`}>{label} Questionnaires</p>
            <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">{config.heading[mode]}</h2>
            <p className={`max-w-2xl text-base ${theme.body}`}>{config.intro[mode]}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {slot === 'after' ? (
                <>
                  {canCopy && (
                    <Button onClick={copyFromBefore} disabled={copying} className={`gap-2 ${theme.heroButton}`}>
                      {copyIcon}
                      {copyText}
                    </Button>
                  )}
                  <Button onClick={goToBuilder} variant="outline" className="border-white/30 px-5 py-2.5 text-white hover:bg-white/10">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Blank
                  </Button>
                </>
              ) : (
                <Button onClick={goToBuilder} className={theme.heroButton}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create {label} Questionnaire
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-left shadow-sm sm:p-16">
          <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.emptyIcon}`}>
            <Inbox className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No {label} Questionnaire Yet</h3>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            {canCopy
              ? `Copy your ${sourceLabel} questionnaire to ensure matching structures for accurate Narrative Report comparisons, or create a blank one.`
              : config.emptyText[mode]}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {canCopy && (
              <Button onClick={copyFromBefore} disabled={copying} className={`gap-2 ${theme.emptyButton}`}>
                {copyIcon}
                {copyText}
              </Button>
            )}
            {slot === 'after' ? (
              <Button onClick={goToBuilder} variant="outline" className="gap-2 text-slate-700">
                <Plus className="h-4 w-4" />
                Create Blank
              </Button>
            ) : (
              <Button onClick={goToBuilder} className={theme.emptyButton}>
                <Plus className="mr-2 h-4 w-4" />
                Create {label} Questionnaire
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const questionCount = countQuestions(form);
  const isActive = Boolean(form) && questionCount > 0;

  return (
    <div className="w-full space-y-8">
      <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br px-5 py-8 text-white shadow-2xl sm:px-10 sm:py-10 ${theme.hero}`}>
        <div className={`pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl ${theme.blobA}`} />
        <div className={`pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full blur-3xl ${theme.blobB}`} />
        <div className="relative flex items-start gap-5 text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <HeroIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 className="break-words text-3xl font-bold leading-tight sm:text-4xl">{form?.title || `${label} Assessment`}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  isActive ? 'bg-emerald-400/20 text-emerald-100 ring-emerald-400/30' : 'bg-amber-400/20 text-amber-100 ring-amber-400/30'
                }`}
              >
                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {isActive ? 'Active' : 'Draft'}
              </span>
              <span className={`inline-flex items-center gap-1 text-sm ${theme.meta}`}>
                <BarChart3 className="h-3.5 w-3.5" /> {responses.length} {responses.length === 1 ? 'response' : 'responses'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <SectionHeader
          icon={BarChart3}
          title="Overview"
          subtitle="Questionnaire statistics at a glance"
          className={theme.overviewHeader}
          iconClassName={theme.overviewIcon}
        />
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          <Stat label="Questions">
            <p className={`mt-1.5 text-left text-3xl font-bold ${theme.questionCount}`}>{questionCount}</p>
          </Stat>
          <Stat label="Responses">
            <p className="mt-1.5 text-left text-3xl font-bold text-emerald-600">{responses.length}</p>
          </Stat>
          <Stat label="Last Response">
            <p className="mt-1.5 text-left text-lg font-bold text-slate-700">{formatDate(latestResponseTime(responses))}</p>
          </Stat>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <SectionHeader
          icon={Plus}
          title="Quick Actions"
          subtitle="Manage and share this questionnaire"
          className={theme.actionsHeader}
          iconClassName={theme.actionsIcon}
        />
        <section className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction icon={Pencil} accent="blue" title="Edit" description="Modify questions and settings" onClick={goToBuilder} />
          {/* No Baseline projects list responses on their own page instead of
              a table below. */}
          {!isBaseline && (
            <QuickAction icon={Eye} accent="emerald" title="View Responses" description="Browse submitted responses" onClick={() => goTo('responses')} />
          )}
          <QuickAction icon={IdCard} accent="cyan" title="View Profiles" description="Demographics and profile photos" onClick={() => goTo('profiles')} />
          <QuickAction icon={BarChart3} accent="violet" title="View Analytics" description="View charts and insights" onClick={() => goTo('analytics')} />
          <QuickAction icon={ExternalLink} accent="amber" title="Copy Link" description="Share questionnaire URL" onClick={copyFormLink} />
          <QuickAction icon={QrCode} accent="sky" title="QR Code" description="Scan or download to share" onClick={() => setQrOpen(true)} />
        </section>
        <ShareQrDialog open={qrOpen} onOpenChange={setQrOpen} url={publicUrl} title={form?.title} />
      </Card>

      {isBaseline && (
        <ResponsesTable
          scope={slot}
          project={project}
          {...(slot === 'before'
            ? { beforeForm: form, beforeResponses: responses }
            : { afterForm: form, afterResponses: responses })}
        />
      )}

      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:border-red-300 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete Questionnaire
        </button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {label} Questionnaire?</AlertDialogTitle>
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

export default QuestionnaireTab;
