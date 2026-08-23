import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileSpreadsheet, Database, BarChart3, ArrowLeft, Import,
  ChevronLeft, ChevronRight, TrendingUp, AlertCircle, Loader2,
  CheckCircle2, XCircle, Filter,
  Download, Save, Eye, TrendingDown, Minus, BarChart2,
  MapPin, Building2, Globe2, Maximize2, Minimize2, PieChart as PieIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, Line, Area, ReferenceLine,
  PieChart, Pie, ScatterChart, Scatter, ComposedChart
} from 'recharts';
import PhilippineMap, { GROUP_COLORS } from '@/components/report/PhilippineMap';
import { ChartCard } from '@/components/report/ReportCharts';
import { resolveRegion } from '@/lib/geoData';
import { Plot as PlotlyChart } from '@/lib/plotlySetup';

// ---------- Geo Map (identical structure to ReportTab.js) ----------
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
    title={<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-600" /> 📍 Geo Map</span>}
    subtitle={expanded
      ? 'Expanded view · navigation stays locked to the Philippines'
      : 'Philippines only · zoom fixed · hover a bubble or list row for details'}
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

// ---------- Auto Chart helpers (general-purpose) ----------
const PIE_COLORS = ['#2563eb', '#f97316', '#16a34a', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#db2777', '#65a30d', '#4f46e5', '#ea580c', '#0d9488'];

const AUTO_DEFAULT_TYPE = { categorical: 'bar', numeric: 'histogram', time: 'line' };
const RATING_LEVELS = ['1', '2', '3', '4', '5'];
const RATING_COLORS = ['#dc2626', '#f87171', '#fbbf24', '#86efac', '#16a34a'];

// Modern palettes for Auto Charts
const CAT_PALETTE = ['#4361ee', '#3f37c9', '#4cc9f0', '#7209b7', '#f72585', '#4895ef', '#b5179e', '#4cc9f0'];
const SEQ_BLUES = ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb'];
const DIV_COLORS = ['#d73027', '#fc8d59', '#fee090', '#ffffbf', '#e0f3f8', '#91bfdb', '#4575b4'];
const SEQ_SCALE = [[0, SEQ_BLUES[0]], [0.25, SEQ_BLUES[2]], [0.5, SEQ_BLUES[4]], [0.75, SEQ_BLUES[5]], [1, SEQ_BLUES[6]]];
const DIV_SCALE = [[0, DIV_COLORS[0]], [0.35, DIV_COLORS[2]], [0.5, DIV_COLORS[3]], [0.65, DIV_COLORS[4]], [1, DIV_COLORS[6]]];

// Small stats helpers for diverse chart builders
const meanOf = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const quantileSorted = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? rest * (sorted[base + 1] - sorted[base]) : 0);
};
const pearsonR = (xs, ys) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = meanOf(xs);
  const my = meanOf(ys);
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }
  if (!sx || !sy) return null;
  return sxy / Math.sqrt(sx * sy);
};
const gaussianKde = (values, steps = 60) => {
  const n = values.length;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  if (!Number.isFinite(mn) || !Number.isFinite(mx) || mx === mn) return null;
  const variance = values.reduce((s, x) => s + (x - meanOf(values)) ** 2, 0) / n;
  const sd = Math.sqrt(variance) || 1e-9;
  const bw = 1.06 * sd * Math.pow(n, -1 / 5);
  const lo = mn - bw * 2;
  const hi = mx + bw * 2;
  const stepX = (hi - lo) / (steps - 1);
  const xs = [];
  const ys = [];
  for (let i = 0; i < steps; i++) {
    const x = lo + i * stepX;
    let d = 0;
    for (let k = 0; k < n; k++) {
      const u = (x - values[k]) / bw;
      d += Math.exp(-0.5 * u * u);
    }
    xs.push(x);
    ys.push(d / (n * bw * Math.sqrt(2 * Math.PI)));
  }
  return { xs, ys };
};

const normalizeHeader = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const capWords = (s) => String(s ?? '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const toNumLoose = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[₱,\s]|php/gi, ''));
  return Number.isFinite(n) ? n : null;
};
const looksDate = (v) => !Number.isNaN(Date.parse(v)) && /[-/:.]|[a-z]{3}/i.test(v);
const fmtTick = (n) => (Math.abs(n) >= 1000 ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(Number(n.toFixed(1))));

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

const profileColumnsForCharts = (cols, rows) => {
  if (!cols || !cols.length || !rows || !rows.length) return [];
  return cols
    .map((col) => {
      const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
      if (!values.length) return { col, kind: 'empty' };
      const strs = values.map((v) => String(v).trim());
      const uniq = Array.from(new Set(strs));
      const nums = strs.filter((v) => toNumLoose(v) !== null).length;
      const dates = strs.filter(looksDate).length;
      if (strs.filter((v) => /^[1-5]$/.test(v)).length >= values.length * 0.8) return { col, kind: 'rating' };
      if (uniq.length >= 2 && uniq.length <= 12) return { col, kind: 'categorical', uniqCount: uniq.length };
      if (dates >= values.length * 0.8) return { col, kind: 'time' };
      if (nums >= values.length * 0.8) return { col, kind: 'numeric' };
      return { col, kind: 'text' };
    })
    .filter((p) => p.kind !== 'empty');
};

const buildAutoChart = (profile, rows, groupCol) => {
  const { col, kind } = profile;
  const cleanRows = rows
    .map((r) => ({ str: String(r[col] ?? '').trim(), num: toNumLoose(r[col]) }))
    .filter((v) => v.str !== '');
  if (!cleanRows.length) return { type: AUTO_DEFAULT_TYPE[kind] || 'bar', data: [], series: null };

  if (kind === 'categorical') {
    const uniqGroups = groupCol
      ? Array.from(new Set(rows.map((r) => String(r[groupCol] ?? '').trim()).filter(Boolean)))
      : [];
    if (uniqGroups.length >= 2 && uniqGroups.length <= 4) {
      const cats = new Map();
      rows.forEach((r) => {
        const c = String(r[col] ?? '').trim();
        if (!c) return;
        const g = String(r[groupCol] ?? '').trim() || '(blank)';
        if (!cats.has(c)) cats.set(c, { name: c });
        const e = cats.get(c);
        e[g] = (e[g] || 0) + 1;
      });
      const data = Array.from(cats.values())
        .map((e) => ({ ...e, __total: uniqGroups.reduce((s, g) => s + (e[g] || 0), 0) }))
        .sort((a, b) => b.__total - a.__total)
        .slice(0, 10)
        .map(({ __total, ...rest }) => rest);
      const series = uniqGroups.map((g, i) => ({
        key: g,
        name: g,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }));
      return { type: 'bar', data, series };
    }
    const counts = new Map();
    cleanRows.forEach((v) => counts.set(v.str, (counts.get(v.str) || 0) + 1));
    const data = Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    if (data.length > 1 && data.length <= 4) return { type: 'donut', data, series: null };
    return { type: 'bar', data: withCumulative(data), series: null };
  }

  if (kind === 'time') {
    const counts = new Map();
    cleanRows.forEach((v) => {
      const t = Date.parse(v.str);
      if (Number.isNaN(t)) return;
      counts.set(v.str, (counts.get(v.str) || 0) + 1);
    });
    const data = Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => Date.parse(a.name) - Date.parse(b.name))
      .slice(-60);
    return { type: 'time', data: withMovingAvg(data), series: null };
  }

  const nums = cleanRows.map((v) => v.num).filter((n) => n !== null);
  if (!nums.length) return { type: 'histogram', data: [], series: null };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const binCount = Math.max(5, Math.min(20, Math.ceil(Math.sqrt(nums.length))));
  const step = (max - min || 1) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    name: `${fmtTick(min + i * step)}–${fmtTick(min + (i + 1) * step)}`,
    value: 0,
  }));
  nums.forEach((n) => {
    const idx = Math.min(binCount - 1, Math.floor((n - min) / step));
    bins[idx].value += 1;
  });
  return { type: 'histogram', data: withCumulative(bins), series: null };
};

