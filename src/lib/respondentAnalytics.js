// src/lib/respondentAnalytics.js
// ============================================================
// RESPONDENT ANALYTICS ENGINE
// Primary classification: Beneficiary / Non-Beneficiary
// Fisherfolk fields retained as livelihood variables.
// Pure functions — no React. Centralized filtering + charts data.
// ============================================================

import {
  AREA_PROVINCE,
  REGION_OF_PROVINCE,
  normalizeKey,
  normalizeProvinceName,
  resolveRegion,
  findAreaKey,
} from './geoData';

// ---------- Base helpers ----------
export const normalize = (value) => String(value ?? '').trim();
export const normalizeLower = (value) => normalize(value).toLowerCase();
export const parseNumericValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim().replace(/,/g, '');
  if (!str) return null;
  const num = Number(str.replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : null;
};
export const mean = (values) => {
  const vals = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
};
export const median = (values) => {
  const vals = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v)).sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
};
export const min = (values) => {
  const vals = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return vals.length ? Math.min(...vals) : null;
};
export const max = (values) => {
  const vals = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return vals.length ? Math.max(...vals) : null;
};
export const sum = (values) => {
  const vals = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return vals.reduce((s, v) => s + v, 0);
};
export const pct = (part, total) => (total && Number.isFinite(part) ? Number(((part / total) * 100).toFixed(1)) : 0);

// ---------- Beneficiary status normalization ----------
// 'BENEFICIARY' / 'Beneficiary ' / 'beneficiary' → 'Beneficiary'
// 'NON-BENEFICIARY' / 'Non beneficiary' / 'non-beneficiary' → 'Non-Beneficiary'
export const normalizeGroupStatus = (value) => {
  const v = normalizeLower(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!v) return 'Unknown';
  if (['1', 'b', 'bene', 'beneficiary', 'beneficiaries', 'fb', 'fisherfolk beneficiary', 'fisherfolk beneficiary (fb)'].includes(v)) return 'Beneficiary';
  if (['0', '2', 'nb', 'non', 'nonbeneficiary', 'non beneficiary', 'beneficiary - no', 'no', 'control', 'comparison', 'comparison group', 'non-fisherfolk'].includes(v)) return 'Non-Beneficiary';
  if (/^nb\b/.test(v)) return 'Non-Beneficiary';
  if (/^b\b/.test(v)) return 'Beneficiary';
  if (v.includes('beneficiar') && !v.includes('non')) return 'Beneficiary';
  if (v.includes('non') && v.includes('beneficiar')) return 'Non-Beneficiary';
  return 'Unknown';
};
// Short token for PSM compatibility: B / NB
export const groupToken = (value) => (normalizeGroupStatus(value) === 'Beneficiary' ? 'B' : 'NB');

// ---------- Column detection ----------
export const detectColumn = (columns, keywords) => {
  const list = Array.isArray(columns) ? columns : [];
  const normalizedHeaders = list.map((h) => normalizeLower(String(h ?? '')).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim());
  for (const keyword of keywords) {
    const needle = normalizeLower(keyword).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const index = normalizedHeaders.findIndex((column) => column.includes(needle));
    if (index !== -1) return list[index];
  }
  for (const keyword of keywords) {
    const needle = normalizeLower(keyword).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = needle.split(' ').filter(Boolean);
    const index = normalizedHeaders.findIndex((column) => tokens.every((token) => column.split(' ').includes(token)));
    if (index !== -1) return list[index];
  }
  return '';
};

const YES_TOKENS = ['yes', 'y', '1', 'true', 'owned', 'have', 'with', 'available', 'access', 'accessible', 'benefitted', 'benefited'];
const isYesValue = (value) => {
  const v = normalizeLower(value).replace(/[^a-z0-9]/g, ' ');
  if (!v) return false;
  if (YES_TOKENS.includes(v.trim())) return true;
  if (v.includes('yes') || v.includes('y ')) return true;
  return false;
};
const isNoValue = (value) => {
  const v = normalizeLower(value).replace(/[^a-z0-9]/g, ' ');
  if (!v) return false;
  if (['no', 'n', '0', 'false', 'none', 'not owned', 'no access', 'n/a', 'na'].includes(v.trim())) return true;
  if (v.includes('no') || v.startsWith('no ')) return true;
  return false;
};
export const isMissingValue = (value) => {
  if (value === null || value === undefined) return true;
  const v = normalizeLower(value);
  if (!v) return true;
  if (['--', 'n/a', 'na', 'none', 'unknown', 'null', 'undefined', '-'].includes(v)) return true;
  return false;
};

