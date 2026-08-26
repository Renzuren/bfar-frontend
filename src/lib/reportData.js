// src/lib/reportData.js
// ============================================================
// REPORT TAB DATA ENGINE
// Transforms the combined Before + After questionnaire responses
// into aggregated datasets for the Report tab (map + 9 charts).
// Pure functions — no React. Dynamic: every chart recomputes via
// useMemo whenever the underlying records or drill filters change.
// ============================================================

import { resolveRegion } from './geoData';
import { normalizeGroupStatus } from './respondentAnalytics';

export const LIKERT_LEVELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
export const LIKERT_COLORS = ['#dc2626', '#f87171', '#fbbf24', '#86efac', '#16a34a'];
export const AGE_BRACKETS = ['18-35', '36-52', '53-69', '70+'];
export const MARITAL_ORDER = ['Single', 'Married/Live-in', 'Separated/Widowed'];
export const EDUCATION_ORDER = ['No Formal Education', 'Elementary', 'High School', 'College', 'Post-Graduate'];
export const INCOME_BRACKETS = ['Below ₱10,000', '₱10,001 – ₱20,000', '₱20,001 – ₱30,000', 'Above ₱30,000'];
export const INDEX_FIELDS = [
  ['doi', 'DOI', 'Durables Ownership Index'],
  ['lci', 'LCI', 'Living Condition Index'],
  ['rpi', 'RPI', 'Real Property Index'],
  ['ici', 'ICI', 'Insurance Coverage Index'],
  ['mwi', 'MWI', 'Material Well-being Index'],
];
export const REGION_ORDER = ['CAR', 'NCR', 'Region I', 'Region II', 'Region III', 'Region IV-A', 'MIMAROPA', 'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX', 'Region X', 'Region XI', 'Region XII', 'Region XIII', 'BARMM'];

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cap = (s) => String(s ?? '').trim().replace(/\b\w/g, (c) => c.toUpperCase());

export const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (Array.isArray(v)) return null;
  const n = parseFloat(String(v).replace(/[₱,\s]|php/gi, ''));
  return Number.isFinite(n) ? n : null;
};

export const flattenQuestions = (form) => {
  if (!form) return [];
  if (Array.isArray(form.questions) && form.questions.length) {
    return form.questions.map((q) => ({ ...q, _section: '' }));
  }
  if (Array.isArray(form.sections)) {
    return form.sections.flatMap((s) => (s.questions || []).map((q) => ({ ...q, _section: s.title || '' })));
  }
  return [];
};

const classifyLikert = (q) => {
  const t = `${norm(q._section)} ${norm(q.code)} ${norm(q.title)}`;
  if (/relevan/.test(t)) return 'relevance';
  if (/social impact|social benef|community impact|impact on|effects on/.test(t)) return 'socialImpact';
  if (/sustainab/.test(t)) return 'sustainability';
  return null;
};

const LIKERT_PREFIX = { relevance: 'R', socialImpact: 'SI', sustainability: 'SU' };

