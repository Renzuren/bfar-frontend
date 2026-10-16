import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, Inbox, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Legend, ReferenceLine, Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { api } from '../lib/apiMiddleware';
import { getSavedAnalysis } from '../lib/analysisStore';
import { buildReportPdf } from '../lib/reportPdf';
import {
  buildMlReportData, buildMlNarrativeFacts, mlFactsFingerprint, readSavedMlNarrative,
} from '../lib/mlNarrativeFacts';
import { Figure } from '../components/report/GroupReportFigures';

// Narrative Report of a saved ML analysis (ML Upload -> saved to the dashboard).
// Same structure as the project Narrative Report: Executive Summary,
// Introduction, Methodology, Findings and Synthesis. Gemini writes the text
// (saved with the analysis); until then a template text is shown. Figures come
// from the saved results and rows. Downloads as a PDF.

const TREATED = '#2563eb';
const COMPARISON = '#f97316';
const GRID = '#eef2f7';
const TICK = { fontSize: 11, fill: '#475569' };
const VALUE = { fontSize: 10.5, fontWeight: 600, fill: '#334155' };

const fmt = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toFixed(d));
const shorten = (text, max = 28) => (String(text).length > max ? `${String(text).slice(0, max - 1)}…` : String(text));

const SectionHeading = ({ num, title }) => (
  <div className="mb-6 mt-12 border-b-2 border-slate-800 pb-3 first:mt-0">
    <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">{num} {title}</h2>
  </div>
);
const SubHeading = ({ num, title }) => (
  <h3 className="mb-4 mt-8 text-base font-bold uppercase tracking-wide text-slate-800">{num} {title}</h3>
);
const Paragraphs = ({ items }) => (items || []).map((text, i) => <p key={i} className="text-justify">{text}</p>);
const Body = ({ children }) => <div className="space-y-4 text-sm leading-relaxed text-slate-700">{children}</div>;
const List = ({ items }) => (
  <ol className="list-inside list-decimal space-y-2 pl-2 text-justify text-sm leading-relaxed text-slate-700">
    {(items || []).map((item, i) => <li key={i}>{item}</li>)}
  </ol>
);
const StatTile = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);