const CATEGORY_KEYWORDS = {
  durables: ['motorcycle', 'bicycle', 'tricycle', 'vehicle', 'car', 'television', 'tv', 'washing machine', 'refrigerator', 'electric fan', 'stove', 'microwave', 'mobile phone', 'cellphone', 'smartphone', 'computer', 'laptop', 'furniture', 'aircon', 'air conditioning', 'radio', 'dvd', 'kawa'],
  services: ['social service', 'service access', '4ps', 'pantawid', 'philhealth', 'health access', 'education access', 'scholarship', 'social pension', 'senior citizen'],
  housing: ['drinking water', 'water source', 'domestic water', 'electricity', 'power supply', 'cooking fuel', 'fuel', 'internet', 'house tenure', 'tenure', 'toilet', 'sanitary', 'roof', 'wall', 'floor', 'house type', 'home ownership'],
  insurance: ['insurance', 'social protection', 'insured', 'life insurance', 'crop insurance', 'health insurance', 'social security', 'pag-ibig', 'gsis'],
  property: ['real property', 'property', 'land ownership', 'land title', 'lot ownership', 'ricefield', 'farm land', 'residential land'],
  perception: ['relevance', 'social impact', 'sustainability', 'satisfaction', 'pei', 'program evaluation'],
  program: ['program type', 'assistance type', 'program', 'assistance', 'training received', 'technical support', 'continuing support', 'utilization'],
};

const detectCategoryColumns = (columns, category) => columns.filter((column) => CATEGORY_KEYWORDS[category]?.some((keyword) => normalizeLower(column).includes(normalizeLower(keyword))));

export const buildColumnMap = (columns) => {
  const list = Array.isArray(columns) ? columns : [];
  return {
    status: detectColumn(list, ['a2', 'beneficiary_status', 'beneficiary status', 'group', 'treatment', 'treated', 'assignment', 'classification', 'respondent_type', 'respondent type', 'status']),
    region: detectColumn(list, ['region', 'reg', 'region_name', 'region name']),
    province: detectColumn(list, ['province', 'prov', 'province_name', 'province name', 'municipality_province']),
    municipality: detectColumn(list, ['a1', 'municipality', 'mun', 'area', 'location', 'barangay', 'brgy', 'village', 'town', 'city', 'municipality_name']),
    sex: detectColumn(list, ['b5', 'sex', 'gender']),
    age: detectColumn(list, ['b3', 'age', 'age_years', 'age years', 'years_old', 'years old', 'respondent_age']),
    marital: detectColumn(list, ['b6', 'marital', 'marital_status', 'marital status', 'm_status', 'civil_status', 'civil status', 'mstatus']),
    education: detectColumn(list, ['b7', 'education', 'educ', 'educational', 'educational_attainment', 'highest_education', 'highest education', 'edu']),
    household: detectColumn(list, ['b8', 'household', 'household_size', 'household size', 'hh_size', 'hh size', 'family_size', 'family size', 'no_of_household', 'members']),
    income: detectColumn(list, ['income', 'monthly_income', 'monthly income', 'total_income', 'total income', 'income_monthly', 'income monthly', 'hhi', 'household_income', 'household income']),
    livelihood: detectColumn(list, ['livelihood', 'primary_livelihood', 'primary livelihood', 'livelihood_type', 'livelihood type', 'occupation', 'main_occupation', 'main occupation', 'work']),
    secondaryLivelihood: detectColumn(list, ['secondary_livelihood', 'secondary livelihood', 'other_livelihood', 'other livelihood', 'secondary_occupation', 'secondary occupation']),
    yearsLivelihood: detectColumn(list, ['years_livelihood', 'years livelihood', 'years_in_livelihood', 'years in livelihood', 'years_fishing', 'years fishing', 'experience_years', 'experience years', 'years_experience']),
    fishingOperation: detectColumn(list, ['fishing_operation', 'fishing operation', 'operation_type', 'operation type', 'a3', 'type_of_operation', 'operation']),
    vesselType: detectColumn(list, ['vessel_type', 'vessel type', 'vessel', 'boat_type', 'boat type', 'boat', 'watercraft']),
    fishingGear: detectColumn(list, ['fishing_gear', 'fishing gear', 'gear', 'gears', 'gear_type', 'gear type']),
    safetyEquipment: detectColumn(list, ['safety_equipment', 'safety equipment', 'safety', 'safety_gear', 'safety gear']),
    programType: detectColumn(list, ['program_type', 'program type', 'program', 'assistance_type', 'assistance type', 'intervention', 'project']),
    yearReceived: detectColumn(list, ['year_received', 'year received', 'year', 'date_received', 'date received']),
    assistanceValue: detectColumn(list, ['assistance_value', 'assistance value', 'value', 'amount', 'assistance_amount', 'assistance amount']),
    before: detectColumn(list, ['sesa', 'ses_a', 'ses a', 'before', 'pre', 'baseline', 'pretest', 'pre_test', 'baseline_score', 'pre_score', 'ses_index_before', 'ses index before', 'ses before', 'before ses']),
    after: detectColumn(list, ['sesb', 'ses_b', 'ses b', 'after', 'post', 'outcome', 'score', 'result', 'posttest', 'post_test', 'followup', 'follow_up', 'ses_index_after', 'ses index after', 'ses after', 'after ses', 'post ses']),
    doi: detectColumn(list, ['doi', 'durables_ownership_index', 'durable index', 'asset index']),
    lci: detectColumn(list, ['lci', 'living_condition_index', 'living condition index', 'living index']),
    rpi: detectColumn(list, ['rpi', 'real_property_index', 'real property index']),
    ici: detectColumn(list, ['ici', 'insurance_coverage_index', 'insurance index']),
    mwi: detectColumn(list, ['mwi', 'material_wellbeing_index', 'material well-being index', 'material wellbeing', 'wellbeing index']),
    durables: detectCategoryColumns(list, 'durables'),
    services: detectCategoryColumns(list, 'services'),
    housing: detectCategoryColumns(list, 'housing'),
    insurance: detectCategoryColumns(list, 'insurance'),
    property: detectCategoryColumns(list, 'property'),
    perception: detectCategoryColumns(list, 'perception'),
  };
};

