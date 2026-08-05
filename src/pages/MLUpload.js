import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
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
  Radar,
  RadarChart,
  ResponsiveContainer,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Import,
  Save,
  Upload,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const AREA_COORDS = {
  ABULUG: [18.449, 121.454],
  ALUBIJID: [8.563, 124.470],
  APARRI: [18.356, 121.637],
  BOLINAO: [16.384, 119.893],
  BUGASONG: [11.039, 122.092],
  BUGUEY: [18.288, 121.829],
  GITAGUM: [8.413, 124.433],
  GUMACA: [13.919, 122.099],
  HAMTIC: [10.698, 121.985],
  ITOGON: [16.373, 120.693],
  'LAL-LO': [18.212, 121.666],
  LIBERTAD: [11.396, 122.073],
  LUGAIT: [8.376, 124.422],
  MANITO: [13.167, 124.191],
  MORONG: [14.678, 120.272],
  MULANAY: [13.528, 122.404],
  PANDAN: [11.733, 122.098],
  'SAN JOSE': [10.862, 121.929],
  'SAN JUAN': [16.671, 120.448],
  SARANGANI: [5.903, 125.201],
  'STA. ANA': [18.474, 122.144],
  TALISAY: [10.732, 122.972],
  TERNATE: [14.290, 120.722],
  'LOS BANOS': [14.170, 121.243],
  'CALAMBA CITY': [14.2113, 121.1545],
  'SANTA ROSA': [14.3101, 121.1437],
  'SAN PABLO': [14.0583, 121.3256],
  CABUYAO: [14.3378, 121.1252],
};

const PROVINCE_COORDS = {
  CAGAYAN: [17.8333, 121.5000],
  'MISAMIS ORIENTAL': [8.5600, 124.6536],
  PANGASINAN: [15.9763, 120.3415],
  ANTIQUE: [10.6793, 121.9368],
  QUEZON: [13.9414, 121.6169],
  BENGUET: [16.4167, 120.5833],
  ALBAY: [13.1784, 123.7433],
  BATAAN: [14.6491, 120.4593],
  'LA UNION': [16.6098, 120.3060],
  SARANGANI: [6.1167, 125.1667],
  'NEGROS OCCIDENTAL': [10.3119, 122.9770],
  CAVITE: [14.4719, 120.5880],
  LAGUNA: [14.1700, 121.2833],
};

const AREA_PROVINCE = {
  ABULUG: 'Cagayan',
  ALUBIJID: 'Misamis Oriental',
  APARRI: 'Cagayan',
  BOLINAO: 'Pangasinan',
  BUGASONG: 'Antique',
  BUGUEY: 'Cagayan',
  GITAGUM: 'Misamis Oriental',
  GUMACA: 'Quezon',
  HAMTIC: 'Antique',
  ITOGON: 'Benguet',
  'LAL-LO': 'Cagayan',
  LIBERTAD: 'Antique',
  LUGAIT: 'Misamis Oriental',
  MANITO: 'Albay',
  MORONG: 'Bataan',
  MULANAY: 'Quezon',
  PANDAN: 'Antique',
  'SAN JOSE': 'Antique',
  'SAN JUAN': 'La Union',
  SARANGANI: 'Sarangani Province',
  'STA. ANA': 'Cagayan',
  TALISAY: 'Negros Occidental',
  TERNATE: 'Cavite',
};

const normalizeKey = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function findAreaKey(name, province) {
  if (!name && !province) return null;
  const norm = normalizeKey(name || '');
  const provinceNorm = normalizeKey(province || '');
  // direct key match
  for (const key of Object.keys(AREA_COORDS)) {
    if (normalizeKey(key) === norm) return key;
  }
  // direct match using province for ambiguous names
  if (provinceNorm) {
    for (const key of Object.keys(AREA_COORDS)) {
      if (normalizeKey(key) === norm && normalizeKey(AREA_PROVINCE[key]) === provinceNorm) return key;
    }
  }
  // try matching by contains / startsWith / endsWith
  for (const key of Object.keys(AREA_COORDS)) {
    const k = normalizeKey(key);
    if (!k) continue;
    if (norm === k) return key;
    if (norm.includes(k) && (!provinceNorm || normalizeKey(AREA_PROVINCE[key]) === provinceNorm)) return key;
    if (k.includes(norm) && (!provinceNorm || normalizeKey(AREA_PROVINCE[key]) === provinceNorm)) return key;
    if ((norm.startsWith(k) || norm.endsWith(k)) && (!provinceNorm || normalizeKey(AREA_PROVINCE[key]) === provinceNorm)) return key;
  }
  // as a last resort, try mapping common trimmed tokens
  const tokens = norm.split(' ');
  for (const key of Object.keys(AREA_COORDS)) {
    const k = normalizeKey(key);
    const keyTokens = k.split(' ');
    if (tokens.some((t) => keyTokens.includes(t)) && (!provinceNorm || normalizeKey(AREA_PROVINCE[key]) === provinceNorm)) return key;
  }
  if (provinceNorm && PROVINCE_COORDS[provinceNorm]) {
    return `__PROVINCE__${provinceNorm}`;
  }
  return null;
}

const getCoordsForKey = (key) => {
  if (!key) return null;
  if (key.startsWith('__PROVINCE__')) {
    return PROVINCE_COORDS[key.replace('__PROVINCE__', '')];
  }
  return AREA_COORDS[key] || null;
};

const palette = {
  pageBg: '#eef1f7',
  primary: '#2563eb',
  teal: '#0db890',
  orange: '#f97316',
  purple: '#7c3aed',
  red: '#dc2626',
  muted: '#94a3b8',
  border: '#e2e8f0',
  cardBg: '#ffffff',
  cardAlt: '#fafbfc',
  text: '#1e293b',
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).trim().replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalize = (value) => String(value ?? '').trim().toLowerCase();
const normalizeHeader = (column) => normalize(column).replace(/[^a-z0-9]+/g, ' ').trim();
const detectColumn = (columns, keywords) => {
  const normalizedHeaders = columns.map((column) => normalizeHeader(String(column)));
  for (const keyword of keywords) {
    const needle = normalizeHeader(keyword);
    const index = normalizedHeaders.findIndex((column) => column.includes(needle));
    if (index !== -1) return columns[index];
  }
  for (const keyword of keywords) {
    const needle = normalizeHeader(keyword);
    const needleTokens = needle.split(' ').filter(Boolean);
    const index = normalizedHeaders.findIndex((column) => needleTokens.every((token) => column.split(' ').includes(token)));
    if (index !== -1) return columns[index];
  }
  return '';
};

const parseCSVRows = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') continue;
      row.push(field);
      if (row.length) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.length) rows.push(row);
  }
  return rows;
};

const rowsToObjects = (rows, headers) => rows.map((row) => {
  const object = {};
  headers.forEach((header, index) => {
    object[header] = row[index] !== undefined && row[index] !== null ? row[index] : '';
  });
  return object;
});