const shortName = (col) => (col.length > 18 ? `${col.slice(0, 16)}…` : col);

const withCumulative = (rows) => {
  const total = rows.reduce((s, r) => s + (r.value || 0), 0);
  if (!total) return rows;
  let run = 0;
  return rows.map((r) => {
    run += r.value || 0;
    return { ...r, cum: Number(((run / total) * 100).toFixed(1)) };
  });
};

const withMovingAvg = (rows, win = 3) => {
  if (rows.length < win) return rows;
  return rows.map((r, i) => {
    const seg = rows.slice(Math.max(0, i - win + 1), i + 1);
    return { ...r, ma: Number((seg.reduce((a, x) => a + (x.value || 0), 0) / seg.length).toFixed(2)) };
  });
};

const buildGroupMeansChart = (profiles, rows, groupCol) => {
  const uniqGroups = Array.from(new Set(rows.map((r) => String(r[groupCol] ?? '').trim()).filter(Boolean)));
  if (uniqGroups.length < 2 || uniqGroups.length > 4) return null;
  const data = profiles
    .map((p) => {
      const row = { name: shortName(p.col), fullName: p.col };
      let hasValue = false;
      uniqGroups.forEach((g) => {
        const vals = rows
          .filter((r) => String(r[groupCol] ?? '').trim() === g)
          .map((r) => toNumLoose(r[p.col]))
          .filter((v) => v !== null);
        row[g] = vals.length ? Number((vals.reduce((s, x) => s + x, 0) / vals.length).toFixed(2)) : 0;
        if (vals.length) hasValue = true;
      });
      return hasValue ? row : null;
    })
    .filter(Boolean);
  if (!data.length) return null;
  const series = uniqGroups.map((g, i) => ({ key: g, name: g, color: PIE_COLORS[i % PIE_COLORS.length] }));
  return { col: 'Group Means Comparison', kind: 'comparison', type: 'groupMeans', data, series };
};

const buildRatingChart = (profiles, rows) => {
  const data = profiles
    .map((p) => {
      const counts = [0, 0, 0, 0, 0];
      let total = 0;
      rows.forEach((r) => {
        const m = /^([1-5])$/.exec(String(r[p.col] ?? '').trim());
        if (m) {
          counts[Number(m[1]) - 1] += 1;
          total += 1;
        }
      });
      if (!total) return null;
      const row = { name: shortName(p.col), fullName: p.col };
      RATING_LEVELS.forEach((L, i) => {
        row[L] = Number(((counts[i] / total) * 100).toFixed(1));
      });
      return row;
    })
    .filter(Boolean);
  if (!data.length) return null;
  const series = RATING_LEVELS.map((L, i) => ({ key: L, name: L, color: RATING_COLORS[i] }));
  return { col: 'Rating Scale Distribution', kind: 'rating', type: 'rating', data, series };
};

const buildCorrelationChart = (profiles, rows) => {
  const cols = profiles.map((p) => p.col).slice(0, 10);
  let best = null;
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const xs = [];
      const ys = [];
      rows.forEach((r) => {
        const x = toNumLoose(r[cols[i]]);
        const y = toNumLoose(r[cols[j]]);
        if (x !== null && y !== null) {
          xs.push(x);
          ys.push(y);
        }
      });
      const n = xs.length;
      if (n < 5) continue;
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const my = ys.reduce((a, b) => a + b, 0) / n;
      let sxy = 0;
      let sx = 0;
      let sy = 0;
      for (let k = 0; k < n; k++) {
        const dx = xs[k] - mx;
        const dy = ys[k] - my;
        sxy += dx * dy;
        sx += dx * dx;
        sy += dy * dy;
      }
      if (!sx || !sy) continue;
      const r = sxy / Math.sqrt(sx * sy);
      if (!best || Math.abs(r) > Math.abs(best.r)) best = { r, x: cols[i], y: cols[j], pts: xs.map((x, k) => ({ x, y: ys[k] })) };
    }
  }
  if (!best || Math.abs(best.r) < 0.3) return null;
  const xsAll = best.pts.map((p) => p.x);
  const ysAll = best.pts.map((p) => p.y);
  const mx = meanOf(xsAll);
  const my = meanOf(ysAll);
  let num = 0;
  let den = 0;
  for (let k = 0; k < best.pts.length; k++) {
    num += (xsAll[k] - mx) * (ysAll[k] - my);
    den += (xsAll[k] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const x0 = Math.min(...xsAll);
  const x1 = Math.max(...xsAll);
  return {
    col: 'Relationship Scatter',
    kind: 'correlation',
    type: 'scatter',
    data: best.pts.slice(0, 1500),
    series: null,
    meta: {
      xLabel: best.x,
      yLabel: best.y,
      r: Number(best.r.toFixed(2)),
      r2: Number((best.r * best.r).toFixed(3)),
      trend: [
        { x: x0, y: Number((intercept + slope * x0).toFixed(4)) },
        { x: x1, y: Number((intercept + slope * x1).toFixed(4)) },
      ],
    },
  };
};

// ---------- Diverse chart builders (Plotly + custom SVG/div designs) ----------
const buildLollipopChart = (profile, rows) => {
  const counts = new Map();
  rows.forEach((r) => {
    const v = String(r[profile.col] ?? '').trim();
    if (!v) return;
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const entries = Array.from(counts.entries()).sort((a, b) => a[1] - b[1]).slice(-12);
  if (entries.length < 3) return null;
  return {
    col: profile.col,
    kind: 'ranking',
    type: 'lollipop',
    cats: entries.map((e) => e[0]),
    vals: entries.map((e) => e[1]),
    total: rows.length,
  };
};

const buildHistKdeChart = (profile, rows) => {
  const nums = rows.map((r) => toNumLoose(r[profile.col])).filter((n) => n !== null);
  if (nums.length < 8) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return null;
  const binCount = Math.max(6, Math.min(18, Math.ceil(Math.sqrt(nums.length))));
  const step = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, () => 0);
  nums.forEach((n) => {
    bins[Math.min(binCount - 1, Math.floor((n - min) / step))] += 1;
  });
  const kde = gaussianKde(nums);
  const binWidth = nums.length * step;
  return {
    col: profile.col,
    kind: 'distribution',
    type: 'histDensity',
    nums,
    binCount,
    binLabels: Array.from({ length: binCount }, (_, i) => `${fmtTick(min + i * step)}–${fmtTick(min + (i + 1) * step)}`),
    binCounts: bins,
    kdeX: kde ? kde.xs : [],
    kdeY: kde ? kde.ys.map((d) => Number((d * binWidth).toFixed(3))) : [],
  };
};

const numericDatasets = (numProfiles, rows, limit = 8) =>
  numProfiles
    .slice(0, limit)
    .map((p) => ({
      name: shortName(p.col),
      fullName: p.col,
      values: rows.map((r) => toNumLoose(r[p.col])).filter((n) => n !== null),
    }))
    .filter((d) => d.values.length >= 5);

const buildBoxChart = (numProfiles, rows) => {
  const datasets = numericDatasets(numProfiles, rows);
  if (datasets.length < 1) return null;
  return { col: 'Numeric Spread', kind: 'spread', type: 'box', datasets };
};

const buildViolinChart = (numProfiles, rows) => {
  const datasets = numericDatasets(numProfiles, rows);
  if (datasets.length < 2 || !datasets.some((d) => d.values.length >= 12)) return null;
  return { col: 'Distribution Shapes', kind: 'violin', type: 'violin', datasets };
};

const buildHeatmapChart = (numProfiles, rows) => {
  const cols = numProfiles.slice(0, 8).map((p) => p.col);
  if (cols.length < 3) return null;
  const series = cols.map((c) => rows.map((r) => toNumLoose(r[c])));
  const z = [];
  for (let i = 0; i < cols.length; i++) {
    const rowZ = [];
    for (let j = 0; j < cols.length; j++) {
      const xs = [];
      const ys = [];
      for (let k = 0; k < rows.length; k++) {
        const x = series[i][k];
        const y = series[j][k];
        if (x !== null && y !== null) {
          xs.push(x);
          ys.push(y);
        }
      }
      rowZ.push(Number((pearsonR(xs, ys) ?? 0).toFixed(2)));
    }
    z.push(rowZ);
  }
  return {
    col: 'Correlation Heatmap',
    kind: 'matrix',
    type: 'heat',
    z,
    xlabels: cols.map(shortName),
    ylabels: cols.map(shortName),
  };
};

const buildRidgelineChart = (catProfiles, numProfile, rows) => {
  if (!numProfile) return null;
  for (const cat of catProfiles.filter((c) => c.uniqCount >= 2 && c.uniqCount <= 6)) {
    const groups = new Map();
    rows.forEach((r) => {
      const g = String(r[cat.col] ?? '').trim();
      const v = toNumLoose(r[numProfile.col]);
      if (!g || v === null) return;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(v);
    });
    const arr = Array.from(groups.entries())
      .map(([name, values]) => ({ name, values }))
      .filter((g) => g.values.length >= 8);
    if (arr.length >= 2 && arr.length <= 6) {
      return { col: `${shortName(numProfile.col)} by ${shortName(cat.col)}`, kind: 'ridge', type: 'ridge', groups: arr.slice(0, 6) };
    }
  }
  return null;
};

const buildWaffleChart = (profiles, rows) => {
  for (const p of profiles.filter((c) => c.uniqCount >= 2 && c.uniqCount <= 6)) {
    const counts = new Map();
    rows.forEach((r) => {
      const v = String(r[p.col] ?? '').trim();
      if (!v) return;
      counts.set(v, (counts.get(v) || 0) + 1);
    });
    if (counts.size < 2) continue;
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const items = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, count, pct: (count / total) * 100, color: CAT_PALETTE[i % CAT_PALETTE.length] }));
    return { col: p.col, kind: 'proportion', type: 'waffle', items, total };
  }
  return null;
};

