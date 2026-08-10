// src/components/RespondentAnalytics.jsx
// ============================================================
// RESPONDENT ANALYTICS DASHBOARD
// Filters → summary cards → charts → comparison → map → exports.
// Primary classification: Beneficiary / Non-Beneficiary.
// All computations come from src/lib/respondentAnalytics.js.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Download, Filter, Layers, MapPin, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AREA_COORDS,
  AREA_PROVINCE,
  PROVINCE_COORDS,
  REGION_COORDS,
  PHILIPPINES_CENTER,
  PHILIPPINES_BOUNDS,
  PHILIPPINES_MIN_ZOOM,
  PHILIPPINES_MAX_ZOOM,
  normalizeKey,
  normalizeProvinceName,
  findAreaKey,
  getCoordsForKey,
  resolveRegion,
} from '@/lib/geoData';
import {
  buildRecords,
  applyFilters,
  buildSummary,
  buildBeneficiaryDistribution,
  buildAgeGroupDistribution,
  buildSexDistribution,
  buildMaritalDistribution,
  buildEducationDistribution,
  buildHouseholdDistribution,
  buildIncomeDistribution,
  buildLivelihoodDistribution,
  buildSecondaryLivelihoodDistribution,
  buildYearsLivelihoodDistribution,
  buildProgramDistribution,
  buildDurablesStats,
  buildServicesStats,
  buildHousingStats,
  buildInsuranceStats,
  buildPropertyStats,
  buildPerceptionStats,
  buildBeforeAfter,
  buildComparison,
  incomeGroupLabel,
  toCSV,
} from '@/lib/respondentAnalytics';
import { normalizeFeatureImportance, ImportanceChart, DirectionChart, DirectionLegend } from './FeatureImportanceSection';

const B_COLOR = '#2563eb';
const NB_COLOR = '#94a3b8';
const UNKNOWN_COLOR = '#cbd5e1';
const CHART_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#0db890', '#f97316', '#06b6d4', '#84cc16', '#8b5cf6'];
const AGE_GROUP_OPTIONS = ['18–35', '36–52', '53–69', '70+'];

const downloadCSV = (filename, content) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const fmt = (n, digits = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits }));

const ChartCard = ({ title, subtitle, children }) => (
  <Card className="overflow-hidden rounded-[8px] border border-[#e2e8f0] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
    <CardHeader className="border-b border-[#f1f5f9] p-[11px_15px_8px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-[13px] font-[700] text-[#1e293b]">{title}</CardTitle>
          {subtitle ? <div className="mt-[1px] text-[11px] font-[400] text-[#94a3b8]">{subtitle}</div> : null}
        </div>
        <div className="flex items-center gap-[5px] text-[14px] text-[#c0c9d4]">
          <span>⎔</span>
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-[14px_14px]">{children}</CardContent>
  </Card>
);

