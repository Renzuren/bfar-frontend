// src/lib/chartTheme.js
// ============================================================
// Shared chart visual theme for the Socio-Economic Impact
// Assessment (Livelihood Program). Cohesive teal/amber/emerald
// palette, consistent fonts, grid, tooltip, and axis styles so
// every chart across report pages looks uniform, professional,
// and presentation-ready.
// ============================================================

export const FONT = "'Inter', system-ui, sans-serif";

export const TICK = {
  fontSize: 11,
  fill: '#64748b',
  fontFamily: FONT,
};

export const AXIS_LABEL = {
  fontSize: 11,
  fontWeight: 600,
  fill: '#334155',
  fontFamily: FONT,
};

export const GRID = {
  stroke: '#eef2f7',
  strokeDasharray: '3 5',
};

export const TOOLTIP_STYLE = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
  fontSize: 12,
  color: '#0f172a',
  fontFamily: FONT,
};

export const TOOLTIP_LABEL = { color: '#0f172a', fontWeight: 600 };
export const TOOLTIP_ITEM = { color: '#334155' };

export const CURSOR = { fill: 'rgba(148, 163, 184, 0.10)' };

export const PALETTE = {
  primary: '#0f766e',
  primaryLight: '#14b8a6',
  primarySoft: '#5eead4',
  accent: '#d97706',
  accentSoft: '#fbbf24',
  success: '#059669',
  danger: '#dc2626',
  neutral: '#64748b',
  slate: '#94a3b8',
  navy: '#1e293b',
};

export const SERIES = [
  '#0d9488',
  '#d97706',
  '#6366f1',
  '#059669',
  '#dc2626',
  '#94a3b8',
  '#0ea5e9',
  '#8b5cf6',
  '#f97316',
  '#a3e635',
];

export const GROUP = {
  Beneficiary: '#0d9488',
  'Non-Beneficiary': '#d97706',
};

export const axisProps = (extra = {}) => ({
  axisLine: false,
  tickLine: false,
  tick: TICK,
  ...extra,
});