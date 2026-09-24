// src/components/report/PairedBeforeAfter.jsx
// ============================================================
// Baseline Report: per-person, per-question Before -> After
// comparison of the matched respondents (linked Before ID, or
// matching name / birthday / demographics).
// Descriptive only -- there is no comparison group, so a change
// is not proof of program impact. Pairing logic lives in
// lib/pairedBaseline.js.
// ============================================================

import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link2 } from 'lucide-react';
import { ChartCard, EmptyNote } from './ReportCharts';
import { GROUP_COLORS } from './PhilippineMap';
import { MATCH_METHODS, PAIRED_KINDS } from '@/lib/pairedBaseline';

// Same Before / After colours as the rest of the baseline Report.
const BEFORE_COLOR = GROUP_COLORS.Beneficiary;
const AFTER_COLOR = GROUP_COLORS['Non-Beneficiary'];
const TICK = { fontSize: 10.5, fill: '#94a3b8' };

const pct = (count, total) => (total ? `${Math.round((count / total) * 100)}%` : '—');
const signed = (value, text) => `${value > 0 ? '+' : ''}${text}`;

// Before / After / Change cells, per question kind.
const formatRow = (q) => {
  switch (q.kind) {
    case 'rating':
      return {
        before: q.beforeMean.toFixed(2),
        after: q.afterMean.toFixed(2),
        change: signed(q.change, q.change.toFixed(2)),
      };
    case 'yesno':
      return {
        before: `${Math.round(q.beforeMean * 100)}% yes`,
        after: `${Math.round(q.afterMean * 100)}% yes`,
        change: signed(q.change, `${Math.round(q.change * 100)} pts`),
      };
    case 'ordinal':
      return {
        before: `${q.beforeMean.toFixed(2)} / ${q.optionCount}`,
        after: `${q.afterMean.toFixed(2)} / ${q.optionCount}`,
        change: signed(q.change, q.change.toFixed(2)),
      };
    default:
      return {
        before: q.beforeTop,
        after: q.afterTop,
        change: `${pct(q.changed, q.n)} changed`,
      };
  }
};

const CountTile = ({ value, label }) => (
  <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
    <div className="font-mono text-xl font-extrabold tabular-nums text-slate-800">{value.toLocaleString()}</div>
    <div className="text-[11px] font-medium text-slate-500">{label}</div>
  </div>
);