const MetricCard = ({ value, label, caption, tone = 'blue', icon }) => (
  <div className="rounded-[8px] p-[18px_20px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)] min-h-[96px]" style={{ background: tone === 'orange' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : tone === 'green' ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : tone === 'purple' ? 'linear-gradient(135deg, #7c3aed 0%, #7c3aed 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[30px] font-[800] tracking-tight">{value}</div>
        <div className="mt-1 text-[12px] font-[500] opacity-92">{label}</div>
        <div className="mt-1 text-[10.5px] font-[400] opacity-75">{caption}</div>
      </div>
      <div className="text-[38px] opacity-80">{icon}</div>
    </div>
  </div>
);

const Donut = ({ data, dataKey = 'count', colors = CHART_COLORS, height = 220 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie data={data} dataKey={dataKey} nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={2}>
        {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={colors[index % colors.length]} />)}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
);

const GroupedBar = ({ data, dataKey = 'name', horizontal = false, height = 240, xLabel }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 12, left: horizontal ? 8 : 0, bottom: 6 }}>
      <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={!horizontal} vertical={horizontal} />
      {horizontal ? (
        <>
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis dataKey={dataKey} type="category" width={118} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        </>
      ) : (
        <>
          <XAxis dataKey={dataKey} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        </>
      )}
      <Tooltip />
      <Legend />
      <Bar dataKey="beneficiary" name="Beneficiary" fill={B_COLOR} maxBarSize={14} radius={[0, 4, 4, 0]} />
      <Bar dataKey="nonBeneficiary" name="Non-Beneficiary" fill={NB_COLOR} maxBarSize={14} radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

const SingleBar = ({ data, dataKey = 'name', valueKey = 'value', horizontal = false, height = 240, barColor = B_COLOR }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 12, left: horizontal ? 8 : 0, bottom: 6 }}>
      <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={!horizontal} vertical={horizontal} />
      {horizontal ? (
        <>
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis dataKey={dataKey} type="category" width={118} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        </>
      ) : (
        <>
          <XAxis dataKey={dataKey} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        </>
      )}
      <Tooltip />
      <Bar dataKey={valueKey} fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={18}>
        {data.map((entry, index) => <Cell key={index} fill={barColor} opacity={0.55 + (index / Math.max(1, data.length)) * 0.45} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const LegendItems = ({ items }) => (
  <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
    {items.map((item) => (
      <div key={item.name} className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
        <span>{item.name}</span>
        <span className="font-[700] text-[#334155]">{item.value}</span>
      </div>
    ))}
  </div>
);

const SelectFilter = ({ label, value, options, onChange, allLabel = 'All' }) => (
  <div>
    <Label className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">{label}</Label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[8px] text-[12.5px] text-[#475569] focus:border-[#2563eb] focus:outline-none"
    >
      <option value="All">{allLabel}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>
);

const MapFocus = ({ focusKey, center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.7 });
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const RespondentAnalytics = ({ columns, rows, analysis = null }) => {
  const [filters, setFilters] = useState({
    status: 'All',
    region: 'All',
    province: 'All',
    municipality: 'All',
    sex: 'All',
    ageGroup: 'All',
    education: 'All',
    marital: 'All',
    livelihood: 'All',
    incomeGroup: 'All',
    programType: 'All',
    yearReceived: 'All',
  });
  const [mapMode, setMapMode] = useState('municipality');
  const [showOutside, setShowOutside] = useState(false);

  const dataset = useMemo(() => buildRecords(columns, rows), [columns, rows]);
  const allRecords = useMemo(() => dataset.records, [dataset]);

  const options = useMemo(() => {
    const { region, province } = filters;
    const regions = Array.from(new Set(allRecords.map((r) => r.region).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const provinces = Array.from(new Set(
      allRecords.filter((r) => !region || region === 'All' || r.region === region).map((r) => r.province).filter((v) => v && v !== 'Unknown'),
    )).sort((a, b) => a.localeCompare(b));
    const municipalities = Array.from(new Set(
      allRecords.filter((r) => (!region || region === 'All' || r.region === region) && (!province || province === 'All' || r.province === province))
        .map((r) => r.municipality).filter(Boolean),
    )).sort((a, b) => a.localeCompare(b));
    const sexes = Array.from(new Set(allRecords.map((r) => r.sex).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const educations = Array.from(new Set(allRecords.map((r) => r.education).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const maritals = Array.from(new Set(allRecords.map((r) => r.marital).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const livelihoods = Array.from(new Set(allRecords.map((r) => r.livelihood).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const incomeGroups = Array.from(new Set(allRecords.map((r) => incomeGroupLabel(r.income)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const programTypes = Array.from(new Set(allRecords.map((r) => r.programType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const years = Array.from(new Set(allRecords.map((r) => r.yearReceived).filter((y) => y !== null))).sort((a, b) => a - b);
    return { regions, provinces, municipalities, sexes, educations, maritals, livelihoods, incomeGroups, programTypes, years };
  }, [allRecords, filters.region, filters.province]);

  const filtered = useMemo(() => applyFilters(allRecords, filters), [allRecords, filters]);

  const handleFilterChange = (key, value) => {
    if (key === 'region') setFilters((f) => ({ ...f, region: value, province: 'All', municipality: 'All' }));
    else if (key === 'province') setFilters((f) => ({ ...f, province: value, municipality: 'All' }));
    else setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters({
    status: 'All', region: 'All', province: 'All', municipality: 'All', sex: 'All', ageGroup: 'All',
    education: 'All', marital: 'All', livelihood: 'All', incomeGroup: 'All', programType: 'All', yearReceived: 'All',
  });

  // ---------- Computed chart data ----------
  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const beneficiaryDist = useMemo(() => buildBeneficiaryDistribution(filtered), [filtered]);
  const maritalDist = useMemo(() => buildMaritalDistribution(filtered), [filtered]);
  const ageGroupDist = useMemo(() => buildAgeGroupDistribution(filtered), [filtered]);
  const sexDist = useMemo(() => buildSexDistribution(filtered), [filtered]);
  const eduDist = useMemo(() => buildEducationDistribution(filtered), [filtered]);
  const hhDist = useMemo(() => buildHouseholdDistribution(filtered), [filtered]);
  const incomeDist = useMemo(() => buildIncomeDistribution(filtered), [filtered]);
  const livelihoodDist = useMemo(() => buildLivelihoodDistribution(filtered), [filtered]);
  const secondaryLivelihoodDist = useMemo(() => buildSecondaryLivelihoodDistribution(filtered), [filtered]);
  const yearsLivelihoodDist = useMemo(() => buildYearsLivelihoodDistribution(filtered), [filtered]);
  const programDist = useMemo(() => buildProgramDistribution(filtered), [filtered]);
  const durablesStats = useMemo(() => buildDurablesStats(filtered), [filtered]);
  const servicesStats = useMemo(() => buildServicesStats(filtered), [filtered]);
  const housingStats = useMemo(() => buildHousingStats(filtered), [filtered]);
  const insuranceStats = useMemo(() => buildInsuranceStats(filtered), [filtered]);
  const propertyStats = useMemo(() => buildPropertyStats(filtered), [filtered]);
  const perception = useMemo(() => buildPerceptionStats(filtered), [filtered]);
  const beforeAfter = useMemo(() => buildBeforeAfter(filtered), [filtered]);
  const comparison = useMemo(() => buildComparison(filtered), [filtered]);

  const safeFeatures = useMemo(() => normalizeFeatureImportance(analysis?.featureImportance || []), [analysis]);

  const indexChartData = useMemo(() => ['DOI', 'LCI', 'RPI', 'ICI', 'MWI'].map((name) => {
    const row = comparison.find((r) => r.metric === name);
    const parse = (v) => (v === '—' ? 0 : Number(String(v).replace(/[₱,]/g, '')) || 0);
    return { name, Beneficiary: parse(row?.beneficiary), 'Non-Beneficiary': parse(row?.nonBeneficiary) };
  }), [comparison]);

  // ---------- Map data ----------
  const mapData = useMemo(() => {
    const groups = {};
    filtered.forEach((r) => {
      let key;
      let coords;
      if (mapMode === 'region') {
        key = r.region || 'Unknown Region';
        coords = REGION_COORDS[key];
      } else if (mapMode === 'province') {
        key = r.province || 'Unknown Province';
        coords = PROVINCE_COORDS[normalizeProvinceName(key)] || REGION_COORDS[r.region];
      } else {
        key = r.municipality || r.province;
        const areaKey = findAreaKey(r.municipality, r.province);
        coords = getCoordsForKey(areaKey) || getCoordsForKey(r.municipality) || getCoordsForKey(`__PROVINCE__${normalizeKey(r.province)}`);
      }
      if (!key) return;
      if (!groups[key]) groups[key] = { name: key, coords, total: 0, b: 0, nb: 0, u: 0 };
      groups[key].total += 1;
      if (r.beneficiaryStatus === 'Beneficiary') groups[key].b += 1;
      else if (r.beneficiaryStatus === 'Non-Beneficiary') groups[key].nb += 1;
      else groups[key].u += 1;
    });
    return Object.values(groups).filter((g) => g.coords).sort((a, b) => b.total - a.total);
  }, [filtered, mapMode]);

  const outsideMunicipalities = useMemo(() => {
    const regionF = filters.region;
    const provF = filters.province;
    const scopeRegions = new Set(regionF && regionF !== 'All' ? [regionF] : []);
    const scopeProvinces = new Set(provF && provF !== 'All' ? [provF] : []);
    const present = new Set(allRecords.map((r) => normalizeKey(r.municipality)).filter(Boolean));
    const list = [];
    Object.keys(AREA_COORDS).forEach((key) => {
      if (key.startsWith('__PROVINCE__')) return;
      const province = AREA_PROVINCE[key] || '';
      const region = resolveRegion(province) || '';
      if (scopeRegions.size && !scopeRegions.has(region)) return;
      if (scopeProvinces.size && !scopeProvinces.has(province)) return;
      if (present.has(normalizeKey(key))) return;
      list.push({ name: key, province, region, coords: AREA_COORDS[key] });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allRecords, filters.region, filters.province]);

  const mapCenter = useMemo(() => {
    const pts = mapData.map((d) => d.coords).filter(Boolean);
    if (!pts.length) return PHILIPPINES_CENTER;
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [lat, lng];
  }, [mapData]);
  const mapZoom = mapMode === 'municipality' ? (mapData.length === 1 ? 11 : 8) : mapMode === 'province' ? 8 : 6;
  const mapFocusKey = mapCenter ? `${mapCenter[0].toFixed(3)},${mapCenter[1].toFixed(3)}:${mapZoom}` : 'ph';

  // ---------- Exports ----------
  const exportFilteredData = () => downloadCSV('bfar_respondent_data.csv', toCSV(columns, filtered.map((r) => r.raw)));
  const exportSummary = () => downloadCSV('bfar_summary.csv', [
    'Metric,Value',
    `Total Respondents,${summary.total}`,
    `Beneficiaries,${summary.beneficiaries}`,
    `Non-Beneficiaries,${summary.nonBeneficiaries}`,
    `Unknown,${summary.unknown}`,
    `Beneficiary Rate (%),${summary.beneficiaryPct}`,
    `Average Monthly Income,${summary.avgIncome ?? ''}`,
    `Median Monthly Income,${summary.medianIncome ?? ''}`,
    `Average Household Size,${summary.avgHousehold ?? ''}`,
    `Average Age,${summary.avgAge ?? ''}`,
    `DOI,${summary.doi ?? ''}`,
    `LCI,${summary.lci ?? ''}`,
    `RPI,${summary.rpi ?? ''}`,
    `ICI,${summary.ici ?? ''}`,
    `MWI,${summary.mwi ?? ''}`,
  ].join('\n'));
  const exportComparison = () => downloadCSV('bfar_beneficiary_comparison.csv', [
    'Metric,"Beneficiary (B)","Non-Beneficiary (NB)"',
    ...comparison.map((r) => `"${r.metric}","${r.beneficiary}","${r.nonBeneficiary}"`),
  ].join('\n'));
  const exportMunicipalities = () => downloadCSV('bfar_outside_program_municipalities.csv', [
    'Municipality,Province,Region,Latitude,Longitude',
    ...outsideMunicipalities.map((m) => `"${m.name}","${m.province}","${m.region}",${m.coords[0]},${m.coords[1]}`),
  ].join('\n'));

  const hasStatus = dataset.withStatus;

  return (
    <div className="mt-10 space-y-8">
      {/* ---------- Header ---------- */}
      <div className="overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e0e7ff] text-[#2563eb]">🧭</div>
            <div>
              <div className="text-[15px] font-[800] text-[#1e293b]">Respondent Analytics Dashboard</div>
              <div className="text-[12px] font-[400] text-[#94a3b8]">Beneficiary / Non-Beneficiary overview · live with filters</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-[#eff6ff] px-[9px] py-[2px] text-[11px] font-[600] text-[#2563eb]">{summary.total.toLocaleString()} respondents</Badge>
            {hasStatus ? (
              <Badge className="rounded-full bg-[#dcfce7] px-[9px] py-[2px] text-[11px] font-[600] text-[#0db890]">B/NB classification detected</Badge>
            ) : (
              <Badge className="rounded-full bg-[#f1f5f9] px-[9px] py-[2px] text-[11px] font-[600] text-[#64748b]">No group column — unclassified</Badge>
            )}
            <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-[12px] py-[8px] text-[12px] font-[600] text-[#475569]" onClick={exportFilteredData}><Download className="mr-2 h-4 w-4" /> Data</Button>
            <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-[12px] py-[8px] text-[12px] font-[600] text-[#475569]" onClick={exportSummary}><Download className="mr-2 h-4 w-4" /> Summary</Button>
            <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-[12px] py-[8px] text-[12px] font-[600] text-[#475569]" onClick={exportComparison}><Download className="mr-2 h-4 w-4" /> B vs NB</Button>
          </div>
        </div>

        {/* ---------- Filters ---------- */}
        <div className="border-b border-[#f1f5f9] px-6 py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] font-[600] text-[#475569]"><Filter className="h-3.5 w-3.5 text-[#2563eb]" /> Filters</div>
            <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded-[6px] border border-[#fecaca] bg-white px-3 py-1.5 text-[11px] font-[700] text-[#dc2626]"><RefreshCw className="h-3 w-3" /> Reset</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <SelectFilter label="Beneficiary Status" value={filters.status} options={['Beneficiary', 'Non-Beneficiary']} onChange={(v) => handleFilterChange('status', v)} />
            <SelectFilter label="Region" value={filters.region} options={options.regions} onChange={(v) => handleFilterChange('region', v)} />
            <SelectFilter label="Province" value={filters.province} options={options.provinces} onChange={(v) => handleFilterChange('province', v)} />
            <SelectFilter label="Municipality" value={filters.municipality} options={options.municipalities} onChange={(v) => handleFilterChange('municipality', v)} />
            <SelectFilter label="Sex" value={filters.sex} options={options.sexes} onChange={(v) => handleFilterChange('sex', v)} />
            <SelectFilter label="Age Group" value={filters.ageGroup} options={AGE_GROUP_OPTIONS} onChange={(v) => handleFilterChange('ageGroup', v)} />
            <SelectFilter label="Education" value={filters.education} options={options.educations} onChange={(v) => handleFilterChange('education', v)} />
            <SelectFilter label="Marital Status" value={filters.marital} options={options.maritals} onChange={(v) => handleFilterChange('marital', v)} />
            <SelectFilter label="Primary Livelihood" value={filters.livelihood} options={options.livelihoods} onChange={(v) => handleFilterChange('livelihood', v)} />
            <SelectFilter label="Income Group" value={filters.incomeGroup} options={options.incomeGroups} onChange={(v) => handleFilterChange('incomeGroup', v)} />
            <SelectFilter label="Program Type" value={filters.programType} options={options.programTypes} onChange={(v) => handleFilterChange('programType', v)} />
            <SelectFilter label="Year Received" value={filters.yearReceived} options={options.years.map((y) => String(y))} onChange={(v) => handleFilterChange('yearReceived', v)} />
          </div>
        </div>

        {/* ---------- Summary cards ---------- */}
        <div className="px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[8px] p-[18px_20px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)] min-h-[96px]" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[30px] font-[800] tracking-tight">{summary.total.toLocaleString()}</div>
                  <div className="mt-1 text-[12px] font-[500] opacity-92">Total Respondents</div>
                  <div className="mt-1 text-[10.5px] font-[400] opacity-75">filtered set · {options.provinces.length} provinces · {options.municipalities.length} municipalities</div>
                </div>
                <div className="text-[38px] opacity-80">👥</div>
              </div>
            </div>
            <div className="rounded-[8px] p-[18px_20px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)] min-h-[96px]" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[30px] font-[800] tracking-tight">{summary.beneficiaries.toLocaleString()}<span className="text-[15px] font-[600] opacity-85"> ({summary.beneficiaryPct}%)</span></div>
                  <div className="mt-1 text-[12px] font-[500] opacity-92">Beneficiaries (B)</div>
                  <div className="mt-1 text-[10.5px] font-[400] opacity-75">program recipients</div>
                </div>
                <div className="text-[38px] opacity-80">🎖</div>
              </div>
            </div>
            <div className="rounded-[8px] p-[18px_20px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)] min-h-[96px]" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #7c3aed 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[30px] font-[800] tracking-tight">{summary.nonBeneficiaries.toLocaleString()}<span className="text-[15px] font-[600] opacity-85"> ({summary.nonBeneficiaryPct}%)</span></div>
                  <div className="mt-1 text-[12px] font-[500] opacity-92">Non-Beneficiaries (NB)</div>
                  <div className="mt-1 text-[10.5px] font-[400] opacity-75">comparison / control group</div>
                </div>
                <div className="text-[38px] opacity-80">⚖</div>
              </div>
            </div>
            <div className="rounded-[8px] p-[18px_20px] text-white shadow-[0_2px_10px_rgba(0,0,0,0.13)] min-h-[96px]" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[30px] font-[800] tracking-tight">{summary.avgIncome === null ? '—' : `₱${fmt(summary.avgIncome, 0)}`}</div>
                  <div className="mt-1 text-[12px] font-[500] opacity-92">Average Monthly Income</div>
                  <div className="mt-1 text-[10.5px] font-[400] opacity-75">median ₱{fmt(summary.medianIncome, 0)} · avg HH size {fmt(summary.avgHousehold, 1)} · avg age {fmt(summary.avgAge, 0)}</div>
                </div>
                <div className="text-[38px] opacity-80">💰</div>
              </div>
            </div>
          </div>

          {/* Index mini-cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['DOI', summary.doi, 'Durable goods'],
              ['LCI', summary.lci, 'Living conditions'],
              ['RPI', summary.rpi, 'Real property'],
              ['ICI', summary.ici, 'Insurance coverage'],
              ['MWI', summary.mwi, 'Material wellbeing'],
            ].map(([label, value, caption]) => (
              <div key={label} className="rounded-[8px] border border-[#e2e8f0] bg-[#fafbfc] p-3 text-center">
                <div className="text-[11px] font-[600] uppercase tracking-[0.04em] text-[#94a3b8]">{label}</div>
                <div className="mt-1 font-mono text-[20px] font-[800] text-[#2563eb]">{value === null ? '—' : value.toFixed(1)}</div>
                <div className="text-[10.5px] text-[#94a3b8]">{caption}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Matching & Impact headline metrics (PSM) ---------- */}
      {analysis ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard value={Number(analysis.attValue ?? 0).toFixed(4)} label="ATT — Avg Treatment Effect" caption={`Beneficiary (B): ${analysis.beneficiaryCount} · Non-Beneficiary (NB): ${analysis.nonBeneficiaryCount}`} tone="orange" icon="📈" />
          <MetricCard value={String(analysis.improved ?? 0)} label="SES Improved (B > A)" caption={`${Number(analysis.sesImprovementPct ?? 0).toFixed(1)}% of all respondents`} tone="green" icon="📈" />
          <MetricCard value={Number(analysis.meanSesAfterBeneficiary ?? analysis.meanSesAfter ?? 0).toFixed(2)} label="Mean SES After (Beneficiary)" caption={`Before: ${Number(analysis.meanSesBeforeBeneficiary ?? analysis.meanSesBefore ?? 0).toFixed(2)} · Δ ${Number(analysis.delta ?? 0).toFixed(2)}`} tone="blue" icon="📊" />
          <MetricCard value={`${analysis.beneficiaryCount}/${analysis.total}`} label="Beneficiaries vs Total Respondents" caption={`${Number(analysis.beneficiaryRate ?? 0).toFixed(1)}% beneficiary rate`} tone="purple" icon="👥" />
        </div>
      ) : null}

      {/* ---------- Combined chart dashboard (all charts in one grid) ---------- */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Model interpretation */}
        {safeFeatures.length ? (
          <ChartCard title="Feature Importance" subtitle={`Top ${safeFeatures.length} features ranked by mean impact`}>
            <ImportanceChart data={safeFeatures} />
          </ChartCard>
        ) : null}
        {safeFeatures.length ? (
          <ChartCard title="Impact Direction" subtitle="How each feature shifts beneficiary likelihood">
            <div className="mb-3"><DirectionLegend /></div>
            <DirectionChart data={safeFeatures} />
          </ChartCard>
        ) : null}

        {/* Matching & impact (PSM) */}
        {analysis ? (
          <ChartCard title="PS Score Distribution" subtitle="Propensity score overlap pattern">
            <GroupedBar data={analysis.psDistribution || []} dataKey="bin" height={220} />
          </ChartCard>
        ) : null}
        {analysis ? (
          <ChartCard title="SES Outcome Distribution" subtitle="Improved vs Declined vs No Change">
            <Donut data={[
              { name: 'Improved', value: analysis.improved, color: '#16a34a' },
              { name: 'Declined', value: analysis.declined, color: '#dc2626' },
              { name: 'No Change', value: analysis.noChange, color: '#94a3b8' },
            ]} dataKey="value" colors={['#16a34a', '#dc2626', '#94a3b8']} height={190} />
            <LegendItems items={[
              { name: 'Improved', value: analysis.improved, color: '#16a34a' },
              { name: 'Declined', value: analysis.declined, color: '#dc2626' },
              { name: 'No Change', value: analysis.noChange, color: '#94a3b8' },
            ]} />
          </ChartCard>
        ) : null}
        {analysis ? (
          <ChartCard title="SMD Before vs After Matching" subtitle="Covariate balance improvement">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analysis.smdData || []} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 0.45]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis dataKey="feature" type="category" width={86} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="before" name="Before" fill="#fca5a5" radius={[0, 4, 4, 0]} maxBarSize={10} />
                <Bar dataKey="after" name="After" fill="#0db890" radius={[0, 4, 4, 0]} maxBarSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}
        {analysis ? (
          <ChartCard title="SES Trend Line" subtitle="Matched pairs over index">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={(analysis.sesTrend || []).filter((row) => row.beneficiary !== 0 || row.nonBeneficiary !== 0)} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="beneficiary" name="Beneficiary" stroke={B_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="nonBeneficiary" name="Non-Beneficiary" stroke="#0db890" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}
        {analysis ? (
          <ChartCard title="Group Profile Radar" subtitle="B vs NB on key traits">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={analysis.radarData || []}>
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Radar name="Beneficiary (B)" dataKey="beneficiary" stroke={B_COLOR} fill={B_COLOR} fillOpacity={0.18} />
                <Radar name="Non-Beneficiary (NB)" dataKey="nonBeneficiary" stroke="#0db890" fill="#0db890" fillOpacity={0.18} />
                <Legend verticalAlign="top" height={28} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        {/* Demographics & respondent charts */}
        <ChartCard title="Beneficiary Distribution" subtitle="B vs NB composition">
          <Donut data={beneficiaryDist} colors={[B_COLOR, NB_COLOR, UNKNOWN_COLOR]} />
          <LegendItems items={beneficiaryDist.map((d) => ({ name: d.name, value: `${d.count} (${d.pct}%)`, color: d.name === 'Beneficiary' ? B_COLOR : d.name === 'Non-Beneficiary' ? NB_COLOR : UNKNOWN_COLOR }))} />
        </ChartCard>

        <ChartCard title="Program / Assistance Received" subtitle="Intervention type distribution">
          {programDist.length ? <GroupedBar data={programDist} horizontal height={240} /> : <EmptyNote text="No program column detected" />}
        </ChartCard>

        <ChartCard title="Marital Status" subtitle="Respondent civil status">
          {maritalDist.length ? (
            <>
              <Donut data={maritalDist} />
              <LegendItems items={maritalDist.slice(0, 6).map((d, i) => ({ name: d.name, value: d.count, color: CHART_COLORS[i % CHART_COLORS.length] }))} />
            </>
          ) : <EmptyNote text="No marital status column detected" />}
        </ChartCard>

        <ChartCard title="Age Groups" subtitle="18–35 · 36–52 · 53–69 · 70+">
          {ageGroupDist.length ? <GroupedBar data={ageGroupDist} height={240} /> : <EmptyNote text="No age column detected" />}
        </ChartCard>

        <ChartCard title="Sex Distribution" subtitle="Male / Female breakdown">
          {sexDist.length ? <GroupedBar data={sexDist} height={240} /> : <EmptyNote text="No sex column detected" />}
        </ChartCard>

        <ChartCard title="Educational Attainment" subtitle="Highest education level">
          {eduDist.length ? <GroupedBar data={eduDist} horizontal height={280} /> : <EmptyNote text="No education column detected" />}
        </ChartCard>

        <ChartCard title="Household Size" subtitle="Members per household">
          {hhDist.length ? <GroupedBar data={hhDist} height={240} /> : <EmptyNote text="No household size column detected" />}
        </ChartCard>

        <ChartCard title="Monthly Income Groups" subtitle="Philippine Peso brackets">
          {incomeDist.length ? <GroupedBar data={incomeDist} horizontal height={280} /> : <EmptyNote text="No income column detected" />}
        </ChartCard>

        <ChartCard title="Primary Livelihood" subtitle="Main livelihood of respondents">
          {livelihoodDist.length ? <GroupedBar data={livelihoodDist} horizontal height={280} /> : <EmptyNote text="No livelihood column detected" />}
        </ChartCard>

        <ChartCard title="Secondary Livelihood" subtitle="Supplementary income source">
          {secondaryLivelihoodDist.length ? <GroupedBar data={secondaryLivelihoodDist} horizontal height={240} /> : <EmptyNote text="No secondary livelihood column detected" />}
        </ChartCard>

        <ChartCard title="Years in Livelihood" subtitle="Fishing / livelihood experience">
          {yearsLivelihoodDist.length ? <GroupedBar data={yearsLivelihoodDist} horizontal height={240} /> : <EmptyNote text="No years-in-livelihood column detected" />}
        </ChartCard>

        <ChartCard title="Material Wellbeing Indices" subtitle="DOI · LCI · RPI · ICI · MWI (median, B vs NB)">
          {indexChartData.some((d) => d.Beneficiary || d['Non-Beneficiary']) ? <GroupedBar data={indexChartData} dataKey="name" height={240} /> : <EmptyNote text="No index columns (DOI/LCI/RPI/ICI/MWI) detected" />}
        </ChartCard>

        {/* Before / after + perception */}
        {beforeAfter.applicable ? (
          <ChartCard title="Before vs After" subtitle={`SES score comparison · ${beforeAfter.pairs} paired respondents · Δ ${fmt(beforeAfter.delta, 2)}`}>
            <GroupedBar data={beforeAfter.data} height={240} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[6px] bg-[#eff6ff] p-2"><div className="text-[10.5px] text-[#64748b]">Before (mean)</div><div className="font-mono text-[15px] font-[800] text-[#2563eb]">{fmt(beforeAfter.beforeAvg, 2)}</div></div>
              <div className="rounded-[6px] bg-[#dcfce7] p-2"><div className="text-[10.5px] text-[#64748b]">After (mean)</div><div className="font-mono text-[15px] font-[800] text-[#0db890]">{fmt(beforeAfter.afterAvg, 2)}</div></div>
              <div className="rounded-[6px] bg-[#fef3c7] p-2"><div className="text-[10.5px] text-[#64748b]">Change</div><div className="font-mono text-[15px] font-[800] text-[#f59e0b]">{beforeAfter.delta >= 0 ? '+' : ''}{fmt(beforeAfter.delta, 2)}</div></div>
            </div>
          </ChartCard>
        ) : null}
        {perception.applicable ? (
          <ChartCard title="Program Evaluation (PEI)" subtitle={`Perception factors (0–100) · ${perception.count} respondents · PEI ${perception.pei}`}>
            <SingleBar data={perception.data} dataKey="name" valueKey="value" horizontal height={Math.max(240, perception.data.length * 42)} barColor="#7c3aed" />
          </ChartCard>
        ) : null}

        {/* Ownership / access charts */}
        <ChartCard title="Durable Goods Ownership" subtitle="% of respondents owning each item">
          {durablesStats.length ? <SingleBar data={durablesStats} dataKey="name" valueKey="ownershipPct" horizontal height={Math.max(260, durablesStats.length * 40)} /> : <EmptyNote text="No durable goods columns detected" />}
        </ChartCard>
        <ChartCard title="Social Service Access" subtitle="% accessing 4Ps · PhilHealth · scholarship · pension">
          {servicesStats.length ? <SingleBar data={servicesStats} dataKey="name" valueKey="ownershipPct" horizontal height={Math.max(260, servicesStats.length * 40)} barColor="#0db890" /> : <EmptyNote text="No social service columns detected" />}
        </ChartCard>
        <ChartCard title="Housing Conditions" subtitle="% with adequate water, electricity, fuel, tenure">
          {housingStats.length ? <SingleBar data={housingStats} dataKey="name" valueKey="ownershipPct" horizontal height={Math.max(260, housingStats.length * 40)} barColor="#f59e0b" /> : <EmptyNote text="No housing condition columns detected" />}
        </ChartCard>
        <ChartCard title="Insurance & Social Protection Coverage" subtitle="% covered by Pag-IBIG · PhilHealth · SSS · 4Ps etc.">
          {insuranceStats.length ? <SingleBar data={insuranceStats} dataKey="name" valueKey="ownershipPct" horizontal height={Math.max(260, insuranceStats.length * 40)} barColor="#06b6d4" /> : <EmptyNote text="No insurance / social protection columns detected" />}
        </ChartCard>
        <ChartCard title="Real Property Ownership" subtitle="% owning land, lots, real property">
          {propertyStats.length ? <SingleBar data={propertyStats} dataKey="name" valueKey="ownershipPct" horizontal height={Math.max(240, propertyStats.length * 40)} barColor="#84cc16" /> : <EmptyNote text="No real property columns detected" />}
        </ChartCard>
      </div>

      {/* ---------- Beneficiary vs Non-Beneficiary comparison ---------- */}
      <Card className="overflow-hidden rounded-[8px] border border-[#e2e8f0] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <CardHeader className="flex flex-row items-start justify-between border-b border-[#f1f5f9] p-[11px_15px_8px]">
          <div>
            <CardTitle className="text-[13px] font-[700] text-[#1e293b]">Beneficiary vs Non-Beneficiary</CardTitle>
            <div className="mt-[1px] text-[11px] font-[400] text-[#94a3b8]">Group comparison · all filtered respondents</div>
          </div>
          <Button variant="outline" className="h-8 rounded-[6px] border-[#e2e8f0] bg-white px-[10px] text-[11px] font-[600] text-[#475569]" onClick={exportComparison}><Download className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.03em] text-[#475569]">
                  <th className="border-b border-[#f1f5f9] px-4 py-2.5 text-left font-[700]">Metric</th>
                  <th className="border-b border-[#f1f5f9] px-4 py-2.5 text-right font-[700] text-[#2563eb]">Beneficiary (B)</th>
                  <th className="border-b border-[#f1f5f9] px-4 py-2.5 text-right font-[700] text-[#475569]">Non-Beneficiary (NB)</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.metric} className={row.metric === 'Respondents' ? 'bg-[#fafbfc]' : 'border-b border-[#f8fafc]'}>
                    <td className="px-4 py-2.5 text-[#334155]">{row.metric}</td>
                    <td className="px-4 py-2.5 text-right font-[700] text-[#2563eb]">{row.beneficiary}</td>
                    <td className="px-4 py-2.5 text-right font-[600] text-[#475569]">{row.nonBeneficiary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Distribution map ---------- */}
      <div className="overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ecfeff] text-[#06b6d4]"><MapPin className="h-4 w-4" /></div>
            <div>
              <div className="text-[14px] font-[700] text-[#1e293b]">Geographic Distribution</div>
              <div className="text-[12px] font-[400] text-[#94a3b8]">Bubble size = respondents · color = majority group · scope: {filters.region !== 'All' ? filters.region : 'Philippines'}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-[6px] border border-[#e2e8f0] bg-[#f8fafc] p-1">
              <button type="button" onClick={() => setMapMode('region')} className={`rounded-[5px] px-3 py-1.5 text-[11px] font-[700] ${mapMode === 'region' ? 'bg-[#2563eb] text-white' : 'text-[#64748b]'}`}><Layers className="mr-1 inline h-3 w-3" />Region</button>
              <button type="button" onClick={() => setMapMode('province')} className={`rounded-[5px] px-3 py-1.5 text-[11px] font-[700] ${mapMode === 'province' ? 'bg-[#2563eb] text-white' : 'text-[#64748b]'}`}><Layers className="mr-1 inline h-3 w-3" />Province</button>
              <button type="button" onClick={() => setMapMode('municipality')} className={`rounded-[5px] px-3 py-1.5 text-[11px] font-[700] ${mapMode === 'municipality' ? 'bg-[#2563eb] text-white' : 'text-[#64748b]'}`}><MapPin className="mr-1 inline h-3 w-3" />Municipality</button>
            </div>
            <button type="button" onClick={() => setShowOutside((s) => !s)} className={`rounded-[6px] border px-3 py-2 text-[11px] font-[700] ${showOutside ? 'border-[#2563eb] bg-[#eff6ff] text-[#2563eb]' : 'border-[#e2e8f0] bg-white text-[#64748b]'}`}>Show non-damaged / no-data areas ({outsideMunicipalities.length})</button>
            <Button variant="outline" className="h-8 rounded-[6px] border-[#e2e8f0] bg-white px-[10px] text-[11px] font-[600] text-[#475569]" onClick={exportMunicipalities}><Download className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>
          </div>
        </div>
        <div className="relative h-[520px]">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            minZoom={PHILIPPINES_MIN_ZOOM}
            maxZoom={PHILIPPINES_MAX_ZOOM}
            bounds={PHILIPPINES_BOUNDS}
            boundsOptions={{ padding: [20, 20] }}
            maxBounds={PHILIPPINES_BOUNDS}
            maxBoundsViscosity={1}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors · Updated 2025 geographic basemap' />
            <MapFocus focusKey={mapFocusKey} center={mapCenter} zoom={mapZoom} />
            {mapData.map((item) => {
              const maxTotal = Math.max(...mapData.map((d) => d.total), 1);
              const radius = 8 + Math.sqrt(item.total / maxTotal) * 30;
              const isBlue = item.b >= item.nb;
              const beneficiaryPct = item.total ? ((item.b / item.total) * 100).toFixed(1) : '0';
              const nbPct = item.total ? ((item.nb / item.total) * 100).toFixed(1) : '0';
              return (
                <CircleMarker
                  key={`${mapMode}-${item.name}`}
                  center={item.coords}
                  radius={radius}
                  pathOptions={{ color: isBlue ? '#93c5fd' : '#cbd5e1', weight: 1.8, fillColor: isBlue ? '#3b82f6' : '#94a3b8', fillOpacity: 0.6 }}
                >
                  <LeafletTooltip direction="top" offset={[0, -radius]} opacity={1}>
                    <div style={{ minWidth: 200, fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{item.name}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <tbody>
                          {[
                            ['Total Respondents', item.total, '#1e293b'],
                            ['Beneficiary (B)', `${item.b} (${beneficiaryPct}%)`, '#2563eb'],
                            ['Non-Beneficiary (NB)', `${item.nb} (${nbPct}%)`, '#475569'],
                          ].map(([label, value, color]) => (
                            <tr key={label}>
                              <td style={{ padding: '3px 0', color: '#94a3b8', paddingRight: 12, whiteSpace: 'nowrap' }}>{label}</td>
                              <td style={{ padding: '3px 0', fontWeight: 700, color }}>{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              );
            })}
            {showOutside && outsideMunicipalities.map((m) => (
              <CircleMarker
                key={`out-${m.name}`}
                center={m.coords}
                radius={4}
                pathOptions={{ color: '#e2e8f0', weight: 1, fillColor: '#f1f5f9', fillOpacity: 0.8 }}
              >
                <LeafletTooltip direction="top" opacity={1}>
                  <div style={{ minWidth: 180, fontFamily: 'Inter, sans-serif', fontSize: 11.5 }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: 3 }}>{m.name}<span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>{m.province}</span></div>
                    <div style={{ color: '#94a3b8' }}>No data — outside program areas</div>
                  </div>
                </LeafletTooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          <div className="absolute bottom-4 left-4 z-20 rounded-[8px] border border-[#e2e8f0] bg-white/95 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.12)] text-[11px] text-[#475569]">
            <div className="mb-2 font-[700] text-[#334155]">Bubble Size = Respondent Count</div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: '#3b82f6' }} />
              <span>Majority Beneficiary</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: '#94a3b8' }} />
              <span>Majority Non-Beneficiary</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Outside-program municipalities list ---------- */}
      <Card className="overflow-hidden rounded-[8px] border border-[#e2e8f0] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <CardHeader className="flex flex-row items-start justify-between border-b border-[#f1f5f9] p-[11px_15px_8px]">
          <div>
            <CardTitle className="text-[13px] font-[700] text-[#1e293b]">Municipalities Outside Program Areas</CardTitle>
            <div className="mt-[1px] text-[11px] font-[400] text-[#94a3b8]">{outsideMunicipalities.length} municipalities in scope with no respondent data{showOutside ? ' — shown as gray dots on map' : ''}</div>
          </div>
          <Button variant="outline" className="h-8 rounded-[6px] border-[#e2e8f0] bg-white px-[10px] text-[11px] font-[600] text-[#475569]" onClick={exportMunicipalities}><Download className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          {outsideMunicipalities.length ? (
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full border-collapse text-[12px]">
                <thead className="sticky top-0">
                  <tr className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.03em] text-[#475569]">
                    <th className="border-b border-[#f1f5f9] px-4 py-2.5 text-left font-[700]">Municipality</th>
                    <th className="border-b border-[#f1f5f9] px-4 py-2.5 text-left font-[700]">Province</th>
                    <th className="border-b border-[#f1f5f9] px-4 py-2.5 text-left font-[700]">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {outsideMunicipalities.map((m) => (
                    <tr key={m.name} className="border-b border-[#f8fafc] hover:bg-[#fafbfc]">
                      <td className="px-4 py-2 text-[#334155]">{m.name}</td>
                      <td className="px-4 py-2 text-[#64748b]">{m.province}</td>
                      <td className="px-4 py-2 text-[#64748b]">{m.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-[12px] text-[#94a3b8]">All municipalities in scope have respondent data.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const EmptyNote = ({ text }) => (
  <div className="flex h-[180px] items-center justify-center rounded-[6px] border border-dashed border-[#e2e8f0] text-[12px] text-[#94a3b8]">{text}</div>
);

export default RespondentAnalytics;
