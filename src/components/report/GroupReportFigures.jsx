// src/components/report/GroupReportFigures.jsx
// Charts for the Group Report. Each is a numbered <figure> whose recharts <svg>
// the PDF export (lib/reportPdf.js) draws as an image, so values are written on
// the bars / slices instead of relying on hover tooltips.

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, PieChart, Pie, Cell } from 'recharts';

const GRID = '#eef2f7';
const TICK = { fontSize: 11, fill: '#475569' };
const VALUE = { fontSize: 10.5, fontWeight: 600, fill: '#334155' };
// Distinct, print-friendly slice colours for donuts.
const SLICE_COLORS = ['#2563eb', '#f97316', '#14b8a6', '#a855f7', '#eab308', '#ef4444'];

const pct = (n) => `${Number(n).toFixed(1)}%`;
const shorten = (text, max = 38) => (String(text).length > max ? `${String(text).slice(0, max - 1)}…` : String(text));

const Figure = ({ num, title, note, children }) => (
  <figure className="mb-8 break-inside-avoid">
    <figcaption className="mb-2 text-sm font-semibold text-slate-800">
      Figure {num}. {title}
    </figcaption>
    <div className="rounded-xl border border-slate-200 bg-white p-3">{children}</div>
    {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
  </figure>
);

// Horizontal bars, longest first, each labelled "45.0% (12)".
const HorizontalBars = ({ rows, color }) => {
  const data = rows.map((r) => ({ name: shorten(r.name), value: r.pct, label: `${pct(r.pct)} (${r.count})` }));
  const labelWidth = Math.min(220, Math.max(70, Math.max(...data.map((d) => d.name.length)) * 6.4));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, 30 + data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tick={TICK} axisLine={false} tickLine={false} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          <LabelList dataKey="label" position="right" style={VALUE} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Donut with the share and count written next to each slice, plus a legend
// drawn as text so it reads in the PDF.
const Donut = ({ rows }) => {
  const data = rows.map((r) => ({ name: r.name, value: r.count, pct: r.pct }));
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-8">
      <div className="h-[220px] w-full max-w-[300px]">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={false}
              label={({ pct: share }) => pct(share)}
              labelLine={{ stroke: '#cbd5e1' }}
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {data.map((d, i) => <Cell key={d.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="pdf-legend space-y-1 text-sm text-slate-700">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
            {d.name}: {d.value} ({pct(d.pct)})
          </li>
        ))}
      </ul>
    </div>
  );
};

// Ratings 1-5 as columns labelled with their share, mean in the caption.
const RatingColumns = ({ options, color }) => {
  const data = options.map((o) => ({ name: `${o.option} ★`, value: o.pct, label: o.count ? `${pct(o.pct)} (${o.count})` : '' }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: -8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          <LabelList dataKey="label" position="top" style={VALUE} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/** Respondents per municipality / barangay. */
export const LocationFigure = ({ num, title, rows, total, color }) => (
  <Figure num={num} title={title} note={`Share of all ${total} respondents${rows.length < total ? '; top locations shown' : ''}.`}>
    <HorizontalBars rows={rows} color={color} />
  </Figure>
);

/** One question's results: donut (2-4 single-choice options), bars, or rating columns. */
export const QuestionFigure = ({ num, summary, color }) => {
  const note = `n = ${summary.answered} answered${summary.unanswered > 0 ? `, ${summary.unanswered} unanswered` : ''}${
    summary.multi ? '; respondents could choose more than one answer' : ''}.`;
  if (summary.kind === 'rating') {
    return (
      <Figure num={num} title={`${summary.label}${summary.mean !== null ? ` (mean ${summary.mean} of 5)` : ''}`} note={note}>
        <RatingColumns options={summary.options} color={color} />
      </Figure>
    );
  }
  const rows = summary.options.map((o) => ({ name: o.option, count: o.count, pct: o.pct }));
  const donut = !summary.multi && rows.length >= 2 && rows.length <= 4;
  return (
    <Figure num={num} title={summary.label} note={note}>
      {donut ? <Donut rows={rows} /> : <HorizontalBars rows={rows.slice(0, 15)} color={color} />}
    </Figure>
  );
};

/** True when a question has something to chart. */
export const hasFigure = (summary) =>
  (summary.kind === 'choice' && summary.options.length > 0) || (summary.kind === 'rating' && summary.answered > 0);
