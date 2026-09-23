// src/lib/pairedBaseline.js
// ============================================================
// Baseline projects: per-person, per-question Before -> After
// comparison. Questions are matched between the two questionnaires
// by code (title when there is no code), so it works for any
// questionnaire, whatever its language.
//
// Matching a respondent's After response to their Before response:
//   1. linked_before_id -- the Before ID the respondent typed on the
//      After form (submit_response.js); trusted as-is.
//   2. otherwise a match score over the respondent's identity:
//        name (normalised) +4, or near-identical spelling +2
//        birthday (any date format) +3
//        sex +1, barangay +1, municipality +1
//        age the same or up to 3 years older +1 (younger: -2)
//        same person number (B-0001 / NB-0001 = person 0001) +1
//        clearly different name -3
//      A pair needs a score of 5+ and a name or birthday match, so an
//      ID number alone never pairs two different people. Pairs are
//      assigned best score first, one After response per Before one.
//
// Question kinds:
//   rating   -> numeric (mean Before / After, change, up/same/down)
//   yesno    -> Oo/Hindi, Meron/Wala, Yes/No (% yes; no->yes / yes->no)
//               "Di sigurado" / "not sure" counts as no answer
//   ordinal  -> every option carries a number (income brackets, counts):
//               mean option position, moved up / same / down
//   category -> any other choice: % of pairs whose answer changed
// ============================================================

import { getAnswerForQuestion } from './answerResolver';
import { isBeneficiaryQuestion, sectionsFor } from './responsesDataset';

export const PAIRED_KINDS = {
  rating: 'Rating',
  yesno: 'Yes / No',
  ordinal: 'Bracket',
  category: 'Choice',
};

const YES_TOKENS = new Set(['oo', 'yes', 'meron', 'mayroon', 'true']);
const NO_TOKENS = new Set(['hindi', 'no', 'wala', 'false']);
const UNSURE_TOKENS = new Set(['di sigurado', 'hindi sigurado', 'not sure', 'unsure', "don't know"]);
const SKIPPED_TYPES = new Set(['date', 'short_text', 'long_text', 'paragraph', 'text', 'profile_photo', 'checkboxes', 'respondent_id', 'respondent_name', 'location_text']);

const clean = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const optionText = (option) => (option && typeof option === 'object' ? option.label ?? option.value ?? '' : option);
const questionKey = (q) => {
  const code = String(q.code || '').replace(/[^A-Z0-9.]/gi, '').toUpperCase();
  return code ? `code:${code}` : `title:${clean(q.title)}`;
};

const classify = (q) => {
  if (q.type === 'rating') return 'rating';
  const options = (q.options || []).map((o) => clean(optionText(o))).filter(Boolean);
  if (!options.length) return null;
  const answerable = options.filter((o) => !UNSURE_TOKENS.has(o));
  if (answerable.every((o) => YES_TOKENS.has(o) || NO_TOKENS.has(o))
    && answerable.some((o) => YES_TOKENS.has(o)) && answerable.some((o) => NO_TOKENS.has(o))) return 'yesno';
  if (options.every((o) => /\d/.test(o))) return 'ordinal';
  return 'category';
};

// Answer -> comparable value for the question kind, or null when unanswered.
const valueFor = (raw, q, kind) => {
  const answer = Array.isArray(raw) ? raw[0] : raw;
  if (answer === null || answer === undefined || answer === '' || answer === '--') return null;
  const text = clean(answer);
  if (kind === 'rating') {
    const n = Number(answer);
    return Number.isFinite(n) ? n : null;
  }
  if (kind === 'yesno') {
    if (YES_TOKENS.has(text)) return 1;
    if (NO_TOKENS.has(text)) return 0;
    return null;
  }
  const idx = (q.options || []).findIndex((o) => clean(optionText(o)) === text);
  if (kind === 'ordinal') return idx === -1 ? null : idx + 1;
  return idx === -1 ? text : clean(optionText(q.options[idx]));
};

const idNumber = (id, prefix) => {
  const match = String(id || '').trim().match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
  return match ? parseInt(match[1], 10) : null;
};

const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

const questionnaireQuestions = (form) => sectionsFor(form)
  .filter((section) => section.section_type === 'questionnaire')
  .flatMap((section) => section.questions || [])
  .filter((q) => !isBeneficiaryQuestion(q) && !SKIPPED_TYPES.has(q.type));

