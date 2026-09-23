// src/lib/baselineReport.js
// ============================================================
// BASELINE REPORT DATA
// Everything the baseline Report shows, computed from the Before
// and After questionnaires and their responses. The comparison is
// Before vs After (the same program's respondents surveyed before
// and after the intervention). It is driven by the questionnaire's
// structure -- question types, option lists and question codes --
// rather than English keywords, so Tagalog questionnaires work.
//
//   profile   -> demographics-section questions, Before vs After
//   income    -> peso-bracket questions, estimated mean from bracket midpoints
//   indices   -> composite scores per question group (code prefix):
//                yes/no groups = share of "yes" items per respondent,
//                rating groups = mean rating per respondent
//   sections  -> every questionnaire question, option distribution Before vs After
//   locations -> map points (b = Before, nb = After)
// ============================================================

import { getAnswerForQuestion } from './answerResolver';
import { isBeneficiaryQuestion, sectionsFor } from './responsesDataset';
import { isReservedField } from './preprocessing';
import { resolveRegion } from './geoData';
import { AGE_BRACKETS, ageBracketLabel } from './reportData';

export const PHASES = ['Before', 'After'];

// Question groups of the BFAR SES instrument, by code prefix. Groups not
// listed here are titled from their code.
const GROUP_TITLES = {
  C: 'Income & Livelihood',
  D: 'Durable Assets',
  D1: 'Vehicles',
  D2: 'Household Appliances',
  D3: 'Communication Devices',
  D4: 'Productive / Fishing Equipment',
  E: 'Living Conditions',
  F: 'Real Property',
  G: 'Insurance Coverage',
  H: 'Government Program Participation',
  I: 'Fishing Activity',
  J: 'Boat & Program Perception',
  J5: 'Program Relevance',
  J6: 'Social Impact',
  J7: 'Sustainability',
};

// Composite indices shown as key indicators, by group.
const INDEX_DEFS = [
  { group: 'D', label: 'DOI', full: 'Durables Ownership Index · share of listed assets owned' },
  { group: 'D1', label: 'Vehicles', full: 'Share of listed vehicles owned' },
  { group: 'D2', label: 'Appliances', full: 'Share of listed household appliances owned' },
  { group: 'D3', label: 'Communication', full: 'Share of listed communication devices owned' },
  { group: 'D4', label: 'Equipment', full: 'Share of listed productive / fishing equipment owned' },
  { group: 'G', label: 'ICI', full: 'Insurance Coverage Index · share of insurance types held' },
  { group: 'H', label: 'Programs', full: 'Share of government programs participated in' },
  { group: 'J5', label: 'Relevance', full: 'Mean rating of the program-relevance statements (J5)' },
  { group: 'J6', label: 'Social Impact', full: 'Mean rating of the social-impact statements (J6)' },
  { group: 'J7', label: 'Sustainability', full: 'Mean rating of the sustainability statements (J7)' },
];

const YES_TOKENS = new Set(['oo', 'yes', 'meron', 'mayroon', 'true']);
const NO_TOKENS = new Set(['hindi', 'no', 'wala', 'false']);
const UNSURE_TOKENS = new Set(['di sigurado', 'hindi sigurado', 'not sure', 'unsure', "don't know"]);
const NON_CHART_TYPES = new Set(['date', 'profile_photo', 'long_text', 'paragraph']);

const clean = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const optionText = (option) => String(option && typeof option === 'object' ? option.label ?? option.value ?? '' : option ?? '').trim();
const firstAnswer = (raw) => (Array.isArray(raw) ? raw[0] : raw);
const isBlank = (v) => v === null || v === undefined || v === '' || v === '--';
const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const cap = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const questionCode = (q) => String(q.code || '').replace(/[^A-Z0-9.]/gi, '').toUpperCase();
const questionKey = (q) => (questionCode(q) ? `code:${questionCode(q)}` : `title:${clean(q.title)}`);

// "D1.3B" -> ['D', 'D1'];  "G4" -> ['G'];  "J5.2" -> ['J', 'J5'];  "C01" -> ['C']
const groupsOf = (code) => {
  const m = /^([A-Z]+)(\d+)?(\.\d+)?/.exec(code);
  if (!m) return [];
  return m[3] ? [m[1], `${m[1]}${Number(m[2])}`] : [m[1]];
};
const groupTitle = (group) => GROUP_TITLES[group] || `Section ${group}`;

