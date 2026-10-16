import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, Inbox, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { api } from '../lib/apiMiddleware';
import { buildReportPdf } from '../lib/reportPdf';
import { canEdit } from '../lib/projectRoles';
import {
  buildGroupReportData,
  buildGroupReportFacts,
  groupFactsFingerprint,
  readSavedGroupReport,
} from '../lib/groupReportFacts';
import { LocationFigure, QuestionFigure, hasFigure } from '../components/report/GroupReportFigures';

// Group Report: a narrative report on ONE of the project's questionnaires --
// Beneficiary or Non-Beneficiary (Before or After in baseline projects) --
// built from the same results as its View Analytics page. Gemini writes the
// text (saved with the project); until then a template text is shown. The
// charts come straight from the responses. Downloads as a PDF.

const GROUP_DESCRIPTIONS = {
  noBaseline: {
    before: 'program beneficiaries',
    after: 'non-beneficiaries, i.e. fisherfolk not enrolled in the program',
  },
  baseline: {
    before: 'program respondents surveyed before the intervention (benchmark survey)',
    after: 'program respondents surveyed after the intervention (current survey)',
  },
};

const SectionHeading = ({ num, title }) => (
  <div className="mb-6 mt-12 border-b-2 border-slate-800 pb-3 first:mt-0">
    <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
      {num} {title}
    </h2>
  </div>
);

const SubHeading = ({ num, title }) => (
  <h3 className="mb-4 mt-8 text-base font-bold uppercase tracking-wide text-slate-800">
    {num} {title}
  </h3>
);

const Paragraphs = ({ items }) => (items || []).map((text, i) => (
  <p key={i} className="text-justify">{text}</p>
));

const pctText = (n) => `${Number(n).toFixed(1)}%`;

// Text and number questions have nothing to chart: one line each.
const AnswerLine = ({ summary }) => (
  <div className="mb-4">
    <p className="mb-0.5 text-sm font-semibold text-slate-800">{summary.label}</p>
    <p className="text-sm text-slate-600">
      {summary.kind === 'number' && summary.mean !== null
        ? `Mean ${summary.mean} (lowest ${summary.min}, highest ${summary.max}) from ${summary.answered} answers.`
        : `${summary.answered} written answer${summary.answered === 1 ? '' : 's'}.`}
      {summary.unanswered > 0 && ` ${summary.unanswered} left unanswered.`}
    </p>
  </div>
);

const StatTile = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);

// Template findings used until the AI report is generated.
const templateFindings = (results) => results
  .filter((s) => (s.kind === 'choice' && s.options.length) || (s.kind === 'rating' && s.mean !== null))
  .slice(0, 8)
  .map((s) => (s.kind === 'rating'
    ? `${s.label}: respondents gave a mean rating of ${s.mean} out of 5 (n = ${s.answered}).`
    : `${s.label}: the most common answer was "${s.options[0].option}", chosen by ${pctText(s.options[0].pct)} of the ${s.answered} respondents who answered.`));