// ---------- Geographic resolution ----------
export const resolveProvinceForArea = (municipality, province) => {
  const supplied = normalize(province);
  if (supplied && REGION_OF_PROVINCE[normalizeProvinceName(supplied)] !== undefined) return supplied;
  if (supplied) return supplied;
  const key = findAreaKey(municipality, province);
  if (key && !key.startsWith('__PROVINCE__')) return AREA_PROVINCE[key] || 'Unknown';
  return 'Unknown';
};
export const resolveRegionForRecord = (municipality, province) => {
  const provinceName = resolveProvinceForArea(municipality, province);
  if (provinceName && provinceName !== 'Unknown') {
    const region = resolveRegion(provinceName);
    if (region) return region;
  }
  const key = findAreaKey(municipality, province);
  if (key && !key.startsWith('__PROVINCE__')) {
    const provFromArea = AREA_PROVINCE[key];
    if (provFromArea) {
      const region = resolveRegion(provFromArea);
      if (region) return region;
    }
  }
  return municipality ? 'Unknown Region' : '';
};

const AGE_GROUPS = [
  { label: '18–35', min: 18, max: 35 },
  { label: '36–52', min: 36, max: 52 },
  { label: '53–69', min: 53, max: 69 },
  { label: '70+', min: 70, max: 200 },
];
export const ageGroupLabel = (age) => {
  const a = parseNumericValue(age);
  if (a === null) return null;
  const group = AGE_GROUPS.find((g) => a >= g.min && a <= g.max);
  return group ? group.label : '70+';
};

