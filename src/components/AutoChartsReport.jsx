// src/components/AutoChartsReport.jsx
// ============================================================
// AUTO-CHARTS REPORT
// Auto-generates one chart tile per important column of the dataset.
// Columns are classified by their values:
//   - coded answers (few whole-number values, e.g. 1-5)  -> one bar per code
//   - continuous numbers                                  -> histogram (long
//     tails fold into a final "≥ p95" bin so the bulk stays readable)
//   - low-cardinality text                                -> donut, or grouped
//     bars when comparing groups
//   - other text                                          -> top-N bars
// When the data has a treatment / beneficiary column, every chart compares
// the two groups as a % of each group (the groups differ in size), with the
// counts in the tooltip. Charts with no data are hidden.
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
import { Activity, BarChart3, Hash, PieChart as PieIcon } from 'lucide-react';
import { parseNumericValue } from '../lib/respondentAnalytics';
import {
  PALETTE,
  SERIES,
  GROUP,
  TICK,
  AXIS_LABEL,
  TOOLTIP_STYLE,
  TOOLTIP_LABEL,
  TOOLTIP_ITEM,
  CURSOR,
} from '../lib/chartTheme';

const HIST_BINS = 10;
const DONUT_MAX = 6;
const BAR_MAX = 10;
const CODE_MAX = 12; // at most this many whole-number values = coded answers
const MIN_PRESENT = 2;
const MAX_CHARTS = 8;

// Solid hairline grid (dashed rules read as thresholds).
const GRID_LINE = { stroke: '#eef2f7' };
const SMALL_TICK = { ...TICK, fontSize: 10 };

const SKIP_HEADER =
  /submit|timestamp|created|updated|_id$|\bid$|profile|photo|image|signature|sequence|seq\b|rowid|uuid/;

const IMPORTANT_HEADER =
  /age|income|ses|household|education|marital|status|benef|score|propensity|municipal|expend/;

const NO_VALUES = new Set(['', '0', 'no', 'false', 'none', 'n/a', 'na', 'wala', 'hindi']);

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

const compact = (n) =>
  Number(n).toLocaleString(undefined, { notation: Math.abs(n) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 });

