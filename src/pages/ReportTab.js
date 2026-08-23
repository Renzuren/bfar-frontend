// src/pages/ReportTab.js
// ============================================================
// REPORT TAB — fully interactive impact evaluation report
// Combines Before + After questionnaire responses and renders:
// locked Philippine distribution map, 9 chart groups with
// hover tooltips, legend-click series filtering, cross-chart
// drill-downs, loading/error/empty states, and a print-ready
// single-PDF export of the entire report (html2canvas + jsPDF).
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AlertTriangle, Building2, Download, FileBarChart2, Globe2, Inbox, Loader2, MapPin, Maximize2, Minimize2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import PhilippineMap, { GROUP_COLORS } from '@/components/report/PhilippineMap';
import {
  AgeChart,
  ChartCard,
  EducationChart,
  IncomeChart,
  IndicesChart,
  LikertSection,
  MaritalChart,
  PeiChart,
  RegionChart,
  SexDonut,
} from '@/components/report/ReportCharts';
import {
  AGE_BRACKETS,
  aggregateAge,
  aggregateEducation,
  aggregateIncome,
  aggregateIndices,
  aggregateLikert,
  aggregateMarital,
  aggregateRegion,
  aggregateSex,
  applyDrill,
  buildMapPoints,
  buildSummary,
  buildUnifiedRecords,
  computePEI,
} from '@/lib/reportData';

const DEFAULT_DRILL = { type: 'All', region: 'All', sex: 'All' };