export default function GroupReport() {
  const { project } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slot = searchParams.get('type') === 'after' ? 'after' : 'before';
  const isBaseline = project?.has_baseline !== false;
  const groupLabel = slot === 'after' ? (isBaseline ? 'After' : 'Non-Beneficiary') : (isBaseline ? 'Before' : 'Beneficiary');
  const groupDescription = GROUP_DESCRIPTIONS[isBaseline ? 'baseline' : 'noBaseline'][slot];
  const formId = slot === 'after' ? project?.after_form : project?.before_form;
  const color = slot === 'after' ? '#f97316' : '#2563eb';
  const reportRef = useRef(null);

  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setAiError(null);
      if (!formId) {
        setForm(null);
        setLoading(false);
        return;
      }
      try {
        const [formRes, responsesRes, projectRes] = await Promise.all([
          api.get(`/forms/${formId}`),
          api.get(`/forms/${formId}/responses`),
          // The saved report is only on GET /projects/:id, not the project list.
          api.get(`/projects/${project.id}`).catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setForm(formRes.data);
        setResponses(Array.isArray(responsesRes.data) ? responsesRes.data : []);
        setSaved(readSavedGroupReport(projectRes.data, slot));
      } catch (error) {
        if (!cancelled) toast.error('Could not load the questionnaire results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [formId, project?.id, slot]);

  const data = useMemo(() => buildGroupReportData(form, responses), [form, responses]);
  const facts = useMemo(
    () => buildGroupReportFacts({ project, groupLabel, groupDescription, form, data }),
    [project, groupLabel, groupDescription, form, data]
  );
  const fingerprint = useMemo(() => groupFactsFingerprint(facts), [facts]);
  const ai = saved?.report || null;
  const stale = Boolean(ai && saved.facts_fingerprint && saved.facts_fingerprint !== fingerprint);
  const editable = canEdit(project);

  const generateAi = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const { data: res } = await api.post(
        `/projects/${project.id}/group-report`,
        { slot, facts, facts_fingerprint: fingerprint },
        { timeout: 150000, retry: 0 },
      );
      setSaved({ report: res.report, generated_at: res.generated_at, model: res.model, facts_fingerprint: res.facts_fingerprint });
      toast.success('AI report generated and saved with the project');
    } catch (error) {
      setAiError(error?.response?.data?.error || error?.message || 'Could not generate the AI report.');
    } finally {
      setAiBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!reportRef.current || aiBusy) return;
    setGenerating(true);
    try {
      const pdf = await buildReportPdf(reportRef.current, { JsPdf: jsPDF });
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const name = `${project?.title || 'project'}-${groupLabel}-report-${stamp}`.replace(/\s+/g, '_');
      pdf.save(`${name}.pdf`);
      toast.success('Report downloaded as PDF');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error(`Failed to generate PDF${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!form || data.respondents === 0) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <Inbox className="mx-auto mb-4 h-10 w-10 text-slate-400" />
        <h3 className="mb-2 text-lg font-bold text-slate-900">
          {!form ? `No ${groupLabel} questionnaire yet` : `No ${groupLabel} responses yet`}
        </h3>
        <p className="text-sm text-slate-500">
          The {groupLabel} report is written from the questionnaire&apos;s responses. It will be available once responses come in.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate(`/projects/${project.id}/${slot}`)}>
          Back to {groupLabel}
        </Button>
      </div>
    );
  }

  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const n = data.respondents;
  const findings = ai ? ai.key_findings : templateFindings(data.results);
  // Figures are numbered in reading order.
  let figureCount = 0;
  const nextFigure = () => { figureCount += 1; return figureCount; };
  const renderQuestion = (s) => (hasFigure(s)
    ? <QuestionFigure key={s.id} num={nextFigure()} summary={s} color={color} />
    : <AnswerLine key={s.id} summary={s} />);

  return (
    <div className="space-y-4 pb-16 pt-4">
      {/* Toolbar (not printed) */}
      <div className="no-print sticky top-[72px] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(`/projects/${project.id}/${slot}`)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {groupLabel}
        </button>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button onClick={generateAi} disabled={aiBusy} className="rounded-xl bg-violet-600 px-4 py-2 text-white hover:bg-violet-700">
              {aiBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {aiBusy ? 'Writing report...' : ai ? 'Regenerate AI Report' : 'Generate AI Report'}
            </Button>
          )}
          <Button onClick={downloadPdf} disabled={generating || aiBusy} className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            <Download className="mr-2 h-4 w-4" />
            {generating ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="no-print space-y-2">
        {ai && saved?.generated_at && (
          <p className="px-1 text-xs text-slate-500">
            AI report generated {new Date(saved.generated_at).toLocaleString()}{saved.model ? ` with ${saved.model}` : ''} · saved with this project.
            Review it before sharing: it is written from the results below, but AI text can still contain mistakes.
          </p>
        )}
        {!ai && !aiBusy && (
          <p className="px-1 text-xs text-slate-500">
            {editable
              ? 'The text below is a generic template. Click "Generate AI Report" to have Gemini write it from these results.'
              : 'The text below is a generic template. No AI report has been generated for this group yet.'}
          </p>
        )}
        {stale && !aiBusy && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>The responses changed since this report was generated. Regenerate it to update the text.</p>
          </div>
        )}
        {aiError && !aiBusy && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{aiError}</p>
          </div>
        )}
      </div>

      {/* ==================== THE REPORT DOCUMENT ==================== */}
      <article ref={reportRef} className="rounded-lg bg-white px-8 py-10 shadow-sm ring-1 ring-slate-200 sm:px-14 sm:py-14">
        <header className="mb-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">{groupLabel} Group Report</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-bold uppercase leading-snug text-slate-900">{project.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm italic leading-relaxed text-slate-600">
            Survey Results of {groupLabel} Respondents{form.title ? ` (${form.title})` : ''}
          </p>
          <div className="mx-auto mt-8 h-0.5 w-28 bg-slate-800" />
          <div className="mt-8 space-y-1 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Bureau of Fisheries and Aquatic Resources</p>
            <p>Generated on {generatedDate}</p>
          </div>
        </header>

        <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Respondents" value={n} />
          <StatTile label="Municipalities" value={data.municipalities.length} />
          <StatTile label="Barangays" value={data.barangays.length} />
          <StatTile label="Survey questions" value={data.results.length} />
        </div>

        <section>
          <SectionHeading num="" title="Executive Summary" />
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            {ai ? <Paragraphs items={ai.executive_summary} /> : (
              <p className="text-justify">
                This report presents the survey results of the {groupLabel.toLowerCase()} group of {project.title},
                composed of {groupDescription}. A total of {n} respondent{n === 1 ? '' : 's'} answered the{' '}
                {form.title || groupLabel} questionnaire, which covered {data.demographics.length} profile item
                {data.demographics.length === 1 ? '' : 's'} and {data.results.length} survey question
                {data.results.length === 1 ? '' : 's'}. The sections below describe the respondents and summarise
                how they answered each question.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionHeading num="1.0" title="Introduction" />
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            {ai ? <Paragraphs items={ai.introduction} /> : (
              <p className="text-justify">
                As part of the evaluation of {project.title}, a survey was administered to {groupDescription}. This
                report documents the characteristics and responses of this group on its own. It is descriptive and
                does not compare the group with other respondents.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionHeading num="2.0" title="Profile of Respondents" />
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            {ai ? <Paragraphs items={ai.respondent_profile} /> : (
              <p className="text-justify">
                The {n} respondents came from {data.municipalities.length} municipalit
                {data.municipalities.length === 1 ? 'y' : 'ies'} and {data.barangays.length} barangay
                {data.barangays.length === 1 ? '' : 's'}. Their profile is summarised in the figures below.
              </p>
            )}
          </div>
          <div className="mt-6">
            {data.municipalities.length > 0 && (
              <LocationFigure num={nextFigure()} title="Respondents by municipality" rows={data.municipalities.slice(0, 15)} total={n} color={color} />
            )}
            {data.barangays.length > 0 && (
              <LocationFigure num={nextFigure()} title="Respondents by barangay" rows={data.barangays.slice(0, 15)} total={n} color={color} />
            )}
            {data.demographics.map(renderQuestion)}
          </div>
        </section>

        <section>
          <SectionHeading num="3.0" title="Survey Results" />
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            {ai ? <Paragraphs items={ai.findings_overview} /> : (
              <p className="text-justify">
                This section presents how the {groupLabel.toLowerCase()} respondents answered each of the{' '}
                {data.results.length} survey questions. Percentages are shares of the respondents who answered the
                question.
              </p>
            )}
          </div>

          <SubHeading num="3.1" title="Key Findings" />
          <ol className="list-inside list-decimal space-y-2 pl-2 text-justify text-sm leading-relaxed text-slate-700">
            {findings.map((item, i) => <li key={i}>{item}</li>)}
          </ol>

          <SubHeading num="3.2" title="Results by Question" />
          {data.results.length > 0
            ? data.results.map(renderQuestion)
            : <p className="text-sm text-slate-500">This questionnaire has no survey questions.</p>}
        </section>

        <section>
          <SectionHeading num="4.0" title="Conclusion and Recommendations" />
          <SubHeading num="4.1" title="Conclusion" />
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            {ai ? <Paragraphs items={ai.conclusion} /> : (
              <p className="text-justify">
                The results above describe the situation and views of the {groupLabel.toLowerCase()} respondents of{' '}
                {project.title} at the time of the survey.
              </p>
            )}
          </div>
          <SubHeading num="4.2" title="Recommendations" />
          {ai ? (
            <ol className="list-inside list-decimal space-y-2 pl-2 text-justify text-sm leading-relaxed text-slate-700">
              {ai.recommendations.map((item, i) => <li key={i}>{item}</li>)}
            </ol>
          ) : (
            <p className="text-justify text-sm leading-relaxed text-slate-700">
              Generate the AI report to add recommendations grounded in these results.
            </p>
          )}
          <SubHeading num="4.3" title="Limitations" />
          {ai ? (
            <ol className="list-inside list-decimal space-y-2 pl-2 text-justify text-sm leading-relaxed text-slate-700">
              {ai.limitations.map((item, i) => <li key={i}>{item}</li>)}
            </ol>
          ) : (
            <p className="text-justify text-sm leading-relaxed text-slate-700">
              The results cover {n} respondent{n === 1 ? '' : 's'} of one group only and rely on self-reported answers.
              They describe this group and do not, on their own, show the effect of the program.
            </p>
          )}
        </section>
      </article>
    </div>
  );
}
