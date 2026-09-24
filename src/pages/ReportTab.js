// src/pages/ReportTab.js
// ============================================================
// BASELINE REPORT TAB
// Before vs After results for a baseline project (the same
// program's respondents surveyed before and after the
// intervention). No model / propensity scores -- those belong to
// No-Baseline projects (NoBaselineAnalysisReport).
//   1. Summary cards          5. Respondent profile
//   2. Key indicators         6. Question-by-question results
//   3. Income                 7. Paired Before -> After (same person number)
//   4. Geographic map
// Data: lib/baselineReport.js and lib/pairedBaseline.js.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle, Building2, ChevronDown, FileBarChart2, Gauge, Globe2, Inbox,
  ListChecks, MapPin, Maximize2, Minimize2, RefreshCw, Users, Wallet,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { api } from '../lib/apiMiddleware';
import PhilippineMap, { GROUP_COLORS } from '@/components/report/PhilippineMap';
import { ChartCard, EmptyNote } from '@/components/report/ReportCharts';
import PairedBeforeAfter from '@/components/report/PairedBeforeAfter';
import { buildBaselineReport } from '@/lib/baselineReport';
import { buildPairedComparison } from '@/lib/pairedBaseline';

const BEFORE = GROUP_COLORS.Beneficiary;
const AFTER = GROUP_COLORS['Non-Beneficiary'];
const TICK = { fontSize: 10.5, fill: '#94a3b8' };
const MAP_LABELS = { b: 'Before', nb: 'After' };

const fmtPeso = (v) => (v === null || v === undefined ? '—' : `₱${Math.round(v).toLocaleString()}`);
const fmtNum = (v, digits = 2) => (v === null || v === undefined ? '—' : v.toFixed(digits));
const fmtPct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
const signed = (v, text) => `${v > 0 ? '+' : ''}${text}`;
const signedPeso = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}₱${Math.round(Math.abs(v)).toLocaleString()}`;
const changeTone = (v) => (!v ? 'text-slate-500' : v > 0 ? 'text-emerald-600' : 'text-rose-600');

const responseList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.responses)) return payload.responses;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

// ---------- small building blocks ----------
const StatCard = ({ value, label, caption, gradient, icon: Icon }) => (
  <div className="min-h-[92px] rounded-[8px] p-[16px_18px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)]" style={{ background: gradient }}>
    <div className="flex items-start justify-between gap-2">
      <div className="font-mono text-[22px] font-extrabold leading-tight tracking-tight">{value}</div>
      {Icon && <Icon className="h-5 w-5 shrink-0 opacity-70" />}
    </div>
    <div className="mt-0.5 text-[11.5px] font-medium opacity-90">{label}</div>
    <div className="text-[10px] opacity-75">{caption}</div>
  </div>
);

const PhaseLegend = () => (
  <div className="flex items-center gap-3 text-[10.5px] font-semibold text-slate-500">
    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: BEFORE }} /> Before</span>
    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: AFTER }} /> After</span>
  </div>
);

const SectionHeading = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-start gap-3 pt-2">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  </div>
);

// One option per line, a Before bar and an After bar (% of that survey's answers).
const DualBars = ({ rows }) => (
  <div className="space-y-2">
    {rows.map((row) => (
      <div key={row.name}>
        <div className="mb-0.5 truncate text-[11.5px] font-medium text-slate-700" title={row.name}>{row.name}</div>
        {[['Before', BEFORE], ['After', AFTER]].map(([phase, color]) => (
          <div key={phase} className="flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, row[phase])}%`, background: color }} />
            </div>
            <span className="w-16 text-right font-mono text-[10.5px] tabular-nums text-slate-500" title={`${row[`${phase}N`]} respondents`}>
              {Math.round(row[phase])}% <span className="text-slate-300">({row[`${phase}N`]})</span>
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// Mean Before -> After line for a scored question.
const meanLine = (q) => {
  if (q.beforeMean === null && q.afterMean === null) return null;
  const change = q.beforeMean !== null && q.afterMean !== null ? q.afterMean - q.beforeMean : null;
  if (q.kind === 'yesno') {
    return { text: `Yes: ${fmtPct(q.beforeMean)} → ${fmtPct(q.afterMean)}`, change, changeText: change === null ? '' : signed(change, `${Math.round(change * 100)} pts`) };
  }
  const suffix = q.kind === 'ordinal' ? ` / ${q.optionCount}` : '';
  const label = q.kind === 'ordinal' ? 'Mean level' : 'Mean';
  return { text: `${label}: ${fmtNum(q.beforeMean)} → ${fmtNum(q.afterMean)}${suffix}`, change, changeText: change === null ? '' : signed(change, fmtNum(change)) };
};