const fmtPeso = (v) => (v === null || v === undefined ? '—' : `₱${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

const StatCard = ({ value, label, caption, gradient }) => (
  <div className="min-h-[92px] rounded-[8px] p-[16px_18px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)]" style={{ background: gradient }}>
    <div className="font-mono text-[26px] font-extrabold leading-tight tracking-tight">{value}</div>
    <div className="mt-0.5 text-[11.5px] font-medium opacity-90">{label}</div>
    <div className="text-[10px] opacity-75">{caption}</div>
  </div>
);

const Skeleton = () => (
  <div className="space-y-5">
    <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
    <div className="mx-auto h-[520px] w-full max-w-[560px] animate-pulse rounded-xl bg-slate-100" />
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-72 animate-pulse rounded-lg bg-slate-100" />)}
    </div>
    <p className="text-center text-sm text-slate-400">Loading report data…</p>
  </div>
);

const MAP_TYPE_PILLS = [
  { value: 'All', label: 'All Groups', color: '#334155' },
  { value: 'Beneficiary', label: 'Beneficiaries', color: GROUP_COLORS.Beneficiary },
  { value: 'Non-Beneficiary', label: 'Non-Beneficiaries', color: GROUP_COLORS['Non-Beneficiary'] },
];

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

const MapSection = ({
  points,
  topLocations,
  summary,
  activeType,
  onDrillType,
  focusKey,
  onFocusChange,
  expanded = false,
  onToggleExpand,
}) => (
  <ChartCard
    title={<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-600" /> Geographic Distribution Map</span>}
    subtitle={expanded
      ? 'Expanded view · navigation stays locked to the Philippines'
      : 'Philippines only · zoom fixed at level 6 · hover a bubble or list row for details'}
    right={
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
    }
  >
    <div className={`grid gap-4 ${expanded ? 'lg:grid-cols-[minmax(0,1fr)_330px]' : 'lg:grid-cols-[minmax(0,540px)_minmax(250px,1fr)]'}`}>
      <div className={expanded ? 'h-[calc(92vh-190px)] min-h-[420px]' : 'h-[480px] sm:h-[560px] xl:h-[640px]'}>
        <PhilippineMap
          points={points}
          activeType={activeType}
          focusKey={focusKey}
          onFocusChange={onFocusChange}
        />
      </div>

      {/* Side panel */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <Building2 className="h-3 w-3" /> Municipalities
            </div>
            <div className="mt-0.5 text-lg font-extrabold tabular-nums leading-tight text-slate-800">{summary.municipalities.toLocaleString()}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <Globe2 className="h-3 w-3" /> Regions
            </div>
            <div className="mt-0.5 text-lg font-extrabold tabular-nums leading-tight text-slate-800">{summary.regions.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Top Locations</span>
            <span className="hidden text-[10px] text-slate-400 xl:block">hover to locate on map</span>
          </div>
          <div className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5 ${expanded ? 'max-h-none' : 'max-h-[430px]'}`}>
            {topLocations.map((p, i) => {
              const isFocus = focusKey === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onMouseEnter={() => onFocusChange(p.key)}
                  onMouseLeave={() => onFocusChange(null)}
                  onFocus={() => onFocusChange(p.key)}
                  onBlur={() => onFocusChange(null)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${isFocus ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
                >
                  <span className={`w-4 text-right text-[11px] font-extrabold ${i === 0 ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold leading-tight text-slate-800">{p.name}</span>
                    <span className="block truncate text-[10px] leading-tight text-slate-400">{p.province}</span>
                  </span>
                  <span className="hidden h-[6px] w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:flex">
                    <span style={{ width: `${p.total ? (p.b / p.total) * 100 : 0}%`, background: GROUP_COLORS.Beneficiary }} />
                    <span style={{ width: `${p.total ? (p.nb / p.total) * 100 : 0}%`, background: GROUP_COLORS['Non-Beneficiary'] }} />
                  </span>
                  <span className="w-7 text-right text-[11.5px] font-extrabold tabular-nums text-slate-700">{p.total.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS.Beneficiary }} /> Beneficiaries</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS['Non-Beneficiary'] }} /> Non-Beneficiaries</span>
          <span>Bar shows B / NB split</span>
        </div>
      </div>
    </div>
  </ChartCard>
);

const ReportTab = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [drill, setDrill] = useState(DEFAULT_DRILL);
  const [indexPhase, setIndexPhase] = useState('All');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const reportRef = useRef(null);

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
        const tasks = [];
        if (project.before_form) {
          tasks.push(
            api.get(`/forms/${project.before_form}`),
            api.get(`/forms/${project.before_form}/responses`).catch(() => ({ data: [] })),
          );
        } else {
          tasks.push(null, null);
        }
        if (project.after_form) {
          tasks.push(
            api.get(`/forms/${project.after_form}`),
            api.get(`/forms/${project.after_form}/responses`).catch(() => ({ data: [] })),
          );
        } else {
          tasks.push(null, null);
        }
        const results = await Promise.all(tasks);
        if (cancelled) return;
        setRaw({
          beforeForm: results[0]?.data ?? null,
          beforeResponses: results[1]?.data ?? [],
          afterForm: results[2]?.data ?? null,
          afterResponses: results[3]?.data ?? [],
        });
      } catch (e) {
        if (!cancelled) setError('Failed to load questionnaire responses for this project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [project, reloadKey]);

  const bundle = useMemo(
    () => buildUnifiedRecords({
      beforeForm: raw?.beforeForm,
      beforeResponses: raw?.beforeResponses,
      afterForm: raw?.afterForm,
      afterResponses: raw?.afterResponses,
    }),
    [raw],
  );

  const records = useMemo(() => applyDrill(bundle.records, drill), [bundle, drill]);
  const summary = useMemo(() => buildSummary(records), [records]);
  const mapPoints = useMemo(() => buildMapPoints(records), [records]);
  const topLocations = useMemo(() => [...mapPoints].sort((a, b) => b.total - a.total).slice(0, 7), [mapPoints]);

  const regionData = useMemo(() => aggregateRegion(records), [records]);
  const ageData = useMemo(() => aggregateAge(records).map((d) => ({ ...d, sharePct: summary.total ? Number(((d.total / summary.total) * 100).toFixed(1)) : 0 })), [records, summary.total]);
  const sexData = useMemo(() => aggregateSex(records), [records]);
  const maritalData = useMemo(() => aggregateMarital(records), [records]);
  const educationData = useMemo(() => aggregateEducation(records), [records]);
  const totalIncomeData = useMemo(() => aggregateIncome(records, 'total'), [records]);
  const indicesData = useMemo(() => aggregateIndices(records, indexPhase), [records, indexPhase]);
  const likertData = useMemo(() => aggregateLikert(bundle.statements, records), [bundle, records]);
  const pei = useMemo(() => computePEI(records), [records]);

  // Section visibility — each block renders only when at least one
  // respondent/beneficiary contributed usable data for it.
  const vis = useMemo(() => ({
    map: mapPoints.length > 0,
    region: records.some((r) => r.region && r.region !== 'Unknown Region'),
    age: ageData.length > 0,
    sex: sexData.length > 0,
    marital: maritalData.length > 0,
    education: educationData.length > 0,
    income: totalIncomeData.length > 0,
    indices: indicesData.some((d) => d.hasData),
    likert: Object.values(likertData).some((rows) => rows.length > 0),
    pei: !!pei.applicable,
  }), [mapPoints, records, ageData, sexData, maritalData, educationData, totalIncomeData, indicesData, likertData, pei]);
  const anySection = Object.values(vis).some(Boolean);

  const setDrillKey = (key, value) => setDrill((d) => ({ ...d, [key]: d[key] === value ? 'All' : value }));
  const clearDrill = () => setDrill(DEFAULT_DRILL);
  const activeDrills = Object.entries(drill).filter(([, v]) => v !== 'All');

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`${(project?.title || 'impact-report').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}-report.pdf`);
      toast.success('Report exported as PDF');
    } catch (e) {
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  if (!project) {
    return <div className="flex items-center justify-center py-20 text-slate-500">Loading project…</div>;
  }

  if (loading && !raw) return <Skeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="mb-1 text-lg font-bold text-slate-900">Something went wrong</h3>
        <p className="mb-6 max-w-sm text-sm text-slate-500">{error}</p>
        <Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
      </div>
    );
  }

  if (!raw?.beforeForm && !raw?.afterForm) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
          <Inbox className="h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">No Questionnaires Yet</h3>
        <p className="max-w-md text-sm text-slate-500">
          The Report tab aggregates responses from your Before and After questionnaires. Create at least one questionnaire to generate this report.
        </p>
      </div>
    );
  }

  if (!summary.total) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
          <Inbox className="h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">No Responses Yet</h3>
        <p className="max-w-md text-sm text-slate-500">
          Share your questionnaire links to start collecting responses. This report updates automatically as new data arrives.
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={reportRef} className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 px-6 py-7 text-white shadow-lg sm:px-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <FileBarChart2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Impact Evaluation Report</p>
              <h2 className="mt-0.5 text-2xl font-bold leading-tight sm:text-3xl">{project.title}</h2>
              <p className="mt-1 text-sm text-blue-100">
                Aggregated from {raw.beforeResponses.length ? `${raw.beforeResponses.length} Before` : 'Before'}{raw.beforeResponses.length && raw.afterResponses.length ? ' + ' : ''}{raw.afterResponses.length ? `${raw.afterResponses.length} After` : 'After'} responses · generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          {anySection && (
            <Button
              onClick={generatePDF}
              disabled={generatingPdf}
              className="bg-white font-semibold text-blue-700 shadow-md hover:bg-blue-50"
            >
              {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {generatingPdf ? 'Preparing PDF…' : 'Export to PDF'}
            </Button>
          )}
        </div>
      </section>

      {/* Active cross-filters */}
      {activeDrills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Cross-filter:</span>
          {activeDrills.map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDrill((d) => ({ ...d, [key]: 'All' }))}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-100"
            >
              {value}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearDrill}
            className="ml-auto flex items-center gap-1 text-[11.5px] font-bold text-blue-700 underline-offset-2 hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard value={summary.total.toLocaleString()} label="Total Respondents" caption={`${summary.regions} regions · ${summary.municipalities} municipalities`} gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" />
        <StatCard value={summary.beneficiaries.toLocaleString()} label="Beneficiaries" caption={summary.total ? `${((summary.beneficiaries / summary.total) * 100).toFixed(1)}% of respondents` : '—'} gradient="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" />
        <StatCard value={summary.nonBeneficiaries.toLocaleString()} label="Non-Beneficiaries" caption="comparison / control group" gradient="linear-gradient(135deg, #fb923c 0%, #ea580c 100%)" />
        <StatCard value={fmtPeso(summary.avgTotalIncome)} label="Avg Total Household Income" caption="monthly · all income sources" gradient="linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" />
      </div>

      {/* Map — shown when at least one municipality has respondents */}
      {vis.map && (
        <MapSection
          points={mapPoints}
          topLocations={topLocations}
          summary={summary}
          activeType={drill.type}
          onDrillType={(v) => setDrillKey('type', v)}
          focusKey={mapFocus}
          onFocusChange={setMapFocus}
          expanded={false}
          onToggleExpand={() => setMapExpanded(true)}
        />
      )}

      {/* Charts */}
      {anySection ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {vis.region && <RegionChart data={regionData} activeRegion={drill.region} onDrillRegion={(v) => setDrillKey('region', v)} />}
          {vis.age && <AgeChart data={ageData} />}
          {vis.sex && <SexDonut data={sexData} activeSex={drill.sex} onDrillSex={(v) => setDrillKey('sex', v)} />}
          {vis.marital && <MaritalChart data={maritalData} />}
          {vis.education && <EducationChart data={educationData} />}
          {vis.income && <IncomeChart data={totalIncomeData} kind="total" />}
          {vis.indices && <IndicesChart data={indicesData} phase={indexPhase} onPhaseChange={setIndexPhase} />}
          {vis.likert && <LikertSection likertData={likertData} />}
          {vis.pei && <PeiChart pei={pei} />}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <Inbox className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No chart data to display</p>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            No respondents matched the current cross-filters, or your questionnaire does not collect these fields yet.
          </p>
        </div>
      )}

      {anySection && (
        <p className="pb-4 text-center text-[11px] text-slate-400">
          Age brackets used: {AGE_BRACKETS.join(' · ')} · Perception charts include beneficiaries only · Report regenerates live from Before + After tab data
        </p>
      )}
      </div>

      {/* Expanded map overlay (outside PDF capture area) */}
      {mapExpanded && vis.map && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setMapExpanded(false); }}
        >
          <div className="w-[min(1250px,97vw)] rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
            <MapSection
              points={mapPoints}
              topLocations={topLocations}
              summary={summary}
              activeType={drill.type}
              onDrillType={(v) => setDrillKey('type', v)}
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
