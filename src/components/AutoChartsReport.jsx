// src/components/AutoChartsReport.jsx
// ============================================================
// AUTO-CHARTS REPORT (No-Baseline)
// Auto-generates one chart tile per column found in the combined
// Beneficiary / Non-Beneficiary dataset shown in the data preview.
// Columns are classified by their values (numeric → histogram,
// low-cardinality category → donut, otherwise top-N bar). Charts
// with no data are hidden completely. The geographic Leaflet map
// is intentionally excluded from this section.
// ============================================================

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  BarChart3,
  PieChart as PieIcon,
} from 'lucide-react';
import { parseNumericValue } from '../lib/respondentAnalytics';
import {
  PALETTE,
  SERIES,
  GROUP,
  TICK,
  AXIS_LABEL,
  GRID,
  TOOLTIP_STYLE,
  TOOLTIP_LABEL,
  TOOLTIP_ITEM,
  CURSOR,
} from '../lib/chartTheme';

const SERIES_COLORS = SERIES;

const HIST_BINS = 10;
const DONUT_MAX = 6;
const BAR_MAX = 10;
const MIN_PRESENT = 2;
const MAX_CHARTS = 8;

const SKIP_HEADER =
  /submit|timestamp|created|updated|_id$|\bid$|profile|photo|image|signature|sequence|seq\b|rowid|uuid/;

const IMPORTANT_HEADER =
  /age|income|ses|household|education|marital|status|benef|score|propensity|municipal|expend/;

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const labelOf = (h) => {
  const parts = String(h ?? '').split(':');
  return parts.length > 1 ? parts.slice(1).join(':').trim() : String(h ?? '');
};

const shortLabel = (h) => {
  const base = labelOf(h);
  return base.length > 30 ? `${base.slice(0, 29)}…` : base;
};

const presentValues = (rows, col) =>
  rows.map((r) => String(r[col] ?? '').trim()).filter((v) => v !== '');

const classify = (rows, col) => {
  const present = presentValues(rows, col);
  if (present.length < MIN_PRESENT) return null;

  const longText = present.filter((v) => v.length > 60).length / present.length;
  if (longText > 0.5) return null;

  const numeric = present.filter((v) => parseNumericValue(v) !== null).length / present.length;
  const uniqCount = new Set(present.map((v) => v.toLowerCase())).size;

  if (numeric >= 0.8) {
    const parsed = present.map((v) => parseNumericValue(v)).filter((x) => x !== null && Number.isFinite(x));
    if (parsed.length < MIN_PRESENT) return null;
    const uniqNumeric = new Set(parsed.map((x) => Math.round(x * 1000))).size;
    if (uniqNumeric < 2) return null;
    const min = Math.min(...parsed);
    const max = Math.max(...parsed);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
    return { kind: 'numeric', min, max, parsed };
  }

  if (uniqCount <= DONUT_MAX) {
    const counts = new Map();
    present.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    return { kind: 'donut', counts: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]) };
  }

  const counts = new Map();
  present.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return { kind: 'bar', counts: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, BAR_MAX) };
};

const countTooltip = (value) => Number(value).toLocaleString();

const ChartCard = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="truncate text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
    <div className="flex flex-1 items-stretch p-4">{children}</div>
  </div>
);

