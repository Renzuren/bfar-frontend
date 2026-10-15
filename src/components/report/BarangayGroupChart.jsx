// src/components/report/BarangayGroupChart.jsx
// ============================================================
// RESPONDENTS PER BARANGAY
// Grouped horizontal bars: how many Beneficiary and Non-Beneficiary respondents
// came from each barangay. Reads the All Responses export rows, whose GROUP is
// '1' / '0' and whose Barangay / Municipality cells are the answers as text
// ('—' when missing). Barangays are sorted by total respondents; when the same
// barangay name appears in more than one municipality, the municipality is
// added to the label so the two are not merged.
// ============================================================

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GROUP, TICK, TOOLTIP_STYLE, TOOLTIP_LABEL, TOOLTIP_ITEM, CURSOR } from '../../lib/chartTheme';

const BENE = 'Beneficiary';
const NON = 'Non-Beneficiary';
const TOP_N = 15;
const UNSPECIFIED = 'Not specified';
const VALUE_LABEL = { ...TICK, fontSize: 10, fontWeight: 600, fill: '#334155' };

const clean = (v) => {
  const text = String(v ?? '').replace(/\s+/g, ' ').trim();
  return text === '' || text === '—' || /^(n\/?a|none)$/i.test(text) ? '' : text;
};
const keyOf = (s) => s.toLowerCase();

export const barangayCounts = (rows = []) => {
  const byKey = new Map();
  const municipalitiesOf = new Map(); // barangay name -> Set of municipalities
  rows.forEach((row) => {
    const group = String(row.GROUP) === '1' ? BENE : String(row.GROUP) === '0' ? NON : null;
    if (!group) return;
    const brgy = clean(row.Barangay);
    const muni = clean(row.Municipality);
    const key = `${keyOf(brgy)}|${keyOf(muni)}`;
    if (!byKey.has(key)) byKey.set(key, { brgy, muni, [BENE]: 0, [NON]: 0 });
    byKey.get(key)[group] += 1;
    if (brgy && muni) {
      if (!municipalitiesOf.has(keyOf(brgy))) municipalitiesOf.set(keyOf(brgy), new Set());
      municipalitiesOf.get(keyOf(brgy)).add(keyOf(muni));
    }
  });

  // A barangay name found in one municipality only (or with none given) is one
  // bar; one found in several gets a bar per municipality. The label keeps the
  // spelling of the first answer seen.
  const merged = new Map();
  byKey.forEach((entry) => {
    const ambiguous = entry.brgy && (municipalitiesOf.get(keyOf(entry.brgy))?.size || 0) > 1;
    const name = !entry.brgy
      ? UNSPECIFIED
      : ambiguous ? `${entry.brgy} (${entry.muni || 'no municipality'})` : entry.brgy;
    const prev = merged.get(keyOf(name)) || { name, [BENE]: 0, [NON]: 0 };
    prev[BENE] += entry[BENE];
    prev[NON] += entry[NON];
    merged.set(keyOf(name), prev);
  });

  return [...merged.values()]
    .map((d) => ({ ...d, total: d[BENE] + d[NON] }))
    .sort((a, b) => {
      if ((a.name === UNSPECIFIED) !== (b.name === UNSPECIFIED)) return a.name === UNSPECIFIED ? 1 : -1;
      return b.total - a.total || a.name.localeCompare(b.name);
    });
};

const BarangayGroupChart = ({ rows = [] }) => {
  const [showAll, setShowAll] = useState(false);
  const data = useMemo(() => barangayCounts(rows), [rows]);
  const named = data.filter((d) => d.name !== UNSPECIFIED);
  if (named.length === 0) return null;

  const shown = showAll ? data : data.slice(0, TOP_N);
  const longest = Math.max(...shown.map((d) => d.name.length));
  const labelWidth = Math.min(200, Math.max(80, longest * 6.5));
  const totals = data.reduce((acc, d) => ({ b: acc.b + d[BENE], n: acc.n + d[NON] }), { b: 0, n: 0 });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <MapPin className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Respondents per Barangay</h3>
            <p className="text-xs text-slate-500">
              {named.length.toLocaleString()} barangay{named.length === 1 ? '' : 's'} ·{' '}
              {totals.b.toLocaleString()} beneficiaries · {totals.n.toLocaleString()} non-beneficiaries
            </p>
          </div>
        </div>
        {data.length > TOP_N && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show top ${TOP_N}` : `Show all ${data.length}`}
          </Button>
        )}
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={Math.max(220, 60 + shown.length * 34)}>
          <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }} barGap={2}>
            <CartesianGrid stroke="#eef2f7" horizontal={false} vertical />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ ...TICK, fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toLocaleString()} respondents`, name]}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL}
              itemStyle={TOOLTIP_ITEM}
              cursor={CURSOR}
            />
            <Legend verticalAlign="top" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'inherit' }} />
            {[BENE, NON].map((group) => (
              <Bar key={group} dataKey={group} name={group} fill={GROUP[group]} radius={[0, 4, 4, 0]} maxBarSize={14}>
                {/* The count at the end of every bar, so it reads without hovering. */}
                <LabelList dataKey={group} position="right" offset={6} formatter={(v) => Number(v).toLocaleString()} style={VALUE_LABEL} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BarangayGroupChart;
