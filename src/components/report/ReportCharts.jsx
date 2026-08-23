// src/components/report/ReportCharts.jsx
// ============================================================
// REPORT TAB CHART LIBRARY (Recharts)
// 9 visualizations: geographic distribution, age brackets with
// density overlay, sex donut, marital status, education,
// fishing/total income brackets, socioeconomic indices,
// Likert perception stacks and PEI histogram.
// All charts support hover tooltips, legend-click series
// filtering and cross-filter drill-downs via callbacks.
// ============================================================

import React, { useState } from 'react';
import {
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
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LIKERT_COLORS, LIKERT_LEVELS, INDEX_FIELDS } from '@/lib/reportData';

const B_COLOR = '#2563eb';
const NB_COLOR = '#f97316';
const GRID = '#eef2f7';
const TICK = { fontSize: 10.5, fill: '#94a3b8' };

export const EmptyNote = ({ text }) => (
  <div className="flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[12px] text-slate-400">
    {text}
  </div>
);

export const ChartCard = ({ title, subtitle, right, children, className = '' }) => (
  <Card className={`overflow-hidden rounded-[8px] border border-[#e2e8f0] shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${className}`}>
    <CardHeader className="border-b border-[#f1f5f9] p-[11px_15px_8px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-[13px] font-bold text-[#1e293b]">{title}</CardTitle>
          {subtitle ? <div className="mt-[1px] text-[11px] text-[#94a3b8]">{subtitle}</div> : null}
        </div>
        {right}
      </div>
    </CardHeader>
    <CardContent className="p-[14px]">{children}</CardContent>
  </Card>
);

const TTCard = ({ active, payload, label, money = false, percent = false }) => {
  if (!active || !payload || !payload.length) return null;
  const fmtVal = (v) => {
    if (v === null || v === undefined) return '—';
    if (money) return `₱${Number(v).toLocaleString()}`;
    if (percent) return `${v}%`;
    return Number(v).toLocaleString();
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] shadow-lg shadow-slate-900/10">
      {label !== undefined && label !== null ? <div className="mb-1 font-bold text-slate-700">{label}</div> : null}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.fill }} />
            {entry.name}
          </span>
          <span className="font-semibold" style={{ color: entry.color || entry.fill }}>{fmtVal(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const legendPointer = { cursor: 'pointer', fontSize: 11 };

const useHiddenSeries = () => useState({});

const GroupedBars = ({ data = [], xKey = 'name', series = [], height = 260, money = false, onBarClick, hint, stacked = false }) => {
  const [hidden, setHidden] = useHiddenSeries();
  const toggle = (entry) => setHidden((h) => ({ ...h, [entry.dataKey]: !h[entry.dataKey] }));
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={Array.isArray(data) ? data : []} margin={{ top: 6, right: 12, left: -8, bottom: 4 }} onClick={(e) => {
          const lbl = e?.activeLabel ?? e?.label;
          if (onBarClick && lbl != null) onBarClick(lbl);
        }}>
          <CartesianGrid strokeDasharray="3 5" stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ ...TICK, fontSize: 9.5 }} interval={0} angle={data.length > 6 ? -18 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 46 : 26} />
          <YAxis axisLine={false} tickLine={false} tick={TICK} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<TTCard money={money} />} />
          <Legend onClick={toggle} wrapperStyle={legendPointer} iconType="circle" iconSize={8} />
          {(Array.isArray(series) ? series : []).map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} hide={!!hidden[s.key]} stackId={stacked ? 'stack' : undefined} maxBarSize={26} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {(hint || onBarClick) && (
        <p className="mt-1 text-center text-[10px] text-slate-400">{hint || 'Click a bar to cross-filter the report'}</p>
      )}
    </>
  );
};

const B_NB_SERIES = [
  { key: 'Beneficiary', name: 'Beneficiary', color: B_COLOR },
  { key: 'Non-Beneficiary', name: 'Non-Beneficiary', color: NB_COLOR },
];

export const RegionChart = ({ data, activeRegion, onDrillRegion }) => (
  <ChartCard title="Geographic Distribution" subtitle="Respondents per region · stacked by group">
    {Array.isArray(data) && data.length ? (
      <GroupedBars
        data={data}
        height={300}
        stacked
        series={B_NB_SERIES}
        onBarClick={(lbl) => onDrillRegion(activeRegion === lbl ? 'All' : lbl)}
        hint="Click a region to cross-filter every chart"
      />
    ) : (
      <EmptyNote text="No region data available" />
    )}
  </ChartCard>
);

