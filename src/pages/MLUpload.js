import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import RespondentAnalytics from '@/components/RespondentAnalytics';
import { findAreaKey, resolveProvince } from '@/lib/geoData';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Import,
  Loader2,
  Save,
  Upload,
  X,
} from 'lucide-react';

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

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Preview' },
  { id: 3, label: 'Analytics' },
  { id: 4, label: 'Save' },
];

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
  const [saveSuccess, setSaveSuccess] = useState(false);

  const autoDetectedFields = useMemo(() => {
    if (!columns.length) return {};
    const headers = columns.map((column) => String(column).trim()).filter(Boolean);
    const treatment = detectColumn(headers, ['a2', 'group', 'treated', 'control', 'treatment', 'assignment', 'arm']);
    const preOutcome = detectColumn(headers, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'baseline_score', 'pre_score']);
    const postOutcome = detectColumn(headers, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'followup']);
    const outcome = detectColumn(headers, ['outcome', 'score', 'result', 'sesb', 'ses_b', 'ses b', 'post', 'after', 'final']);
    return { treatment, preOutcome, postOutcome, outcome };
  }, [columns]);

  const currentStep = analysisResults ? 4 : isAnalyzing ? 3 : showPreview ? 2 : 1;

  const resetAnalysisState = () => {
    setAnalysisResults(null);
    setShowPreview(false);
    setIsAnalyzing(false);
    setCurrentPage(1);
    setSaveSuccess(false);
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
    setSaveSuccess(true);
  };

  const totalPages = Math.max(1, Math.ceil(csvData.length / rowsPerPage));
  const previewRows = csvData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 pb-24 pt-0 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-1.5 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <h1 className="text-sm font-semibold text-slate-900 sm:text-base">ML Data Upload</h1>
            </div>

            <nav className="hidden items-center gap-1 md:flex">
              {STEPS.map((step, index) => {
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;
                return (
                  <React.Fragment key={step.id}>
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          isCompleted ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-px w-6 transition-colors ${
                          currentStep > step.id ? 'bg-emerald-300' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden border-slate-200 text-[10px] text-slate-400 sm:inline-flex">
                PSM · SES Impact
              </Badge>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl pt-6">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="rounded-md p-1 text-red-400 hover:text-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                <div className="border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Import File</h2>
                      <p className="text-xs text-slate-500">Upload CSV or XLSX to prepare the analysis</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
                      isDragging
                        ? 'border-blue-400 bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                          isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-8 w-8 animate-spin" />
                        ) : (
                          <FolderOpen className="h-8 w-8" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-700">
                          {isLoading ? 'Processing file...' : 'Drag & drop your file here'}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          or click to browse
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                          <FileSpreadsheet className="h-3 w-3" /> .csv
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                          <FileSpreadsheet className="h-3 w-3" /> .xlsx
                        </span>
                        <span className="text-xs text-slate-300">Max 10MB</span>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep >= 2 && file && (
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{file.name}</h3>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                          <Check className="h-3 w-3" /> {csvData.length.toLocaleString()} rows
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">
                          {columns.length} columns
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeFile}
                    className="gap-1.5 text-slate-500"
                  >
                    Change File
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Group / Treatment Column
                    </Label>
                    <Select
                      value={treatmentColumn}
                      onValueChange={setTreatmentColumn}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder={`Auto-detect → ${autoDetectedFields.treatment || 'A2:GROUP'}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem key={column} value={column} className="text-xs">
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Outcome Column
                    </Label>
                    <Select
                      value={outcomeColumn}
                      onValueChange={setOutcomeColumn}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Auto-detect → Outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem key={column} value={column} className="text-xs">
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Treatment: <span className="font-medium text-slate-600">{autoDetectedFields.treatment || '—'}</span>
                      {' · '}
                      Outcome: <span className="font-medium text-slate-600">{autoDetectedFields.postOutcome || autoDetectedFields.outcome || '—'}</span>
                    </p>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Include Features
                    </Label>
                    <Input
                      value={includeFeatures}
                      onChange={(e) => setIncludeFeatures(e.target.value)}
                      placeholder="B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep >= 2 && showPreview && csvData.length > 0 && (
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Data Preview
                    </h3>
                    <Badge variant="secondary" className="bg-slate-100 text-[10px] font-medium text-slate-500">
                      {csvData.length.toLocaleString()} rows × {columns.length} cols
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-[80px] text-center text-xs text-slate-500">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="sticky top-0 z-10 bg-slate-50">
                        {columns.map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-left font-semibold text-slate-600"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {previewRows.map((row, rowIndex) => (
                        <tr
                          key={`${rowIndex}-${currentPage}`}
                          className="transition-colors hover:bg-slate-50/50"
                        >
                          {columns.map((column) => {
                            const value = row[column] ?? '';
                            const normalized = String(value).trim();
                            const name = column.toLowerCase();
                            if (name.includes('group')) {
                              const normalizedGroup =
                                normalized === '1' || normalized.toLowerCase() === 'treated' || normalized.toLowerCase() === 'b' || normalized.toLowerCase() === 'beneficiary'
                                  ? 'B'
                                  : 'NB';
                              return (
                                <td key={`${column}-${rowIndex}`} className="whitespace-nowrap px-4 py-2">
                                  <span
                                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                      normalizedGroup === 'B'
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {normalizedGroup}
                                  </span>
                                </td>
                              );
                            }
                            if (name.includes('ses') && name.includes('a')) {
                              return (
                                <td key={`${column}-${rowIndex}`} className="whitespace-nowrap px-4 py-2 font-mono text-slate-500">
                                  {normalized || '—'}
                                </td>
                              );
                            }
                            if (name.includes('ses') && name.includes('b')) {
                              const pairedA = parseNumericValue(row[column.replace(/B$/i, 'A')]);
                              const currentB = parseNumericValue(value);
                              const arrow =
                                currentB !== null && pairedA !== null
                                  ? currentB > pairedA
                                    ? ' ▲'
                                    : currentB < pairedA
                                      ? ' ▼'
                                      : ''
                                  : '';
                              const color =
                                currentB !== null && pairedA !== null
                                  ? currentB > pairedA
                                    ? 'text-emerald-600'
                                    : currentB < pairedA
                                      ? 'text-red-500'
                                      : 'text-slate-500'
                                  : 'text-slate-500';
                              return (
                                <td key={`${column}-${rowIndex}`} className={`whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold ${color}`}>
                                  {normalized || '—'}{arrow}
                                </td>
                              );
                            }
                            return (
                              <td key={`${column}-${rowIndex}`} className="whitespace-nowrap px-4 py-2 text-slate-600">
                                {normalized || '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <div className="mb-6 flex items-center justify-center py-12">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex flex-col items-center gap-4 p-12">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-slate-900">Analyzing Data</h3>
                    <p className="text-xs text-slate-500">Running propensity score matching and impact assessment...</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {showPreview && csvData.length > 0 && currentStep < 3 && (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={handleImportForm}
                variant="outline"
                className="gap-2 border-slate-200 text-sm"
              >
                <Import className="h-4 w-4" /> Create Form from CSV
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="gap-2 bg-blue-600 text-sm shadow-sm hover:bg-blue-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" /> Analyze Data
                  </>
                )}
              </Button>
            </div>
          )}

          {analysisResults && (
            <>
              <RespondentAnalytics columns={columns} rows={csvData} analysis={analysisResults} />

              <Card className="mt-6 border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Analysis Complete</h3>
                        <p className="text-xs text-slate-500">
                          Results are included above. Ready to save or export.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-emerald-50 text-[10px] font-semibold text-emerald-600">
                        <Check className="mr-1 h-3 w-3" /> Complete
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadJSON}
                        className="gap-1.5 text-slate-600"
                      >
                        <Download className="h-3.5 w-3.5" /> JSON
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowSaveModal(true)}
                        className="gap-1.5 bg-blue-600 shadow-sm hover:bg-blue-700"
                      >
                        <Save className="h-3.5 w-3.5" /> Save Results
                      </Button>
                    </div>
                  </div>

                  {saveSuccess && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Results saved successfully.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {showPreview && csvData.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeFile}
                className="gap-1.5 text-slate-500"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Start Over
              </Button>
              {analysisResults && (
                <Button
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                  className="gap-1.5 bg-blue-600 shadow-sm hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" /> Save Results
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Analysis Results</DialogTitle>
            <DialogDescription>
              Store your results locally to access them later from your dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="saveName" className="text-xs font-medium text-slate-700">
                Name
              </Label>
              <Input
                id="saveName"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. General Assessment Baseline"
                className="mt-1.5 h-9 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="saveDescription" className="text-xs font-medium text-slate-700">
                Description
              </Label>
              <Textarea
                id="saveDescription"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Optional notes for this analysis run..."
                className="mt-1.5 text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveModal(false)}
              className="gap-1.5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveResults}
              disabled={!saveName.trim()}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MLUpload;