const QuestionCard = ({ q }) => {
  const line = meanLine(q);
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3.5">
      <div className="mb-2.5">
        <div className="text-[11px] font-bold text-blue-700">{q.code || '—'}</div>
        <div className="text-[12.5px] font-semibold leading-snug text-slate-800">{q.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[10.5px] text-slate-400">
          <span>Answered: {q.answered.Before} Before · {q.answered.After} After</span>
          {line && (
            <span className="font-semibold text-slate-600">
              {line.text} {line.changeText && <span className={changeTone(line.change)}>({line.changeText})</span>}
            </span>
          )}
        </div>
      </div>
      <DualBars rows={q.rows} />
    </div>
  );
};

const Skeleton = () => (
  <div className="space-y-5">
    <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
    <div className="h-80 w-full animate-pulse rounded-xl bg-slate-100" />
    <p className="text-center text-sm text-slate-400">Loading report data…</p>
  </div>
);

const TypePill = ({ active, color, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold transition ${active ? 'text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
    style={active ? { background: color } : undefined}
  >
    {!active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
    {label}
  </button>
);

// The map keys its two groups Beneficiary / Non-Beneficiary; here they are Before / After.
const MAP_TYPE_PILLS = [
  { value: 'All', label: 'All', color: '#334155' },
  { value: 'Beneficiary', label: 'Before', color: BEFORE },
  { value: 'Non-Beneficiary', label: 'After', color: AFTER },
];

const MapSection = ({ points, summary, activeType, onDrillType, focusKey, onFocusChange, expanded = false, onToggleExpand }) => {
  const topLocations = [...points].sort((a, b) => b.total - a.total).slice(0, 7);
  return (
    <ChartCard
      title={<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-600" /> Geographic Distribution</span>}
      subtitle="Where the Before and After respondents are · hover a bubble or list row for details"
      right={(
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-0.5 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200 sm:flex">
            {MAP_TYPE_PILLS.map((p) => (
              <TypePill key={p.value} {...p} active={activeType === p.value} onClick={() => onDrillType(p.value)} />
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleExpand}
            title={expanded ? 'Collapse map' : 'Expand map'}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    >
      <div className={`grid grid-cols-1 gap-4 ${expanded ? 'lg:grid-cols-[minmax(0,1fr)_330px]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]'}`}>
        <div className={expanded ? 'h-[calc(92vh-190px)] min-h-[420px]' : 'h-[420px] sm:h-[480px]'}>
          <PhilippineMap points={points} activeType={activeType} focusKey={focusKey} onFocusChange={onFocusChange} groupLabels={MAP_LABELS} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Building2 className="h-3 w-3" /> Municipalities</div>
              <div className="mt-0.5 text-lg font-extrabold tabular-nums leading-tight text-slate-800">{summary.municipalities.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Globe2 className="h-3 w-3" /> Regions</div>
              <div className="mt-0.5 text-lg font-extrabold tabular-nums leading-tight text-slate-800">{summary.regions.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200/80 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Top Locations</div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
              {topLocations.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  onMouseEnter={() => onFocusChange(p.key)}
                  onMouseLeave={() => onFocusChange(null)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${focusKey === p.key ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
                >
                  <span className={`w-4 text-right text-[11px] font-extrabold ${i === 0 ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold leading-tight text-slate-800">{p.name}</span>
                    <span className="block truncate text-[10px] leading-tight text-slate-400">{p.province} · {p.b} Before · {p.nb} After</span>
                  </span>
                  <span className="w-8 text-right text-[11.5px] font-extrabold tabular-nums text-slate-700">{p.total.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
};

// ---------- page ----------
const ReportTab = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mapType, setMapType] = useState('All');
  const [mapFocus, setMapFocus] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    if (!mapExpanded) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMapExpanded(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mapExpanded]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!project) return;
      setLoading(true);
      setError(null);
      try {
        const load = (formId) => (formId
          ? Promise.all([api.get(`/forms/${formId}`), api.get(`/forms/${formId}/responses`)])
          : Promise.resolve([{ data: null }, { data: [] }]));
        const [[beforeForm, beforeResponses], [afterForm, afterResponses]] = await Promise.all([
          load(project.before_form),
          load(project.after_form),
        ]);
        if (cancelled) return;
        setRaw({
          beforeForm: beforeForm.data,
          beforeResponses: responseList(beforeResponses.data),
          afterForm: afterForm.data,
          afterResponses: responseList(afterResponses.data),
        });
      } catch (e) {
        if (!cancelled) setError(`Failed to load the questionnaires and responses: ${e?.response?.data?.error || e?.message || 'unknown error'}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [project, reloadKey]);

  const report = useMemo(() => (raw ? buildBaselineReport(raw) : null), [raw]);
  const paired = useMemo(() => (raw ? buildPairedComparison(raw) : null), [raw]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  if (!project) return <div className="flex items-center justify-center py-20 text-slate-500">Loading project…</div>;
  if (loading && !raw) return <Skeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500"><AlertTriangle className="h-8 w-8" /></div>
        <h3 className="mb-1 text-lg font-bold text-slate-900">Something went wrong</h3>
        <p className="mb-6 max-w-sm text-sm text-slate-500">{error}</p>
        <Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
      </div>
    );
  }

  if (!raw?.beforeForm && !raw?.afterForm) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300"><Inbox className="h-10 w-10" /></div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">No Questionnaires Yet</h3>
        <p className="max-w-md text-sm text-slate-500">The Report compares your Before and After questionnaires. Create at least one questionnaire to generate it.</p>
      </div>
    );
  }

  const { counts } = report;
  if (!counts.before && !counts.after) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300"><Inbox className="h-10 w-10" /></div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">No Responses Yet</h3>
        <p className="max-w-md text-sm text-slate-500">Share your questionnaire links to start collecting responses. This report updates automatically as new data arrives.</p>
      </div>
    );
  }

  const shareIndices = report.indices.filter((i) => i.scale === 'share');
  const ratingIndices = report.indices.filter((i) => i.scale === 'rating');
  const shareChart = shareIndices.map((i) => ({ name: i.label, full: i.full, Before: Math.round((i.beforeMean ?? 0) * 100), After: Math.round((i.afterMean ?? 0) * 100) }));
  const ratingChart = ratingIndices.map((i) => ({ name: i.label, full: i.full, Before: Number(fmtNum(i.beforeMean)), After: Number(fmtNum(i.afterMean)) }));
  const incomeChart = report.income.map((i) => ({ name: i.code || i.title.slice(0, 14), full: i.title, Before: Math.round(i.beforeMean ?? 0), After: Math.round(i.afterMean ?? 0) }));
  const mainIncome = report.income.find((i) => /kasalukuyan|current/i.test(i.title)) || report.income[0];
  const doi = report.indices.find((i) => i.group === 'D');
  const onlyOnePhase = !counts.before || !counts.after;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 px-6 py-7 text-white shadow-lg sm:px-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm"><FileBarChart2 className="h-6 w-6" /></div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Baseline Impact Evaluation · Before vs After</p>
                <h2 className="mt-0.5 text-2xl font-bold leading-tight sm:text-3xl">{project.title}</h2>
                <p className="mt-1 text-sm text-blue-100">
                  {counts.before} Before + {counts.after} After responses · generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {onlyOnePhase && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Only {counts.before ? 'Before' : 'After'} responses so far. The Before vs After comparisons fill in once both questionnaires have responses.
          </div>
        )}

        {/* 1. Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} value={counts.before.toLocaleString()} label="Before Respondents" caption="baseline survey · pre-intervention" gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" />
          <StatCard icon={Users} value={counts.after.toLocaleString()} label="After Respondents" caption="follow-up survey · post-intervention" gradient="linear-gradient(135deg, #fb923c 0%, #ea580c 100%)" />
          <StatCard
            icon={Wallet}
            value={mainIncome ? `${fmtPeso(mainIncome.beforeMean)} → ${fmtPeso(mainIncome.afterMean)}` : '—'}
            label="Est. Monthly Income"
            caption={mainIncome ? `${mainIncome.code || 'income'} · from bracket midpoints` : 'no income brackets found'}
            gradient="linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
          />
          <StatCard
            icon={Gauge}
            value={doi ? `${fmtPct(doi.beforeMean)} → ${fmtPct(doi.afterMean)}` : `${paired?.pairCount ?? 0}`}
            label={doi ? 'Durables Ownership (DOI)' : 'Linked Pairs'}
            caption={doi ? `share of ${doi.items} listed assets owned` : 'same person, Before and After'}
            gradient="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
          />
        </div>

        {/* 2. Key indicators */}
        {(shareIndices.length > 0 || ratingIndices.length > 0) && (
          <>
            <SectionHeading icon={Gauge} title="Key Indicators" subtitle="Composite scores per respondent, averaged per survey · Before vs After" />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {shareIndices.length > 0 && (
                <ChartCard title="Ownership & Coverage Indices" subtitle="% of listed items a respondent has (Meron / Oo) · mean per survey" right={<PhaseLegend />}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={shareChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 5" stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK} interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={TICK} unit="%" domain={[0, 100]} />
                      <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l, p) => p?.[0]?.payload?.full || l} />
                      <Bar dataKey="Before" fill={BEFORE} radius={[3, 3, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="After" fill={AFTER} radius={[3, 3, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {ratingIndices.length > 0 && (
                <ChartCard title="Program Perception" subtitle="Mean agreement rating (1 = lowest, 5 = highest) · mean per survey" right={<PhaseLegend />}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ratingChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 5" stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK} interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={TICK} domain={[0, 5]} />
                      <Tooltip labelFormatter={(l, p) => p?.[0]?.payload?.full || l} />
                      <Bar dataKey="Before" fill={BEFORE} radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="After" fill={AFTER} radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
            <ChartCard title="Indicator Summary" subtitle="Mean per survey and the change from Before to After">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Indicator</th>
                      <th className="px-4 py-2.5 text-right">Items</th>
                      <th className="px-4 py-2.5 text-right">Before</th>
                      <th className="px-4 py-2.5 text-right">After</th>
                      <th className="px-4 py-2.5 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.indices.map((i) => {
                      const change = i.beforeMean !== null && i.afterMean !== null ? i.afterMean - i.beforeMean : null;
                      const show = i.scale === 'share' ? fmtPct : (v) => fmtNum(v);
                      const changeText = change === null ? '—' : i.scale === 'share' ? signed(change, `${Math.round(change * 100)} pts`) : signed(change, fmtNum(change));
                      return (
                        <tr key={i.group}>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-800">{i.label}</div>
                            <div className="text-[11px] text-slate-400">{i.full}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{i.items}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">{show(i.beforeMean)}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">{show(i.afterMean)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums ${changeTone(change)}`}>{changeText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Ownership / coverage indices: for each respondent, the share of the group's yes/no items answered "Meron" / "Oo" ("not sure" left out), then averaged.
                Perception: each respondent's mean rating over the group's statements, then averaged. Some statements are worded negatively
                (e.g. "the program should be stopped"), so a higher perception mean is not automatically better; see the question-by-question results.
              </p>
            </ChartCard>
          </>
        )}

        {/* 3. Income */}
        {report.income.length > 0 && (
          <>
            <SectionHeading icon={Wallet} title="Income" subtitle="Monthly income brackets, estimated in pesos from each bracket's midpoint" />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="grid grid-cols-1 gap-3">
                {report.income.map((i) => {
                  const change = i.beforeMean !== null && i.afterMean !== null ? i.afterMean - i.beforeMean : null;
                  const pctChange = change !== null && i.beforeMean ? (change / i.beforeMean) * 100 : null;
                  return (
                    <div key={i.key} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-[11px] font-bold text-blue-700">{i.code}</div>
                      <div className="text-[12.5px] font-semibold leading-snug text-slate-800">{i.title}</div>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono tabular-nums">
                        <span className="text-lg font-extrabold" style={{ color: BEFORE }}>{fmtPeso(i.beforeMean)}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-lg font-extrabold" style={{ color: AFTER }}>{fmtPeso(i.afterMean)}</span>
                        {change !== null && (
                          <span className={`text-sm font-bold ${changeTone(change)}`}>
                            {signedPeso(change)}{pctChange !== null ? ` (${signed(pctChange, `${Math.round(pctChange)}%`)})` : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-400">{i.beforeN} Before · {i.afterN} After answered</div>
                    </div>
                  );
                })}
              </div>
              <ChartCard title="Estimated Mean Monthly Income" subtitle="₱ · bracket midpoints · Before vs After" right={<PhaseLegend />}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={incomeChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 5" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK} />
                    <YAxis axisLine={false} tickLine={false} tick={TICK} tickFormatter={(v) => `₱${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => fmtPeso(v)} labelFormatter={(l, p) => p?.[0]?.payload?.full || l} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Before" fill={BEFORE} radius={[3, 3, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="After" fill={AFTER} radius={[3, 3, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

        {/* 4. Map */}
        {report.locations.length > 0 && (
          <MapSection
            points={report.locations}
            summary={counts}
            activeType={mapType}
            onDrillType={(v) => setMapType((t) => (t === v ? 'All' : v))}
            focusKey={mapFocus}
            onFocusChange={setMapFocus}
            onToggleExpand={() => setMapExpanded(true)}
          />
        )}

        {/* 5. Profile */}
        {report.profile.length > 0 && (
          <>
            <SectionHeading icon={Users} title="Respondent Profile" subtitle="Demographics of the Before and After respondents · % of each survey's answers (count)" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {report.profile.map((p) => (
                <ChartCard
                  key={p.key}
                  title={p.title}
                  subtitle={p.kind === 'bins'
                    ? `Age brackets · mean age ${fmtNum(p.beforeMean, 1)} → ${fmtNum(p.afterMean, 1)}`
                    : `${p.code ? `${p.code} · ` : ''}${p.answered.Before} Before · ${p.answered.After} After answered`}
                  right={<PhaseLegend />}
                >
                  <DualBars rows={p.rows} />
                </ChartCard>
              ))}
            </div>
          </>
        )}

        {/* 6. Question by question */}
        {report.sections.length > 0 && (
          <>
            <SectionHeading icon={ListChecks} title="Results by Question" subtitle="Every questionnaire question · share of each answer, Before vs After · click a section to collapse it" />
            <div className="space-y-4">
              {report.sections.map((section) => (
                <details key={section.id} open className="group rounded-xl border border-slate-200 bg-slate-50/60">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{section.id}</span>
                      <span className="text-sm font-bold text-slate-800">{section.title}</span>
                      <span className="text-[11px] text-slate-400">{section.questions.length} questions</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <PhaseLegend />
                      <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.questions.map((q) => <QuestionCard key={q.key} q={q} />)}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}

        {/* 7. Paired */}
        {paired && <PairedBeforeAfter comparison={paired} />}

        {!report.sections.length && !report.profile.length && (
          <EmptyNote text="The questionnaires have no choice or rating questions to chart yet." />
        )}

        <p className="pb-4 text-center text-[11px] leading-relaxed text-slate-400">
          Before vs After compares the baseline survey with the follow-up survey of the program's respondents. There is no
          comparison group in a baseline design, so the changes shown are descriptive and not proof of program impact.
          Percentages are of the respondents who answered each question in that survey.
        </p>
      </div>

      {/* Expanded map overlay */}
      {mapExpanded && report.locations.length > 0 && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setMapExpanded(false); }}
        >
          <div className="w-[min(1250px,97vw)] rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
            <MapSection
              points={report.locations}
              summary={counts}
              activeType={mapType}
              onDrillType={(v) => setMapType((t) => (t === v ? 'All' : v))}
              focusKey={mapFocus}
              onFocusChange={setMapFocus}
              expanded
              onToggleExpand={() => setMapExpanded(false)}
            />
            <p className="mt-2 text-center text-[10.5px] text-slate-400">Press Esc or click outside to collapse</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportTab;