export const AgeChart = ({ data }) => {
  const [hidden, setHidden] = useHiddenSeries();
  const toggle = (entry) => setHidden((h) => ({ ...h, [entry.dataKey]: !h[entry.dataKey] }));
  return (
    <ChartCard title="Age Bracket Distribution" subtitle="Respondents by age bracket · line shows share of total (%)">
      {Array.isArray(data) && data.length ? (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 5" stroke={GRID} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={TICK} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={TICK} unit="%" />
            <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<TTCard />} />
            <Legend onClick={toggle} wrapperStyle={legendPointer} iconType="circle" iconSize={8} />
            <Bar yAxisId="left" dataKey="Beneficiary" name="Beneficiary" fill={B_COLOR} hide={!!hidden.Beneficiary} maxBarSize={30} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="Non-Beneficiary" name="Non-Beneficiary" fill={NB_COLOR} hide={!!hidden['Non-Beneficiary']} maxBarSize={30} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="sharePct" name="% of total" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <EmptyNote text="No age data available" />
      )}
    </ChartCard>
  );
};

const SEX_COLORS = { Male: '#2563eb', Female: '#f472b6' };

export const SexDonut = ({ data, activeSex, onDrillSex }) => {
  const safeData = Array.isArray(data) ? data : [];
  const total = safeData.reduce((s, d) => s + d.total, 0);
  return (
    <ChartCard title="Sex Distribution" subtitle="All respondents · click a segment to cross-filter">
      {total ? (
        <>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={safeData}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={88}
                paddingAngle={2}
                label={({ name, total: v }) => `${name} ${total ? Math.round((v / total) * 100) : 0}% (${v})`}
                labelLine={false}
                onClick={(d) => { const name = d?.name ?? d?.payload?.name; if (name) onDrillSex(activeSex === name ? 'All' : name); }}
                style={{ cursor: 'pointer' }}
              >
                {safeData.map((d) => <Cell key={d.name} fill={SEX_COLORS[d.name] || '#94a3b8'} />)}
              </Pie>
              <Tooltip content={<TTCard />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 text-[11px] text-slate-500">
            {safeData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEX_COLORS[d.name] || '#94a3b8' }} />
                {d.name}: <b>{d.total.toLocaleString()}</b> ({d.Beneficiary}B / {d['Non-Beneficiary']}NB)
              </span>
            ))}
          </div>
        </>
      ) : (
        <EmptyNote text="No sex data available" />
      )}
    </ChartCard>
  );
};

export const MaritalChart = ({ data }) => (
  <ChartCard title="Marital Status Distribution" subtitle="Single vs Married/Live-in vs Separated/Widowed">
    {Array.isArray(data) && data.length ? <GroupedBars data={data} series={B_NB_SERIES} height={250} /> : <EmptyNote text="No marital status data available" />}
  </ChartCard>
);

export const EducationChart = ({ data }) => (
  <ChartCard title="Educational Attainment" subtitle="Highest level completed by group">
    {Array.isArray(data) && data.length ? <GroupedBars data={data} series={B_NB_SERIES} height={270} /> : <EmptyNote text="No education data available" />}
  </ChartCard>
);

export const IncomeChart = ({ data, kind }) => (
  <ChartCard
    title={kind === 'fishing' ? 'Fishing Income Brackets' : 'Total Household Income Brackets'}
    subtitle="Monthly income per group"
  >
    {Array.isArray(data) && data.length ? <GroupedBars data={data} series={B_NB_SERIES} height={250} money /> : <EmptyNote text={`No ${kind === 'fishing' ? 'fishing income' : 'household income'} data available`} />}
  </ChartCard>
);

const PHASE_OPTIONS = ['All', 'Before', 'After'];