const buildBubbleChart = (numProfiles, rows) => {
  const cols = numProfiles.slice(0, 5).map((p) => p.col);
  if (cols.length < 3) return null;
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      for (let k = j + 1; k < cols.length; k++) {
        const x = [];
        const y = [];
        const s = [];
        rows.forEach((r) => {
          const xv = toNumLoose(r[cols[i]]);
          const yv = toNumLoose(r[cols[j]]);
          const sv = toNumLoose(r[cols[k]]);
          if (xv !== null && yv !== null && sv !== null) {
            x.push(xv);
            y.push(yv);
            s.push(Math.abs(sv));
          }
        });
        if (x.length >= 10 && new Set(s).size > 2) {
          return {
            col: 'Bubble Relationships',
            kind: 'bubble',
            type: 'bubble',
            x,
            y,
            size: s,
            labels: [cols[i], cols[j], cols[k]],
          };
        }
      }
    }
  }
  return null;
};

const buildDonutChart = (profile, rows) => {
  const counts = new Map();
  rows.forEach((r) => {
    const v = String(r[profile.col] ?? '').trim();
    if (!v) return;
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (entries.length < 2) return null;
  const total = entries.reduce((s, e) => s + e[1], 0);
  return {
    col: profile.col,
    kind: 'share',
    type: 'donut',
    data: entries.map(([name, value], i) => ({ name, value, color: CAT_PALETTE[i % CAT_PALETTE.length] })),
    total,
  };
};

const AUTO_TILE_BADGE = {
  bar: 'Bars + Cum %',
  donut: 'Donut',
  histogram: 'Histogram',
  time: 'Smooth Area',
  rating: 'Stacked %',
  groupMeans: 'Group Means',
  scatter: 'Scatter + Trend',
  lollipop: 'Lollipop',
  histDensity: 'Hist + KDE',
  box: 'Box Plot',
  violin: 'Violin',
  ridge: 'Ridgeline',
  heat: 'Heatmap',
  waffle: 'Waffle',
  bubble: 'Bubble',
};

// ---------- Shared tile chrome (equal-height cards) ----------
const TileShell = ({ col, badge, footer, children }) => (
  <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
      <p className="min-w-0 truncate text-xs font-semibold text-slate-700">{col}</p>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {badge}
      </span>
    </div>
    <div className="flex flex-1 flex-col p-3">
      <div className="h-56 shrink-0">{children}</div>
      <div className="mt-1 h-4 truncate text-center text-[10px] text-slate-400">{footer || ''}</div>
    </div>
  </div>
);

// ---------- Plotly styling ----------
const hexA = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const plotLayout = (extra = {}) => ({
  autosize: true,
  margin: { t: 8, r: 18, b: 28, l: 50 },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', size: 10, color: '#64748b' },
  showlegend: false,
  hoverlabel: { font: { size: 11 }, bgcolor: '#ffffff', bordercolor: '#cbd5e1' },
  ...extra,
});

const axisStyle = { gridcolor: 'rgba(148,163,184,0.2)', zeroline: false, tickfont: { size: 9.5 } };

const plotlyTraces = (c) => {
  switch (c.type) {
    case 'lollipop':
      return [{
        type: 'scatter',
        mode: 'lines+markers',
        x: c.vals,
        y: c.cats,
        line: { color: '#cbd5e1', width: 2 },
        marker: {
          size: 13,
          color: c.vals,
          colorscale: SEQ_SCALE,
          cmin: Math.min(...c.vals),
          cmax: Math.max(...c.vals),
          line: { color: '#ffffff', width: 1 },
        },
        hovertemplate: '%{y}: %{x:,}<extra></extra>',
      }];
    case 'histDensity': {
      const traces = [{
        type: 'histogram',
        x: c.nums,
        nbinsx: c.binCount,
        name: 'Count',
        marker: { color: '#93c5fd', opacity: 0.6, line: { color: '#60a5fa', width: 1 } },
        hovertemplate: '%{x} range<br>count %{y}<extra></extra>',
      }];
      if (c.kdeY.length) {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: c.kdeX,
          y: c.kdeY,
          name: 'Density',
          line: { shape: 'spline', color: '#7209b7', width: 2.5, smoothing: 0.85 },
          hovertemplate: '%{x:.2f}<br>density %{y:.2f}<extra></extra>',
        });
      }
      return traces;
    }
    case 'box':
      return c.datasets.map((d, i) => ({
        type: 'box',
        y: d.values,
        name: d.name,
        fillcolor: i % 2 ? 'rgba(76,201,240,0.28)' : 'rgba(67,97,238,0.18)',
        line: { color: CAT_PALETTE[i % CAT_PALETTE.length], width: 1.6 },
        whiskerwidth: 0.6,
        boxpoints: 'outliers',
        marker: { size: 3.5, color: '#f72585' },
        hoverinfo: 'y',
      }));
    case 'violin':
      return c.datasets.map((d) => ({
        type: 'violin',
        y: d.values,
        name: d.name,
        fillcolor: 'rgba(114,9,183,0.22)',
        line: { color: '#7209b7', width: 1.6 },
        box: { visible: true, width: 0.32 },
        meanline: { visible: true },
        points: false,
      }));
    case 'ridge':
      return c.groups.map((g, i) => ({
        type: 'violin',
        orientation: 'h',
        side: 'positive',
        width: 2.6,
        scalegroup: `ridge-${i}`,
        points: false,
        x: g.values,
        y: g.values.map(() => i),
        name: g.name,
        fillcolor: hexA(CAT_PALETTE[i % CAT_PALETTE.length], 0.35),
        line: { color: CAT_PALETTE[i % CAT_PALETTE.length], width: 1.4 },
        hovertemplate: '%{x:.2f}<extra></extra>',
      }));
    case 'heat':
      return [{
        type: 'heatmap',
        z: c.z,
        x: c.xlabels,
        y: c.ylabels,
        colorscale: DIV_SCALE,
        zmid: 0,
        xgap: 2,
        ygap: 2,
        colorbar: { thickness: 10, outlinewidth: 0, tickfont: { size: 8.5 }, len: 0.95 },
        hovertemplate: '%{y} × %{x}<br>r = %{z:.2f}<extra></extra>',
      }];
    case 'bubble':
      return [{
        type: 'scatter',
        mode: 'markers',
        x: c.x,
        y: c.y,
        customdata: c.size,
        marker: {
          size: c.size,
          sizemode: 'area',
          sizeref: (2 * Math.max(...c.size)) / 34 ** 2,
          sizemin: 3.5,
          color: c.size,
          colorscale: SEQ_SCALE,
          opacity: 0.78,
          line: { color: '#ffffff', width: 1 },
        },
        hovertemplate: `${c.labels[0]}: %{x:,}<br>${c.labels[1]}: %{y:,}<br>${c.labels[2]}: %{customdata:,}<extra></extra>`,
      }];
    default:
      return [];
  }
};