const optionsOf = (q) => (q.options || []).map(optionText).filter(Boolean);

export const classifyQuestion = (q) => {
  if (q.type === 'rating') return 'rating';
  const options = optionsOf(q).map(clean);
  if (!options.length) return 'text';
  const answerable = options.filter((o) => !UNSURE_TOKENS.has(o));
  if (answerable.length && answerable.every((o) => YES_TOKENS.has(o) || NO_TOKENS.has(o))
    && answerable.some((o) => YES_TOKENS.has(o)) && answerable.some((o) => NO_TOKENS.has(o))) return 'yesno';
  if (options.every((o) => /\d/.test(o))) return 'ordinal';
  return 'category';
};

// Peso bracket label -> monthly peso estimate (bracket midpoint).
// "≤₱10K" -> 5000, ">₱10K to ₱20K" -> 15000, ">₱50K" -> 55000.
const bracketPesos = (label) => {
  const text = String(label).replace(/,/g, '');
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(k)?/gi)].map((m) => Number(m[1]) * (m[2] ? 1000 : 1));
  if (!nums.length) return null;
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  if (/[≤<]|below|under|less|pababa/i.test(text)) return nums[0] / 2;
  if (/[≥>]|above|over|more|pataas/i.test(text)) return nums[0] * 1.1;
  return nums[0];
};
const isPesoQuestion = (q) => classifyQuestion(q) === 'ordinal' && optionsOf(q).some((o) => /₱|php|peso|piso/i.test(o));

const matchOption = (q, value) => {
  const text = clean(value);
  return optionsOf(q).find((o) => clean(o) === text) || null;
};

// --------------------------------------------------------------------------
// Respondent rows: one per response, with its answers resolved per question.
// --------------------------------------------------------------------------
const buildRows = (form, responses, phase) => {
  if (!form) return { rows: [], demo: [], quest: [] };
  const sections = sectionsFor(form);
  const usable = (q) => !isReservedField(q) && !isBeneficiaryQuestion(q) && !NON_CHART_TYPES.has(q.type);
  const demo = sections.filter((s) => s.section_type === 'demographics').flatMap((s) => s.questions || []).filter(usable);
  const quest = sections.filter((s) => s.section_type !== 'demographics').flatMap((s) => s.questions || []).filter(usable);
  const all = sections.flatMap((s) => s.questions || []);
  const locationQ = (re) => all.find((q) => re.test(`${questionCode(q)} ${clean(q.title)}`));
  const muniQ = locationQ(/^A1\b|municipal|city|bayan/);
  const provQ = locationQ(/^A3\b|province|lalawigan/);

  const rows = responses.map((r) => {
    const answer = (q) => firstAnswer(getAnswerForQuestion(r, q, { sections }));
    const municipality = cap(r.municipality || (muniQ ? answer(muniQ) : '') || '');
    const province = cap(r.province || (provQ ? answer(provQ) : '') || '') || 'Unknown';
    const values = {};
    [...demo, ...quest].forEach((q) => {
      const v = answer(q);
      if (!isBlank(v)) values[questionKey(q)] = v;
    });
    return { id: r.respondent_id || r.id, phase, municipality, province, region: resolveRegion(province) || 'Unknown Region', values };
  });
  return { rows, demo, quest };
};