// ---------- Records ----------
export const buildRecords = (columns, rows) => {
  const colMap = buildColumnMap(columns);
  const withStatus = Boolean(colMap.status);
  const records = (rows || []).map((row) => {
    const value = (col) => (col ? row[col] : undefined);
    return {
      raw: row,
      beneficiaryStatus: withStatus ? normalizeGroupStatus(value(colMap.status)) : 'Unknown',
      group: withStatus ? groupToken(value(colMap.status)) : null,
      region: value(colMap.region) ? normalize(value(colMap.region)) : resolveRegionForRecord(value(colMap.municipality), value(colMap.province)),
      province: resolveProvinceForArea(value(colMap.municipality), value(colMap.province)),
      municipality: value(colMap.municipality) ? normalize(value(colMap.municipality)) : '',
      sex: value(colMap.sex) ? normalize(value(colMap.sex)) : '',
      age: parseNumericValue(value(colMap.age)),
      marital: value(colMap.marital) ? normalize(value(colMap.marital)) : '',
      education: value(colMap.education) ? normalize(value(colMap.education)) : '',
      householdSize: parseNumericValue(value(colMap.household)),
      income: parseNumericValue(value(colMap.income)),
      livelihood: value(colMap.livelihood) ? normalize(value(colMap.livelihood)) : '',
      secondaryLivelihood: value(colMap.secondaryLivelihood) ? normalize(value(colMap.secondaryLivelihood)) : '',
      yearsLivelihood: parseNumericValue(value(colMap.yearsLivelihood)),
      fishingOperation: value(colMap.fishingOperation) ? normalize(value(colMap.fishingOperation)) : '',
      vesselType: value(colMap.vesselType) ? normalize(value(colMap.vesselType)) : '',
      fishingGear: value(colMap.fishingGear) ? normalize(value(colMap.fishingGear)) : '',
      safetyEquipment: value(colMap.safetyEquipment) ? normalize(value(colMap.safetyEquipment)) : '',
      programType: value(colMap.programType) ? normalize(value(colMap.programType)) : '',
      yearReceived: parseNumericValue(value(colMap.yearReceived)),
      assistanceValue: parseNumericValue(value(colMap.assistanceValue)),
      before: parseNumericValue(value(colMap.before)),
      after: parseNumericValue(value(colMap.after)),
      doi: parseNumericValue(value(colMap.doi)),
      lci: parseNumericValue(value(colMap.lci)),
      rpi: parseNumericValue(value(colMap.rpi)),
      ici: parseNumericValue(value(colMap.ici)),
      mwi: parseNumericValue(value(colMap.mwi)),
      durables: colMap.durables.map((col) => ({ column: col, owned: isYesValue(row[col]), missing: isMissingValue(row[col]) })),
      services: colMap.services.map((col) => ({ column: col, accessed: isYesValue(row[col]), missing: isMissingValue(row[col]) })),
      housing: colMap.housing.map((col) => ({ column: col, met: !isNoValue(row[col]) && !isMissingValue(row[col]), value: normalize(row[col]) })),
      insurance: colMap.insurance.map((col) => ({ column: col, insured: isYesValue(row[col]) && !isMissingValue(row[col]), missing: isMissingValue(row[col]) })),
      property: colMap.property.map((col) => ({ column: col, owned: isYesValue(row[col]), missing: isMissingValue(row[col]) })),
      perception: colMap.perception.map((col) => ({ column: col, score: parseNumericValue(row[col]) })),
    };
  });
  return { records, colMap, withStatus };
};

// ---------- Centralized filtering ----------
export const applyFilters = (records, filters = {}) => {
  const {
    status, region, province, municipality, sex, ageGroup, education, marital, livelihood, incomeGroup, programType, yearReceived,
  } = filters;
  return records.filter((r) => {
    if (status && status !== 'All' && r.beneficiaryStatus !== status) return false;
    if (region && region !== 'All' && r.region !== region) return false;
    if (province && province !== 'All' && r.province !== province) return false;
    if (municipality && municipality !== 'All' && normalize(r.municipality) !== normalize(municipality)) return false;
    if (sex && sex !== 'All' && normalize(r.sex) !== normalize(sex)) return false;
    if (ageGroup && ageGroup !== 'All' && ageGroupLabel(r.age) !== ageGroup) return false;
    if (education && education !== 'All' && normalize(r.education) !== normalize(education)) return false;
    if (marital && marital !== 'All' && normalize(r.marital) !== normalize(marital)) return false;
    if (livelihood && livelihood !== 'All' && normalize(r.livelihood) !== normalize(livelihood)) return false;
    if (incomeGroup && incomeGroup !== 'All' && incomeGroupLabel(r.income) !== incomeGroup) return false;
    if (programType && programType !== 'All' && normalize(r.programType) !== normalize(programType)) return false;
    if (yearReceived && yearReceived !== 'All' && String(r.yearReceived) !== String(yearReceived)) return false;
    return true;
  });
};