export const IndicesChart = ({ data, phase, onPhaseChange }) => {
  const [hidden, setHidden] = useHiddenSeries();
  const toggle = (entry) => setHidden((h) => ({ ...h, [entry.dataKey]: !h[entry.dataKey] }));
  const hasData = data.some((d) => d.hasData);
  return (
    <ChartCard
      title="Socioeconomic Index Comparison"
      subtitle={`Mean scores · ${INDEX_FIELDS.map(([, l]) => l).join(' · ')}`}
      className="md:col-span-2 xl:col-span-2"
      right={(
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
          {PHASE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onPhaseChange(opt)}
              className={`rounded px-2.5 py-1 text-[10.5px] font-bold transition ${phase === opt ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {opt === 'All' ? 'All phases' : opt}
            </button>
          ))}
        </div>
      )}
    >
      {hasData ? (
        <GroupedBars data={data} series={B_NB_SERIES} height={280} hint="Toggle Before / After to compare benchmark vs current conditions" />
      ) : (
        <EmptyNote text="No index columns (DOI/LCI/RPI/ICI/MWI) detected in either questionnaire" />
      )}
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-5">
        {INDEX_FIELDS.map(([key, label, full]) => (
          <div key={key} className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400" title={full}>{label}</div>
            <div className="font-mono text-[11.5px] text-slate-600">{full}</div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
};

const LIKERT_TITLES = {
  relevance: 'Program Relevance',
  socialImpact: 'Social Impact',
  sustainability: 'Sustainability',
};

const LikertCard = ({ cat, rows }) => {
  const [hidden, setHidden] = useState({});
  const toggle = (entry) => setHidden((h) => ({ ...h, [entry.dataKey]: !h[entry.dataKey] }));
  const chartData = rows.map((r) => ({
    name: r.short,
    fullTitle: r.title,
    mean: r.mean,
    answered: r.answered,
    ...LIKERT_LEVELS.reduce((acc, lvl, i) => ({ ...acc, [lvl]: r.values[i] }), {}),
    _counts: r.counts,
  }));
  return (
    <ChartCard
      title={`${LIKERT_TITLES[cat]} ( Beneficiaries )`}
      subtitle={`${rows.length} statements · % of responses per Likert scale`}
    >
      {rows.length ? (
        <>
          <ResponsiveContainer width="100%" height={rows.length * 46 + 60}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" stroke={GRID} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={TICK} unit="%" />
              <YAxis type="category" dataKey="name" width={38} axisLine={false} tickLine={false} tick={TICK} />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;
                  return (
                    <div className="max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] shadow-lg">
                      <div className="mb-1 font-bold text-slate-700">{row.fullTitle}</div>
                      {LIKERT_LEVELS.map((lvl, i) => (
                        <div key={lvl} className="flex justify-between gap-3">
                          <span className="text-slate-500">{lvl}</span>
                          <span className="font-semibold text-slate-700">{row._counts[i]} ({row[lvl]}%)</span>
                        </div>
                      ))}
                      <div className="mt-1 border-t border-slate-100 pt-1 text-slate-500">Mean: <b>{row.mean ?? '—'}</b> · n={row.answered}</div>
                    </div>
                  );
                }}
              />
              <Legend onClick={toggle} wrapperStyle={{ ...legendPointer, fontSize: 9.5 }} iconType="circle" iconSize={7} />
              {LIKERT_LEVELS.map((lvl, i) => (
                <Bar key={lvl} dataKey={lvl} stackId="likert" fill={LIKERT_COLORS[i]} hide={!!hidden[lvl]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-[10px] text-slate-400">
            {rows.map((r) => `${r.short} = ${r.title}`).join(' · ')}
          </p>
        </>
      ) : (
        <EmptyNote text={`No rating questions classified under ${LIKERT_TITLES[cat]} were found (beneficiaries only)`} />
      )}
    </ChartCard>
  );
};

export const LikertSection = ({ likertData }) => (
  <div className="grid gap-5 md:col-span-2 md:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
    {Object.keys(LIKERT_TITLES).map((cat) => (
      <LikertCard key={cat} cat={cat} rows={likertData[cat] || []} />
    ))}
  </div>
);

export const PeiChart = ({ pei }) => {
  const targetMean = 4.36;
  const meanBin = pei.applicable && pei.bins.length
    ? pei.bins[Math.min(pei.bins.length - 1, Math.max(0, Math.floor((pei.mean - 1) / 0.5)))].name
    : undefined;
  return (
    <ChartCard
      title="Program Evaluation Index (PEI)"
      subtitle="Distribution of mean Likert score per beneficiary · density curve overlay"
      right={(
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">Mean PEI: {pei.applicable ? pei.mean : '—'}</div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">Target: {targetMean}</div>
        </div>
      )}
      className="md:col-span-2 xl:col-span-3"
    >
      {pei.applicable ? (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={pei.bins} margin={{ top: 10, right: 6, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 5" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={TICK} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={TICK} unit="%" />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<TTCard percent />} />
              <ReferenceLine yAxisId="left" x={meanBin} stroke="#7c3aed" strokeDasharray="5 4" label={{ value: `Mean ${pei.mean}`, position: 'top', fill: '#7c3aed', fontSize: 11, fontWeight: 700 }} />
              <Bar yAxisId="left" dataKey="count" name="Beneficiaries" fill="#8b5cf6" maxBarSize={40} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="pct" name="% of beneficiaries" stroke="#0db890" strokeWidth={2} dot={{ r: 3 }} />
              <Legend wrapperStyle={legendPointer} iconType="circle" iconSize={8} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-[10px] text-slate-400">n = {pei.count.toLocaleString()} beneficiaries with perception responses</p>
        </>
      ) : (
        <EmptyNote text="No Likert perception responses from beneficiaries were found" />
      )}
    </ChartCard>
  );
};