const pct = (part, whole) => (whole ? (part / whole) * 100 : 0);
const fmtPct = (p) => `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

const presentValues = (rows, col) =>
  rows.map((r) => String(r[col] ?? '').trim()).filter((v) => v !== '');

// Which column splits respondents into two groups, and how to name them.
const findGrouping = (columns, rows, treatmentColumn) => {
  const statusCol = columns.find((c) => norm(c) === 'status' || norm(labelOf(c)) === 'status');
  if (statusCol) {
    return {
      col: statusCol,
      names: ['Beneficiary', 'Non-Beneficiary'],
      colors: [GROUP.Beneficiary, GROUP['Non-Beneficiary']],
      groupOf: (r) => (/^benef/.test(String(r[statusCol] ?? '').toLowerCase()) ? 0 : 1),
      description: 'Beneficiary vs Non-Beneficiary',
    };
  }
  if (treatmentColumn && columns.includes(treatmentColumn)) {
    // A treatment column may hold 1/0, Yes/No, or a value only for the treated
    // (e.g. the year a boat was received, blank otherwise).
    const groupOf = (r) => (NO_VALUES.has(String(r[treatmentColumn] ?? '').trim().toLowerCase()) ? 1 : 0);
    const sizes = [0, 0];
    rows.forEach((r) => { sizes[groupOf(r)] += 1; });
    if (!sizes[0] || !sizes[1]) return null;
    return {
      col: treatmentColumn,
      names: ['Treated', 'Comparison'],
      colors: [GROUP.Beneficiary, GROUP['Non-Beneficiary']],
      groupOf,
      description: `Treated (has ${shortLabel(treatmentColumn)}) vs Comparison`,
    };
  }
  return null;
};

const classify = (rows, col) => {
  const present = presentValues(rows, col);
  if (present.length < MIN_PRESENT) return null;

  const longText = present.filter((v) => v.length > 60).length / present.length;
  if (longText > 0.5) return null;

  const numericShare = present.filter((v) => parseNumericValue(v) !== null).length / present.length;
  const uniqCount = new Set(present.map((v) => v.toLowerCase())).size;

  if (numericShare >= 0.8) {
    const parsed = present.map((v) => parseNumericValue(v)).filter((x) => x !== null && Number.isFinite(x));
    if (parsed.length < MIN_PRESENT) return null;
    const distinct = [...new Set(parsed)].sort((a, b) => a - b);
    if (distinct.length < 2) return null;
    // Few whole numbers are answer codes (1 = ..., 2 = ...), not a scale to bin.
    if (distinct.length <= CODE_MAX && distinct.every((x) => Number.isInteger(x))) {
      return { kind: 'codes', codes: distinct };
    }
    return { kind: 'numeric', sorted: [...parsed].sort((a, b) => a - b) };
  }

  const counts = new Map();
  present.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (uniqCount <= DONUT_MAX) return { kind: 'donut', categories: ordered.map(([name]) => name) };
  return { kind: 'bar', categories: ordered.slice(0, BAR_MAX).map(([name]) => name) };
};

// Histogram edges; a long right tail folds into a final "≥ p95" bin.
const binEdges = (sorted) => {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95 = quantile(sorted, 0.95);
  const longTail = p95 > min && max - min > 3 * (p95 - min);
  const top = longTail ? p95 : max;
  const bins = longTail ? HIST_BINS - 1 : HIST_BINS;
  const step = (top - min) / bins;
  const edges = Array.from({ length: bins }, (_, i) => [min + step * i, min + step * (i + 1)]);
  const binOf = (v) => (longTail && v >= top ? bins : Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step))));
  const labels = edges.map(([a, b]) => `${compact(a)}–${compact(b)}`);
  if (longTail) labels.push(`≥ ${compact(top)}`);
  return { labels, binOf };
};

// Builds [{ name, <series>: value, <series>__n: count }] rows for a chart.
// With groups each series is the % of that group; without, the count.
const buildRows = (rows, col, keys, keyOf, grouping) => {
  const series = grouping ? grouping.names : ['Respondents'];
  const counts = keys.map(() => series.map(() => 0));
  const totals = series.map(() => 0);
  rows.forEach((r) => {
    const k = keyOf(r[col]);
    if (k === null || k === undefined || k < 0) return;
    const g = grouping ? grouping.groupOf(r) : 0;
    counts[k][g] += 1;
    totals[g] += 1;
  });
  const data = keys.map((name, i) => {
    const row = { name };
    series.forEach((s, g) => {
      row[s] = grouping ? pct(counts[i][g], totals[g]) : counts[i][g];
      row[`${s}__n`] = counts[i][g];
    });
    return row;
  });
  return { data, series, totals };
};

const summarizeNumbers = (rows, col, grouping) => {
  const valuesFor = (g) => rows
    .filter((r) => !grouping || grouping.groupOf(r) === g)
    .map((r) => parseNumericValue(r[col]))
    .filter((x) => x !== null && Number.isFinite(x));
  const describe = (vals) => {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return `median ${compact(median(vals))} · mean ${compact(Number(mean.toFixed(1)))}`;
  };
  if (!grouping) {
    const vals = valuesFor(0);
    return vals.length ? `n = ${vals.length.toLocaleString()} · ${describe(vals)}` : '';
  }
  return grouping.names
    .map((name, g) => {
      const vals = valuesFor(g);
      return vals.length ? `${name}: median ${compact(median(vals))}` : null;
    })
    .filter(Boolean)
    .join(' · ');
};

// "Most common" line for coded and text columns.
const summarizeMode = (data, series, totals, grouping) => {
  if (!data.length) return '';
  if (!grouping) {
    const top = [...data].sort((a, b) => b[series[0]] - a[series[0]])[0];
    return `n = ${totals[0].toLocaleString()} · most common: ${top.name} (${fmtPct(pct(top[series[0]], totals[0]))})`;
  }
  return series
    .map((s) => {
      const top = [...data].sort((a, b) => b[s] - a[s])[0];
      return `${s}: ${top.name} (${fmtPct(top[s])})`;
    })
    .join(' · ');
};

const ChartCard = ({ icon: Icon, title, subtitle, summary, children }) => (
  <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="truncate text-xs text-slate-400" title={subtitle}>{subtitle}</p>
        {summary && <p className="mt-1 text-xs font-medium text-slate-600">{summary}</p>}
      </div>
    </div>
    <div className="flex flex-1 items-stretch p-4">{children}</div>
  </div>
);

const AutoChartsReport = ({ columns = [], rows = [], treatmentColumn = '' }) => {
  const ctx = useMemo(() => {
    const list = Array.isArray(columns) ? columns : [];
    const data = Array.isArray(rows) ? rows : [];
    const grouping = findGrouping(list, data, treatmentColumn);

    const charts = list
      .map((col) => {
        if (grouping && col === grouping.col) return null; // it defines the groups
        const ncol = norm(col);
        const nlabel = norm(labelOf(col));
        if (SKIP_HEADER.test(ncol) || SKIP_HEADER.test(nlabel)) return null;
        const cls = classify(data, col);
        if (!cls) return null;

        const coverage = data.length ? presentValues(data, col).length / data.length : 0;
        const kw = IMPORTANT_HEADER.test(nlabel) ? 2 : 0;
        const kindBase = { donut: 5, codes: 5, numeric: 4, bar: 3 }[cls.kind];
        const priority = kindBase + kw + coverage * 2;
        const base = { col, title: shortLabel(col), priority };

        if (cls.kind === 'numeric') {
          const { labels, binOf } = binEdges(cls.sorted);
          const keyOf = (v) => {
            const x = parseNumericValue(v);
            return x === null || !Number.isFinite(x) ? null : binOf(x);
          };
          const built = buildRows(data, col, labels, keyOf, grouping);
          if (!built.data.some((d) => built.series.some((s) => d[`${s}__n`] > 0))) return null;
          return {
            ...base,
            kind: 'columns',
            icon: Activity,
            subtitle: `${col} · value ranges`,
            summary: summarizeNumbers(data, col, grouping),
            angled: labels.length > 6,
            ...built,
          };
        }

        if (cls.kind === 'codes') {
          const index = new Map(cls.codes.map((c, i) => [c, i]));
          const keyOf = (v) => {
            const x = parseNumericValue(v);
            return index.has(x) ? index.get(x) : null;
          };
          const built = buildRows(data, col, cls.codes.map(String), keyOf, grouping);
          return {
            ...base,
            kind: 'columns',
            icon: Hash,
            subtitle: `${col} · answer codes`,
            summary: summarizeMode(built.data, built.series, built.totals, grouping),
            angled: false,
            ...built,
          };
        }

        const index = new Map(cls.categories.map((c, i) => [c, i]));
        const keyOf = (v) => {
          const s = String(v ?? '').trim();
          return index.has(s) ? index.get(s) : null;
        };
        const built = buildRows(data, col, cls.categories, keyOf, grouping);
        const summary = summarizeMode(built.data, built.series, built.totals, grouping);

        // A donut shows one group's shares; comparing two groups needs bars.
        if (cls.kind === 'donut' && !grouping) {
          return {
            ...base,
            kind: 'donut',
            icon: PieIcon,
            subtitle: `${col} · ${cls.categories.length} values`,
            summary,
            ...built,
            data: built.data.map((d, i) => ({ name: d.name, value: d.Respondents, color: SERIES[i % SERIES.length] })),
          };
        }
        return {
          ...base,
          kind: 'rows',
          icon: BarChart3,
          subtitle: `${col} · ${cls.kind === 'bar' ? `top ${cls.categories.length} values` : `${cls.categories.length} values`}`,
          summary,
          ...built,
        };
      })
      .filter(Boolean);

    return {
      charts: charts.sort((a, b) => b.priority - a.priority).slice(0, MAX_CHARTS),
      grouping,
      rowCount: data.length,
      colCount: list.length,
    };
  }, [columns, rows, treatmentColumn]);

  const { grouping } = ctx;
  const colorOf = (s, i) => (grouping ? grouping.colors[i] : PALETTE.primary);
  const valueAxis = grouping ? '% of group' : 'Respondents';
  const tickValue = (v) => (grouping ? `${Math.round(v)}%` : compact(v));

  // Tooltip: "% of group (n respondents)" when comparing, the count otherwise.
  const tooltipFormatter = (value, name, item) => {
    const n = item?.payload?.[`${name}__n`];
    return grouping
      ? [`${fmtPct(Number(value))} (${Number(n).toLocaleString()} respondents)`, name]
      : [Number(value).toLocaleString(), name];
  };

  const legend = grouping ? (
    <Legend verticalAlign="top" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'inherit' }} />
  ) : null;

  const tooltip = (
    <Tooltip formatter={tooltipFormatter} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} cursor={CURSOR} />
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Auto Charts</h2>
        <p className="text-sm text-slate-500">
          Top {ctx.charts.length} most important · generated from the data preview — {ctx.rowCount.toLocaleString()} rows ×{' '}
          {ctx.colCount.toLocaleString()} columns.
        </p>
        {grouping && (
          <p className="mt-1 text-xs text-slate-500">
            Comparing <span className="font-semibold text-slate-700">{grouping.description}</span> · bars show the % of
            each group, so groups of different sizes compare fairly (counts in the tooltip).
          </p>
        )}
      </div>

      {ctx.charts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ctx.charts.map((ch) => (
            <ChartCard key={ch.col} icon={ch.icon} title={ch.title} subtitle={ch.subtitle} summary={ch.summary}>
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
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                    >
                      {ch.data.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => Number(value).toLocaleString()}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      itemStyle={TOOLTIP_ITEM}
                    />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'inherit' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {ch.kind === 'rows' && (
                <ResponsiveContainer width="100%" height={Math.max(220, 60 + ch.data.length * (grouping ? 30 : 22))}>
                  <BarChart data={ch.data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barGap={2}>
                    <CartesianGrid {...GRID_LINE} horizontal={false} vertical />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={SMALL_TICK}
                      tickFormatter={tickValue}
                      label={{ value: valueAxis, ...AXIS_LABEL, fontSize: 10, position: 'insideBottomRight', dy: 8 }}
                    />
                    <YAxis type="category" dataKey="name" width={96} tick={SMALL_TICK} axisLine={false} tickLine={false} />
                    {tooltip}
                    {legend}
                    {ch.series.map((s, i) => (
                      <Bar key={s} dataKey={s} name={s} fill={colorOf(s, i)} radius={[0, 4, 4, 0]} maxBarSize={14} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}

              {ch.kind === 'columns' && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ch.data} margin={{ top: 8, right: 4, left: -6, bottom: 4 }} barGap={2}>
                    <CartesianGrid {...GRID_LINE} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={SMALL_TICK}
                      interval={0}
                      angle={ch.angled ? -30 : 0}
                      textAnchor={ch.angled ? 'end' : 'middle'}
                      height={ch.angled ? 48 : 28}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={SMALL_TICK} tickFormatter={tickValue} axisLine={false} tickLine={false} width={40} />
                    {tooltip}
                    {legend}
                    {ch.series.map((s, i) => (
                      <Bar key={s} dataKey={s} name={s} fill={colorOf(s, i)} radius={[4, 4, 0, 0]} maxBarSize={grouping ? 16 : 28} />
                    ))}
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