// ---------- Income groups ----------
export const incomeGroupLabel = (income) => {
  const v = parseNumericValue(income);
  if (v === null) return null;
  if (v < 5000) return 'Below ₱5,000';
  if (v < 10000) return '₱5,000–₱9,999';
  if (v < 15000) return '₱10,000–₱14,999';
  if (v < 25000) return '₱15,000–₱24,999';
  if (v < 50000) return '₱25,000–₱49,999';
  return '₱50,000+';
};

// ---------- Distributions ----------
// Standard distribution: { name, count, beneficiary, nonBeneficiary, pct }
const toStandard = (map, total) => Object.keys(map)
  .map((name) => ({ name, count: map[name].count, beneficiary: map[name].b, nonBeneficiary: map[name].nb, pct: pct(map[name].count, total) }))
  .filter((d) => d.count > 0)
  .sort((a, b) => b.count - a.count);

export const buildBeneficiaryDistribution = (records) => {
  const counts = { Beneficiary: 0, 'Non-Beneficiary': 0, Unknown: 0 };
  records.forEach((r) => {
    counts[r.beneficiaryStatus] = (counts[r.beneficiaryStatus] || 0) + 1;
  });
  const total = records.length || 1;
  return Object.keys(counts).map((name) => ({ name, count: counts[name], pct: pct(counts[name], total) })).filter((d) => d.name !== 'Unknown' || d.count > 0);
};

export const buildGroupedDistribution = (records, keyFn) => {
  const map = {};
  records.forEach((r) => {
    const name = keyFn(r);
    if (name === null || name === undefined || name === '') return;
    if (!map[name]) map[name] = { count: 0, b: 0, nb: 0 };
    map[name].count += 1;
    if (r.beneficiaryStatus === 'Beneficiary') map[name].b += 1;
    else if (r.beneficiaryStatus === 'Non-Beneficiary') map[name].nb += 1;
  });
  return toStandard(map, records.length);
};

export const buildRegionDistribution = (records) => buildGroupedDistribution(records, (r) => r.region || 'Unknown Region');
export const buildProvinceDistribution = (records) => buildGroupedDistribution(records, (r) => r.province || 'Unknown Province');
export const buildMunicipalityDistribution = (records) => buildGroupedDistribution(records, (r) => (r.municipality ? r.municipality : r.province && r.province !== 'Unknown' ? `${r.province} (all)` : 'Unknown'));
export const buildAgeDistribution = (records) => buildGroupedDistribution(records, (r) => (r.age === null ? null : `${Math.floor(r.age / 10) * 10}s`));
export const buildAgeGroupDistribution = (records) => buildGroupedDistribution(records, (r) => ageGroupLabel(r.age));
export const buildSexDistribution = (records) => buildGroupedDistribution(records, (r) => (r.sex ? r.sex : null));
export const buildMaritalDistribution = (records) => buildGroupedDistribution(records, (r) => (r.marital ? r.marital : null));
export const buildEducationDistribution = (records) => buildGroupedDistribution(records, (r) => (r.education ? r.education : null));
export const buildHouseholdDistribution = (records) => buildGroupedDistribution(records, (r) => (r.householdSize === null ? null : String(r.householdSize)));
export const buildLivelihoodDistribution = (records) => buildGroupedDistribution(records, (r) => (r.livelihood ? r.livelihood : null));
export const buildSecondaryLivelihoodDistribution = (records) => buildGroupedDistribution(records, (r) => (r.secondaryLivelihood ? r.secondaryLivelihood : null));
export const buildYearsLivelihoodDistribution = (records) => buildGroupedDistribution(records, (r) => (r.yearsLivelihood === null ? null : `${Math.floor(r.yearsLivelihood / 5) * 5}-${Math.floor(r.yearsLivelihood / 5) * 5 + 4} yrs`));
export const buildProgramDistribution = (records) => buildGroupedDistribution(records, (r) => (r.programType ? r.programType : null));
export const buildIncomeDistribution = (records) => buildGroupedDistribution(records, (r) => incomeGroupLabel(r.income));