const plotLayoutFor = (c) => {
  switch (c.type) {
    case 'lollipop':
      return plotLayout({ margin: { t: 8, r: 26, b: 26, l: 130 }, xaxis: axisStyle, yaxis: { ...axisStyle, tickfont: { size: 9.5 } } });
    case 'histDensity':
      return plotLayout({ margin: { t: 8, r: 12, b: 30, l: 42 }, bargap: 0.02, xaxis: axisStyle, yaxis: axisStyle });
    case 'box':
      return plotLayout({
        margin: { t: 8, r: 12, b: 36, l: 38 },
        xaxis: { ...axisStyle, tickangle: -18, tickfont: { size: 8.5 }, automargin: true },
        yaxis: { ...axisStyle, tickfont: { size: 9 } },
      });
    case 'violin':
      return plotLayout({
        margin: { t: 8, r: 12, b: 36, l: 38 },
        xaxis: { ...axisStyle, tickangle: -18, tickfont: { size: 8.5 }, automargin: true },
        yaxis: { gridcolor: 'rgba(148,163,184,0.12)', zeroline: false, tickfont: { size: 9 } },
        violingap: 0.25,
      });
    case 'ridge':
      return plotLayout({
        margin: { t: 8, r: 16, b: 30, l: 118 },
        xaxis: axisStyle,
        yaxis: {
          autorange: 'reversed',
          tickvals: c.groups.map((_, i) => i),
          ticktext: c.groups.map((g) => g.name),
          tickfont: { size: 9.5 },
          showgrid: false,
          zeroline: false,
        },
        violingap: 0.08,
      });
    case 'heat':
      return plotLayout({
        margin: { t: 4, r: 2, b: 4, l: 2 },
        xaxis: { tickangle: -38, tickfont: { size: 8.5 }, automargin: true, showgrid: false },
        yaxis: { tickfont: { size: 8.5 }, automargin: true, showgrid: false },
      });
    case 'bubble':
      return plotLayout({ margin: { t: 8, r: 12, b: 32, l: 46 }, xaxis: axisStyle, yaxis: axisStyle });
    default:
      return plotLayout();
  }
};

const plotConfigFor = (c) => (c.type === 'bubble' ? { scrollZoom: true, displayModeBar: false } : {});