// Share of each option among the respondents of one phase who answered.
const distribution = (q, key, rowsByPhase, kind) => {
  const labels = kind === 'rating' ? null : optionsOf(q);
  const counts = {};
  const answered = {};
  PHASES.forEach((phase) => {
    counts[phase] = new Map();
    answered[phase] = 0;
    rowsByPhase[phase].forEach((row) => {
      const v = row.values[key];
      if (isBlank(v)) return;
      const label = kind === 'rating'
        ? (Number.isFinite(Number(v)) ? String(Math.round(Number(v))) : null)
        : matchOption(q, v) || String(v).trim();
      if (!label) return;
      answered[phase] += 1;
      counts[phase].set(label, (counts[phase].get(label) || 0) + 1);
    });
  });
  let order = labels;
  if (kind === 'rating') {
    const seen = [...new Set(PHASES.flatMap((p) => [...counts[p].keys()]))].map(Number);
    const max = Math.max(5, ...seen);
    order = Array.from({ length: max }, (_, i) => String(i + 1));
  } else {
    const extra = [...new Set(PHASES.flatMap((p) => [...counts[p].keys()]))].filter((l) => !order.includes(l));
    order = [...order, ...extra];
  }
  const rows = order.map((name) => ({
    name,
    Before: answered.Before ? (counts.Before.get(name) || 0) / answered.Before * 100 : 0,
    After: answered.After ? (counts.After.get(name) || 0) / answered.After * 100 : 0,
    BeforeN: counts.Before.get(name) || 0,
    AfterN: counts.After.get(name) || 0,
  }));
  return { rows, answered };
};

// Numeric value of an answer for the question kind (null when not scorable).
const scoreOf = (q, kind, v) => {
  if (isBlank(v)) return null;
  if (kind === 'rating') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (kind === 'yesno') {
    const t = clean(v);
    if (YES_TOKENS.has(t)) return 1;
    if (NO_TOKENS.has(t)) return 0;
    return null;
  }
  if (kind === 'ordinal') {
    const label = matchOption(q, v);
    return label ? optionsOf(q).indexOf(label) + 1 : null;
  }
  return null;
};

const numericOf = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return String(v ?? '').match(/\d/) && Number.isFinite(n) ? n : null;
};