// ---------- respondent identity (for matching Before <-> After) ----------
export const MATCH_METHODS = {
  linked: 'Linked Before ID',
  idProfile: 'ID + name / demographics',
  profile: 'Name / demographics',
};
const MIN_MATCH_SCORE = 5;

const normName = (value) => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const nameTokens = (value) => normName(value).split(' ').filter(Boolean).sort().join(' ');

const editDistance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
};

// "12/03/1987", "12-03-1987", "1987-03-12" -> "1987-03-12"; null when unreadable.
const normDate = (value) => {
  const text = String(value ?? '').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};

const findQuestion = (questions, codeRe, titleRe) =>
  questions.find((q) => codeRe.test(String(q.code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()))
  || questions.find((q) => titleRe.test(String(q.title || '')));

const identitiesFor = (form, responses) => {
  const sections = sectionsFor(form);
  const questions = sections.flatMap((s) => s.questions || []);
  const sexQ = findQuestion(questions, /^B0?5$/, /\b(sex|gender|kasarian)\b/i);
  const birthQ = findQuestion(questions, /^B0?4$/, /birth|kaarawan|kapanganakan/i);
  const ageQ = findQuestion(questions, /^B0?3$/, /\b(age|edad|gulang)\b/i);
  const barangayQ = findQuestion(questions, /^A2$/, /barangay|brgy/i);
  const muniQ = findQuestion(questions, /^A1$/, /municipal|city|bayan/i);
  const nameQ = findQuestion(questions, /^RESP0?2$/, /respondent name|pangalan/i);
  const answer = (r, q) => {
    if (!q) return null;
    const v = getAnswerForQuestion(r, q, { sections });
    return Array.isArray(v) ? v[0] : v;
  };
  return responses.map((r) => {
    const rawName = r.full_name || answer(r, nameQ);
    const age = Number(String(answer(r, ageQ) ?? r.age ?? '').replace(/[^\d.]/g, ''));
    return {
      response: r,
      name: normName(rawName),
      tokens: nameTokens(rawName),
      birthday: normDate(answer(r, birthQ)),
      sex: normName(answer(r, sexQ) ?? r.gender),
      barangay: normName(r.barangay || answer(r, barangayQ)),
      municipality: normName(r.municipality || answer(r, muniQ)),
      age: Number.isFinite(age) && age > 0 ? age : null,
      number: idNumber(r.respondent_id, 'B') ?? idNumber(r.respondent_id, 'NB'),
    };
  });
};

const matchScore = (b, a) => {
  let score = 0;
  let nameMatch = false;
  if (b.name && a.name) {
    if (b.name === a.name || b.tokens === a.tokens) {
      score += 4;
      nameMatch = true;
    } else {
      const longest = Math.max(b.name.length, a.name.length);
      const distance = editDistance(b.name, a.name) / longest;
      if (longest >= 5 && distance <= 0.15) {
        score += 2;
        nameMatch = true;
      } else if (distance > 0.4) {
        score -= 3; // clearly a different name: demographics alone must not pair them
      }
    }
  }
  const birthdayMatch = !!(b.birthday && b.birthday === a.birthday);
  if (birthdayMatch) score += 3;
  if (b.sex && b.sex === a.sex) score += 1;
  if (b.barangay && b.barangay === a.barangay) score += 1;
  if (b.municipality && b.municipality === a.municipality) score += 1;
  if (b.age !== null && a.age !== null) {
    const gap = a.age - b.age;
    if (gap >= 0 && gap <= 3) score += 1;
    else if (gap < -1) score -= 2;
  }
  const sameNumber = b.number !== null && b.number === a.number;
  if (sameNumber) score += 1;
  return { score, sameNumber, ok: score >= MIN_MATCH_SCORE && (nameMatch || birthdayMatch) };
};

/**
 * Links each After response to the same person's Before response.
 * @returns {{ pairs: {before, after, method, score}[], beforeWithoutAfter, afterWithoutBefore, methodCounts }}
 */
export const pairResponses = ({ beforeForm, beforeResponses = [], afterForm, afterResponses = [] } = {}) => {
  const befores = identitiesFor(beforeForm, beforeResponses);
  const afters = identitiesFor(afterForm, afterResponses);
  const usedBefore = new Set();
  const usedAfter = new Set();
  const pairs = [];

  // 1. Explicit links typed on the After form.
  const beforeByNumber = new Map();
  befores.forEach((b, i) => { if (b.number !== null && !beforeByNumber.has(b.number)) beforeByNumber.set(b.number, i); });
  afters.forEach((a, ai) => {
    const n = idNumber(a.response.linked_before_id, 'B') ?? idNumber(a.response.linked_before_id, 'NB');
    const bi = n === null ? undefined : beforeByNumber.get(n);
    if (bi === undefined || usedBefore.has(bi)) return;
    usedBefore.add(bi);
    usedAfter.add(ai);
    pairs.push({ before: befores[bi].response, after: a.response, method: 'linked', score: null });
  });

  // 2. Scored matching on identity, best score first, one-to-one.
  const candidates = [];
  afters.forEach((a, ai) => {
    if (usedAfter.has(ai)) return;
    befores.forEach((b, bi) => {
      if (usedBefore.has(bi)) return;
      const m = matchScore(b, a);
      if (m.ok) candidates.push({ ai, bi, ...m });
    });
  });
  candidates.sort((x, y) => (y.score - x.score) || (Number(y.sameNumber) - Number(x.sameNumber)));
  candidates.forEach(({ ai, bi, score, sameNumber }) => {
    if (usedAfter.has(ai) || usedBefore.has(bi)) return;
    usedAfter.add(ai);
    usedBefore.add(bi);
    pairs.push({ before: befores[bi].response, after: afters[ai].response, method: sameNumber ? 'idProfile' : 'profile', score });
  });

  const methodCounts = pairs.reduce((acc, p) => ({ ...acc, [p.method]: (acc[p.method] || 0) + 1 }), {});
  return {
    pairs,
    beforeWithoutAfter: beforeResponses.length - pairs.length,
    afterWithoutBefore: afterResponses.length - pairs.length,
    methodCounts,
  };
};

const compareQuestion = (bq, aq, kind, pairs, beforeSections, afterSections) => {
  const values = [];
  pairs.forEach(({ before, after }) => {
    const b = valueFor(getAnswerForQuestion(before, bq, { sections: beforeSections }), bq, kind);
    const a = valueFor(getAnswerForQuestion(after, aq, { sections: afterSections }), aq, kind);
    if (b !== null && a !== null) values.push([b, a]);
  });
  const n = values.length;
  const row = { key: questionKey(bq), code: bq.code || '', title: bq.title || 'Untitled question', kind, n };
  if (!n) return row;
  if (kind === 'category') {
    const changed = values.filter(([b, a]) => b !== a).length;
    const mode = (list) => {
      const counts = new Map();
      list.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
      return [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
    };
    return { ...row, beforeTop: mode(values.map(([b]) => b)), afterTop: mode(values.map(([, a]) => a)), changed, same: n - changed };
  }
  const befores = values.map(([b]) => b);
  const afters = values.map(([, a]) => a);
  return {
    ...row,
    optionCount: kind === 'ordinal' ? (bq.options || []).length : null,
    beforeMean: mean(befores),
    afterMean: mean(afters),
    change: mean(afters) - mean(befores),
    up: values.filter(([b, a]) => a > b).length,
    same: values.filter(([b, a]) => a === b).length,
    down: values.filter(([b, a]) => a < b).length,
  };
};

/**
 * @returns {{ pairCount, beforeWithoutAfter, afterWithoutBefore, questions: object[] }}
 *   questions: one row per question asked in both questionnaires, in Before-form order.
 */
export const buildPairedComparison = ({ beforeForm, beforeResponses = [], afterForm, afterResponses = [] } = {}) => {
  const { pairs, beforeWithoutAfter, afterWithoutBefore, methodCounts } = pairResponses({ beforeForm, beforeResponses, afterForm, afterResponses });
  const beforeSections = sectionsFor(beforeForm);
  const afterSections = sectionsFor(afterForm);
  const afterByKey = new Map(questionnaireQuestions(afterForm).map((q) => [questionKey(q), q]));

  const questions = [];
  const seen = new Set();
  questionnaireQuestions(beforeForm).forEach((bq) => {
    const key = questionKey(bq);
    const aq = afterByKey.get(key);
    const kind = classify(bq);
    if (!aq || !kind || seen.has(key)) return;
    seen.add(key);
    questions.push(compareQuestion(bq, aq, kind, pairs, beforeSections, afterSections));
  });

  const pairList = pairs.map((p) => ({
    beforeId: p.before.respondent_id || '—',
    afterId: p.after.respondent_id || '—',
    beforeName: p.before.full_name || '—',
    afterName: p.after.full_name || '—',
    method: p.method,
    score: p.score,
  }));
  return { pairCount: pairs.length, beforeWithoutAfter, afterWithoutBefore, methodCounts, pairList, questions };
};