// ---------- Hand-rolled waffle design ----------
const WaffleGrid = ({ items, total }) => {
  const cells = [];
  items.forEach((it) => {
    for (let i = 0; i < Math.round(it.pct); i++) cells.push(it.color);
  });
  while (cells.length < 100) cells.push('#e2e8f0');
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="grid grid-cols-10 gap-[3px]">
        {cells.slice(0, 100).map((bg, i) => (
          <span key={i} className="aspect-square rounded-[3px]" style={{ background: bg }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((it) => (
          <span key={it.name} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
            {it.name} · {it.pct.toFixed(1)}%
          </span>
        ))}
      </div>
      <p className="sr-only">Total {total}</p>
    </div>
  );
};

const RechartsTile = ({ col, type, data, series, meta, total }) => {
  const rotate = data.length > 6;
  const hasCum = !series && type === 'bar' && data.length > 2 && data[0]?.cum !== undefined;
  const showCumAxis = hasCum || type === 'histogram';
  const gid = useMemo(() => `ag-${Math.random().toString(36).slice(2, 9)}`, []);

  const renderChart = () => {
    if (!data.length) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-[11px] text-slate-400">
          No data available for charting.
        </div>
      );
    }

    if (type === 'donut') {
      return (
        <div className="relative h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={82}
                paddingAngle={3}
                cornerRadius={6}
              >
                {data.map((entry, i) => (
                  <Cell key={`donut-${i}`} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} stroke="#ffffff" strokeWidth={1.5} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold text-slate-800">{Number(total ?? data.reduce((s, d) => s + (d.value || 0), 0)).toLocaleString()}</span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">total</span>
          </div>
        </div>
      );
    }

    if (type === 'rating') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 14, left: 0, bottom: 0 }} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 9.5 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={8} />
            {(series || []).map((s) => (
              <Bar key={s.key} dataKey={s.key} name={`Level ${s.name}`} stackId="rate" fill={s.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'groupMeans') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 14, left: 0, bottom: 0 }} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9.5 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={8} />
            {(series || []).map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[0, 3, 3, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 14, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" name={meta?.xLabel || 'X'} tick={{ fontSize: 9.5 }} />
            <YAxis dataKey="y" type="number" name={meta?.yLabel || 'Y'} tick={{ fontSize: 9.5 }} />
            <Tooltip content={<ChartTooltip />} />
            {meta?.trend && (
              <ReferenceLine
                segment={[{ x: meta.trend[0].x, y: meta.trend[0].y }, { x: meta.trend[1].x, y: meta.trend[1].y }]}
                stroke="#7209b7"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            )}
            <Scatter
              data={data}
              fill={hexA('#4361ee', 0.65)}
              stroke="#ffffff"
              strokeWidth={0.8}
              name={`${meta?.yLabel || 'Y'} vs ${meta?.xLabel || 'X'}`}
            />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'time') {
      const hasMA = data[0]?.ma !== undefined;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 14, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4361ee" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#4cc9f0" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9.5 }}
              interval="preserveStartEnd"
              angle={rotate ? -28 : 0}
              textAnchor={rotate ? 'end' : 'middle'}
              height={rotate ? 54 : 28}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 9.5 }} allowDecimals={false} />
            {hasMA && <YAxis yAxisId="right" orientation="right" hide />}
            <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={8} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="value"
              name="Count"
              stroke="#4361ee"
              strokeWidth={2}
              fill={`url(#${gid})`}
              dot={data.length <= 30 ? { r: 2.5 } : false}
              activeDot={{ r: 4 }}
            />
            {hasMA && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ma"
                name="Moving Avg"
                stroke="#f72585"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 14, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9.5 }}
            interval={type === 'histogram' ? 'preserveStartEnd' : 0}
            angle={rotate ? -28 : 0}
            textAnchor={rotate ? 'end' : 'middle'}
            height={rotate ? 58 : 28}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 9.5 }} allowDecimals={false} />
          {showCumAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              width={38}
              unit="%"
              tick={{ fontSize: 9 }}
            />
          )}
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} content={<ChartTooltip />} />
          {series || hasCum ? <Legend wrapperStyle={{ fontSize: 10.5 }} iconType="circle" iconSize={8} /> : null}
          {(series || [{ key: 'value', name: type === 'histogram' ? 'Frequency' : 'Count', color: type === 'histogram' ? '#8b5cf6' : '#3b82f6' }]).map((s) => (
            <Bar key={s.key} yAxisId="left" dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={40} />
          ))}
          {hasCum && (
            <Line
              yAxisId="right"
              dataKey="cum"
              name="Cumulative %"
              stroke="#0f172a"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={data.length <= 12 ? { r: 2 } : false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <TileShell
      col={col}
      badge={type === 'bar' ? (series ? 'Grouped Bars' : 'Bars + Cum %') : (AUTO_TILE_BADGE[type] || type)}
      footer={type === 'scatter' && meta ? `${meta.xLabel} vs ${meta.yLabel} · r = ${meta.r} · R² = ${meta.r2}` : ''}
    >
      {renderChart()}
    </TileShell>
  );
};

// ---------- Dispatcher: routes each tile to recharts / Plotly / custom design ----------
const RECHARTS_TYPES = new Set(['bar', 'histogram', 'donut', 'time', 'rating', 'groupMeans', 'scatter']);

const AutoChartTile = (props) => {
  const { type } = props;
  if (!RECHARTS_TYPES.has(type)) {
    if (!props.items && !props.cats && !props.datasets && !props.z && !props.x) {
      return (
        <TileShell col={props.col} badge={AUTO_TILE_BADGE[type] || type}>
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-[11px] text-slate-400">
            No data available for charting.
          </div>
        </TileShell>
      );
    }
    if (type === 'waffle') {
      return (
        <TileShell col={props.col} badge={AUTO_TILE_BADGE.waffle}>
          <WaffleGrid items={props.items} total={props.total} />
        </TileShell>
      );
    }
    return (
      <TileShell
        col={props.col}
        badge={AUTO_TILE_BADGE[type] || type}
        footer={
          type === 'bubble'
            ? `${props.labels[1]} vs ${props.labels[0]} · size: ${props.labels[2]}`
            : type === 'heat'
              ? 'Pearson r between numeric columns'
              : ''
        }
      >
        <PlotlyChart data={plotlyTraces(props)} layout={plotLayoutFor(props)} config={plotConfigFor(props)} />
      </TileShell>
    );
  }
  return <RechartsTile {...props} />;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== null && (
        <p className="mb-1 max-w-[220px] truncate font-semibold text-slate-700">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center justify-between gap-3 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.fill || '#94a3b8' }} />
            {entry.name || 'Value'}
          </span>
          <span className="font-semibold text-slate-800">
            {Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </p>
      ))}
    </div>
  );
};

const MLUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ML_API_URL = process.env.REACT_APP_ML_API_URL || 'http://localhost:8000';

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Treatment, outcome, and feature filter
  const [treatmentColumn, setTreatmentColumn] = useState('');
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [includeFeatures, setIncludeFeatures] = useState('');

  // Save Results modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const scrollPositionRef = useRef(0);
  const [tablePage, setTablePage] = useState(0);
  const tableRef = useRef(null);
  const ROWS_PER_PAGE = 100;

  // ---------- NEW: Geo Map + Auto Charts state ----------
  const [mapType, setMapType] = useState('All');
  const [mapFocus, setMapFocus] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  // ---------- File handling (unchanged) ----------
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) validateAndProcessFile(selectedFile);
  };

  const validateAndProcessFile = (file) => {
    setError(null);
    if (!file || typeof file !== 'object') { setError('Invalid file selected'); return; }
    if (!file.name || file.name.trim() === '') { setError('File name is required'); return; }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { setError(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`); return; }
    if (file.size === 0) { setError('File is empty'); return; }
    const fileName = file.name.toLowerCase().trim();
    const isCSV = fileName.endsWith('.csv');
    const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    if (!isCSV && !isXLSX) { setError(`Unsupported file type. Only CSV and XLSX files are supported`); return; }
    setFile(file);
    setShowPreview(false);
    try {
      if (isCSV) parseCSV(file);
      else parseXLSX(file);
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error(err);
    }
  };

  const parseCSV = (file) => {
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (!text.trim()) { setError('CSV file is empty'); setIsLoading(false); return; }
        const rows = parseCSVRows(text);
        if (rows.length === 0) { setError('No valid data found'); setIsLoading(false); return; }
        const headers = rows[0].map(header => header.trim()).filter(header => header.length > 0);
        if (headers.length === 0) { setError('No valid column headers'); setIsLoading(false); return; }
        setColumns(headers);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setTablePage(0);
        const data = rows.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] || '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value.trim()));
        setCsvData(data);
        setShowPreview(true);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to parse CSV');
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setError('Failed to read file'); setIsLoading(false); };
    reader.readAsText(file);
  };

  const parseXLSX = (file) => {
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xlsxData = new Uint8Array(e.target.result);
        const workbook = XLSX.read(xlsxData, { type: 'array', cellDates: false, cellStyles: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
        if (!jsonData || jsonData.length === 0) { setError('XLSX is empty'); setIsLoading(false); return; }
        const firstRow = jsonData[0];
        const headers = Object.keys(firstRow).map(key =>
          firstRow[key] !== undefined && firstRow[key] !== null
            ? firstRow[key].toString().trim()
            : ''
        ).filter(header => header.length > 0);
        if (headers.length === 0) { setError('No valid headers'); setIsLoading(false); return; }
        setColumns(headers);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setTablePage(0);
        const processedData = jsonData.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, headerIndex) => {
            const cellValue = row[headerIndex];
            rowObj[header] = cellValue !== undefined && cellValue !== null
              ? cellValue.toString()
              : '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value && value.toString().trim()));
        setCsvData(processedData);
        setShowPreview(true);
        setIsLoading(false);
      } catch (err) {
        setError(`Failed to parse XLSX: ${err.message}`);
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setError('Failed to read XLSX'); setIsLoading(false); };
    reader.readAsArrayBuffer(file);
  };

  const parseCSVRows = (text) => {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') { currentField += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField.trim() || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) rows.push(currentRow);
    }
    return rows;
  };

  // Drag and drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndProcessFile(droppedFile);
  };

  // Scroll helpers
  const handleScrollLeft = () => {
    if (tableRef.current) {
      const newScrollPosition = Math.max(0, scrollPositionRef.current - 200);
      tableRef.current.scrollLeft = newScrollPosition;
      scrollPositionRef.current = newScrollPosition;
    }
  };
  const handleScrollRight = () => {
    if (tableRef.current) {
      const maxScroll = tableRef.current.scrollWidth - tableRef.current.clientWidth;
      const newScrollPosition = Math.min(maxScroll, scrollPositionRef.current + 200);
      tableRef.current.scrollLeft = newScrollPosition;
      scrollPositionRef.current = newScrollPosition;
    }
  };
  const handleTableScroll = useCallback((e) => {
    scrollPositionRef.current = e.target.scrollLeft;
  }, []);
  const getScrollPercentage = () => {
    if (!tableRef.current) return 0;
    const maxScroll = tableRef.current.scrollWidth - tableRef.current.clientWidth;
    if (maxScroll <= 0) return 0;
    return Math.round((scrollPositionRef.current / maxScroll) * 100);
  };

  // ---------- Convert XLSX to CSV for backend ----------
  const convertXLSXtoCSV = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(firstSheet);
          resolve(csv);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // ---------- Analyze: call /train ----------
  const handleAnalyze = async () => {
    if (csvData.length === 0) {
      setError('No data available to analyze');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setShowPreview(true);
    setUploadProgress(10);

    try {
      let fileToSend = file;
      if (file && file.name.toLowerCase().endsWith('.xlsx')) {
        const csvString = await convertXLSXtoCSV(file);
        const blob = new Blob([csvString], { type: 'text/csv' });
        fileToSend = new File([blob], file.name.replace(/\.xlsx$/i, '.csv'), { type: 'text/csv' });
      }

      const formData = new FormData();
      formData.append('file', fileToSend);
      if (treatmentColumn) formData.append('treatment_column', treatmentColumn);
      if (outcomeColumn) formData.append('outcome_column', outcomeColumn);
      if (includeFeatures.trim()) formData.append('include_features', includeFeatures.trim());

      setUploadProgress(30);
      const endpoint = `${ML_API_URL.replace(/\/$/, '')}/train`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setUploadProgress(80);

      if (!response.ok) {
        let errorMsg = `Server returned ${response.status}`;
        try {
          const errorJson = await response.json();
          if (errorJson.error) errorMsg = errorJson.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const result = await response.json();
      setAnalysisResults(result);
      // Auto‑switch to the "impact" tab if profiling data exists, else summary
      if (result.profile_updates && result.profile_updates.length > 0) {
        setActiveTab('impact');
      } else {
        setActiveTab('summary');
      }
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Training may be taking too long.');
      } else {
        setError(`Analysis failed: ${err.message || 'Unknown error'}`);
      }
      setUploadProgress(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ---------- Chart Data Preparation (same as before) ----------
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
      count
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

  // ---------- NEW: Geo Map data (auto-detect geographic columns) ----------
  const geo = useMemo(() => {
    const emptySummary = { municipalities: 0, regions: 0 };
    if (!columns.length || !csvData.length) {
      return { status: 'no-data', points: [], summary: emptySummary };
    }
    const cols = detectGeoColumns(columns);
    if (!cols.areaCol && !cols.provinceCol && !cols.regionCol && !cols.latCol) {
      return { status: 'none-detected', points: [], summary: emptySummary };
    }
    const groupCol = analysisResults?.treatment_column || treatmentColumn || '';
    const treatedRe = /^(1|yes|y|true|treated|beneficiar)/i;
    const groups = new Map();
    let validRows = 0;
    csvData.forEach((row) => {
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
  }, [columns, csvData, treatmentColumn, analysisResults]);

  const geoTopLocations = useMemo(
    () => [...geo.points].sort((a, b) => b.total - a.total).slice(0, 7),
    [geo.points],
  );

  // ---------- NEW: Auto Charts data (all charts generated at once) ----------
  const columnProfiles = useMemo(() => profileColumnsForCharts(columns, csvData), [columns, csvData]);

  const autoCharts = useMemo(() => {
    if (!csvData.length) return { charts: [], total: 0 };
    const groupCol = analysisResults?.treatment_column || treatmentColumn || '';
    const profiles = columnProfiles.filter((p) => p.kind !== 'text');
    const catProfiles = profiles.filter((p) => p.kind === 'categorical');
    const numProfiles = profiles.filter((p) => p.kind === 'numeric');
    const timeProfiles = profiles.filter((p) => p.kind === 'time');
    const ratingProfiles = profiles.filter((p) => p.kind === 'rating');
    const smallCats = catProfiles.filter((p) => (p.uniqCount ?? 99) <= 5);
    const bigCats = catProfiles.filter((p) => (p.uniqCount ?? 0) >= 6);

    const charts = [];
    const push = (t) => {
      if (t && charts.length < 16 && !charts.some((x) => x.type === t.type && x.col === t.col)) charts.push(t);
    };

    // Proportions & rankings
    push(buildWaffleChart(catProfiles, csvData));
    if (smallCats[0] || catProfiles[0]) push(buildDonutChart(smallCats[0] || catProfiles[0], csvData));
    push(buildLollipopChart(bigCats[0] || catProfiles[catProfiles.length - 1], csvData));

    // Distribution shapes
    push(buildHistKdeChart(numProfiles[0], csvData));
    push(buildBoxChart(numProfiles, csvData));
    push(buildViolinChart(numProfiles, csvData));
    push(buildRidgelineChart(catProfiles, numProfiles[0], csvData));

    // Per-column classics (mixed designs)
    catProfiles.slice(0, 2).forEach((p) => push({ ...buildAutoChart(p, csvData, groupCol), col: p.col, kind: p.kind }));
    numProfiles.slice(1, 3).forEach((p) => push({ ...buildAutoChart(p, csvData, groupCol), col: p.col, kind: p.kind }));
    timeProfiles.slice(0, 1).forEach((p) => push({ ...buildAutoChart(p, csvData, groupCol), col: p.col, kind: p.kind }));

    // Relationships & aggregates
    push(buildBubbleChart(numProfiles.slice(0, 5), csvData));
    push(buildCorrelationChart(numProfiles.slice(0, 10), csvData));
    push(buildHeatmapChart(numProfiles.slice(0, 8), csvData));
    push(buildRatingChart(ratingProfiles, csvData));
    push(buildGroupMeansChart(numProfiles.slice(0, 8), csvData, groupCol));

    return { charts: charts.filter(Boolean).slice(0, 16), total: profiles.length };
  }, [columnProfiles, csvData, analysisResults, treatmentColumn]);

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

  // ---------- Render Summary (unchanged) ----------
  const renderSummary = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
    const { rows, treatment_column, treatment_detection_method, retrained, retrain_attempts, feature_selection } = analysisResults;
    const topFeatures = feature_selection?.selected || [];
    const importanceData = prepareFeatureImportance(topFeatures);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Rows</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{rows}</p>
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
                  <BarChart data={importanceData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 'dataMax + 0.05']} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-md">
                              <p className="font-medium text-slate-900">{data.fullName || data.name}</p>
                              <p className="text-slate-600">Importance: {data.importance.toFixed(4)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="importance" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- Render Output (unchanged) ----------
  const renderOutput = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
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
                  <BarChart data={psData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {psData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index < psData.length / 2 ? '#60a5fa' : '#a78bfa'} />
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

  // ---------- Render Metrics (unchanged) ----------
  const renderMetrics = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
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
                      <BarChart data={smdData} layout="vertical" margin={{ left: 80, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 'dataMax + 0.2']} />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-md">
                                  <p className="font-medium text-slate-900">{data.fullName || data.name}</p>
                                  <p className="text-slate-600">Before: {data.before.toFixed(4)}</p>
                                  <p className="text-slate-600">After: {data.after.toFixed(4)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar dataKey="before" fill="#f87171" name="Before" />
                        <Bar dataKey="after" fill="#34d399" name="After" />
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

  // ---------- NEW: Render Impact (ATT + Profiling) ----------
  const renderImpact = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
    const { att_result, profiling_summary, profile_updates, pair_profiles } = analysisResults;

    // Helper to compute percentages
    const calcPct = (count, total) => total > 0 ? (count / total * 100).toFixed(1) : 0;

    return (
      <div className="space-y-6">
        {/* ATT Result Card */}
        {att_result && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Average Treatment Effect on the Treated (ATT)</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Mean ATT</p>
                  <p className="mt-0.5 text-2xl font-bold text-blue-600">{att_result.att_mean?.toFixed(4)}</p>
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
                <BarChart2 className="h-4 w-4 text-cyan-600" />
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
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-blue-600">
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

  // ---------- Save Results (localStorage) ----------
  const handleSaveResults = () => {
    if (!analysisResults) return;
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
    if (!analysisResults) return;
    const blob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Form import (unchanged) ----------
  const handleImportForm = () => {
    if (csvData.length === 0 || columns.length === 0) {
      setError('No data available to import');
      return;
    }
    setError(null);
    try {
      const isSurveyData = detectSurveyData();
      let formFields;
      let formTitle;
      let formDescription;

      if (isSurveyData) {
        formFields = createSurveyFormFields();
        formTitle = `Survey Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/, '') || 'Survey Data'}`;
        formDescription = `Survey questionnaire created from ${file?.name} with ${columns.length} questions and ${csvData.length} responses`;
      } else {
        formFields = columns.map((column, index) => ({
          id: `field_${index}`,
          type: 'text',
          label: column,
          required: false,
          placeholder: `Enter ${column}`
        }));
        formTitle = `Imported Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/, '') || 'Data'}`;
        formDescription = `Form created from ${file?.name} import with ${columns.length} fields and ${csvData.length} data rows`;
      }

      const formData = {
        title: formTitle,
        description: formDescription,
        fields: formFields,
        isSurvey: isSurveyData,
        sourceFile: file?.name,
        importType: file?.name?.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX',
        importedAt: new Date().toISOString()
      };

      navigate('/forms/new', { state: { importedData: formData }, replace: true });
    } catch (err) {
      console.error('Form import error:', err);
      setError(`Failed to create form: ${err.message || 'Unknown error occurred'}`);
    }
  };

  // ---------- Survey detection functions (unchanged) ----------
  const detectSurveyData = () => {
    if (csvData.length === 0 || columns.length === 0) return false;
    const surveyKeywords = [
      'question', 'answer', 'response', 'option', 'choice', 'rating', 'score',
      'satisfaction', 'feedback', 'comment', 'agree', 'disagree', 'strongly',
      'scale', 'range', 'multiple', 'single', 'yes', 'no', 'true', 'false',
      'likert', 'satisfied', 'dissatisfied', 'excellent', 'poor',
      'recommend', 'important', 'priority', 'frequency', 'always', 'never',
      'survey', 'poll', 'quiz', 'test', 'assessment'
    ];
    const columnNames = columns.map(col => col.toLowerCase());
    const hasSurveyKeywords = columnNames.some(col =>
      surveyKeywords.some(keyword => col.includes(keyword))
    );
    let surveyScore = 0;
    let maxScore = 0;
    const questionPatterns = columns.filter(col =>
      /q\d+|question|ques|what|when|how|why|which|where|who/.test(col.toLowerCase())
    );
    if (questionPatterns.length > 0) surveyScore += 2;
    maxScore += 2;
    const answerPatterns = columns.filter(col =>
      /answer|response|reply|feedback|comment|note/.test(col.toLowerCase())
    );
    if (answerPatterns.length > 0) surveyScore += 2;
    maxScore += 2;
    const limitedOptionsCount = columns.filter(col => {
      const uniqueValues = [...new Set(csvData.map(row => row[col]))].filter(val => val);
      return uniqueValues.length >= 2 && uniqueValues.length <= 8;
    }).length;
    if (limitedOptionsCount > 0) surveyScore += 1;
    maxScore += 1;
    const ratingScales = columns.filter(col => {
      const values = csvData.map(row => row[col]).filter(val => val);
      const numericValues = values.filter(val => !isNaN(val) && val !== '');
      return numericValues.length >= 3 &&
        Math.max(...numericValues) <= 10 &&
        Math.min(...numericValues) >= 1;
    }).length;
    if (ratingScales > 0) surveyScore += 1;
    maxScore += 1;
    const booleanColumns = columns.filter(col => {
      const uniqueValues = [...new Set(csvData.map(row => row[col]))].filter(val => val);
      const booleanValues = ['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'];
      return uniqueValues.length === 2 &&
        uniqueValues.every(val => booleanValues.includes(val.toString().toLowerCase()));
    }).length;
    if (booleanColumns > 0) surveyScore += 1;
    maxScore += 1;
    const confidence = maxScore > 0 ? (surveyScore / maxScore) : 0;
    return confidence >= 0.3;
  };

  const createSurveyFormFields = () => {
    return columns.map((column, index) => {
      const columnName = column.toLowerCase();
      const uniqueValues = [...new Set(csvData.map(row => row[column]))].filter(val => val);
      let fieldType = 'text';
      let options = [];
      if (uniqueValues.length === 2 &&
          uniqueValues.some(val => ['yes', 'no', 'true', 'false', '1', '0'].includes(val.toLowerCase()))) {
        fieldType = 'radio';
        options = uniqueValues;
      }
      else if (uniqueValues.length >= 3 && uniqueValues.length <= 10) {
        fieldType = 'select';
        options = uniqueValues;
      }
      else if (uniqueValues.some(val => !isNaN(val)) &&
               uniqueValues.some(val => Number(val) >= 1) &&
               uniqueValues.some(val => Number(val) <= 10)) {
        fieldType = 'radio';
        options = uniqueValues.filter(val => !isNaN(val)).sort((a, b) => Number(a) - Number(b));
      }
      else if (uniqueValues.some(val => val.length > 50)) {
        fieldType = 'textarea';
      }
      return {
        id: `field_${index}`,
        type: fieldType,
        label: column,
        required: columnName.includes('required') || columnName.includes('mandatory'),
        placeholder: `Enter ${column}`,
        options: options.length > 0 ? options : undefined
      };
    });
  };

  const handleBackToDashboard = () => navigate('/dashboard');

  // ---------- Main render ----------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-3 pb-24 pt-0 sm:px-4">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="gap-1.5 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <h1 className="text-sm font-semibold text-slate-900 sm:text-base">ML Data Upload</h1>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden border-slate-200 text-[10px] text-slate-400 sm:inline-flex">
                PSM · SES Impact
              </Badge>
            </div>
          </div>
        </header>

        {/* How it works - only show when no file is uploaded */}
        {!file && !isLoading && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-300">How it works</p>
              <h2 className="mb-6 text-2xl font-bold">ML Analysis Pipeline</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-blue-300">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">1. Upload</h4>
                    <p className="text-sm text-blue-200">Drag & drop your CSV or XLSX file</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-indigo-300">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">2. Configure</h4>
                    <p className="text-sm text-blue-200">Select treatment, outcome & feature filter</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-emerald-300">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">3. Analyze</h4>
                    <p className="text-sm text-blue-200">Get PS scores, balance, SHAP & impact</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-purple-300">
                    <Save className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">4. Save</h4>
                    <p className="text-sm text-blue-200">Store or download results for later</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* File Upload Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Import File</h2>
                <p className="text-xs text-slate-500">Upload CSV or XLSX to prepare the analysis</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                <p className="text-sm text-red-800 flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Drag & Drop */}
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 relative ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70 shadow-lg scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
              } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-slate-600">Processing file...</p>
                  </div>
                </div>
              )}
              <div className="space-y-5">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                  file ? 'bg-emerald-100' : 'bg-blue-100'
                }`}>
                  {file ? (
                    <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                  ) : (
                    <Upload className="w-10 h-10 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-slate-700 font-medium text-lg mb-1">
                    {file ? file.name : 'Drop your CSV or XLSX file here'}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {file
                      ? `Size: ${(file.size / 1024).toFixed(2)} KB`
                      : 'or click to browse (max 10MB)'
                    }
                  </p>
                </div>
                <div className="flex justify-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant={file ? "outline" : "default"}
                    className={`${file ? 'bg-white hover:bg-slate-50 border-slate-300' : 'bg-blue-600 hover:bg-blue-700 text-white'} shadow-sm transition-all`}
                    disabled={isLoading}
                  >
                    {file ? 'Change File' : <><Upload className="w-4 h-4 mr-2" /> Choose File</>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Configuration options */}
            {columns.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Group / Treatment Column
                  </Label>
                  <Select value={treatmentColumn} onValueChange={setTreatmentColumn}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col} className="text-sm">{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Outcome Column
                  </Label>
                  <Select value={outcomeColumn} onValueChange={setOutcomeColumn}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col} className="text-sm">{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Include Features
                  </Label>
                  <Input
                    value={includeFeatures}
                    onChange={(e) => setIncludeFeatures(e.target.value)}
                    placeholder="B3:AGE, B5:SEX, ..."
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Preview */}
        {csvData.length > 0 && showPreview && (() => {
          const totalPages = Math.ceil(csvData.length / ROWS_PER_PAGE);
          const pageData = csvData.slice(tablePage * ROWS_PER_PAGE, (tablePage + 1) * ROWS_PER_PAGE);
          return (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Data Preview</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {csvData.length.toLocaleString()} rows × {columns.length} cols
                </span>
              </div>
              {columns.length > 6 && (
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleScrollLeft}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[60px] text-center text-xs text-slate-500">{getScrollPercentage()}%</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleScrollRight}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <div className="max-h-96 overflow-y-auto" ref={tableRef} onScroll={handleTableScroll}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-20 bg-slate-50">
                    <tr>
                      {columns.map((column, index) => (
                        <th key={index} className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pageData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="transition-colors hover:bg-slate-50/50">
                        {columns.map((column, colIndex) => (
                          <td key={colIndex} className="whitespace-nowrap px-6 py-3 text-sm text-slate-600">
                            {row[column] || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                <p className="text-xs text-slate-500">
                  Showing {(tablePage * ROWS_PER_PAGE + 1).toLocaleString()}–{Math.min((tablePage + 1) * ROWS_PER_PAGE, csvData.length).toLocaleString()} of {csvData.length.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-slate-600">{tablePage + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))} disabled={tablePage >= totalPages - 1}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Empty state – only if no file */}
        {!file && !isLoading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Database className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No file uploaded yet</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Upload a CSV or XLSX file to begin propensity-score matching analysis.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {csvData.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleImportForm}
              variant="outline"
              className="gap-2 border-slate-200 text-sm"
            >
              <Import className="h-4 w-4" /> Create Form from CSV
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="gap-2 bg-blue-600 text-sm shadow-sm hover:bg-blue-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" /> Analyze Data
                </>
              )}
            </Button>
          </div>
        )}

        {/* Progress bar */}
        {isAnalyzing && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="w-full">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-slate-500 mt-1 text-center">Training in progress… {uploadProgress}%</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResults && (
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
        )}

        {/* NEW SECTION: 📍 Geo Map */}
        {analysisResults && (
          csvData.length === 0 ? (
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
          )
        )}

        {/* NEW SECTION: 📊 Auto Charts */}
        {analysisResults && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <PieIcon className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-slate-900">📊 Auto Charts</h3>
                {autoCharts.charts.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                    {autoCharts.charts.length} chart{autoCharts.charts.length === 1 ? '' : 's'} auto-generated
                    {autoCharts.total > 0 ? ` · from ${autoCharts.total} data column${autoCharts.total === 1 ? '' : 's'}` : ''}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Diverse auto-designed views: waffle · donut (total in ring) · lollipop · histogram + KDE curve · box plot · violin · ridgeline · smooth gradient area · bubble · scatter + trend line (R²) · correlation heatmap · stacked ratings · group means
              </p>
            </div>
            <div className="p-4 sm:p-6">
              {!csvData.length || autoCharts.charts.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-400">
                  No data available for charting.
                </div>
              ) : (
                <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                  {autoCharts.charts.map((c) => (
                    <AutoChartTile key={`${c.type}-${c.col}`} {...c} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* NEW: Expanded Geo Map overlay */}
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
                  placeholder="e.g., Baseline Analysis 2026"
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
    </div>
  );
};

export default MLUpload;