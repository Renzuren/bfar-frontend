// src/components/MLAnalyticsPanel.jsx
// ============================================================
// SHARED ML ANALYSIS RESULTS VIEWER
// Renders the full ML analysis output produced by the `/train`
// pipeline: Summary / Output / Metrics / Impact tabs and the
// Philippine geo map. The auto-generated chart grid was replaced
// by AutoChartsReport in the no-baseline flow.
// Used by:
//   - MLUpload (manual: user drops a CSV/XLSX file)
//   - NoBaselineAnalysisReport (automatic: built from the
//     combined Beneficiary + Non-Beneficiary responses)
// This component is UI-only; it receives the already-computed
// results plus the dataset used to produce them.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart2,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  Globe2,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Save,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PhilippineMap, { GROUP_COLORS } from '@/components/report/PhilippineMap';
import { ChartCard } from '@/components/report/ReportCharts';
import { resolveRegion } from '@/lib/geoData';
import {
  PALETTE,
  TICK,
  AXIS_LABEL,
  GRID,
  TOOLTIP_STYLE,
  TOOLTIP_LABEL,
  TOOLTIP_ITEM,
  CURSOR,
} from '@/lib/chartTheme';
import { toast } from 'sonner';

// ---------- Geo Map (identical structure to ReportTab / MLUpload) ----------
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

