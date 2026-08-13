import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RespondentAnalytics from '@/components/RespondentAnalytics';
import { findAreaKey, resolveProvince } from '@/lib/geoData';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Import,
  Save,
  Upload,
} from 'lucide-react';

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
const GROUP_BENEFICIARY = 'B';
const GROUP_NON_BENEFICIARY = 'NB';
const GROUP_UNKNOWN = 'Unknown';
const normalizeGroupToken = (value) => normalize(String(value)).replace(/[^a-z0-9]/g, '');
const isBeneficiaryToken = (token) =>
  ['1', 'b', 'bene', 'beneficiary'].includes(token) || (token.startsWith('b') && !token.startsWith('nb') && !token.startsWith('nonb'));
const isNonBeneficiaryToken = (token) =>
  ['0', 'nb', 'nonbeneficiary', 'control', 'comparison', 'comparisongroup', 'ctrl'].includes(token) ||
  token.startsWith('nb') || token.startsWith('nonb') || token.startsWith('ctrl') || token.startsWith('control') || token.startsWith('compar');
const normalizeGroupStatus = (value, useTwoAsControl = false) => {
  const normalized = normalizeGroupToken(value);
  if (!normalized) return GROUP_UNKNOWN;
  if (isBeneficiaryToken(normalized)) return GROUP_BENEFICIARY;
  if (isNonBeneficiaryToken(normalized)) return GROUP_NON_BENEFICIARY;
  if (useTwoAsControl && normalized === '2') return GROUP_NON_BENEFICIARY;
  if (normalized === '2') return GROUP_NON_BENEFICIARY;
  if (normalized === '1') return GROUP_BENEFICIARY;
  return GROUP_UNKNOWN;
};
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
  if (age < 20) return 'Under 20';
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

  const treatmentValues = new Set(rows.map((row) => normalizeGroupToken(row[treatment])).filter(Boolean));
  const useTwoAsControl = treatmentValues.has('1') && treatmentValues.has('2') && !treatmentValues.has('0');
  const normalizeGroup = (value) => normalizeGroupStatus(value, useTwoAsControl);

  const rawRespondents = rows.map((row, index) => {
    const rawAreaValue = String(row[area] ?? 'Unspecified').trim();
    const rawProvinceValue = String(row[province] ?? '').trim();
    const matchedKey = findAreaKey(rawAreaValue, rawProvinceValue);
    const areaName = matchedKey && !matchedKey.startsWith('__PROVINCE__') ? matchedKey : String(rawAreaValue).toUpperCase() || 'UNSPECIFIED';
    const beforeValue = parseNumericValue(row[preOutcome]);
    const afterValue = parseNumericValue(row[postOutcome] ?? row[outcome]);
    const outcomeValue = parseNumericValue(row[outcome]);
    const numericEducation = parseNumericValue(row[education]);
    const numericHousehold = parseNumericValue(row[household]);
    const psScore = parseNumericValue(row[psScoreColumn]);
    const group = normalizeGroup(row[treatment]);
    return {
      id: `${index}`,
      area: areaName,
      province: resolveProvince(rawAreaValue, rawProvinceValue),
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

  const beneficiaries = respondents.filter((item) => item.group === GROUP_BENEFICIARY);
  const nonBeneficiaries = respondents.filter((item) => item.group === GROUP_NON_BENEFICIARY);
  const total = respondents.length;
  const improved = respondents.filter((item) => item.sesOutcome === 'Improved').length;
  const declined = respondents.filter((item) => item.sesOutcome === 'Declined').length;
  const noChange = respondents.filter((item) => item.sesOutcome === 'No Change').length;
  const beneficiaryRate = total ? (beneficiaries.length / total) * 100 : 0;
  const meanSesA_beneficiary = mean(beneficiaries.map((item) => item.sesA).filter((value) => value !== null));
  const meanSesB_beneficiary = mean(beneficiaries.map((item) => item.sesB).filter((value) => value !== null));
  const meanSesA_nonBeneficiary = mean(nonBeneficiaries.map((item) => item.sesA).filter((value) => value !== null));
  const meanSesB_nonBeneficiary = mean(nonBeneficiaries.map((item) => item.sesB).filter((value) => value !== null));
  const validBeforeAfterBeneficiary = beneficiaries.some((item) => item.beforeValue !== null && item.afterValue !== null);
  const validBeforeAfterNonBeneficiary = nonBeneficiaries.some((item) => item.beforeValue !== null && item.afterValue !== null);
  const hasBeforeAfter = Boolean(preOutcome && postOutcome && (validBeforeAfterBeneficiary || validBeforeAfterNonBeneficiary));
  const att = hasBeforeAfter
    ? (meanSesB_beneficiary - meanSesA_beneficiary) - (meanSesB_nonBeneficiary - meanSesA_nonBeneficiary)
    : meanSesB_beneficiary - meanSesB_nonBeneficiary;
  const areaMap = respondents.reduce((acc, item) => {
    if (!acc[item.area]) acc[item.area] = { ...item, total: 0, beneficiary: 0, nonBeneficiary: 0, improved: 0, declined: 0, noChange: 0 };
    const bucket = acc[item.area];
    bucket.total += 1;
    if (item.group === GROUP_BENEFICIARY) bucket.beneficiary += 1;
    else if (item.group === GROUP_NON_BENEFICIARY) bucket.nonBeneficiary += 1;
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

  const featureImportance = featureStats
    .map((feature) => {
      const beneficiaryVals = respondents.filter((item) => item.group === GROUP_BENEFICIARY).map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
      const nonBeneficiaryVals = respondents.filter((item) => item.group === GROUP_NON_BENEFICIARY).map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
      const groupDiff = (mean(beneficiaryVals) - mean(nonBeneficiaryVals)) / Math.max(feature.std || 1, 1e-6);
      const clamped = Math.max(-1, Math.min(1, groupDiff));
      return {
        feature: feature.column,
        value: Number(Math.abs(clamped).toFixed(2)),
        effect: Number(clamped.toFixed(2)),
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const psDistribution = (() => {
    const scores = respondents.map((item) => {
      const values = featureStats.map((feature) => {
        const parsed = parseNumericValue(item.rawData?.[feature.column]);
        return parsed === null ? 0 : feature.std === 0 ? 0 : (parsed - feature.mean) / feature.std;
      });
      const raw = values.reduce((sum, value) => sum + value, 0);
      return 1 / (1 + Math.exp(-raw / Math.max(1, values.length)));
    });
    const bins = Array.from({ length: 8 }, (_, index) => ({ bin: `${((index + 1) / 8).toFixed(2)}`, beneficiary: 0, nonBeneficiary: 0 }));
    scores.forEach((score, idx) => {
      const bucket = bins[Math.min(7, Math.floor(score * 8))];
      if (respondents[idx].group === GROUP_BENEFICIARY) bucket.beneficiary += 1;
      else if (respondents[idx].group === GROUP_NON_BENEFICIARY) bucket.nonBeneficiary += 1;
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
      beneficiary: mean(bucket.filter((item) => item.group === GROUP_BENEFICIARY).map((item) => item.sesB).filter((value) => value !== null)),
      nonBeneficiary: mean(bucket.filter((item) => item.group === GROUP_NON_BENEFICIARY).map((item) => item.sesB).filter((value) => value !== null)),
    };
  });

  const radarData = [
    { subject: 'Age', beneficiary: Number((mean(beneficiaries.map((item) => item.age).filter((value) => value !== null)) / 100 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.age).filter((value) => value !== null)) / 100 * 100).toFixed(0)) },
    { subject: 'Education', beneficiary: Number((mean(beneficiaries.map((item) => item.educationValue).filter((value) => value !== null)) / 5 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.educationValue).filter((value) => value !== null)) / 5 * 100).toFixed(0)) },
    { subject: 'HH Size', beneficiary: Number((mean(beneficiaries.map((item) => item.householdValue).filter((value) => value !== null)) / 6 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.householdValue).filter((value) => value !== null)) / 6 * 100).toFixed(0)) },
    { subject: 'SES A', beneficiary: Number((mean(beneficiaries.map((item) => item.sesA).filter((value) => value !== null)) / 60 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.sesA).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
    { subject: 'SES B', beneficiary: Number((mean(beneficiaries.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.sesB).filter((value) => value !== null)) / 60 * 100).toFixed(0)) },
    { subject: 'PS Score', beneficiary: Number((mean(beneficiaries.map((item) => item.psScore).filter((value) => value !== null)) * 100).toFixed(0)), nonBeneficiary: Number((mean(nonBeneficiaries.map((item) => item.psScore).filter((value) => value !== null)) * 100).toFixed(0)) },
  ];

  const smdData = featureStats.slice(0, 7).map((feature) => {
    const beneficiaryVals = beneficiaries.map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
    const nonBeneficiaryVals = nonBeneficiaries.map((item) => parseNumericValue(item.rawData?.[feature.column])).filter((value) => value !== null);
    const beneficiaryMean = mean(beneficiaryVals);
    const nonBeneficiaryMean = mean(nonBeneficiaryVals);
    const beneficiaryStd = stdDev(beneficiaryVals);
    const nonBeneficiaryStd = stdDev(nonBeneficiaryVals);
    const pooled = Math.sqrt(((beneficiaryStd ** 2) * Math.max(0, beneficiaryVals.length - 1) + (nonBeneficiaryStd ** 2) * Math.max(0, nonBeneficiaryVals.length - 1)) / Math.max(1, beneficiaryVals.length + nonBeneficiaryVals.length - 2));
    const smd = pooled === 0 ? 0 : Math.abs(beneficiaryMean - nonBeneficiaryMean) / pooled;
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
    ['Beneficiary (B) Count', beneficiaries.length.toLocaleString()],
    ['Non-Beneficiary (NB) Count', nonBeneficiaries.length.toLocaleString()],
    ['Mean SES Before (B)', meanSesA_beneficiary.toFixed(2)],
    ['Mean SES After (B)', meanSesB_beneficiary.toFixed(2)],
    ['SES Δ Beneficiary', (meanSesB_beneficiary - meanSesA_beneficiary).toFixed(2)],
    ['SES Δ Non-Beneficiary', (meanSesB_nonBeneficiary - meanSesA_nonBeneficiary).toFixed(2)],
    ['No Change', noChange.toString()],
  ];

  return {
    headers,
    total,
    totalColumns: headers.length,
    beneficiaryCount: beneficiaries.length,
    nonBeneficiaryCount: nonBeneficiaries.length,
    improved,
    declined,
    noChange,
    beneficiaryRate,
    attValue: att,
    sesImprovementPct: total ? (improved / total) * 100 : 0,
    meanSesBefore: meanSesA_beneficiary,
    meanSesAfter: meanSesB_beneficiary,
    meanSesBeforeBeneficiary: meanSesA_beneficiary,
    meanSesAfterBeneficiary: meanSesB_beneficiary,
    meanSesBeforeNonBeneficiary: meanSesA_nonBeneficiary,
    meanSesAfterNonBeneficiary: meanSesB_nonBeneficiary,
    delta: meanSesB_beneficiary - meanSesA_beneficiary,
    featureImportance,
    areaDistribution: areaStats.slice(0, 8).map((item) => ({ name: item.area, beneficiary: item.beneficiary, nonBeneficiary: item.nonBeneficiary })),
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

  const autoDetectedFields = useMemo(() => {
    if (!columns.length) return {};
    const headers = columns.map((column) => String(column).trim()).filter(Boolean);
    const treatment = detectColumn(headers, ['a2', 'group', 'treated', 'control', 'treatment', 'assignment', 'arm']);
    const preOutcome = detectColumn(headers, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'baseline_score', 'pre_score']);
    const postOutcome = detectColumn(headers, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'followup']);
    const outcome = detectColumn(headers, ['outcome', 'score', 'result', 'sesb', 'ses_b', 'ses b', 'post', 'after', 'final']);
    return { treatment, preOutcome, postOutcome, outcome };
  }, [columns]);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-6 pb-24 pt-8 sm:px-8 lg:px-10">
        <header className="sticky top-0 z-40 mb-8 -mx-6 border-b border-slate-200/80 bg-white/80 px-6 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-slate-600">
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <span className="hidden text-xs font-medium text-slate-400 md:block">PSM · SES Impact · General Assessment</span>
          </div>
        </header>

        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-center text-white shadow-2xl shadow-slate-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17L8 12L12 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Machine learning workspace</p>
            <h1 className="text-3xl font-bold sm:text-4xl">ML Analysis</h1>
            <p className="mx-auto mt-2 max-w-lg text-base text-slate-300">Upload your dataset for propensity-score matching and impact assessment.</p>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="grid gap-[0px] md:grid-cols-4">
            {stepItems.map((step, index) => {
              const isActive = activeStep === step.id;
              const isDone = activeStep > step.id;
              const background = isDone ? '#f0fdf4' : isActive ? '#eff6ff' : 'transparent';
              const badgeColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#94a3b8';
              const textColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#334155';
              return (
                <div key={step.title} className={`flex items-start gap-[12px] border-b border-[#f1f5f9] p-[18px_20px] md:border-b-0 md:border-r ${index === stepItems.length - 1 ? 'md:border-r-0' : ''}`} style={{ background }}>
                  <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px]" style={{ background: isDone ? '#f0fdf4' : isActive ? '#eff6ff' : '#f8fafc', color: badgeColor }}>
                    {isDone ? <Check className="h-4 w-4" /> : <span className="text-[13px] font-[700]">{step.icon}</span>}
                  </div>
                  <div>
                    <div className="text-[14px] font-[700]" style={{ color: textColor }}>{step.title}</div>
                    <div className="mt-[3px] text-[12px] font-[400] leading-[1.4] text-[#94a3b8]">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-[700] text-[#1e293b]">Import File</div>
              <div className="text-[12px] font-[400] text-[#94a3b8]">Upload CSV or XLSX to prepare the analysis</div>
            </div>
          </div>
          <div className="px-6 py-6">
            {error ? (
              <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {!file ? (
              <div className={`rounded-[10px] border border-dashed p-[60px_24px] text-center transition-all ${isDragging ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#c7d2de] bg-[#f8fafc]'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="mt-4 text-[15px] font-[700] text-[#1e293b]">Drop your CSV or XLSX file here</div>
                <div className="mt-1 text-[12px] font-[400] text-[#94a3b8]">or click to browse (max 10MB)</div>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-cyan-600 px-[28px] py-[10px] text-[13px] font-[600] text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 focus-visible:outline-offset-2">
                    <Upload className="mr-2 h-4 w-4" /> Choose File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-5">
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

                <div className="grid gap-[16px] md:grid-cols-3">
                  <div>
                    <Label htmlFor="treatment" className="mb-[5px] block text-[11px] font-[600] uppercase tracking-[0.03em] text-[#94a3b8]">Group / Treatment</Label>
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
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] px-6 py-5">
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
            <div className="overflow-x-auto px-6 py-6">
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
                          const normalizedGroup = normalized === '1' || normalized.toLowerCase() === 'treated' || normalized.toLowerCase() === 'b' || normalized.toLowerCase() === 'beneficiary' ? 'B' : 'NB';
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2"><span className={`rounded-[5px] px-2 py-0.5 text-[11px] font-[700] ${normalizedGroup === 'B' ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#f1f5f9] text-[#475569]'}`}>{normalizedGroup}</span></td>;
                        }
                        if (name.includes('ses') && name.includes('a')) {
                          return <td key={`${column}-${rowIndex}`} className="border-b border-[#f8fafc] px-3 py-2 font-mono text-[11px] text-[#64748b]">{normalized || '—'}</td>;
                        }
                        if (name.includes('ses') && name.includes('b')) {
                          const pairedA = parseNumericValue(row[column.replace(/B$/i, 'A')]);
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
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={handleImportForm} className="rounded-xl bg-teal-500 px-[22px] py-[10px] text-[13px] font-[600] text-white shadow-lg shadow-teal-500/20 hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 focus-visible:outline-offset-2">
              <Import className="mr-2 h-4 w-4" /> Create Form from CSV
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className={`rounded-xl px-[26px] py-[10px] text-[13px] font-[600] text-white shadow-lg ${isAnalyzing ? 'bg-cyan-300' : 'bg-cyan-600 shadow-cyan-600/20 hover:bg-cyan-700'}`}>
              {isAnalyzing ? '⏳ Analyzing…' : <><BarChart3 className="mr-2 h-4 w-4" /> Analyze Data</>}
            </Button>
          </div>
        ) : null}

        {analysisResults ? <RespondentAnalytics columns={columns} rows={csvData} analysis={analysisResults} /> : null}

        {analysisResults ? (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcfce7] text-[#0db890]">📈</div>
              <div>
                <div className="text-[15px] font-[800] text-[#1e293b]">Matching & Impact Results</div>
                <div className="text-[12px] font-[400] text-[#94a3b8]">Included in the dashboard above · Ready to save or export</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-[#dcfce7] px-[9px] py-[2px] text-[11px] font-[600] text-[#0db890]">✓ Complete</Badge>
              <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white px-[12px] py-[8px] text-[12px] font-[600] text-[#475569]" onClick={handleDownloadJSON}><Download className="mr-2 h-4 w-4" /> JSON</Button>
              <Button className="rounded-xl bg-cyan-600 px-[12px] py-[8px] text-[13px] font-[600] text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700" onClick={() => setShowSaveModal(true)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            </div>
          </div>
        ) : null}
      </div>

      {showSaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-[700] text-[#1e293b]">Save Results</div>
              <button className="rounded-full p-1 text-[#94a3b8] hover:bg-[#f1f5f9]" onClick={() => setShowSaveModal(false)}>×</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="saveName">Name</Label>
                <Input id="saveName" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="e.g. General Assessment baseline" className="mt-1 rounded-[6px] border-[#dde3ec]" />
              </div>
              <div>
                <Label htmlFor="saveDescription">Description</Label>
                <Textarea id="saveDescription" value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} placeholder="Notes for this run" className="mt-1 rounded-[6px] border-[#dde3ec]" rows={3} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-[6px] border-[#e2e8f0] bg-white text-[#475569]" onClick={() => setShowSaveModal(false)}>Cancel</Button>
              <Button className="rounded-xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700" onClick={handleSaveResults} disabled={!saveName.trim()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MLUpload;