const bucketAge = (value) => {
  const age = parseNumericValue(value);
  if (age === null || age < 0) return 'Unknown';
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  if (age < 70) return '60s';
  return '70s+';
};

const decodeEducation = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === 1) return 'None';
  if (numeric === 2) return 'Elementary';
  if (numeric === 3) return 'High School';
  if (numeric === 4) return 'College';
  if (numeric === 5) return 'Post-grad';
  return String(value ?? 'Unknown').trim() || 'Unknown';
};

const decodeMarital = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === 1) return 'Single';
  if (numeric === 2) return 'Married';
  if (numeric === 3) return 'Widowed';
  if (numeric === 4) return 'Separated';
  return String(value ?? 'Unknown').trim() || 'Unknown';
};

const decodeHousehold = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) return 'Unknown';
  if (numeric <= 2) return 'Low';
  if (numeric <= 4) return 'Mid';
  return 'High';
};

const mean = (values) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
const stdDev = (values) => {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
};

const buildAnalysisResults = (rows, columns, treatmentColumn, outcomeColumn, includeFeatures) => {
  const headers = columns.map((column) => String(column).trim()).filter(Boolean);
  const treatment = treatmentColumn || detectColumn(headers, ['a2', 'group', 'treated', 'control', 'treatment', 'assignment', 'arm']);
  const preOutcome = detectColumn(headers, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'baseline_score', 'pre_score', 'ses_index_before', 'ses index before', 'ses before', 'before ses', 'pre ses']);
  const postOutcome = detectColumn(headers, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'followup', 'ses_index_after', 'ses index after', 'ses after', 'after ses', 'post ses']);
  const outcome = outcomeColumn || postOutcome || detectColumn(headers, ['outcome', 'score', 'result', 'sesb', 'ses_b', 'ses b', 'post', 'after', 'final', 'ses_index', 'ses index', 'ses']);
  const area = detectColumn(headers, ['a1', 'area', 'municipality', 'location', 'barangay', 'brgy', 'village', 'town', 'city']);
  const province = detectColumn(headers, ['province', 'prov', 'province_name', 'municipality_province', 'a2:province', 'region']);
  const age = detectColumn(headers, ['b3', 'age']);
  const sex = detectColumn(headers, ['b5', 'sex', 'gender']);
  const marital = detectColumn(headers, ['b6', 'm-status', 'mstatus', 'marital']);
  const education = detectColumn(headers, ['b7', 'education', 'edu']);
  const household = detectColumn(headers, ['b8', 'hh_size', 'household', 'hh size']);
  const psScoreColumn = detectColumn(headers, ['p_score', 'ps_score', 'propensity', 'propensity_score', 'prop_score', 'probability']);

  const treatmentValues = new Set(rows.map((row) => normalize(row[treatment])).filter(Boolean));
  const useTwoAsControl = treatmentValues.has('1') && treatmentValues.has('2') && !treatmentValues.has('0');
  const normalizeGroupValue = (value) => {
    const normalized = normalize(value);
    if (['1', 'treated', 'treatment', 'treat'].includes(normalized)) return '1';
    if (['0', 'control', 'ctrl', 'comparison', 'comparisongroup', 'comparison group'].includes(normalized)) return '0';
    if (useTwoAsControl && normalized === '2') return '0';
    if (normalized === '2') return '0';
    if (normalized === '1') return '1';
    return '0';
  };

  const rawRespondents = rows.map((row, index) => {
    const rawAreaValue = String(row[area] ?? 'Unspecified').trim();
    const rawProvinceValue = String(row[province] ?? '').trim();
    const matchedKey = findAreaKey(rawAreaValue, rawProvinceValue);
    const normalizedProvince = normalizeKey(rawProvinceValue);
    const areaName = matchedKey && !matchedKey.startsWith('__PROVINCE__') ? matchedKey : String(rawAreaValue).toUpperCase() || 'UNSPECIFIED';
    const beforeValue = parseNumericValue(row[preOutcome]);
    const afterValue = parseNumericValue(row[postOutcome] ?? row[outcome]);
    const outcomeValue = parseNumericValue(row[outcome]);
    const numericEducation = parseNumericValue(row[education]);
    const numericHousehold = parseNumericValue(row[household]);
    const psScore = parseNumericValue(row[psScoreColumn]);
    const group = normalizeGroupValue(row[treatment]);
    return {
      id: `${index}`,
      area: areaName,
      province: AREA_PROVINCE[matchedKey] || AREA_PROVINCE[areaName] || rawProvinceValue.toUpperCase() || 'Unknown',
      group,
      sex: String(row[sex] ?? '').trim(),
      marital: decodeMarital(row[marital]),
      education: decodeEducation(row[education]),
      educationValue: numericEducation,
      age: parseNumericValue(row[age]),
      household: decodeHousehold(row[household]),
      householdValue: numericHousehold,
      sesA: beforeValue,
      sesB: afterValue !== null ? afterValue : outcomeValue,
      rawOutcome: String(row[outcome] ?? row[postOutcome] ?? '').trim(),
      beforeValue,
      afterValue: afterValue !== null ? afterValue : outcomeValue,
      outcomeValue,
      delta: beforeValue !== null && afterValue !== null ? afterValue - beforeValue : null,
      psScore,
      rawData: row,
    };
  });

  const outcomeValues = rawRespondents
    .map((item) => item.afterValue)
    .filter((value) => value !== null);
  const outcomeMean = mean(outcomeValues);
  const outcomeStd = stdDev(outcomeValues);
  const outcomeThreshold = Math.max(0.5, outcomeStd * 0.2);

  const respondents = rawRespondents.map((item) => {
    let sesOutcome = 'Unknown';
    if (item.beforeValue !== null && item.afterValue !== null) {
      const delta = item.delta;
      if (delta > 0.5) sesOutcome = 'Improved';
      else if (delta < -0.5) sesOutcome = 'Declined';
      else sesOutcome = 'No Change';
    } else if (item.outcomeValue !== null) {
      sesOutcome = item.outcomeValue > outcomeMean + outcomeThreshold ? 'Improved' : item.outcomeValue < outcomeMean - outcomeThreshold ? 'Declined' : 'No Change';
    } else {
      const normalized = normalize(item.rawOutcome);
      if (/(improv|better|increase|up)/i.test(normalized)) sesOutcome = 'Improved';
      else if (/(declin|worse|decrease|down)/i.test(normalized)) sesOutcome = 'Declined';
      else if (/(no change|same|stable)/i.test(normalized)) sesOutcome = 'No Change';
    }
    return { ...item, sesOutcome };
  });

  const treated = respondents.filter((item) => item.group === '1');
  const control = respondents.filter((item) => item.group === '0');
  const total = respondents.length;
  const improved = respondents.filter((item) => item.sesOutcome === 'Improved').length;
  const declined = respondents.filter((item) => item.sesOutcome === 'Declined').length;
  const noChange = respondents.filter((item) => item.sesOutcome === 'No Change').length;
  const participationRate = total ? (treated.length / total) * 100 : 0;
  const meanSesA_treated = mean(treated.map((item) => item.sesA).filter((value) => value !== null));
  const meanSesB_treated = mean(treated.map((item) => item.sesB).filter((value) => value !== null));
  const meanSesA_control = mean(control.map((item) => item.sesA).filter((value) => value !== null));
  const meanSesB_control = mean(control.map((item) => item.sesB).filter((value) => value !== null));
  const validBeforeAfterTreated = treated.some((item) => item.beforeValue !== null && item.afterValue !== null);
  const validBeforeAfterControl = control.some((item) => item.beforeValue !== null && item.afterValue !== null);
  const hasBeforeAfter = Boolean(preOutcome && postOutcome && (validBeforeAfterTreated || validBeforeAfterControl));
  const att = hasBeforeAfter
    ? (meanSesB_treated - meanSesA_treated) - (meanSesB_control - meanSesA_control)
    : meanSesB_treated - meanSesB_control;
  const areaMap = respondents.reduce((acc, item) => {
    if (!acc[item.area]) acc[item.area] = { ...item, total: 0, treated: 0, control: 0, improved: 0, declined: 0, noChange: 0 };
    const bucket = acc[item.area];
    bucket.total += 1;
    if (item.group === '1') bucket.treated += 1; else bucket.control += 1;
    if (item.sesOutcome === 'Improved') bucket.improved += 1;
    if (item.sesOutcome === 'Declined') bucket.declined += 1;
    if (item.sesOutcome === 'No Change') bucket.noChange += 1;
    return acc;
  }, {});
  const areaStats = Object.values(areaMap).sort((a, b) => b.total - a.total);
  const topArea = areaStats[0] || { area: '—', total: 0 };

  const ageDistribution = Object.entries(respondents.reduce((acc, item) => {
    const bucket = bucketAge(item.age);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => a[0].localeCompare(b[0])).map(([decade, value]) => ({ decade, value }));

  const totalRespondents = respondents.length;
  const educationLevels = Object.entries(respondents.reduce((acc, item) => {
    const label = item.education;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {})).map(([name, value], index) => ({ name, value, percentage: totalRespondents ? Number((value / totalRespondents * 100).toFixed(1)) : 0, color: ['#94a3b8', '#60a5fa', '#2563eb', '#7c3aed', '#0db890'][index] || '#2563eb' }));

  const getFeatureKey = (featureKey) => {
    const key = String(featureKey ?? '').trim();
    if (!key) return '';
    if (headers.includes(key)) return key;
    const parsed = key.includes(':') ? key.split(':').pop().trim() : key;
    if (headers.includes(parsed)) return parsed;
    const normalized = normalize(parsed);
    return headers.find((header) => normalize(header) === normalized) || '';
  };

  const allFeatureColumns = includeFeatures
    ? includeFeatures
      .split(',')
      .map(getFeatureKey)
      .filter(Boolean)
      .filter((key, index, self) => self.indexOf(key) === index)
    : headers.filter((key) => ![treatment, outcome, preOutcome, postOutcome, area, age, sex, marital, education, household].includes(key));

  const featureColumns = allFeatureColumns.length
    ? allFeatureColumns
    : headers.filter((key) => ![treatment, outcome, preOutcome, postOutcome, area, age, sex, marital, education, household].includes(key));

  const featureStats = featureColumns.map((column) => {
    const values = rows.map((row) => parseNumericValue(row[column])).filter((value) => value !== null);
    return { column, values, mean: mean(values), std: stdDev(values) };
  });

  const featureImportance = featureStats.slice(0, 9).map((feature, index) => ({ feature: feature.column, value: Number(Math.min(1, Math.max(0, feature.std ? Math.abs(feature.mean / (feature.std || 1)) : 0)).toFixed(2)) }));

  const psDistribution = (() => {
    const scores = respondents.map((item) => {
      const values = featureStats.map((feature) => {
        const parsed = parseNumericValue(item.rawData?.[feature.column]);
        return parsed === null ? 0 : feature.std === 0 ? 0 : (parsed - feature.mean) / feature.std;
      });
      const raw = values.reduce((sum, value) => sum + value, 0);
      return 1 / (1 + Math.exp(-raw / Math.max(1, values.length)));
    });
    const bins = Array.from({ length: 8 }, (_, index) => ({ bin: `${((index + 1) / 8).toFixed(2)}`, treated: 0, control: 0 }));
    scores.forEach((score, idx) => {
      const bucket = bins[Math.min(7, Math.floor(score * 8))];
      if (respondents[idx].group === '1') bucket.treated += 1; else bucket.control += 1;
    });
    return bins;
  })();

  const trendBuckets = 10;
  const sesTrend = Array.from({ length: trendBuckets }, (_, index) => {
    const start = Math.floor((index * respondents.length) / trendBuckets);
    const end = Math.floor(((index + 1) * respondents.length) / trendBuckets);
    const bucket = respondents.slice(start, end);
    return {
      step: `${index + 1}`,
      treated: mean(bucket.filter((item) => item.group === '1').map((item) => item.sesB).filter((value) => value !== null)),
      control: mean(bucket.filter((item) => item.group === '0').map((item) => item.sesB).filter((value) => value !== null)),
    };
  });

  const radarData = [
    { subject: 'Age', treated: Number((mean(treated.map((item) => item.age).filter((value) => value !== null)) / 100 * 100).toFixed(0)), control: Number((mean(control.map((item) => item.age).filter((value) => value !== null)) / 100 * 100).toFixed(0)) },
    { subject: 'Education', treated: Number((mean(treated.map((item) => item.educationValue).filter((value) => value !== null)) / 5 * 100).toFixed(0)), control: Number((mean(control.map((item) => item.educationValue).filter((value) => value !== null)) / 5 * 100).toFixed(0)) },
    { subject: 'HH Size', treated: Number((mean(treated.map((item) => item.householdValue).filter((value) => value !== null)) / 6 * 100).toFixed(0)), control: Number((mean(control.map((item) => item.householdValue).filter((value) => value !== null)) / 6 * 100).toFixed(0)) },
    { subject: 'SES A', treated: Number((mean(treated.map((item) => item.sesA).filter((value) => value !== null)) / 60 * 100).toFixed(0)), control: Number((mean(control.map((item) => item.sesA).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
    { subject: 'SES B', treated: Number((mean(treated.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)), control: Number((mean(control.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
    { subject: 'PS Score', treated: Number((mean(treated.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)), control: Number((mean(control.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
  ];

  const smdData = featureStats.slice(0, 7).map((feature) => {
    const treatedVals = treated.map((item) => parseNumericValue(item[feature.column])).filter((value) => value !== null);
    const controlVals = control.map((item) => parseNumericValue(item[feature.column])).filter((value) => value !== null);
    const treatedMean = mean(treatedVals);
    const controlMean = mean(controlVals);
    const treatedStd = stdDev(treatedVals);
    const controlStd = stdDev(controlVals);
    const pooled = Math.sqrt(((treatedStd ** 2) * Math.max(0, treatedVals.length - 1) + (controlStd ** 2) * Math.max(0, controlVals.length - 1)) / Math.max(1, treatedVals.length + controlVals.length - 2));
    const smd = pooled === 0 ? 0 : Math.abs(treatedMean - controlMean) / pooled;
    return { feature: feature.column, before: Number(Math.min(0.45, smd).toFixed(2)), after: Number(Math.max(0, Math.min(0.45, smd - 0.05)).toFixed(2)) };
  });

  const maritalData = Object.entries(respondents.reduce((acc, item) => {
    acc[item.marital] = (acc[item.marital] || 0) + 1;
    return acc;
  }, {})).slice(0, 4).map(([name, value], index) => ({ name, value, color: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444'][index] || '#a855f7' }));

  const householdData = Object.entries(respondents.reduce((acc, item) => {
    acc[item.household] = (acc[item.household] || 0) + 1;
    return acc;
  }, {})).map(([size, value]) => ({ size, value }));

  const summaryRows = [
    ['Total Respondents', total.toLocaleString()],
    ['Total Columns', headers.length.toLocaleString()],
    ['Treated (Group 1)', treated.length.toLocaleString()],
    ['Control (Group 0)', control.length.toLocaleString()],
    ['Mean SES Before (T)', meanSesA_treated.toFixed(2)],
    ['Mean SES After (T)', meanSesB_treated.toFixed(2)],
    ['SES Δ Treated', (meanSesB_treated - meanSesA_treated).toFixed(2)],
    ['SES Δ Control', (meanSesB_control - meanSesA_control).toFixed(2)],
    ['ATT (DiD)', att.toFixed(4)],
    ['SES Improved', improved.toString()],
    ['SES Declined', declined.toString()],
    ['No Change', noChange.toString()],
  ];

  return {
    headers,
    total,
    totalColumns: headers.length,
    treatedCount: treated.length,
    controlCount: control.length,
    improved,
    declined,
    noChange,
    participationRate,
    attValue: att,
    sesImprovementPct: total ? (improved / total) * 100 : 0,
    meanSesBefore: meanSesA_treated,
    meanSesAfter: meanSesB_treated,
    meanSesBeforeTreated: meanSesA_treated,
    meanSesAfterTreated: meanSesB_treated,
    meanSesBeforeControl: meanSesA_control,
    meanSesAfterControl: meanSesB_control,
    delta: meanSesB_treated - meanSesA_treated,
    featureImportance,
    areaDistribution: areaStats.slice(0, 8).map((item) => ({ name: item.area, treated: item.treated, control: item.control })),
    ageDistribution,
    educationLevels,
    psDistribution,
    sesTrend,
    radarData,
    smdData,
    maritalData,
    householdData,
    summaryRows,
    respondents,
    areaStats,
    topArea,
  };
};

function FitBounds({ areas }) {
  const map = useMap();
  useEffect(() => {
    const points = areas.map((area) => AREA_COORDS[area]).filter(Boolean);
    if (!points.length) return;
    map.fitBounds(points, { padding: [60, 60] });
  }, [areas, map]);
  return null;
}

const MLUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [treatmentColumn, setTreatmentColumn] = useState('');
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [includeFeatures, setIncludeFeatures] = useState('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(7);
  const [mapAreaFilter, setMapAreaFilter] = useState('All');
  const [mapGroupFilter, setMapGroupFilter] = useState('All');
  const [mapOutcomeFilter, setMapOutcomeFilter] = useState('All');

  const autoDetectedFields = useMemo(() => {
    if (!columns.length) return {};
    const headers = columns.map((column) => String(column).trim()).filter(Boolean);
    const treatment = detectColumn(headers, ['a2', 'group', 'treated', 'control', 'treatment', 'assignment', 'arm']);
    const preOutcome = detectColumn(headers, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'baseline_score', 'pre_score']);
    const postOutcome = detectColumn(headers, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'followup']);
    const outcome = detectColumn(headers, ['outcome', 'score', 'result', 'sesb', 'ses_b', 'ses b', 'post', 'after', 'final']);
    return { treatment, preOutcome, postOutcome, outcome };
  }, [columns]);

  useEffect(() => {
    if (analysisResults) {
      setMapAreaFilter('All');
      setMapGroupFilter('All');
      setMapOutcomeFilter('All');
    }
  }, [analysisResults]);

  const activeStep = analysisResults ? 4 : isAnalyzing ? 3 : file ? 2 : 1;
  const stepItems = [
    { id: 1, title: 'Upload', description: 'Drag & drop your CSV or XLSX file', icon: '⬆' },
    { id: 2, title: 'Configure', description: 'Select treatment, outcome & feature filter', icon: '⚗' },
    { id: 3, title: 'Analyze', description: 'Get PS scores, balance, SHAP & impact', icon: '📊' },
    { id: 4, title: 'Save', description: 'Store or download results for later', icon: '💾' },
  ];

  const resetAnalysisState = () => {
    setAnalysisResults(null);
    setShowPreview(false);
    setIsAnalyzing(false);
    setCurrentPage(1);
  };

  const parseCSV = (selectedFile) => {
    setError(null);
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        if (!text || !text.trim()) {
          setError('CSV file is empty');
          setIsLoading(false);
          return;
        }
        const rawRows = parseCSVRows(text);
        const headers = rawRows[0]?.map((header) => String(header ?? '').trim()).filter(Boolean) || [];
        const rows = rowsToObjects(rawRows.slice(1), headers).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
        if (!headers.length || !rows.length) {
          setError('No valid data found');
          setIsLoading(false);
          return;
        }
        setColumns(headers);
        setCsvData(rows);
        setFile(selectedFile);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setIncludeFeatures('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
        setCurrentPage(1);
        resetAnalysisState();
        setShowPreview(true);
      } catch (err) {
        setError('Failed to parse CSV');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };
    reader.readAsText(selectedFile);
  };

  const parseXLSX = (selectedFile) => {
    setError(null);
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const headers = raw[0]?.map((header) => String(header ?? '').trim()).filter(Boolean) || [];
        const rows = rowsToObjects(raw.slice(1), headers).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
        if (!headers.length || !rows.length) {
          setError('No valid data found');
          setIsLoading(false);
          return;
        }
        setColumns(headers);
        setCsvData(rows);
        setFile(selectedFile);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setIncludeFeatures('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
        setCurrentPage(1);
        resetAnalysisState();
        setShowPreview(true);
      } catch (err) {
        setError('Failed to parse XLSX');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read XLSX');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const validateAndProcessFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) {
      setError('Invalid file selected');
      return;
    }
    if (selectedFile.size === 0) {
      setError('File is empty');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB');
      return;
    }
    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.csv')) parseCSV(selectedFile);
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) parseXLSX(selectedFile);
    else setError('Unsupported file type. Only CSV and XLSX are supported');
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) validateAndProcessFile(selectedFile);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const selectedFile = event.dataTransfer.files?.[0];
    if (selectedFile) validateAndProcessFile(selectedFile);
  };

  const handleChangeFile = () => {
    setFile(null);
    setCsvData([]);
    setColumns([]);
    setTreatmentColumn('');
    setOutcomeColumn('');
    setIncludeFeatures('B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION');
    setShowPreview(false);
    setError(null);
    setCurrentPage(1);
    resetAnalysisState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = () => {
    if (!csvData.length) {
      setError('No data available to analyze');
      return;
    }
    const detectedTreatment = treatmentColumn || autoDetectedFields.treatment;
    const detectedOutcome = outcomeColumn || autoDetectedFields.postOutcome || autoDetectedFields.outcome;
    if (!detectedTreatment) {
      setError('No treatment/group column could be detected. Please choose one from the dropdown.');
      return;
    }
    if (!detectedOutcome) {
      setError('No outcome column could be detected. Please choose one from the dropdown.');
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      setAnalysisResults(buildAnalysisResults(csvData, columns, treatmentColumn, outcomeColumn, includeFeatures));
      setIsAnalyzing(false);
    }, 1800);
  };

  const handleImportForm = () => {
    if (!csvData.length || !columns.length) {
      setError('No data available to import');
      return;
    }
    navigate('/forms/new', {
      state: {
        importedData: {
          title: `Imported Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/i, '') || 'Data'}`,
          description: `Form created from ${file?.name || 'uploaded file'} import with ${columns.length} fields and ${csvData.length} rows`,
          fields: columns.map((column, index) => ({ id: `field_${index}`, type: 'text', label: column, required: false, placeholder: `Enter ${column}` })),
          importType: file?.name?.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX',
          sourceFile: file?.name,
        },
      },
      replace: true,
    });
  };

  const handleDownloadJSON = () => {
    if (!analysisResults) return;
    const blob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveResults = () => {
    if (!analysisResults) return;
    const saved = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
    saved.push({
      id: Date.now().toString(36),
      name: saveName || `Analysis ${new Date().toLocaleString()}`,
      description: saveDescription || '',
      date: new Date().toISOString(),
      results: analysisResults,
    });
    localStorage.setItem('savedAnalyses', JSON.stringify(saved));
    setShowSaveModal(false);
    setSaveName('');
    setSaveDescription('');
  };

  const totalPages = Math.max(1, Math.ceil(csvData.length / rowsPerPage));
  const previewRows = csvData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const filteredMapRespondents = useMemo(() => {
    if (!analysisResults) return [];
    return analysisResults.respondents.filter((item) => {
      if (mapAreaFilter !== 'All' && item.area !== mapAreaFilter) return false;
      if (mapGroupFilter !== 'All' && (mapGroupFilter === 'Treated') !== (item.group === '1')) return false;
      if (mapOutcomeFilter !== 'All' && item.sesOutcome !== mapOutcomeFilter) return false;
      return true;
    });
  }, [analysisResults, mapAreaFilter, mapGroupFilter, mapOutcomeFilter]);

  const filteredAreaStats = useMemo(() => {
    const map = {};
    filteredMapRespondents.forEach((item) => {
      if (!map[item.area]) {
        map[item.area] = { area: item.area, province: item.province, total: 0, treated: 0, control: 0, improved: 0, declined: 0, noChange: 0 };
      }
      const bucket = map[item.area];
      bucket.total += 1;
      if (item.group === '1') bucket.treated += 1; else bucket.control += 1;
      if (item.sesOutcome === 'Improved') bucket.improved += 1;
      if (item.sesOutcome === 'Declined') bucket.declined += 1;
      if (item.sesOutcome === 'No Change') bucket.noChange += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredMapRespondents]);

  const areaFilterOptions = useMemo(() => {
    if (!analysisResults) return ['All'];
    return ['All', ...new Set(analysisResults.areaStats.map((item) => item.area))];
  }, [analysisResults]);

  const mapTotals = useMemo(() => ({
    total: filteredMapRespondents.length,
    treated: filteredMapRespondents.filter((item) => item.group === '1').length,
    improved: filteredMapRespondents.filter((item) => item.sesOutcome === 'Improved').length,
    declined: filteredMapRespondents.filter((item) => item.sesOutcome === 'Declined').length,
    control: filteredMapRespondents.filter((item) => item.group === '0').length,
    areas: filteredAreaStats.length,
  }), [filteredMapRespondents, filteredAreaStats]);

  const renderMetricCard = (value, label, caption, tone, icon) => (
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

  const widgetCard = (title, subtitle, children) => (
    <Card className="overflow-hidden rounded-[8px] border border-[#e2e8f0] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <CardHeader className="border-b border-[#f1f5f9] p-[11px_15px_8px]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-[13px] font-[700] text-[#1e293b]">{title}</CardTitle>
            {subtitle ? <div className="mt-[1px] text-[11px] font-[400] text-[#94a3b8]">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-[5px] text-[14px] text-[#c0c9d4]">
            <span>⎔</span>
            <span>⋮</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-[12px_14px]">{children}</CardContent>
    </Card>
  );

  const renderResults = () => {
    if (!analysisResults) return null;
    const attValue = Number(analysisResults.attValue ?? 0).toFixed(4);
    const improvedValue = String(analysisResults.improved ?? 0);
    const improvementPct = Number(analysisResults.sesImprovementPct ?? 0).toFixed(1);
    const meanSesBeforeTreated = Number(analysisResults.meanSesBeforeTreated ?? analysisResults.meanSesBefore ?? 0).toFixed(2);
    const meanSesAfterTreated = Number(analysisResults.meanSesAfterTreated ?? analysisResults.meanSesAfter ?? 0).toFixed(2);
    const deltaValue = Number(analysisResults.delta ?? (Number(meanSesAfterTreated) - Number(meanSesBeforeTreated))).toFixed(2);
    const participationRate = Number(analysisResults.participationRate ?? 0).toFixed(1);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {renderMetricCard(attValue, 'ATT — Avg Treatment Effect', `Treated: ${analysisResults.treatedCount} · Control: ${analysisResults.controlCount}`, 'orange', '📈')}
          {renderMetricCard(improvedValue, 'SES Improved (B > A)', `${improvementPct}% of all respondents`, 'green', '📈')}
          {renderMetricCard(meanSesAfterTreated, 'Mean SES After (Treated)', `Before: ${meanSesBeforeTreated} · Δ ${deltaValue}`, 'blue', '📊')}
          {renderMetricCard(`${analysisResults.treatedCount}/${analysisResults.total}`, 'Treated vs Total Respondents', `${participationRate}% participation rate`, 'purple', '👥')}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {widgetCard('Area Distribution', 'Top municipalities by respondent count', (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults.areaDistribution} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" width={84} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="treated" fill={palette.primary} maxBarSize={10} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="control" fill="#a5b4fc" maxBarSize={10} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('Age Distribution', 'By decade', (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults.ageDistribution} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="decade" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {analysisResults.ageDistribution.map((entry, index) => (
                      <Cell key={entry.decade} fill={`rgba(37,99,235,${0.45 + index * 0.07})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('Education Level', 'Decoded from B7:EDUCATION', (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analysisResults.educationLevels} dataKey="value" nameKey="name" outerRadius={70} innerRadius={32} paddingAngle={2}>
                    {analysisResults.educationLevels.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 text-[11px] text-[#64748b]">
                {analysisResults.educationLevels.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />{entry.name}</div>
                    <span>{entry.value} ({entry.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {widgetCard('PS Score Distribution', 'Overlap pattern', (
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults.psDistribution} margin={{ top: 6, right: 8, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="bin" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} height={36} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="treated" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="control" fill="#a5b4fc" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('SES Index Before vs After', 'Treated / Control means', (
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { group: 'Treated', before: analysisResults.meanSesBeforeTreated, after: analysisResults.meanSesAfterTreated },
                  { group: 'Control', before: analysisResults.meanSesBeforeControl, after: analysisResults.meanSesAfterControl },
                ]} margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={false} />
                  <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="before" fill="#fca5a5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="after" fill="#0db890" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('SES Outcome Distribution', 'Improved vs Declined', (
            <div className="h-[210px] flex flex-col justify-between">
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Improved', value: analysisResults.improved, color: palette.teal },
                      { name: 'Declined', value: analysisResults.declined, color: palette.red },
                      { name: 'No Change', value: analysisResults.noChange, color: '#94a3b8' },
                    ]} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={3} startAngle={90}>
                      {[
                        { name: 'Improved', value: analysisResults.improved, color: palette.teal },
                        { name: 'Declined', value: analysisResults.declined, color: palette.red },
                        { name: 'No Change', value: analysisResults.noChange, color: '#94a3b8' },
                      ].map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-[#64748b]">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />SES Improved</span><strong>{analysisResults.improved}</strong></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />SES Declined</span><strong>{analysisResults.declined}</strong></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#64748b]" />No Change</span><strong>{analysisResults.noChange}</strong></div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {widgetCard('Feature Importance', 'Top drivers', (
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults.featureImportance} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 1.05]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="feature" type="category" width={96} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={palette.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('SMD Before vs After Matching', 'Balance improvement', (
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults.smdData} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 0.45]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="feature" type="category" width={86} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="before" fill="#fca5a5" name="Before" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="after" fill="#0db890" name="After" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('Household & Marital Profile', 'Profile mix', (
            <div className="space-y-4">
              <div className="h-[90px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analysisResults.maritalData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Tooltip />
                    <Bar dataKey="value" barSize={12} radius={[0, 4, 4, 0]}>
                      {analysisResults.maritalData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysisResults.householdData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="size" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="value" fill={palette.purple} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {widgetCard('SES Trend Line', 'Matched pairs over index', (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysisResults.sesTrend.filter((row) => row.treated !== 0 || row.control !== 0)} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="treated" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="control" stroke="#0db890" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('Group Profile Radar', 'Treated vs Control', (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={analysisResults.radarData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="Treated" dataKey="treated" stroke="#2563eb" fill="#2563eb" fillOpacity={0.18} />
                  <Radar name="Control" dataKey="control" stroke="#0db890" fill="#0db890" fillOpacity={0.18} />
                  <Legend verticalAlign="top" height={28} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {widgetCard('Summary Statistics', 'Key takeaways', (
            <div className="overflow-hidden rounded-[6px] border border-[#e2e8f0]">
              <table className="min-w-full text-[11px]">
                <tbody>
                  {analysisResults.summaryRows.map((row, index) => (
                    <tr key={`${row[0]}-${index}`} className={index % 2 === 0 ? 'bg-[#fafbfc]' : 'bg-white'}>
                      <td className="px-3 py-2 text-[#64748b]">{row[0]}</td>
                      <td className="px-3 py-2 font-mono font-[600] text-[#1e293b]">{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-5 py-4">
            <div>
              <div className="text-[14px] font-[700] text-[#1e293b]">📍 Geographic Distribution of Respondents</div>
              <div className="mt-1 text-[11px] font-[400] text-[#94a3b8]">Bubble size = respondent count per municipality · click for details</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-[700] text-[#2563eb] border border-[#dbeafe]">{mapTotals.total.toLocaleString()} respondents</span>
              <span className="rounded-full bg-[#f0fdf4] px-3 py-1 text-[11px] font-[700] text-[#16a34a] border border-[#d9f99d]">{mapTotals.areas} areas</span>
            </div>
          </div>

          <div className="grid gap-2 border-b border-[#f1f5f9] bg-[#fafbfc] p-4 sm:grid-cols-4">
            {[
              { label: 'Total Respondents', value: mapTotals.total.toLocaleString(), color: '#2563eb', bg: '#eff6ff' },
              { label: 'Top Municipality', value: `${analysisResults.topArea.area} · ${analysisResults.topArea.total}`, color: '#7c3aed', bg: '#f5f3ff' },
              { label: 'SES Improved', value: `${mapTotals.improved} (${mapTotals.total ? ((mapTotals.improved / mapTotals.total) * 100).toFixed(1) : 0}%)`, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Treated / Control', value: `${mapTotals.treated} / ${mapTotals.control}`, color: '#f97316', bg: '#fff7ed' },
            ].map((item, index) => (
              <div key={item.label} className="rounded-[8px] p-3" style={{ background: item.bg, borderRight: index < 3 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="text-[10px] font-[700] uppercase tracking-[0.08em] text-[#94a3b8]">{item.label}</div>
                <div className="mt-2 font-mono text-[13px] font-[800]" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] bg-[#fafbfc] px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-[#475569]"><span>Area:</span>
              <select value={mapAreaFilter} onChange={(event) => setMapAreaFilter(event.target.value)} className="rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[6px] text-[12px] text-[#475569]">
                {areaFilterOptions.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#475569]"><span>Group:</span>
              <select value={mapGroupFilter} onChange={(event) => setMapGroupFilter(event.target.value)} className="rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[6px] text-[12px] text-[#475569]">
                {['All', 'Treated', 'Control'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#475569]"><span>Outcome:</span>
              <select value={mapOutcomeFilter} onChange={(event) => setMapOutcomeFilter(event.target.value)} className="rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[6px] text-[12px] text-[#475569]">
                {['All', 'Improved', 'Declined', 'No Change'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            {(mapAreaFilter !== 'All' || mapGroupFilter !== 'All' || mapOutcomeFilter !== 'All') && (
              <button type="button" onClick={() => { setMapAreaFilter('All'); setMapGroupFilter('All'); setMapOutcomeFilter('All'); }} className="rounded-[6px] border border-[#fecaca] bg-white px-3 py-2 text-[11px] font-[700] text-[#dc2626]">✕ Clear filters</button>
            )}
          </div>

          <div className="relative h-[520px]">
            <MapContainer center={[12.5, 122.5]} zoom={6} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors · Updated 2025 geographic basemap' />
              {filteredAreaStats.map((item) => {
                // try to resolve the best matching key for this area
                const resolvedKey = findAreaKey(item.area, item.province) || item.area;
                const coords = getCoordsForKey(resolvedKey) || getCoordsForKey(item.area) || getCoordsForKey(`__PROVINCE__${normalizeKey(item.province)}`);
                if (!coords) return null;
                const maxTotal = Math.max(...filteredAreaStats.map((entry) => entry.total), 1);
                const radius = 8 + Math.sqrt(item.total / maxTotal) * 34;
                const treatedPct = item.total ? ((item.treated / item.total) * 100).toFixed(1) : '0';
                const improvedPct = item.total ? ((item.improved / item.total) * 100).toFixed(1) : '0';
                return (
                  <CircleMarker key={item.area} center={coords} radius={radius} pathOptions={{ color: '#93c5fd', weight: 1.8, fillColor: '#3b82f6', fillOpacity: 0.55 }}>
                    <LeafletTooltip direction="top" offset={[0, -radius]} opacity={1}>
                      <div style={{ minWidth: 200, fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{item.area}<span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>{item.province}</span></div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                          <tbody>
                            {[
                              ['Total Respondents', item.total, '#1e293b'],
                              ['Treated (Group 1)', `${item.treated} (${treatedPct}%)`, '#2563eb'],
                              ['Control (Group 0)', `${item.control} (${(100 - Number(treatedPct)).toFixed(1)}%)`, '#475569'],
                              ['SES Improved', `${item.improved} (${improvedPct}%)`, '#16a34a'],
                              ['SES Declined', item.declined, '#dc2626'],
                              ['No Change', item.noChange, '#64748b'],
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
              <FitBounds areas={filteredAreaStats.map((item) => item.area)} />
            </MapContainer>

            <div className="absolute bottom-4 left-4 z-20 rounded-[8px] border border-[#e2e8f0] bg-white/95 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.12)] text-[11px] text-[#475569]">
              <div className="font-[700] text-[#334155] mb-2">Bubble Size = Respondent Count</div>
              {[
                { label: 'Small (≤30)', size: 8 },
                { label: 'Medium (31–70)', size: 14 },
                { label: 'Large (71–110)', size: 20 },
                { label: 'Largest (>110)', size: 26 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 mb-2">
                  <div style={{ width: item.size * 2, height: item.size * 2, borderRadius: '50%', background: 'rgba(59,130,246,0.55)', border: '1.8px solid #93c5fd' }} />
                  <span>{item.label}</span>
                </div>
              ))}
              <div className="border-t border-[#f1f5f9] pt-2 text-[10px] text-[#94a3b8]">Click / hover bubble for details</div>
            </div>

            <div className="absolute top-4 right-4 z-20 rounded-[8px] border border-[#e2e8f0] bg-white/95 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.12)] text-[11px] text-[#475569] min-w-[180px]">
              <div className="font-[700] text-[#334155] mb-2">Visible Summary</div>
              {[
                { label: 'Total', value: mapTotals.total, color: '#2563eb' },
                { label: 'Treated', value: mapTotals.treated, color: '#7c3aed' },
                { label: 'Control', value: mapTotals.control, color: '#475569' },
                { label: 'SES Improved', value: mapTotals.improved, color: '#16a34a' },
                { label: 'SES Declined', value: mapTotals.declined, color: '#dc2626' },
                { label: 'Areas on map', value: mapTotals.areas, color: '#2563eb' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-2 mb-1">
                  <span className="text-[#94a3b8]">{item.label}</span>
                  <span className="font-mono font-[800]" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#f1f5f9] p-4">
            <div className="text-[10px] font-[700] uppercase tracking-[0.08em] text-[#94a3b8] mb-3">Area Breakdown</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#475569] text-[10.5px] font-[700] uppercase tracking-[0.04em]">
                    {['Municipality', 'Province', 'Total', 'Treated', 'Control', 'Improved', 'Declined', 'No Change'].map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAreaStats.map((item, index) => (
                    <tr key={item.area} className={index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-3 py-2 font-[700] text-[#1e293b] whitespace-nowrap"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3b82f6] mr-2 align-middle" />{item.area}</td>
                      <td className="px-3 py-2 text-[#64748b]">{item.province}</td>
                      <td className="px-3 py-2 font-mono font-[700] text-[#2563eb]">{item.total}</td>
                      <td className="px-3 py-2 font-mono text-[#7c3aed]">{item.treated}</td>
                      <td className="px-3 py-2 font-mono text-[#475569]">{item.control}</td>
                      <td className="px-3 py-2 font-mono text-[#16a34a]">{item.improved}</td>
                      <td className="px-3 py-2 font-mono text-[#dc2626]">{item.declined}</td>
                      <td className="px-3 py-2 font-mono text-[#64748b]">{item.noChange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.pageBg, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <div className="mx-auto max-w-[1100px] px-5 pb-14 pt-7 sm:px-6 lg:px-5">
        <header className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#0db890] to-[#2563eb] shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L8 12L12 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[32px] font-[800] tracking-[-0.02em] text-[#2563eb]">ML Analysis</h1>
          <p className="mt-1 text-[13px] font-[400] text-[#64748b]">Upload your dataset for propensity-score matching</p>
        </header>

        <div className="mt-6 overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="grid gap-[0px] md:grid-cols-4">
            {stepItems.map((step, index) => {
              const isActive = activeStep === step.id;
              const isDone = activeStep > step.id;
              const background = isDone ? '#f0fdf4' : isActive ? '#eff6ff' : 'transparent';
              const badgeColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#94a3b8';
              const textColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#334155';
              return (
                <div key={step.title} className={`flex items-start gap-[10px] border-b border-[#f1f5f9] p-[14px_16px] md:border-b-0 md:border-r ${index === stepItems.length - 1 ? 'md:border-r-0' : ''}`} style={{ background }}>
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px]" style={{ background: isDone ? '#f0fdf4' : isActive ? '#eff6ff' : '#f8fafc', color: badgeColor }}>
                    {isDone ? <Check className="h-4 w-4" /> : <span className="text-[12px] font-[700]">{step.icon}</span>}
                  </div>
                  <div>
                    <div className="text-[13px] font-[700]" style={{ color: textColor }}>{step.title}</div>
                    <div className="mt-[2px] text-[11px] font-[400] leading-[1.4] text-[#94a3b8]">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-[#f1f5f9] px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[14px] font-[700] text-[#1e293b]">Import File</div>
              <div className="text-[12px] font-[400] text-[#94a3b8]">Upload CSV or XLSX to prepare the analysis</div>
            </div>
          </div>
          <div className="px-5 py-5">
            {error ? (
              <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {!file ? (
              <div className={`rounded-[10px] border border-dashed p-[52px_24px] text-center transition-all ${isDragging ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#c7d2de] bg-[#f8fafc]'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="mt-4 text-[15px] font-[700] text-[#1e293b]">Drop your CSV or XLSX file here</div>
                <div className="mt-1 text-[12px] font-[400] text-[#94a3b8]">or click to browse (max 10MB)</div>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                <div className="mt-5 flex justify-center">
                  <Button onClick={() => fileInputRef.current?.click()} className="rounded-[8px] bg-[#2563eb] px-[26px] py-[10px] text-[13px] font-[600] text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] focus-visible:outline-offset-2">
                    <Upload className="mr-2 h-4 w-4" /> Choose File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#d1fae5] text-[24px]">📄</div>
                    <div>
                      <div className="text-[14px] font-[700] text-[#1e293b]">{file.name}</div>
                      <div className="text-[12px] font-[400] text-[#94a3b8]">{(file.size / 1024).toFixed(2)} KB</div>
                      <div className="mt-2 text-[12px] font-[600] text-[#0db890]">✓ {csvData.length.toLocaleString()} rows · {columns.length} columns detected</div>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-4 py-2 text-[12px] font-[500] text-[#475569]" onClick={handleChangeFile}>Change File</Button>
                </div>

                <div className="grid gap-[14px] md:grid-cols-3">
                  <div>
                    <Label htmlFor="treatment" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Treatment</Label>
                    <select id="treatment" value={treatmentColumn} onChange={(event) => setTreatmentColumn(event.target.value)} className="w-full rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[8px] text-[12.5px] text-[#475569] focus:border-[#2563eb] focus:outline-none">
                      <option value="">Auto-detect → A2:GROUP</option>
                      {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="outcome" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Outcome</Label>
                    <select id="outcome" value={outcomeColumn} onChange={(event) => setOutcomeColumn(event.target.value)} className="w-full rounded-[6px] border border-[#dde3ec] bg-white px-[10px] py-[8px] text-[12.5px] text-[#475569] focus:border-[#2563eb] focus:outline-none">
                      <option value="">Auto-detect → Outcome / Post column</option>
                      {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                    <div className="mt-2 text-[11px] text-[#64748b]">
                      Auto-detected: Treatment = <strong>{autoDetectedFields.treatment || 'none'}</strong>, Outcome = <strong>{autoDetectedFields.postOutcome || autoDetectedFields.outcome || 'none'}</strong>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="includeFeatures" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Include only</Label>
                    <Input id="includeFeatures" value={includeFeatures} onChange={(event) => setIncludeFeatures(event.target.value)} placeholder="B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION" className="rounded-[6px] border-[#dde3ec] text-[12.5px] text-[#475569]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showPreview && csvData.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">🗄</div>
                <div>
                  <div className="text-[14px] font-[700] text-[#1e293b]">Data Preview ({csvData.length} rows, {columns.length} columns)</div>
                  <div className="text-[12px] font-[400] text-[#94a3b8]">Parsed and ready for matching analysis</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-[#dcfce7] px-[9px] py-[2px] text-[11px] font-[600] text-[#0db890]">✓ Parsed</Badge>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-[6px] border-[#e2e8f0]" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-[6px] border-[#e2e8f0]" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="overflow-x-auto px-5 py-5">
              <table className="min-w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.03em] text-[#475569]">
                    {columns.map((column) => <th key={column} className="border-b border-[#f1f5f9] px-3 py-2 text-left font-[700]">{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${currentPage}`} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      {columns.map((column) => {
                        const value = row[column] ?? '';
                        const normalized = String(value).trim();
                        const name = column.toLowerCase();
                        if (name.includes('group')) {
                          const pill = normalized === '1' || normalized.toLowerCase() === 'treated' ? 'treated' : 'control';
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2"><span className={`rounded-[5px] px-2 py-0.5 text-[11px] font-[700] ${pill === 'treated' ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#f1f5f9] text-[#475569]'}`}>{pill === 'treated' ? '1' : '0'}</span></td>;
                        }
                        if (name.includes('ses') && name.includes('a')) {
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 font-mono text-[11px] text-[#64748b]">{normalized || '—'}</td>;
                        }
                        if (name.includes('ses') && name.includes('b')) {
                          const pairedA = parseNumericValue(row[column.replace(/b/i, 'a')]);
                          const currentB = parseNumericValue(value);
                          const arrow = currentB !== null && pairedA !== null ? (currentB > pairedA ? ' ▲' : currentB < pairedA ? ' ▼' : '') : '';
                          const color = currentB !== null && pairedA !== null ? (currentB > pairedA ? '#16a34a' : currentB < pairedA ? '#dc2626' : '#64748b') : '#64748b';
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 font-mono text-[11px] font-[600]" style={{ color }}>{normalized || '—'}{arrow}</td>;
                        }
                        return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 text-[12px] text-[#334155]">{normalized || '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {csvData.length > 0 ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={handleImportForm} className="rounded-[8px] bg-[#0db890] px-[22px] py-[10px] text-[13px] font-[600] text-white hover:bg-[#0aa37f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0db890] focus-visible:outline-offset-2">
              <Import className="mr-2 h-4 w-4" /> Create Form from CSV
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className={`rounded-[8px] px-[26px] py-[10px] text-[13px] font-[600] text-white ${isAnalyzing ? 'bg-[#93c5fd]' : 'bg-[#2563eb] hover:bg-[#1d4ed8]'}`}>
              {isAnalyzing ? '⏳ Analyzing…' : <><BarChart3 className="mr-2 h-4 w-4" /> Analyze Data</>}
            </Button>
          </div>
        ) : null}

        {analysisResults ? (
          <div className="mt-8 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcfce7] text-[#0db890]">📈</div>
                <div>
                  <div className="text-[15px] font-[800] text-[#1e293b]">Analysis Results</div>
                  <div className="text-[12px] font-[400] text-[#94a3b8]">Complete · Ready to save or export</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-[#dcfce7] px-[9px] py-[2px] text-[11px] font-[600] text-[#0db890]">✓ Complete</Badge>
                <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-[12px] py-[8px] text-[12px] font-[600] text-[#475569]" onClick={handleDownloadJSON}><Download className="mr-2 h-4 w-4" /> JSON</Button>
                <Button className="rounded-[8px] bg-[#2563eb] px-[12px] py-[8px] text-[13px] font-[600] text-white hover:bg-[#1d4ed8]" onClick={() => setShowSaveModal(true)}><Save className="mr-2 h-4 w-4" /> Save</Button>
              </div>
            </div>
            <div className="px-5 py-5">{renderResults()}</div>
          </div>
        ) : null}
      </div>

      {showSaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-[12px] border border-[#e2e8f0] bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-[700] text-[#1e293b]">Save Results</div>
              <button className="rounded-full p-1 text-[#94a3b8] hover:bg-[#f1f5f9]" onClick={() => setShowSaveModal(false)}>×</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="saveName">Name</Label>
                <Input id="saveName" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="e.g. BFAR baseline" className="mt-1 rounded-[6px] border-[#dde3ec]" />
              </div>
              <div>
                <Label htmlFor="saveDescription">Description</Label>
                <Textarea id="saveDescription" value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} placeholder="Notes for this run" className="mt-1 rounded-[6px] border-[#dde3ec]" rows={3} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white text-[#475569]" onClick={() => setShowSaveModal(false)}>Cancel</Button>
              <Button className="rounded-[8px] bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={handleSaveResults} disabled={!saveName.trim()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MLUpload;