const GeoMapSection = ({
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
    title={<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-600" /> 📍 Geo Map</span>}
    subtitle={expanded
      ? 'Expanded view · provincial & regional boundaries · zoom stays locked to the Philippines'
      : 'Philippines with provincial/regional boundaries · hover a bubble or list row for details'}
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
    <div className={`grid gap-4 ${expanded ? 'lg:grid-cols-[minmax(0,1fr)_330px]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]'}`}>
      <div className={expanded ? 'h-[calc(92vh-190px)] min-h-[420px]' : 'h-[360px] sm:h-[400px] xl:h-[420px]'}>
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
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${isFocus ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50'}`}
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

const GeoMessageCard = ({ title, message }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
    <div className="border-b border-slate-100 px-6 py-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="flex h-48 items-center justify-center px-6">
      <p className="text-center text-sm italic text-slate-400">{message}</p>
    </div>
  </div>
);

// ---------- Geo + small helpers ----------
const normalizeHeader = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const capWords = (s) => String(s ?? '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const toNumLoose = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[₱,\s]|php/gi, ''));
  return Number.isFinite(n) ? n : null;
};

const detectGeoColumns = (cols) => {
  const found = { areaCol: null, provinceCol: null, regionCol: null, latCol: null, lngCol: null };
  cols.forEach((col) => {
    const h = normalizeHeader(col);
    if (!found.provinceCol && /(^| )a3( |$)|province|lalawigan/.test(h)) found.provinceCol = col;
    else if (!found.regionCol && /region|rehiyon/.test(h)) found.regionCol = col;
    else if (!found.latCol && /(^| )(lat|latitude)( |$)/.test(h)) found.latCol = col;
    else if (!found.lngCol && /(^| )(lng|long|longitude)( |$)/.test(h)) found.lngCol = col;
    else if (!found.areaCol && /(^| )a1( |$)|area|municipality|municipal|city|town|barangay/.test(h)) found.areaCol = col;
  });
  return found;
};


// ---------- ML analysis data prep helpers ----------
const preparePSHistogram = (psArray) => {
  if (!psArray || psArray.length === 0) return [];
  const bins = 20;
  const min = 0;
  const max = 1;
  const step = (max - min) / bins;
  const hist = Array(bins).fill(0);
  psArray.forEach(p => {
    const idx = Math.min(Math.floor((p - min) / step), bins - 1);
    hist[idx] += 1;
  });
  return hist.map((count, i) => ({
    bin: `${(i * step).toFixed(2)}-${((i + 1) * step).toFixed(2)}`,
    count,
  }));
};

const prepareSMDBarData = (perFeature) => {
  if (!perFeature || perFeature.length === 0) return [];
  const sorted = [...perFeature].sort((a, b) =>
    Math.abs(b.smd_after || b.smd_before || 0) - Math.abs(a.smd_after || a.smd_before || 0)
  );
  return sorted.slice(0, 20).map(item => ({
    name: item.feature.length > 20 ? item.feature.slice(0, 18) + '…' : item.feature,
    fullName: item.feature,
    before: item.smd_before || 0,
    after: item.smd_after || 0,
  }));
};

const prepareFeatureImportance = (selected) => {
  if (!selected || selected.length === 0) return [];
  return selected.slice(0, 15).map(item => ({
    name: item.feature.length > 25 ? item.feature.slice(0, 23) + '…' : item.feature,
    fullName: item.feature,
    importance: item.importance,
  }));
};

// ============================================================
// MAIN PANEL
// ============================================================
export const MLAnalyticsPanel = ({
  analysisResults,
  columns = [],
  rows = [],
  treatmentColumn = '',
  defaultTab = 'summary',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [mapType, setMapType] = useState('All');
  const [mapFocus, setMapFocus] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const groupCol = analysisResults?.treatment_column || treatmentColumn || '';

  // Auto-switch to the "impact" tab when profiling data exists.
  useEffect(() => {
    if (!analysisResults) return;
    if (analysisResults.profile_updates && analysisResults.profile_updates.length > 0) {
      setActiveTab('impact');
    } else {
      setActiveTab('summary');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResults]);

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

  const geo = useMemo(() => {
    const emptySummary = { municipalities: 0, regions: 0 };
    if (!columns.length || !rows.length) {
      return { status: 'no-data', points: [], summary: emptySummary };
    }
    const cols = detectGeoColumns(columns);
    if (!cols.areaCol && !cols.provinceCol && !cols.regionCol && !cols.latCol) {
      return { status: 'none-detected', points: [], summary: emptySummary };
    }
    const treatedRe = /^(1|yes|y|true|treated|beneficiar)/i;
    const groups = new Map();
    let validRows = 0;
    rows.forEach((row) => {
      const area = capWords(String(row[cols.areaCol] ?? '').trim());
      const province = capWords(String(row[cols.provinceCol] ?? '').trim());
      const regionRaw = capWords(String(row[cols.regionCol] ?? '').trim());
      const lat = cols.latCol ? parseFloat(String(row[cols.latCol] ?? '').replace(/[^0-9.\-]/g, '')) : NaN;
      const lng = cols.lngCol ? parseFloat(String(row[cols.lngCol] ?? '').replace(/[^0-9.\-]/g, '')) : NaN;
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
      const name = area || province || regionRaw;
      if (!name && !hasCoords) return;
      validRows += 1;
      const region = regionRaw || resolveRegion(province) || (province || 'Unknown Region');
      const provinceLabel = province || region || 'Unknown';
      const key = `${String(name || `${lat},${lng}`).toUpperCase()}|${provinceLabel}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: name || provinceLabel,
          province: provinceLabel,
          region,
          latlng: hasCoords ? [lat, lng] : null,
          total: 0,
          b: 0,
          nb: 0,
        });
      }
      const g = groups.get(key);
      g.total += 1;
      if (groupCol) {
        if (treatedRe.test(String(row[groupCol] ?? '').trim())) g.b += 1;
        else g.nb += 1;
      } else {
        g.b += 1;
      }
    });
    if (!validRows) return { status: 'invalid', points: [], summary: emptySummary };
    const points = Array.from(groups.values());
    const summary = {
      municipalities: new Set(points.map((p) => `${p.name}|${p.province}`)).size,
      regions: new Set(points.map((p) => p.region).filter((r) => r && r !== 'Unknown Region')).size,
    };
    return { status: 'ok', points, summary };
  }, [columns, rows, groupCol]);

  const geoTopLocations = useMemo(
    () => [...geo.points].sort((a, b) => b.total - a.total).slice(0, 7),
    [geo.points],
  );


  if (!analysisResults) return null;

  const renderSummary = () => {
    const { rows: totalRows, treatment_column, treatment_detection_method, retrained, retrain_attempts, feature_selection } = analysisResults;
    const topFeatures = feature_selection?.selected || [];
    const importanceData = prepareFeatureImportance(topFeatures);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Rows</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalRows}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Treatment Column</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{treatment_column || 'N/A'}</p>
            <p className="text-[11px] text-slate-400">{treatment_detection_method}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Retrained</p>
            <div className="mt-1 flex items-center gap-2">
              {retrained ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-amber-500" />}
              <span className="text-sm font-semibold text-slate-900">{retrained ? 'Yes' : 'No'}</span>
            </div>
            <p className="text-[11px] text-slate-400">Attempts: {retrain_attempts}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Features Selected</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{feature_selection?.n_features_selected || 0}</p>
          </div>
        </div>

        {importanceData.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Top 15 Feature Importances</h3>
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={importanceData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                    <CartesianGrid {...GRID} horizontal={false} vertical={true} />
                    <XAxis
                      type="number"
                      domain={[0, 'dataMax + 0.05']}
                      axisLine={false}
                      tickLine={false}
                      tick={TICK}
                      label={{ value: 'Importance (relative)', ...AXIS_LABEL, position: 'insideBottom', dy: -2 }}
                    />
                    <YAxis type="category" dataKey="name" width={110} tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
                              <p className="font-medium text-slate-900">{data.fullName || data.name}</p>
                              <p className="text-slate-600">Importance: {data.importance.toFixed(4)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={CURSOR}
                    />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={16}>
                      {importanceData.map((d, i) => (
                        <Cell
                          key={`${d.name}-${i}`}
                          fill={PALETTE.primary}
                          opacity={1 - (i / Math.max(1, importanceData.length)) * 0.45}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOutput = () => {
    const { ps_output, decision_support } = analysisResults;
    const psData = preparePSHistogram(ps_output?.ps);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Min</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.min?.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Max</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.max?.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Mean</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.mean?.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Median</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.median?.toFixed(4)}</p>
          </div>
        </div>

        {psData.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Propensity Score Distribution</h3>
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={psData} margin={{ top: 12, right: 24, left: 0, bottom: 44 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis
                      dataKey="bin"
                      angle={-45}
                      textAnchor="end"
                      height={64}
                      tick={TICK}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Propensity score bin', ...AXIS_LABEL, position: 'insideBottom', dy: 50 }}
                    />
                    <YAxis
                      tick={TICK}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      label={{ value: 'Respondents', ...AXIS_LABEL, angle: -90, position: 'insideLeft', dx: 8 }}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString(), 'Respondents']}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      itemStyle={TOOLTIP_ITEM}
                      cursor={CURSOR}
                    />
                    <Bar dataKey="count" name="Respondents" radius={[3, 3, 0, 0]} maxBarSize={32}>
                      {psData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index < psData.length / 2 ? PALETTE.primary : PALETTE.primaryLight}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {decision_support && decision_support.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Decision Support (PS Quartiles)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Group</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Count</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Mean PS</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {decision_support.map((row, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700">{row.ps_group}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-center text-slate-600">{row.count}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-center font-mono text-slate-600">{row.mean_ps?.toFixed(4)}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-600">{row.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMetrics = () => {
    const { covariate_balance, model_interpretation } = analysisResults;
    const smdData = prepareSMDBarData(covariate_balance?.per_feature);

    return (
      <div className="space-y-6">
        {covariate_balance && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Balance Achieved</p>
                <div className="mt-1 flex items-center gap-2">
                  {covariate_balance.balance_achieved ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-900">{covariate_balance.balance_achieved ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Mean |SMD|</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.mean_abs_smd?.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Matched Pairs</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.matched_pairs}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Caliper</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.caliper?.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Overlap (Treated in Control)</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.overlap?.treated_in_control_range_pct?.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Overlap (Control in Treated)</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.overlap?.control_in_treated_range_pct?.toFixed(1)}%</p>
              </div>
            </div>

            {smdData.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Standardized Mean Differences (SMD) – Before vs After Matching</h3>
                </div>
                <div className="p-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={smdData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
                        <CartesianGrid {...GRID} horizontal={false} vertical={true} />
                        <XAxis
                          type="number"
                          domain={[0, 'dataMax + 0.2']}
                          axisLine={false}
                          tickLine={false}
                          tick={TICK}
                          label={{ value: 'Standardized mean difference (SMD)', ...AXIS_LABEL, position: 'insideBottom', dy: -2 }}
                        />
                        <YAxis type="category" dataKey="name" width={110} tick={TICK} axisLine={false} tickLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
                                  <p className="font-medium text-slate-900">{data.fullName || data.name}</p>
                                  <p className="text-slate-600">Before: {data.before.toFixed(4)}</p>
                                  <p className="text-slate-600">After: {data.after.toFixed(4)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                          cursor={CURSOR}
                        />
                        <ReferenceLine x={0.1} stroke={PALETTE.danger} strokeDasharray="5 4" />
                        <Legend
                          verticalAlign="top"
                          height={26}
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                        <Bar dataKey="before" fill={PALETTE.accent} name="Before" radius={[0, 4, 4, 0]} maxBarSize={14} />
                        <Bar dataKey="after" fill={PALETTE.success} name="After" radius={[0, 4, 4, 0]} maxBarSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {model_interpretation && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Model Interpretation (SHAP)</h3>
            </div>
            <div className="p-6">
              <p className="mb-4 text-sm text-slate-600">{model_interpretation.method}</p>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <ul className="space-y-1 text-sm">
                  {model_interpretation.feature_contributions?.slice(0, 15).map((item, idx) => (
                    <li key={idx} className="flex justify-between border-b border-slate-100 py-1.5 px-2">
                      <span className="truncate text-slate-700">{item.feature}</span>
                      <span className="whitespace-nowrap font-mono text-slate-600">
                        {item.mean_abs_shap?.toFixed(4)} ({item.direction === 'increases_likelihood' ? '\u2B06' : '\u2B07'})
                      </span>
                    </li>
                  ))}
                  {model_interpretation.feature_contributions?.length > 15 && (
                    <li className="px-2 py-1 text-xs text-slate-400">&hellip; and {model_interpretation.feature_contributions.length - 15} more</li>
                  )}
                </ul>
              </div>
              {model_interpretation.socioeconomic_insights && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="mb-2 text-sm font-semibold text-slate-700">Insights</h5>
                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                    {model_interpretation.socioeconomic_insights.map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderImpact = () => {
    const { att_result, profiling_summary, profile_updates, pair_profiles } = analysisResults;

    return (
      <div className="space-y-6">
        {/* ATT Result Card */}
        {att_result && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-900">Average Treatment Effect on the Treated (ATT)</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Mean ATT</p>
                  <p className="mt-0.5 text-2xl font-bold text-teal-600">{att_result.att_mean?.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">95% CI</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-700">
                    [{att_result.ci_95?.[0]?.toFixed(4)}, {att_result.ci_95?.[1]?.toFixed(4)}]
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">p-value (paired t-test)</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">{att_result.p_value_paired_ttest?.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Matched Pairs</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">{att_result.matched_pairs}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">Caliper: {att_result.caliper?.toFixed(4)}</p>
            </div>
          </div>
        )}

        {/* Profiling Summary Cards */}
        {profiling_summary && (
          <div className="grid grid-cols-3 gap-5">
            <div className="rounded-2xl border border-green-200 bg-green-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Increased</p>
                  <p className="text-2xl font-bold text-green-700">{profiling_summary.increased_count}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Decreased</p>
                  <p className="text-2xl font-bold text-red-700">{profiling_summary.decreased_count}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Minus className="h-8 w-8 text-slate-500" />
                <div>
                  <p className="text-xs font-medium text-slate-500">No Change</p>
                  <p className="text-2xl font-bold text-slate-700">{profiling_summary.no_change_count}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Updates Table with bars */}
        {profile_updates && profile_updates.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-900">Pre‑Post Change Profile (Treated vs Control)</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Feature</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-600" colSpan="3">Treated</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-600" colSpan="3">Control</th>
                  </tr>
                  <tr className="bg-slate-50/70">
                    <th className="border-b border-slate-200 px-6 py-2"></th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-green-600">↑</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-red-600">↓</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-400">–</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-green-600">↑</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-red-600">↓</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-400">–</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {profile_updates.map((item, idx) => {
                      const tTotal = item.treated.total || 1;
                      const cTotal = item.control.total || 1;
                      return (
                        <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                          <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-700">{item.feature}</td>
                          {/* Treated bars */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.increased}</span>
                              <div className="w-12 h-1.5 bg-green-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.treated.increased / tTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.decreased}</span>
                              <div className="w-12 h-1.5 bg-red-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.treated.decreased / tTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.no_change}</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(item.treated.no_change / tTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          {/* Control bars */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.increased}</span>
                              <div className="w-12 h-1.5 bg-green-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.control.increased / cTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.decreased}</span>
                              <div className="w-12 h-1.5 bg-red-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.control.decreased / cTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.no_change}</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(item.control.no_change / cTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Optional: expandable pair profiles */}
        {pair_profiles && pair_profiles.length > 0 && (
          <details className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-teal-600">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                View matched pair details ({pair_profiles.length} pairs)
              </span>
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Pair</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Treated ID</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Control ID</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Treated Outcome</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Control Outcome</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Difference</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pair_profiles.slice(0, 50).map((pair, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.treated_index}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.control_index}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.treated_outcome?.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.control_outcome?.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.outcome_difference?.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          pair.status === 'Increased' ? 'bg-green-50 text-green-600' :
                          pair.status === 'Decreased' ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>{pair.status}</span>
                      </td>
                    </tr>
                  ))}
                  {pair_profiles.length > 50 && (
                    <tr><td colSpan="7" className="py-3 text-center text-xs text-slate-400">… and {pair_profiles.length - 50} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    );
  };

  const handleSaveResults = () => {
    const saved = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: saveName || `Analysis ${new Date().toLocaleString()}`,
      description: saveDescription || '',
      date: new Date().toISOString(),
      results: analysisResults,
    };
    saved.push(entry);
    localStorage.setItem('savedAnalyses', JSON.stringify(saved));
    setShowSaveModal(false);
    setSaveName('');
    setSaveDescription('');
    alert('Results saved successfully!');
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Analysis Results */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Analysis Results</h3>
              <p className="text-xs text-slate-500">Results are ready to review</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadJSON} className="gap-1.5 text-slate-600">
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
            <Button size="sm" onClick={() => setShowSaveModal(true)} className="gap-1.5 bg-blue-600 shadow-sm hover:bg-blue-700">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="impact">Impact</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-4">{renderSummary()}</TabsContent>
            <TabsContent value="output" className="mt-4">{renderOutput()}</TabsContent>
            <TabsContent value="metrics" className="mt-4">{renderMetrics()}</TabsContent>
            <TabsContent value="impact" className="mt-4">{renderImpact()}</TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 📍 Geo Map */}
      {rows.length === 0 ? (
        <GeoMessageCard title="📍 Geo Map" message="No dataset loaded. Upload a CSV/XLSX file with at least one row to view the map." />
      ) : geo.status === 'none-detected' ? (
        <GeoMessageCard title="📍 Geo Map" message="No geographic data detected for mapping." />
      ) : geo.status === 'invalid' ? (
        <GeoMessageCard title="📍 Geo Map" message="No valid geographic data available." />
      ) : (
        <div className="[&>div]:rounded-2xl [&>div]:border-slate-200/80">
          <GeoMapSection
            points={geo.points}
            topLocations={geoTopLocations}
            summary={geo.summary}
            activeType={mapType}
            onDrillType={setMapType}
            focusKey={mapFocus}
            onFocusChange={setMapFocus}
            expanded={false}
            onToggleExpand={() => setMapExpanded(true)}
          />
        </div>
      )}


      {/* Expanded Geo Map overlay */}
      {mapExpanded && geo.status === 'ok' && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setMapExpanded(false); }}
        >
          <div className="w-[min(1250px,97vw)] rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
            <GeoMapSection
              points={geo.points}
              topLocations={geoTopLocations}
              summary={geo.summary}
              activeType={mapType}
              onDrillType={setMapType}
              focusKey={mapFocus}
              onFocusChange={setMapFocus}
              expanded
              onToggleExpand={() => setMapExpanded(false)}
            />
            <p className="mt-2 text-center text-[10.5px] text-slate-400">Press Esc or click outside to collapse</p>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Save Analysis Results</h3>
            <p className="mb-5 text-sm text-slate-500">Store your results locally to access them later.</p>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Name *</Label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., Beneficiary vs Non-Beneficiary Analysis 2026"
                  className="mt-1.5 h-11"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Description (optional)</Label>
                <Textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="What was this run about?"
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowSaveModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveResults} disabled={!saveName.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Save className="mr-1.5 h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Convenience export for a loading skeleton used by host pages.
export const MLAnalysisSkeleton = () => (
  <div className="space-y-5">
    <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
    <div className="h-[420px] w-full animate-pulse rounded-xl bg-slate-100" />
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-72 animate-pulse rounded-lg bg-slate-100" />)}
    </div>
  </div>
);

export default MLAnalyticsPanel;