export const buildBaselineReport = ({ beforeForm, beforeResponses = [], afterForm, afterResponses = [] } = {}) => {
  const before = buildRows(beforeForm, beforeResponses, 'Before');
  const after = buildRows(afterForm, afterResponses, 'After');
  const rowsByPhase = { Before: before.rows, After: after.rows };
  const allRows = [...before.rows, ...after.rows];

  // Questions asked in either questionnaire, matched by code (title when uncoded).
  const merge = (a, b) => {
    const seen = new Map();
    [...a, ...b].forEach((q) => { if (!seen.has(questionKey(q))) seen.set(questionKey(q), q); });
    return [...seen.entries()].map(([key, q]) => ({ key, q }));
  };
  const demoQs = merge(before.demo, after.demo);
  const questQs = merge(before.quest, after.quest);

  // ---- Profile (demographics) ----
  const profile = demoQs.map(({ key, q }) => {
    const kind = classifyQuestion(q);
    if (kind === 'text') {
      // Free-text demographics: only age is charted (in age brackets).
      if (!/^B0?3$/.test(questionCode(q)) && !/\b(age|edad|gulang)\b/i.test(q.title || '')) return null;
      const values = allRows.map((r) => r.values[key]).filter((v) => !isBlank(v));
      const nums = values.map(numericOf).filter((n) => n !== null && n >= 10 && n <= 110);
      if (!values.length || nums.length < values.length * 0.8) return null;
      const bins = AGE_BRACKETS.map((name) => ({ name, Before: 0, After: 0, BeforeN: 0, AfterN: 0 }));
      const answered = { Before: 0, After: 0 };
      PHASES.forEach((phase) => rowsByPhase[phase].forEach((row) => {
        const n = numericOf(row.values[key]);
        const label = n === null ? null : ageBracketLabel(n);
        const bin = bins.find((b) => b.name === label);
        if (!bin) return;
        bin[`${phase}N`] += 1;
        answered[phase] += 1;
      }));
      bins.forEach((b) => PHASES.forEach((p) => { b[p] = answered[p] ? b[`${p}N`] / answered[p] * 100 : 0; }));
      const meanAge = (phase) => mean(rowsByPhase[phase].map((r) => numericOf(r.values[key])).filter((n) => n !== null));
      return { key, code: questionCode(q), title: q.title, kind: 'bins', rows: bins, answered, beforeMean: meanAge('Before'), afterMean: meanAge('After') };
    }
    const { rows, answered } = distribution(q, key, rowsByPhase, kind);
    if (!answered.Before && !answered.After) return null;
    return { key, code: questionCode(q), title: q.title, kind, rows, answered };
  }).filter(Boolean);

  // ---- Questionnaire sections, question by question ----
  const sectionMap = new Map();
  let lastGroup = 'Other';
  questQs.forEach(({ key, q }) => {
    const code = questionCode(q);
    const group = groupsOf(code)[0] || lastGroup;
    lastGroup = group;
    const kind = classifyQuestion(q);
    if (kind === 'text') return;
    const { rows, answered } = distribution(q, key, rowsByPhase, kind);
    if (!answered.Before && !answered.After) return;
    const scored = kind === 'rating' || kind === 'yesno' || kind === 'ordinal';
    const phaseMean = (phase) => (scored
      ? mean(rowsByPhase[phase].map((r) => scoreOf(q, kind, r.values[key])).filter((n) => n !== null))
      : null);
    if (!sectionMap.has(group)) sectionMap.set(group, { id: group, title: groupTitle(group), questions: [] });
    sectionMap.get(group).questions.push({
      key, code, title: q.title || 'Untitled question', kind, rows, answered,
      beforeMean: phaseMean('Before'), afterMean: phaseMean('After'),
      optionCount: optionsOf(q).length,
    });
  });
  const sections = [...sectionMap.values()];

  // ---- Income (peso brackets -> estimated monthly pesos) ----
  const income = questQs.filter(({ q }) => isPesoQuestion(q)).map(({ key, q }) => {
    const pesosFor = (phase) => rowsByPhase[phase]
      .map((r) => { const label = matchOption(q, r.values[key]); return label ? bracketPesos(label) : null; })
      .filter((n) => n !== null);
    const b = pesosFor('Before');
    const a = pesosFor('After');
    return { key, code: questionCode(q), title: q.title, beforeMean: mean(b), afterMean: mean(a), beforeN: b.length, afterN: a.length };
  }).filter((i) => i.beforeN || i.afterN);

  // ---- Composite indices per respondent, averaged per phase ----
  const questionsByGroup = new Map();
  questQs.forEach(({ key, q }) => {
    groupsOf(questionCode(q)).forEach((g) => {
      if (!questionsByGroup.has(g)) questionsByGroup.set(g, []);
      questionsByGroup.get(g).push({ key, q, kind: classifyQuestion(q) });
    });
  });
  const indices = INDEX_DEFS.map((def) => {
    const items = questionsByGroup.get(def.group) || [];
    const yesno = items.filter((i) => i.kind === 'yesno');
    const ratings = items.filter((i) => i.kind === 'rating');
    const use = ratings.length > yesno.length ? ratings : yesno;
    if (use.length < 2) return null;
    const scale = use === ratings ? 'rating' : 'share';
    const perRespondent = (phase) => rowsByPhase[phase].map((row) => {
      const scores = use.map(({ key, q, kind }) => scoreOf(q, kind, row.values[key])).filter((n) => n !== null);
      return scores.length ? mean(scores) : null;
    }).filter((n) => n !== null);
    const b = perRespondent('Before');
    const a = perRespondent('After');
    if (!b.length && !a.length) return null;
    return {
      ...def, scale, items: use.length,
      beforeMean: mean(b), afterMean: mean(a), beforeN: b.length, afterN: a.length,
    };
  }).filter(Boolean);

  // ---- Map points (b = Before, nb = After) ----
  const locationMap = new Map();
  allRows.forEach((row) => {
    const key = `${row.municipality.toUpperCase()}|${row.province}`;
    if (!locationMap.has(key)) {
      locationMap.set(key, { key, name: row.municipality || row.province, province: row.province, region: row.region, total: 0, b: 0, nb: 0 });
    }
    const point = locationMap.get(key);
    point.total += 1;
    if (row.phase === 'Before') point.b += 1;
    else point.nb += 1;
  });
  const locations = [...locationMap.values()];

  return {
    counts: {
      before: before.rows.length,
      after: after.rows.length,
      municipalities: locations.filter((p) => p.name).length,
      regions: new Set(allRows.map((r) => r.region).filter((r) => r !== 'Unknown Region')).size,
    },
    locations,
    profile,
    income,
    indices,
    sections,
  };
};