// Binary ownership charts (durables / services / housing / insurance / property)
export const buildOwnershipStats = (records, field) => {
  const items = {};
  records.forEach((r) => {
    (r[field] || []).forEach((item) => {
      const name = item.column;
      if (!items[name]) items[name] = { total: 0, owned: 0, bTotal: 0, bOwned: 0, nbTotal: 0, nbOwned: 0 };
      const valid = item.missing !== undefined ? !item.missing : item.value !== '';
      if (!valid) return;
      items[name].total += 1;
      const yes = field === 'housing' ? item.met : field === 'insurance' ? item.insured : item.owned || item.accessed;
      if (yes) items[name].owned += 1;
      if (r.beneficiaryStatus === 'Beneficiary') {
        items[name].bTotal += 1;
        if (yes) items[name].bOwned += 1;
      } else if (r.beneficiaryStatus === 'Non-Beneficiary') {
        items[name].nbTotal += 1;
        if (yes) items[name].nbOwned += 1;
      }
    });
  });
  return Object.keys(items).map((name) => {
    const it = items[name];
    return {
      name,
      column: name,
      ownershipPct: pct(it.owned, it.total),
      count: it.owned,
      total: it.total,
      beneficiaryPct: pct(it.bOwned, it.bTotal),
      nonBeneficiaryPct: pct(it.nbOwned, it.nbTotal),
      beneficiary: it.bOwned,
      nonBeneficiary: it.nbOwned,
      noAnswer: it.total - it.owned,
    };
  }).sort((a, b) => b.ownershipPct - a.ownershipPct);
};
export const buildDurablesStats = (records) => buildOwnershipStats(records, 'durables');
export const buildServicesStats = (records) => buildOwnershipStats(records, 'services');
export const buildHousingStats = (records) => buildOwnershipStats(records, 'housing');
export const buildInsuranceStats = (records) => buildOwnershipStats(records, 'insurance');
export const buildPropertyStats = (records) => buildOwnershipStats(records, 'property');

// Perception (Program Evaluation Index) — only for respondents with valid scores
export const buildPerceptionStats = (records) => {
  const validRecords = records.filter((r) => (r.perception || []).some((p) => p.score !== null));
  if (!validRecords.length) return { applicable: false, data: [] };
  const factors = {};
  validRecords.forEach((r) => {
    (r.perception || []).forEach((p) => {
      if (p.score === null) return;
      if (!factors[p.column]) factors[p.column] = [];
      factors[p.column].push(p.score);
    });
  });
  const data = Object.keys(factors).map((name) => {
    const scores = factors[name];
    const avg = mean(scores);
    return { name, value: avg === null ? 0 : Number(Math.min(100, Math.max(0, (avg / 5) * 100)).toFixed(1)), rawAvg: avg, count: scores.length };
  });
  // PEI = mean of all perception factors
  const pei = data.length ? Number((data.reduce((s, d) => s + d.value, 0) / data.length).toFixed(1)) : 0;
  return { applicable: true, data, pei, count: validRecords.length };
};

// ---------- Index stats (DOI / LCI / RPI / ICI / MWI) ----------
export const buildIndexStats = (records) => {
  const fieldValues = (field) => records.map((r) => r[field]).filter((v) => v !== null && v !== undefined);
  const doi = median(fieldValues('doi'));
  const lci = median(fieldValues('lci'));
  const rpi = median(fieldValues('rpi'));
  const ici = median(fieldValues('ici'));
  const mwi = median(fieldValues('mwi'));
  return {
    doi, lci, rpi, ici, mwi,
    data: [
      { name: 'DOI', value: doi },
      { name: 'LCI', value: lci },
      { name: 'RPI', value: rpi },
      { name: 'ICI', value: ici },
      { name: 'MWI', value: mwi },
    ],
  };
};

// ---------- Before / After (valid values only) ----------
export const buildBeforeAfter = (records) => {
  const pairs = records.filter((r) => r.before !== null && r.after !== null);
  if (!pairs.length) return { applicable: false, data: [], pairs: 0 };
  const beforeAvg = mean(pairs.map((p) => p.before));
  const afterAvg = mean(pairs.map((p) => p.after));
  const holders = pairs.filter((r) => r.group === 'B');
  const nonHolders = pairs.filter((r) => r.group === 'NB');
  return {
    applicable: true,
    pairs: pairs.length,
    beforeAvg,
    afterAvg,
    delta: afterAvg - beforeAvg,
    data: [
      { name: 'Before', beneficiary: mean(holders.map((p) => p.before)), nonBeneficiary: mean(nonHolders.map((p) => p.before)) },
      { name: 'After', beneficiary: mean(holders.map((p) => p.after)), nonBeneficiary: mean(nonHolders.map((p) => p.after)) },
    ],
  };
};