const KindPill = ({ active, label, count, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${active ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
  >
    {label} <span className="opacity-70">{count}</span>
  </button>
);

const PairedBeforeAfter = ({ comparison }) => {
  const [kindFilter, setKindFilter] = useState('all');
  const { pairCount, beforeWithoutAfter, afterWithoutBefore, methodCounts = {}, pairList = [], questions } = comparison;
  const withData = questions.filter((q) => q.n > 0);
  const kindCounts = withData.reduce((acc, q) => ({ ...acc, [q.kind]: (acc[q.kind] || 0) + 1 }), {});
  const visible = kindFilter === 'all' ? withData : withData.filter((q) => q.kind === kindFilter);
  const ratingChart = withData
    .filter((q) => q.kind === 'rating')
    .map((q) => ({
      name: q.code || q.title.slice(0, 12),
      title: q.title,
      Before: Number(q.beforeMean.toFixed(2)),
      After: Number(q.afterMean.toFixed(2)),
    }));

  return (
    <ChartCard
      title={<span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4 text-cyan-600" /> Paired Before → After Comparison</span>}
      subtitle="Same respondents surveyed twice · matched by linked ID, name and demographics · compared question by question"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CountTile value={pairCount} label="Matched pairs" />
          <CountTile value={beforeWithoutAfter} label="Before respondents with no After match" />
          <CountTile value={afterWithoutBefore} label="After responses with no Before match" />
        </div>

        {pairCount > 0 && (
          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[12px] text-slate-600">
              <span className="font-semibold text-slate-800">How pairs were matched</span>
              {Object.entries(MATCH_METHODS).filter(([m]) => methodCounts[m]).map(([m, label]) => (
                <span key={m}>{label}: <span className="font-bold text-slate-800">{methodCounts[m]}</span></span>
              ))}
              <span className="ml-auto text-[11px] text-cyan-700">Show the {pairCount} pairs</span>
            </summary>
            <div className="max-h-80 overflow-auto border-t border-slate-100">
              <table className="min-w-full text-[12px]">
                <thead className="sticky top-0 bg-slate-50 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Before</th>
                    <th className="px-3 py-2 text-left">After</th>
                    <th className="px-3 py-2 text-left">Matched by</th>
                    <th className="px-3 py-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pairList.map((p) => (
                    <tr key={`${p.beforeId}-${p.afterId}-${p.afterName}`}>
                      <td className="px-3 py-1.5"><span className="font-semibold text-slate-800">{p.beforeId}</span> <span className="text-slate-500">{p.beforeName}</span></td>
                      <td className="px-3 py-1.5"><span className="font-semibold text-slate-800">{p.afterId}</span> <span className="text-slate-500">{p.afterName}</span></td>
                      <td className="px-3 py-1.5 text-slate-500">{MATCH_METHODS[p.method]}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{p.score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-[10.5px] leading-relaxed text-slate-400">
              Linked Before ID: typed by the respondent on the After form. Otherwise matched on name (+4, or +2 for a near-identical
              spelling), birthday (+3), sex, barangay, municipality, age (+1 each) and the same ID number (+1); a clearly different
              name is −3. A pair needs a score of 5 or more and a matching name or birthday, so an ID number alone never pairs two people.
            </p>
          </details>
        )}

        {pairCount === 0 ? (
          <EmptyNote text="No matched pairs yet. Pairs are found from the Before ID typed on the After form, or from matching name, birthday and demographics." />
        ) : withData.length === 0 ? (
          <EmptyNote text="Linked pairs found, but no question was answered in both the Before and the After questionnaire." />
        ) : (
          <>
            {ratingChart.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] font-semibold text-slate-700">Rating questions · mean score, same respondents</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ratingChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 5" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK} interval={0} angle={-35} textAnchor="end" height={48} />
                    <YAxis axisLine={false} tickLine={false} tick={TICK} width={32} domain={[0, 'auto']} />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.title || label}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Before" fill={BEFORE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="After" fill={AFTER_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="no-print flex flex-wrap items-center gap-2">
              <KindPill active={kindFilter === 'all'} label="All" count={withData.length} onClick={() => setKindFilter('all')} />
              {Object.entries(PAIRED_KINDS).filter(([kind]) => kindCounts[kind]).map(([kind, label]) => (
                <KindPill key={kind} active={kindFilter === kind} label={label} count={kindCounts[kind]} onClick={() => setKindFilter(kind)} />
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Question</th>
                    <th className="px-4 py-2.5 text-left">Type</th>
                    <th className="px-4 py-2.5 text-right">Pairs</th>
                    <th className="px-4 py-2.5 text-right">Before</th>
                    <th className="px-4 py-2.5 text-right">After</th>
                    <th className="px-4 py-2.5 text-right">Change</th>
                    <th className="px-4 py-2.5 text-right">Up</th>
                    <th className="px-4 py-2.5 text-right">Same</th>
                    <th className="px-4 py-2.5 text-right">Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((q) => {
                    const cells = formatRow(q);
                    const isCategory = q.kind === 'category';
                    const tone = isCategory || !q.change ? 'text-slate-600' : q.change > 0 ? 'text-emerald-600' : 'text-rose-600';
                    return (
                      <tr key={q.key}>
                        <td className="max-w-[360px] px-4 py-2.5">
                          <div className="font-semibold text-slate-800">{q.code || '—'}</div>
                          <div className="truncate text-[11px] text-slate-500" title={q.title}>{q.title}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-slate-500">{PAIRED_KINDS[q.kind]}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{q.n}</td>
                        <td className="max-w-[160px] truncate px-4 py-2.5 text-right tabular-nums text-slate-600" title={cells.before}>{cells.before}</td>
                        <td className="max-w-[160px] truncate px-4 py-2.5 text-right tabular-nums text-slate-600" title={cells.after}>{cells.after}</td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums ${tone}`}>{cells.change}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{isCategory ? '—' : pct(q.up, q.n)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{pct(q.same, q.n)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{isCategory ? '—' : pct(q.down, q.n)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-[11px] leading-relaxed text-slate-400">
          Each row compares the same respondents' Before and After answers, over the pairs that answered the question
          both times. Rating: mean score. Yes / No: share answering yes (Oo / Meron); "not sure" is left out; Up = no → yes.
          Bracket: mean option position (1 = first option). Choice: most common answer and share of respondents whose
          answer changed. Up / Down only say which way the answer moved, not whether it is better, since some statements
          are worded negatively. This is a descriptive comparison with no comparison group, so a change is not proof of
          program impact.
        </p>
      </div>
    </ChartCard>
  );
};

export default PairedBeforeAfter;