// Respondents per group as two labelled columns.
const GroupSizeChart = ({ treated, comparison }) => {
  const total = treated + comparison || 1;
  const data = [
    { name: 'Beneficiaries', value: treated, label: `${treated} (${((treated / total) * 100).toFixed(1)}%)`, fill: TREATED },
    { name: 'Non-beneficiaries', value: comparison, label: `${comparison} (${((comparison / total) * 100).toFixed(1)}%)`, fill: COMPARISON },
  ];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: -8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={80} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          <LabelList dataKey="label" position="top" style={VALUE} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Treated vs comparison means of one column.
const MeansChart = ({ item }) => {
  const data = [
    { name: 'Beneficiaries', value: item.treated_mean, label: fmt(item.treated_mean), fill: TREATED },
    { name: 'Non-beneficiaries', value: item.comparison_mean, label: fmt(item.comparison_mean), fill: COMPARISON },
  ];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={TICK} axisLine={false} tickLine={false} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          <LabelList dataKey="label" position="right" style={VALUE} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// |SMD| before vs after matching for the most imbalanced features.
const BalanceChart = ({ rows, threshold }) => {
  const data = rows.map((r) => ({
    name: shorten(r.feature),
    Before: Math.abs(Number(r.smd_before) || 0),
    After: Math.abs(Number(r.smd_after) || 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, 50 + data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barGap={2}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={170} interval={0} tick={TICK} axisLine={false} tickLine={false} />
        {threshold !== null && <ReferenceLine x={threshold} stroke="#ef4444" strokeDasharray="4 3" />}
        <Legend verticalAlign="top" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Before" name="Before matching" fill="#94a3b8" radius={[0, 4, 4, 0]} maxBarSize={12} isAnimationActive={false} />
        <Bar dataKey="After" name="After matching" fill={TREATED} radius={[0, 4, 4, 0]} maxBarSize={12} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Strongest drivers of participation (mean |SHAP|).
const DriversChart = ({ drivers }) => {
  const data = drivers.map((d) => ({
    name: shorten(d.feature),
    value: Number(d.mean_abs_shap) || 0,
    label: `${fmt(d.mean_abs_shap, 3)} ${d.direction === 'increases_likelihood' ? '(raises)' : '(lowers)'}`,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, 30 + data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 110, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={170} interval={0} tick={TICK} axisLine={false} tickLine={false} />
        <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList dataKey="label" position="right" style={VALUE} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default function MLNarrativeReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const [record, setRecord] = useState(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSavedAnalysis(id)
      .then((result) => {
        if (cancelled) return;
        if (!result) { setMissing(true); return; }
        setRecord(result);
        setSaved(readSavedMlNarrative(result));
      })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [id]);

  const data = useMemo(() => (record ? buildMlReportData(record) : null), [record]);
  const facts = useMemo(() => (record && data ? buildMlNarrativeFacts(record, data) : null), [record, data]);
  const fingerprint = useMemo(() => (facts ? mlFactsFingerprint(facts) : ''), [facts]);
  const ai = saved?.narrative || null;
  const stale = Boolean(ai && saved.facts_fingerprint && saved.facts_fingerprint !== fingerprint);

  const generateAi = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const { data: res } = await api.post(
        `/analyses/${encodeURIComponent(id)}/narrative`,
        { facts, facts_fingerprint: fingerprint },
        { timeout: 150000, retry: 0 },
      );
      setSaved({ narrative: res.narrative, generated_at: res.generated_at, model: res.model, facts_fingerprint: res.facts_fingerprint });
      toast.success('AI narrative generated and saved with the analysis');
    } catch (error) {
      setAiError(error?.response?.data?.error || error?.message || 'Could not generate the AI narrative.');
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
      pdf.save(`${(record.title || 'ml-analysis').replace(/\s+/g, '_')}-narrative-report-${stamp}.pdf`);
      toast.success('Report downloaded as PDF');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error(`Failed to generate PDF${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setGenerating(false);
    }
  };

  if (missing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Inbox className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h1 className="text-lg font-bold text-slate-900">Analysis not found</h1>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  if (!record || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const att = data.att || {};
  const bal = data.balanceSummary || {};
  const p = Number(att.p_value_paired_ttest);
  const significant = Number.isFinite(p) && p < 0.05;
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let figureCount = 0;
  const nextFigure = () => { figureCount += 1; return figureCount; };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl space-y-4 px-3 pb-16 pt-4 sm:px-4">
        {/* Toolbar (not printed) */}
        <div className="no-print sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 shadow-md backdrop-blur">
          <button
            type="button"
            onClick={() => navigate(`/ml-analysis/${id}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to analysis
          </button>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateAi} disabled={aiBusy} className="rounded-xl bg-violet-600 px-4 py-2 text-white hover:bg-violet-700">
              {aiBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {aiBusy ? 'Writing narrative...' : ai ? 'Regenerate AI Narrative' : 'Generate AI Narrative'}
            </Button>
            <Button onClick={downloadPdf} disabled={generating || aiBusy} className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
              <Download className="mr-2 h-4 w-4" />
              {generating ? 'Generating PDF...' : 'Download PDF'}
            </Button>
          </div>
        </div>

        <div className="no-print space-y-2">
          {ai && saved?.generated_at && (
            <p className="px-1 text-xs text-slate-500">
              AI narrative generated {new Date(saved.generated_at).toLocaleString()}{saved.model ? ` with ${saved.model}` : ''} · saved with this analysis.
              Review it before sharing: AI text can still contain mistakes.
            </p>
          )}
          {!ai && !aiBusy && (
            <p className="px-1 text-xs text-slate-500">
              The text below is a generic template. Click &quot;Generate AI Narrative&quot; to have Gemini write it from this analysis.
            </p>
          )}
          {stale && !aiBusy && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>The report data changed since this narrative was generated. Regenerate it to update the text.</p>
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
          <header className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Technical Narrative Report</p>
            <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-bold uppercase leading-snug text-slate-900">{record.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm italic leading-relaxed text-slate-600">
              An Impact Assessment Comparing Program Beneficiaries and Non-Beneficiaries Using Propensity Score Matching
            </p>
            <div className="mx-auto mt-8 h-0.5 w-28 bg-slate-800" />
            <div className="mt-8 space-y-1 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Bureau of Fisheries and Aquatic Resources</p>
              {record.fileName && <p>Dataset: {record.fileName}</p>}
              <p>Generated on {generatedDate}</p>
            </div>
          </header>

          <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Respondents" value={data.rowsTotal ?? '—'} />
            <StatTile label="Matched pairs" value={att.matched_pairs ?? '—'} />
            <StatTile label="ATT" value={fmt(att.att_mean)} />
            <StatTile label="p-value" value={fmt(att.p_value_paired_ttest, 3)} />
          </div>

          <section>
            <SectionHeading num="" title="Executive Summary" />
            <Body>
              {ai ? <Paragraphs items={ai.executive_summary} /> : (
                <p className="text-justify">
                  This report evaluates {record.title} by comparing program beneficiaries with non-beneficiaries in an
                  uploaded dataset of {data.rowsTotal} respondents. Propensity score matching paired {att.matched_pairs ?? 'the'}{' '}
                  beneficiaries with similar non-beneficiaries, and the average difference in{' '}
                  {data.outcomeCol || 'the outcome'} between matched pairs (ATT) was {fmt(att.att_mean)}
                  {Number.isFinite(p) ? ` (p = ${fmt(p, 3)}, ${significant ? 'statistically significant' : 'not statistically significant'} at the 5% level)` : ''}.
                </p>
              )}
            </Body>
          </section>

          <section>
            <SectionHeading num="1.0" title="Introduction" />
            <SubHeading num="1.1" title="Rationale of the Project" />
            <Body>
              {ai ? <Paragraphs items={ai.rationale} /> : (
                <p className="text-justify">
                  Livelihood programs for fisherfolk need evidence of whether they improve the condition of those they
                  serve. This assessment compares beneficiaries with similar non-beneficiaries to estimate how the
                  program is associated with the selected outcome.
                </p>
              )}
            </Body>
            <SubHeading num="1.2" title="Objectives" />
            <Body>
              {ai ? (<>
                <p>{ai.general_objective} Specifically, it aimed to:</p>
                <List items={ai.specific_objectives} />
              </>) : (<>
                <p>The assessment aimed to estimate the program&apos;s association with {data.outcomeCol || 'the outcome'}. Specifically, it aimed to:</p>
                <List items={[
                  'Describe the beneficiary and non-beneficiary respondents in the dataset;',
                  'Identify the characteristics that best predict program participation;',
                  'Match beneficiaries with comparable non-beneficiaries and check covariate balance; and',
                  'Estimate the average treatment effect on the treated (ATT) for the outcome.',
                ]} />
              </>)}
            </Body>
          </section>

          <section>
            <SectionHeading num="2.0" title="Methodology" />
            <SubHeading num="2.1" title="Research Design and Respondents" />
            <Body>
              {ai ? <Paragraphs items={ai.research_design} /> : (
                <p className="text-justify">
                  The study used a quasi-experimental cross-sectional design. The dataset identifies beneficiaries
                  through the column {data.treatCol || 'treatment'} ({data.treated} beneficiaries and {data.comparison}{' '}
                  non-beneficiaries in the saved rows).
                </p>
              )}
            </Body>
            {(data.treated + data.comparison) > 0 && (
              <div className="mt-6">
                <Figure num={nextFigure()} title="Respondents by group" note={`From the ${data.rowsKept} saved rows.`}>
                  <GroupSizeChart treated={data.treated} comparison={data.comparison} />
                </Figure>
              </div>
            )}
            <SubHeading num="2.2" title="Statistical Treatment" />
            <Body>
              {ai ? <Paragraphs items={ai.statistical_treatment} /> : (
                <p className="text-justify">
                  A gradient boosting model estimated each respondent&apos;s propensity to be a beneficiary.
                  Beneficiaries were matched one-to-one with the nearest non-beneficiary within a caliper, covariate
                  balance was checked with standardized mean differences (SMD), and the ATT was tested with a paired
                  t-test.
                </p>
              )}
            </Body>
          </section>

          <section>
            <SectionHeading num="3.0" title="Findings" />
            <SubHeading num="3.1" title="Comparison of Beneficiaries and Non-Beneficiaries" />
            <Body>
              {ai ? <Paragraphs items={ai.findings_overview} /> : (
                <p className="text-justify">
                  The figures below compare the two groups before matching on the outcome and on the characteristics
                  that most strongly predicted participation.
                </p>
              )}
            </Body>
            <div className="mt-6">
              {data.drivers.length > 0 && (
                <Figure num={nextFigure()} title="Strongest predictors of program participation (mean |SHAP|)" note="(raises) / (lowers): direction of the effect on the likelihood of being a beneficiary.">
                  <DriversChart drivers={data.drivers} />
                </Figure>
              )}
              {data.comparisons.map((item) => (
                <Figure
                  key={item.column}
                  num={nextFigure()}
                  title={`${item.column}${item.column === data.outcomeCol ? ' (outcome)' : ''}: mean by group`}
                  note={`Before matching. n = ${item.n_treated} beneficiaries, ${item.n_comparison} non-beneficiaries; difference ${fmt(item.difference)}.`}
                >
                  <MeansChart item={item} />
                </Figure>
              ))}
            </div>

            <SubHeading num="3.2" title="Impact Estimate" />
            <Body>
              {ai ? <Paragraphs items={ai.impact_discussion} /> : (
                <p className="text-justify">
                  After matching, the mean difference in {data.outcomeCol || 'the outcome'} between beneficiaries and
                  their matched non-beneficiaries was {fmt(att.att_mean)}
                  {Array.isArray(att.ci_95) ? ` (95% CI ${fmt(att.ci_95[0])} to ${fmt(att.ci_95[1])})` : ''}.
                  Covariate balance was {bal.balance_achieved ? 'achieved' : 'not fully achieved'}, so the estimate
                  should be read {bal.balance_achieved && significant ? 'as an association under the matching assumptions' : 'with caution'}.
                </p>
              )}
            </Body>
            <div className="mt-6">
              <table className="mb-6 w-full border-collapse text-sm">
                <tbody className="text-slate-700">
                  {[
                    ['Matched pairs', att.matched_pairs ?? '—'],
                    ['Average treatment effect on the treated (ATT)', fmt(att.att_mean, 4)],
                    ['95% confidence interval', Array.isArray(att.ci_95) ? `${fmt(att.ci_95[0], 4)} to ${fmt(att.ci_95[1], 4)}` : '—'],
                    ['p-value (paired t-test)', fmt(att.p_value_paired_ttest, 4)],
                    ['Covariate balance achieved', bal.balance_achieved === undefined ? '—' : bal.balance_achieved ? 'Yes' : 'No'],
                    ['Mean |SMD| after matching', fmt(bal.mean_abs_smd, 4)],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold">{k}</td>
                      <td className="border border-slate-300 px-3 py-1.5 text-right tabular-nums">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.balance.length > 0 && (
                <Figure
                  num={nextFigure()}
                  title="Covariate balance before and after matching (|SMD|)"
                  note={data.balanceThreshold !== null ? `Dashed line: balance threshold |SMD| = ${data.balanceThreshold}. Lower is better.` : 'Lower is better.'}
                >
                  <BalanceChart rows={data.balance} threshold={data.balanceThreshold} />
                </Figure>
              )}
            </div>
          </section>

          <section>
            <SectionHeading num="4.0" title="Synthesis and Implications" />
            <SubHeading num="4.1" title="Summary of Findings" />
            {ai ? <List items={ai.summary_of_findings} /> : (
              <List items={[
                `${data.rowsTotal} respondents were analysed: ${data.treated} beneficiaries and ${data.comparison} non-beneficiaries in the saved rows.`,
                `${att.matched_pairs ?? 'No'} matched pairs were formed.`,
                `The ATT on ${data.outcomeCol || 'the outcome'} was ${fmt(att.att_mean)}${Number.isFinite(p) ? ` (p = ${fmt(p, 3)})` : ''}.`,
              ]} />
            )}
            <SubHeading num="4.2" title="Concluding Remarks" />
            <Body>
              {ai ? <Paragraphs items={ai.concluding_remarks} /> : (
                <p className="text-justify">Generate the AI narrative for concluding remarks grounded in these results.</p>
              )}
            </Body>
            <SubHeading num="4.3" title="Recommendations" />
            {ai ? <List items={ai.recommendations} /> : (
              <Body><p className="text-justify">Generate the AI narrative to add recommendations grounded in these results.</p></Body>
            )}
            <SubHeading num="4.4" title="Limitations" />
            {ai ? <List items={ai.limitations} /> : (
              <List items={[
                'The design is cross-sectional; matching only adjusts for the characteristics in the dataset.',
                'Results depend on the quality and coding of the uploaded data.',
              ]} />
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