// ---------- Summary cards ----------
export const buildSummary = (records) => {
  const total = records.length;
  const beneficiaries = records.filter((r) => r.beneficiaryStatus === 'Beneficiary');
  const nonBeneficiaries = records.filter((r) => r.beneficiaryStatus === 'Non-Beneficiary');
  const unknown = records.filter((r) => r.beneficiaryStatus === 'Unknown');
  const indexStats = buildIndexStats(records);
  return {
    total,
    beneficiaries: beneficiaries.length,
    nonBeneficiaries: nonBeneficiaries.length,
    unknown: unknown.length,
    beneficiaryPct: pct(beneficiaries.length, total),
    nonBeneficiaryPct: pct(nonBeneficiaries.length, total),
    avgIncome: mean(records.map((r) => r.income)),
    medianIncome: median(records.map((r) => r.income)),
    avgHousehold: mean(records.map((r) => r.householdSize)),
    avgAge: mean(records.map((r) => r.age)),
    doi: indexStats.doi, lci: indexStats.lci, rpi: indexStats.rpi, ici: indexStats.ici, mwi: indexStats.mwi,
  };
};

// ---------- Beneficiary vs Non-Beneficiary comparison ----------
export const buildComparison = (allRecords) => {
  const records = allRecords.filter((r) => r.beneficiaryStatus !== 'Unknown');
  const b = records.filter((r) => r.beneficiaryStatus === 'Beneficiary');
  const nb = records.filter((r) => r.beneficiaryStatus === 'Non-Beneficiary');
  const num = (values, digits = 2) => {
    const m = mean(values);
    return m === null ? '—' : Number(m.toFixed(digits)).toLocaleString();
  };
  const formatMoney = (v) => (v === '—' || v === null || v === undefined ? '—' : `₱${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  const livelihoodB = buildLivelihoodDistribution(b);
  const livelihoodNB = buildLivelihoodDistribution(nb);
  const topLivelihoodB = livelihoodB[0]?.name || '—';
  const topLivelihoodNB = livelihoodNB[0]?.name || '—';
  return [
    { metric: 'Respondents', beneficiary: b.length.toLocaleString(), nonBeneficiary: nb.length.toLocaleString() },
    { metric: 'Average Age', beneficiary: num(b.map((r) => r.age), 1), nonBeneficiary: num(nb.map((r) => r.age), 1) },
    { metric: 'Average Household Size', beneficiary: num(b.map((r) => r.householdSize), 2), nonBeneficiary: num(nb.map((r) => r.householdSize), 2) },
    { metric: 'Average Monthly Income', beneficiary: formatMoney(mean(b.map((r) => r.income))), nonBeneficiary: formatMoney(mean(nb.map((r) => r.income))) },
    { metric: 'DOI', beneficiary: num(b.map((r) => r.doi), 1), nonBeneficiary: num(nb.map((r) => r.doi), 1) },
    { metric: 'LCI', beneficiary: num(b.map((r) => r.lci), 1), nonBeneficiary: num(nb.map((r) => r.lci), 1) },
    { metric: 'RPI', beneficiary: num(b.map((r) => r.rpi), 1), nonBeneficiary: num(nb.map((r) => r.rpi), 1) },
    { metric: 'ICI', beneficiary: num(b.map((r) => r.ici), 1), nonBeneficiary: num(nb.map((r) => r.ici), 1) },
    { metric: 'MWI', beneficiary: num(b.map((r) => r.mwi), 1), nonBeneficiary: num(nb.map((r) => r.mwi), 1) },
    { metric: 'Top Primary Livelihood', beneficiary: topLivelihoodB, nonBeneficiary: topLivelihoodNB },
  ];
};

// ---------- Export helpers (CSV) ----------
export const toCSV = (columns, rows) => {
  const lines = [columns.join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => {
    const v = row[c];
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  }).join(',')));
  return lines.join('\n');
};