const AutoChartsReport = ({ columns = [], rows = [] }) => {
  const ctx = useMemo(() => {
    const list = Array.isArray(columns) ? columns : [];
    const data = Array.isArray(rows) ? rows : [];

    const statusCol = list.find((c) => norm(c) === 'status' || norm(labelOf(c)) === 'status') || '';
    const isBene = (r) => (statusCol ? /^benef/.test(String(r[statusCol] ?? '').toLowerCase()) : null);

    const charts = list
      .map((col) => {
        const ncol = norm(col);
        const nlabel = norm(labelOf(col));
        if (SKIP_HEADER.test(ncol) || SKIP_HEADER.test(nlabel)) return null;
        const cls = classify(data, col);
        if (!cls) return null;

        const isStatus = ncol === 'status' || nlabel === 'status';
        const coverage = data.length ? presentValues(data, col).length / data.length : 0;
        const kw = IMPORTANT_HEADER.test(nlabel) ? 2 : 0;
        const kindBase = cls.kind === 'donut' ? 5 : cls.kind === 'numeric' ? 4 : 3;
        const priority = kindBase + (isStatus ? 6 : 0) + kw + coverage * 2;

        if (cls.kind === 'numeric') {
          const { min, max } = cls;
          const step = (max - min) / HIST_BINS;
          const bins = Array.from({ length: HIST_BINS }, () => ({ Beneficiary: 0, 'Non-Beneficiary': 0, All: 0 }));

          data.forEach((r) => {
            const v = parseNumericValue(r[col]);
            if (v === null || v === undefined || !Number.isFinite(v)) return;
            const idx = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((v - min) / step)));
            bins[idx].All += 1;
            const bene = isBene(r);
            if (bene === true) bins[idx].Beneficiary += 1;
            else if (bene === false) bins[idx]['Non-Beneficiary'] += 1;
          });

          const dataBins = bins.map((b, i) => ({
            name: `${(min + step * i).toLocaleString(undefined, { maximumFractionDigits: 1 })}–${(min + step * (i + 1)).toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
            Beneficiary: b.Beneficiary,
            'Non-Beneficiary': b['Non-Beneficiary'],
            All: b.All,
          }));

          const hasAny = dataBins.some((b) => b.Beneficiary > 0 || b['Non-Beneficiary'] > 0 || b.All > 0);
          if (!hasAny) return null;

          return {
            col,
            title: shortLabel(col),
            subtitle: `${col} · numeric (${HIST_BINS} bins)`,
            kind: 'numeric',
            priority,
            seriesKeys: statusCol !== '' ? ['Beneficiary', 'Non-Beneficiary'] : ['All'],
            data: dataBins,
          };
        }

        if (cls.kind === 'donut') {
          return {
            col,
            title: shortLabel(col),
            subtitle: `${col} · ${cls.counts.length} values`,
            kind: 'donut',
            priority,
            data: cls.counts.map(([name, value], i) => ({ name, value, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
          };
        }

        return {
          col,
          title: shortLabel(col),
          subtitle: `${col} · top ${cls.counts.length} values`,
          kind: 'bar',
          priority,
          data: cls.counts.map(([name, value]) => ({ name, value })),
        };
      })
      .filter(Boolean);

    const topCharts = charts.sort((a, b) => b.priority - a.priority).slice(0, MAX_CHARTS);

    return {
      charts: topCharts,
      rowCount: data.length,
      colCount: list.length,
    };
  }, [columns, rows]);

  const iconFor = (kind) => (kind === 'donut' ? PieIcon : kind === 'bar' ? BarChart3 : Activity);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Auto Charts</h2>
        <p className="text-sm text-slate-500">
          Top {ctx.charts.length} most important · generated from the data preview — {ctx.rowCount.toLocaleString()} rows ×{' '}
          {ctx.colCount.toLocaleString()} columns.
        </p>
      </div>

      {ctx.charts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ctx.charts.map((ch) => (
            <ChartCard key={ch.col} icon={iconFor(ch.kind)} title={ch.title} subtitle={ch.subtitle}>
              {ch.kind === 'donut' && (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={ch.data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="48%"
                      outerRadius="74%"
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                    >
                      {ch.data.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={countTooltip}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      itemStyle={TOOLTIP_ITEM}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10.5, fontFamily: 'inherit' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {ch.kind === 'bar' && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ch.data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid {...GRID} horizontal={false} vertical={true} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={TICK}
                      label={{ value: 'Respondents', ...AXIS_LABEL, position: 'insideRight' }}
                    />
                    <YAxis type="category" dataKey="name" width={92} tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={countTooltip}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      itemStyle={TOOLTIP_ITEM}
                      cursor={CURSOR}
                    />
                    <Bar dataKey="value" name="Respondents" fill={PALETTE.primary} radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {ch.kind === 'numeric' && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ch.data} margin={{ top: 8, right: 4, left: -6, bottom: 4 }} barGap={2}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ ...TICK, fontSize: 9 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={48}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Value range', ...AXIS_LABEL, position: 'insideBottom', dy: 40 }}
                    />
                    <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={countTooltip}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      itemStyle={TOOLTIP_ITEM}
                      cursor={CURSOR}
                    />
                    <Legend
                      verticalAlign="top"
                      height={24}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10.5, fontFamily: 'inherit' }}
                    />
                    {ch.seriesKeys.map((key) =>
                      key === 'Beneficiary' ? (
                        <Bar key={key} dataKey={key} fill={GROUP.Beneficiary} radius={[3, 3, 0, 0]} maxBarSize={20} />
                      ) : key === 'Non-Beneficiary' ? (
                        <Bar key={key} dataKey={key} fill={GROUP['Non-Beneficiary']} radius={[3, 3, 0, 0]} maxBarSize={20} />
                      ) : (
                        <Bar key={key} dataKey={key} fill={PALETTE.primary} radius={[3, 3, 0, 0]} maxBarSize={20} />
                      ),
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <p className="text-sm text-slate-500">No analyzable columns in the combined dataset.</p>
        </div>
      )}
    </div>
  );
};

export default AutoChartsReport;