export const buildStatements = (formEntries) => {
  const seen = new Set();
  const out = { relevance: [], socialImpact: [], sustainability: [] };
  formEntries.forEach(({ form }) => {
    flattenQuestions(form).forEach((q) => {
      if (q.type !== 'rating') return;
      const cat = classifyLikert(q);
      if (!cat) return;
      const key = `${cat}|${norm(q.title)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out[cat].push({ id: q.id, title: q.title || 'Untitled statement', short: `${LIKERT_PREFIX[cat]}${out[cat].length + 1}`, formId: form?.id ?? null });
    });
  });
  return out;
};

const detectFields = (qs) => {
  const sig = (q) => ` ${norm(q.code)} ${norm(q._section)} ${norm(q.title)} `;
  const find = (pred) => qs.find(pred) || null;
  const hasB3 = (s) => / b ?3 /.test(s);
  return {
    municipality: find((q) => / a ?1 |municipality| city | town /.test(sig(q))),
    province: find((q) => / a ?3 |province /.test(sig(q))),
    beneficiary: find((q) => /beneficiar /.test(sig(q))),
    age: find((q) => { const s = sig(q); return hasB3(s) || / age /.test(s); }),
    sex: find((q) => { const s = sig(q); return / b ?5 /.test(s) || / sex | gender /.test(s); }),
    marital: find((q) => { const s = sig(q); return / b ?6 /.test(s) || / marital | m status | civil status /.test(s); }),
    education: find((q) => { const s = sig(q); return / b ?7 /.test(s) || / educat /.test(s); }),
    fishingIncome: find((q) => { const s = sig(q); return /fishing income|fishery income|income from fishing|fishing gross|gross receipts from fishing/.test(s); }),
    totalIncome: find((q) => {
      const s = sig(q);
      if (/fishing/.test(s)) return false;
      return /household income|total income|monthly income|family income/.test(s);
    }),
    doi: find((q) => /\bdoi\b|durables ownership|asset ownership index/.test(sig(q))),
    lci: find((q) => /\blci\b|living condition index|living condition score/.test(sig(q))),
    rpi: find((q) => /\brpi\b|real property index/.test(sig(q))),
    ici: find((q) => /\bici\b|insurance coverage index|insurance coverage score/.test(sig(q))),
    mwi: find((q) => /\bmwi\b|material well being|material wellbeing/.test(sig(q))),
  };
};

export const normalizeSex = (v) => {
  const s = norm(v);
  if (!s) return null;
  if (/^m(ale)?$|^lalaki/.test(s)) return 'Male';
  if (/^f(emale)?$|^babae/.test(s)) return 'Female';
  return cap(v);
};

export const normalizeMarital = (v) => {
  const s = norm(v);
  if (!s) return null;
  if (/separat|annul|divorc|wido/.test(s)) return 'Separated/Widowed';
  if (/married|live in|live in with|living with|liv in|live together/.test(s)) return 'Married/Live-in';
  if (/single|unmarried|never marry|walang asawa/.test(s)) return 'Single';
  return cap(v);
};

export const normalizeEducation = (v) => {
  const s = norm(v);
  if (!s) return null;
  if (/no formal|none|no schooling|not attended|wala/.test(s)) return 'No Formal Education';
  if (/post grad|postgrad|graduate stud|master|doctor|phd/.test(s)) return 'Post-Graduate';
  if (/college|vocational|tertiary|bachelor/.test(s)) return 'College';
  if (/high school|secondary| hs |h s /.test(s)) return 'High School';
  if (/elementary|primary|grade school/.test(s)) return 'Elementary';
  return cap(v);
};

export const ageBracketLabel = (age) => {
  const a = typeof age === 'number' ? age : toNum(age);
  if (a === null || a < 18) return null;
  if (a <= 35) return '18-35';
  if (a <= 52) return '36-52';
  if (a <= 69) return '53-69';
  return '70+';
};

export const incomeBracketLabel = (v) => {
  const n = typeof v === 'number' ? v : toNum(v);
  if (n === null) return null;
  if (n <= 10000) return INCOME_BRACKETS[0];
  if (n <= 20000) return INCOME_BRACKETS[1];
  if (n <= 30000) return INCOME_BRACKETS[2];
  return INCOME_BRACKETS[3];
};

export const buildUnifiedRecords = ({ beforeForm, beforeResponses = [], afterForm, afterResponses = [] }) => {
  const statements = buildStatements([
    { form: afterForm },
    { form: beforeForm },
  ]);
  const records = [];
  [
    { form: beforeForm, responses: beforeResponses, phase: 'Before' },
    { form: afterForm, responses: afterResponses, phase: 'After' },
  ].forEach(({ form, responses, phase }) => {
    if (!form) return;
    const qs = flattenQuestions(form);
    const f = detectFields(qs);
    const answerOf = (resp, q) => {
      if (!q) return null;
      const arr = Array.isArray(resp.answers) ? resp.answers : [];
      let hit = arr.find((a) => a.question_id === q.id) || arr.find((a) => a.qid === q.id);
      if (!hit && q.title) hit = arr.find((a) => a.question_title === q.title);
      if (!hit && arr.length && typeof arr[0] !== 'object') {
        const i = qs.indexOf(q);
        if (i >= 0 && i < arr.length) hit = { answer: arr[i] };
      }
      return hit ? hit.answer : null;
    };
    const answerById = (resp, qid) => {
      const arr = Array.isArray(resp.answers) ? resp.answers : [];
      const hit = arr.find((a) => a.question_id === qid);
      return hit ? hit.answer : null;
    };
    responses.forEach((r) => {
      let type = normalizeGroupStatus(r.beneficiary_status ?? answerOf(r, f.beneficiary));
      if (type === 'Unknown' && form?.has_baseline === false && form?.questionnaire_type) {
        type = form.questionnaire_type === 'before' ? 'Beneficiary' : 'Non-Beneficiary';
      }
      const municipality = cap(r.municipality ?? answerOf(r, f.municipality) ?? '');
      const provinceRaw = cap(r.province ?? answerOf(r, f.province) ?? '');
      const province = provinceRaw || 'Unknown';
      const region = resolveRegion(province) || (province !== 'Unknown' ? province : 'Unknown Region');
      const likert = {};
      Object.keys(statements).forEach((cat) => {
        likert[cat] = statements[cat].map((st) => {
          const raw = st.formId && form && st.formId !== form.id ? null : answerById(r, st.id);
          if (raw === null || raw === undefined || raw === '') return null;
          const n = Math.round(toNum(raw));
          return n >= 1 && n <= 5 ? n : null;
        });
      });
      records.push({
        id: r.respondent_id || r.id || `${phase}-${records.length + 1}`,
        type,
        phase,
        age: toNum(r.age ?? answerOf(r, f.age)),
        sex: normalizeSex(r.gender ?? answerOf(r, f.sex)),
        maritalStatus: normalizeMarital(answerOf(r, f.marital)),
        education: normalizeEducation(answerOf(r, f.education)),
        region,
        province,
        municipality,
        fishingIncome: toNum(answerOf(r, f.fishingIncome)),
        totalIncome: toNum(answerOf(r, f.totalIncome)),
        doi: toNum(answerOf(r, f.doi)),
        lci: toNum(answerOf(r, f.lci)),
        rpi: toNum(answerOf(r, f.rpi)),
        ici: toNum(answerOf(r, f.ici)),
        mwi: toNum(answerOf(r, f.mwi)),
        likert,
      });
    });
  });
  return { records, statements };
};

export const applyDrill = (records, drill) => records.filter((rec) => {
  if (drill.type && drill.type !== 'All' && rec.type !== drill.type) return false;
  if (drill.region && drill.region !== 'All' && rec.region !== drill.region) return false;
  if (drill.sex && drill.sex !== 'All' && rec.sex !== drill.sex) return false;
  return true;
});

const groupCounts = (records, keyFn) => {
  const map = new Map();
  records.forEach((rec) => {
    const key = keyFn(rec);
    if (key === null || key === undefined) return;
    if (!map.has(key)) map.set(key, { name: key, Beneficiary: 0, 'Non-Beneficiary': 0, total: 0 });
    const g = map.get(key);
    g.total += 1;
    if (rec.type === 'Beneficiary') g.Beneficiary += 1;
    else if (rec.type === 'Non-Beneficiary') g['Non-Beneficiary'] += 1;
  });
  return map;
};

const orderedRows = (map, order = null) => {
  const rows = Array.from(map.values());
  if (!order) return rows.sort((a, b) => b.total - a.total);
  const known = order.filter((name) => map.has(name)).map((name) => map.get(name));
  const extra = rows.filter((r2) => !order.includes(r2.name)).sort((a, b) => b.total - a.total);
  return known.concat(extra);
};

export const aggregateRegion = (records) => orderedRows(groupCounts(records, (r2) => r2.region), REGION_ORDER);

export const aggregateAge = (records) => orderedRows(groupCounts(records, (r2) => ageBracketLabel(r2.age)), AGE_BRACKETS);

export const aggregateSex = (records) => {
  const rows = orderedRows(groupCounts(records, (r2) => r2.sex));
  return rows.map((r2) => ({ ...r2 }));
};

export const aggregateMarital = (records) => orderedRows(groupCounts(records, (r2) => r2.maritalStatus), MARITAL_ORDER);

export const aggregateEducation = (records) => orderedRows(groupCounts(records, (r2) => r2.education), EDUCATION_ORDER);

export const aggregateIncome = (records, kind = 'total') => {
  const field = kind === 'fishing' ? 'fishingIncome' : 'totalIncome';
  return orderedRows(groupCounts(records, (r2) => incomeBracketLabel(r2[field])), INCOME_BRACKETS);
};

const meanOf = (vals) => {
  const v = vals.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

export const aggregateIndices = (records, phase = 'All') => INDEX_FIELDS.map(([key, label]) => {
  const scoped = phase === 'All' ? records : records.filter((r2) => r2.phase === phase);
  const bene = meanOf(scoped.filter((r2) => r2.type === 'Beneficiary').map((r2) => r2[key]));
  const nb = meanOf(scoped.filter((r2) => r2.type === 'Non-Beneficiary').map((r2) => r2[key]));
  return { name: label, Beneficiary: bene === null ? 0 : Number(bene.toFixed(2)), 'Non-Beneficiary': nb === null ? 0 : Number(nb.toFixed(2)), hasData: bene !== null || nb !== null };
});

export const aggregateLikert = (statements, records) => {
  const bene = records.filter((r2) => r2.type === 'Beneficiary');
  const result = {};
  Object.keys(statements).forEach((cat) => {
    const rows = statements[cat].map((st, idx) => {
      const counts = [0, 0, 0, 0, 0];
      bene.forEach((r2) => {
        const v = (r2.likert?.[cat] || [])[idx];
        if (v >= 1 && v <= 5) counts[v - 1] += 1;
      });
      const answered = counts.reduce((s, c) => s + c, 0);
      const pctValues = counts.map((c) => (answered ? Number(((c / answered) * 100).toFixed(1)) : 0));
      return {
        key: `${cat}-${idx}`,
        short: st.short,
        title: st.title,
        counts,
        answered,
        values: pctValues,
        mean: answered ? Number((counts.reduce((s, c, i) => s + c * (i + 1), 0) / answered).toFixed(2)) : null,
      };
    });
    result[cat] = rows.filter((row) => row.answered > 0);
  });
  return result;
};

export const PEI_BIN_LABELS = ['1.0–1.4', '1.5–1.9', '2.0–2.4', '2.5–2.9', '3.0–3.4', '3.5–3.9', '4.0–4.4', '4.5–5.0'];

export const computePEI = (records) => {
  const bene = records.filter((r2) => r2.type === 'Beneficiary');
  const scores = [];
  bene.forEach((r2) => {
    const vals = [];
    Object.keys(r2.likert || {}).forEach((cat) => {
      (r2.likert[cat] || []).forEach((v) => { if (v >= 1 && v <= 5) vals.push(v); });
    });
    if (!vals.length) return;
    scores.push(vals.reduce((s, v) => s + v, 0) / vals.length);
  });
  if (!scores.length) return { applicable: false, bins: [], mean: null, count: 0 };
  const binCounts = PEI_BIN_LABELS.map(() => 0);
  scores.forEach((s) => {
    const idx = Math.min(binCounts.length - 1, Math.max(0, Math.floor((s - 1) / 0.5)));
    binCounts[idx] += 1;
  });
  const total = scores.length;
  return {
    applicable: true,
    count: total,
    mean: Number((scores.reduce((s, v) => s + v, 0) / total).toFixed(2)),
    bins: PEI_BIN_LABELS.map((label, i) => ({
      name: label,
      count: binCounts[i],
      pct: Number(((binCounts[i] / total) * 100).toFixed(1)),
    })),
  };
};

export const buildSummary = (records) => ({
  total: records.length,
  beneficiaries: records.filter((r2) => r2.type === 'Beneficiary').length,
  nonBeneficiaries: records.filter((r2) => r2.type === 'Non-Beneficiary').length,
  regions: new Set(records.map((r2) => r2.region).filter((x) => x && x !== 'Unknown Region')).size,
  municipalities: new Set(records.map((r2) => `${r2.municipality}|${r2.province}`).filter((x) => !x.startsWith('|'))).size,
  avgTotalIncome: meanOf(records.map((r2) => r2.totalIncome)),
  avgFishingIncome: meanOf(records.map((r2) => r2.fishingIncome)),
});

export const buildMapPoints = (records) => {
  const groups = new Map();
  records.forEach((rec) => {
    const key = `${rec.municipality.toUpperCase()}|${rec.province}`;
    if (!groups.has(key)) {
      groups.set(key, { key, name: rec.municipality || rec.province, province: rec.province, region: rec.region, latlng: rec.latlng || null, total: 0, b: 0, nb: 0 });
    }
    const g = groups.get(key);
    g.total += 1;
    if (rec.type === 'Beneficiary') g.b += 1;
    else if (rec.type === 'Non-Beneficiary') g.nb += 1;
  });
  return Array.from(groups.values());
};
