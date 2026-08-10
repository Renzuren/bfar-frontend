// src/components/FeatureImportanceSection.jsx
// ============================================================
// MODEL INTERPRETATION SECTION
// Top feature importance bar chart + signed impact/direction chart.
// Data comes from analysis.featureImportance (computed in MLUpload.js).
// ============================================================

import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';

const TOP_N = 10;
const BLUE = '#2563eb';
const POSITIVE = '#0db890';
const NEGATIVE = '#f97316';
const POSITIVE_LABEL = 'Increases beneficiary likelihood';
const NEGATIVE_LABEL = 'Decreases beneficiary likelihood';

const pct = (value) => `${(Math.abs(Number(value) || 0) * 100).toFixed(1)}%`;

export const normalizeFeatureImportance = (featureImportance = [], topN = TOP_N) =>
  featureImportance
    .filter((item) => item && item.feature)
    .map((item) => ({
      feature: String(item.feature),
      value: Number.isFinite(Number(item.value)) ? Math.max(0, Math.min(1, Number(item.value))) : 0,
      effect: Number.isFinite(Number(item.effect)) ? Math.max(-1, Math.min(1, Number(item.effect))) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);

export const ImportanceChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={Math.max(240, data.length * 34)}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={false} />
      <XAxis type="number" domain={[0, 1]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
      <YAxis dataKey="feature" type="category" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
      <Tooltip formatter={(value) => [pct(value), 'Importance']} cursor={{ fill: '#f8fafc' }} />
      <Bar dataKey="value" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={16}>
        {data.map((entry, index) => (
          <Cell key={entry.feature} fill={BLUE} opacity={1 - (index / Math.max(1, data.length)) * 0.45} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const DirectionChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={Math.max(240, data.length * 34)}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap="24%">
      <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={false} />
      <XAxis type="number" domain={[-1, 1]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
      <YAxis dataKey="feature" type="category" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
      <Tooltip
        formatter={(value) => {
          const v = Number(value) || 0;
          return [pct(v), v >= 0 ? 'Positive · increases likelihood' : 'Negative · decreases likelihood'];
        }}
        cursor={{ fill: '#f8fafc' }}
      />
      <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1.5} />
      <Bar dataKey="effect" maxBarSize={16} radius={[4, 4, 4, 4]}>
        {data.map((entry) => (
          <Cell key={entry.feature} fill={Number(entry.effect) >= 0 ? POSITIVE : NEGATIVE} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const DirectionLegend = () => (
  <div className="flex flex-wrap items-center gap-4 text-[11px] font-[400] text-[#94a3b8]">
    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POSITIVE }} />{POSITIVE_LABEL}</span>
    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NEGATIVE }} />{NEGATIVE_LABEL}</span>
  </div>
);

const FeatureImportanceSection = ({ featureImportance = [] }) => {
  const safe = normalizeFeatureImportance(featureImportance);

  if (!safe.length) return null;

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e0e7ff] text-[#2563eb]">🧠</div>
          <div>
            <div className="text-[15px] font-[800] text-[#1e293b]">Model Interpretation</div>
            <div className="text-[12px] font-[400] text-[#94a3b8]">Top contributing features to treatment classification · derived from uploaded data</div>
          </div>
        </div>
        <Badge className="rounded-full bg-[#eff6ff] px-[9px] py-[2px] text-[11px] font-[600] text-[#2563eb]">Top {safe.length} features</Badge>
      </div>

      <div className="px-6 py-6">
        <p className="mb-5 max-w-3xl text-[12.5px] leading-[1.6] text-[#64748b]">
          Feature importance measures how strongly each column separates the Beneficiary (B) group from the Non-Beneficiary (NB) group.
          A larger bar means the feature matters more for the treatment/outcome split.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-4">
            <div className="text-[13px] font-[700] text-[#1e293b]">Feature Importance</div>
            <div className="mb-3 mt-[2px] text-[11px] font-[400] text-[#94a3b8]">Top {safe.length} features ranked by mean impact</div>
            <ImportanceChart data={safe} />
          </div>
          <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-4">
            <div className="text-[13px] font-[700] text-[#1e293b]">Impact Direction</div>
            <div className="mb-3 mt-[2px]"><DirectionLegend /></div>
            <DirectionChart data={safe} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureImportanceSection;
