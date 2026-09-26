// src/lib/combinedDataset.js
// ============================================================
// NO-BASELINE ML ANALYSIS DATA BUILDER
// Merges the Beneficiary (before_form) and Non-Beneficiary
// (after_form) questionnaire responses into a single flat
// CSV-ready dataset ({ columns, rows }) that the ML `/train`
// pipeline can consume — the same shape a user would upload
// manually via the ML Upload page, except it is built
// automatically from the project's collected responses.
// Each row is tagged with a "Status" treatment column whose
// values are "Beneficiary" / "Non-Beneficiary".
// ============================================================

import { normalizeLocationCodes, getQuestionLabel } from './preprocessing';
import { flattenFormQuestions as flattenQuestions } from './formQuestions';


const normalizeCode = (q) =>
  String(q?.code || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .replace(/^([A-Z])0+/, '$1');

const normalizeLabel = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const optionText = (option) => {
  if (option && typeof option === 'object') return option.label ?? option.value ?? option.title ?? '';
  return option;
};

const isGeographicQuestion = (question) => {
  const code = normalizeCode(question);
  const title = normalizeLabel(question?.title);
  return ['A1', 'A2', 'A3'].includes(code) ||
    question?.type === 'location_text' ||
    /municipal|barangay|province|brgy/.test(title);
};

const isDateQuestion = (question) => /date|birth|dob|petsa|kapanganakan/i.test(
  `${question?.type || ''} ${question?.code || ''} ${question?.title || ''}`
);

const cleanDate = (answer) => {
  const value = String(answer || '').trim();
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

/**
 * True when a question adds no analytic signal for the ML pipeline:
 * respondent identity/name fields and photo uploads.
 */
const isNoiseColumn = (q) => {
  if (!q) return true;
  const code = normalizeCode(q);
  if (/^RESP0?1$|^RESP0?2$/.test(code)) return true;
  if (q.type === 'profile_photo') return true;
  const t = normalizeLabel(q.title);
  if (/^(respondent id|respondent idd|respondent name|respondent s name|full name|name|respondents name)$/.test(t)) {
    return true;
  }
  return false;
};

/**
 * Resolves whether a response belongs to the Beneficiary or
 * Non-Beneficiary group, mirroring the logic used across the
 * responses tables (FormResponses) and the report data engine.
 */
export const resolveBeneficiaryStatus = (response, form) => {
  const s = response?.beneficiary_status;
  if (typeof s === 'string') {
    if (/^yes$|^true$|^1$|^beneficiar/i.test(s.trim())) return 'Beneficiary';
    if (/^no$|^false$|^0$|^non[- ]?beneficiar|^nonbeneficiar/i.test(s.trim())) return 'Non-Beneficiary';
  }
  if (s === true) return 'Beneficiary';
  if (s === false) return 'Non-Beneficiary';
  const id = String(response?.respondent_id || '');
  if (/^B-?/i.test(id)) return 'Beneficiary';
  if (/^NB-?/i.test(id)) return 'Non-Beneficiary';
  if (form?.has_baseline === false && form?.questionnaire_type) {
    return form.questionnaire_type === 'before' ? 'Beneficiary' : 'Non-Beneficiary';
  }
  return '';
};

const isYesNoQuestion = (question) => {
  if (!question) return false;
  if (question.type === 'yes_no') return true;
  const options = (question.options || []).map((o) => String(optionText(o)).toLowerCase().trim()).filter(Boolean);
  return options.length > 0 && options.every((o) => ['oo', 'yes', 'true', 'meron', 'hindi', 'no', 'false', 'wala'].includes(o));
};

/**
 * Extracts a numeric value from text that may contain currency symbols,
 * comma thousand-separators, and/or trailing units/suffixes.
 * Examples: "₱1,500" → 1500, "1500 pesos" → 1500, "42 years" → 42,
 *           "1,500.00/month" → 1500, "N/A" → null.
 */
const extractNumeric = (text) => {
  if (text === null || text === undefined || text === '') return null;
  const cleaned = String(text)
    .replace(/[₱$€£¥₩,%]/g, '')
    .replace(/\s*(pesos?|php|ng|manila|months?|yrs?|years?|kg|kilos?|lbs?|g\b|units?|pcs?|pieces?|hours?|days?|items?|bags?|packs?)\b/gi, '')
    .trim();
  // Unit-only text such as "kg" or "pesos" is empty once the unit is stripped,
  // and Number('') is 0 -- require a digit so it isn't read as a real zero.
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  return null;
};

const YES_NO_TOKENS = { oo: '1', yes: '1', true: '1', meron: '1', hindi: '0', no: '0', false: '0', wala: '0' };

const CHOICE_TYPES = ['multiple_choice', 'dropdown', 'radio', 'checkboxes', 'checkbox', 'single_choice', 'multi_select', 'select', 'choice', 'multiple_response', 'yes_no'];
const isChoiceQuestion = (q) => CHOICE_TYPES.includes(q?.type) || (Array.isArray(q?.options) && q.options.length > 0);

const formatChoiceAnswer = (answer, q) => {
  if (isGeographicQuestion(q)) return String(answer).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  // A choice question is option-coded even when a word like "update" or "date" appears in its title.
  if (isDateQuestion(q) && !isChoiceQuestion(q)) return cleanDate(answer);
  const text = String(answer ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return text;
  // Handle numbers with comma thousand-separators (e.g. "1,500" → "1500")
  if (/^-?[\d,]+(\.\d+)?$/.test(text)) return text.replace(/,/g, '');
  if (isChoiceQuestion(q)) {
    const normalized = text.toLowerCase();
    if (isYesNoQuestion(q) && Object.prototype.hasOwnProperty.call(YES_NO_TOKENS, normalized)) return YES_NO_TOKENS[normalized];
    const idx = (q.options || []).findIndex((option) =>
      String(optionText(option)).trim().toLowerCase() === normalized
    );
    return idx === -1 ? '' : String(idx + 1);
  }
  if (q.type === 'rating') {
    const n = Number(answer);
    return Number.isFinite(n) ? String(n) : '';
  }
  // Only extract numbers for numeric/currency question types; preserve full text otherwise
  if (['number', 'currency'].includes(q.type)) {
    const num = extractNumeric(text);
    if (num !== null) return String(num);
  }
  return text;
};

/**
 * Strict numeric form of formatChoiceAnswer, used by the All Responses CSV
 * export. It applies the same option-index / yes-no / rating / number rules as
 * the analysis dataset, but every result is a number: an answer with no numeric
 * code (free text, a label that matches no option) is '' instead of raw text.
 *   choice       -> 1-based option index (yes/no -> 1/0)
 *   multi-select -> comma-separated option indexes, e.g. "1,3"
 *   date         -> YYYY/MM/DD, e.g. 1986/10/07 (the one non-numeric exception)
 *   number       -> the number, e.g. "₱1,500" -> 1500
 */
export const encodeAnswerNumeric = (answer, q) => {
  if (answer === null || answer === undefined || answer === '') return '';
  if (Array.isArray(answer)) {
    return answer.map((item) => encodeAnswerNumeric(item, q)).filter(Boolean).join(',');
  }
  if (isDateQuestion(q) && !isChoiceQuestion(q)) return cleanDate(answer).replace(/-/g, '/');
  const encoded = formatChoiceAnswer(answer, q);
  if (/^-?\d+(\.\d+)?$/.test(encoded)) return encoded;
  // Only a non-choice answer can still be numeric here (e.g. "₱1,500", "40 years").
  if (isChoiceQuestion(q)) return '';
  const num = extractNumeric(encoded);
  return num === null ? '' : String(num);
};

/**
 * True for free-form text questions: no option list, and not a date, number or
 * rating. Only these can hold categorical answers (e.g. "Raw materials") that
 * have no option index and so need buildTextCodebook.
 */
export const isTextQuestion = (q) =>
  !isChoiceQuestion(q) && !isDateQuestion(q) && !['rating', 'number', 'currency'].includes(q?.type);

/** Case/whitespace-insensitive key that identifies one distinct text answer. */
export const textCodeKey = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

// A column is only auto-coded when it looks categorical: few distinct answers,
// and answers that repeat (a column of one-off sentences or names is free text).
const MAX_TEXT_CATEGORIES = 20;

/**
 * Builds a numeric codebook for one column of text answers, for columns whose
 * questions have no option list to take codes from.
 *   - every answer a yes/no token (Oo/Hindi, Yes/No) -> 1/0, as in analysis
 *   - otherwise, categorical answers -> 1..n in alphabetical order
 *   - free text (too many distinct answers, or answers rarely repeat) -> null
 * Pass the text of every response (not just the visible ones) so the codes do
 * not change with filters. Returns a Map of textCodeKey(text) -> code, or null.
 */
export const buildTextCodebook = (texts) => {
  const counts = new Map();
  texts.forEach((text) => {
    const key = textCodeKey(text);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  const keys = [...counts.keys()];
  if (!keys.length) return null;
  if (keys.every((key) => Object.prototype.hasOwnProperty.call(YES_NO_TOKENS, key))) {
    return new Map(keys.map((key) => [key, YES_NO_TOKENS[key]]));
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (keys.length > MAX_TEXT_CATEGORIES || keys.length * 2 > total) return null;
  return new Map(keys.sort().map((key, i) => [key, String(i + 1)]));
};

const buildColumnModel = (questions) => {
  const cols = [];
  questions.forEach((q) => {
    if (isNoiseColumn(q)) return;
    const base = getQuestionLabel(q);
    if (q.type === 'checkboxes' && Array.isArray(q.options) && q.options.length) {
      q.options.forEach((opt, i) => {
        cols.push({ q, key: `${base}_${i + 1}`, kind: 'checkbox', option: opt });
      });
    } else {
      cols.push({ q, key: base, kind: q.type });
    }
  });
  return cols;
};

/**
 * Merges Beneficiary + Non-Beneficiary questionnaires and responses
 * into one flat dataset ready for the ML analysis pipeline.
 *
 * @returns {{ columns: string[], rows: object[], statusCounts: {Beneficiary:number, Non-Beneficiary:number}, respondentCount: number }}
 */
export const buildCombinedDataset = ({ beforeForm, beforeResponses = [], afterForm, afterResponses = [] } = {}) => {
  const beforeQs = normalizeLocationCodes(flattenQuestions(beforeForm));
  const afterQs = normalizeLocationCodes(flattenQuestions(afterForm));

  // Union the questions from both forms, deduped so a copied questionnaire
  // doesn't produce duplicate columns. Two questions are only treated as the
  // same column when BOTH their code and title match (or they're literally
  // the same question object, shared by id, as with common items asked to
  // both groups) -- Beneficiary and Non-Beneficiary questionnaires often
  // reuse the same code (e.g. "K1"/"K01" normalize to the same code, or a
  // literal same code like "J4a") for entirely different questions, and
  // matching on code alone would silently merge their unrelated answers
  // into one column.
  const qByUid = new Map();
  const orderedQs = [];
  // Every form's own copy of each column's question, keyed by column uid. The two
  // questionnaires usually give the same question different ids, so a response
  // must be looked up with ITS form's copy -- looking it up with the other form's
  // id found nothing, leaving every shared column answered by one group only.
  const copiesByUid = new Map();
  const uidOf = (q) => {
    const code = normalizeCode(q);
    const title = normalizeLabel(q.title);
    return code && title ? `${code}::${title}` : (code || title || q.id);
  };
  [beforeQs, afterQs].forEach((qs) => {
    qs.forEach((q) => {
      if (!q || !q.id) return;
      const uid = uidOf(q);
      if (uid && !qByUid.has(uid)) {
        qByUid.set(uid, q);
        orderedQs.push(q);
      }
      if (uid) copiesByUid.set(uid, [...(copiesByUid.get(uid) || []), q]);
    });
  });

  const cols = buildColumnModel(orderedQs);
  if (!cols.length) return { columns: [], rows: [], statusCounts: { Beneficiary: 0, 'Non-Beneficiary': 0 }, respondentCount: 0 };

  const columns = ['Status', ...cols.map((c) => c.key)];
  const rows = [];
  const statusCounts = { Beneficiary: 0, 'Non-Beneficiary': 0 };

  const ingest = (form, responses, fallbackStatus) => {
    if (!form) return;
    const formQuestionIds = new Set(flattenQuestions(form).map((q) => q.id));
    // null when this form never asked the column's question (e.g. the other
    // group's J2): searching by its code would pull in this form's own, unrelated J2.
    const ownCopy = (q) => (copiesByUid.get(uidOf(q)) || [q]).find((copy) => formQuestionIds.has(copy.id)) || null;
    responses.forEach((r) => {
      const answers = Array.isArray(r?.answers) ? r.answers : [];
      // Index this response's answers once by id, code and title (first answer
      // wins, as with answers.find) instead of scanning them for every column.
      const byId = new Map();
      const byCode = new Map();
      const byTitle = new Map();
      const first = (map, key, position) => { if (!map.has(key)) map.set(key, position); };
      answers.forEach((a, position) => {
        first(byId, a?.question_id, position);
        first(byId, a?.qid, position);
        first(byCode, normalizeCode({ code: a?.question_code }), position);
        first(byCode, normalizeCode({ code: a?.qid }), position);
        first(byTitle, normalizeLabel(a?.question_title), position);
        first(byTitle, normalizeLabel(a?.title), position);
      });
      const findAnswer = (columnQ) => {
        if (!columnQ) return null;
        const q = ownCopy(columnQ);
        if (!q) return null;
        const co = normalizeCode(q);
        const t = normalizeLabel(q.title);
        const positions = [byId.get(q.id), co ? byCode.get(co) : undefined, t ? byTitle.get(t) : undefined]
          .filter((position) => position !== undefined);
        const hit = positions.length ? answers[Math.min(...positions)] : undefined;
        return hit ? hit.answer : null;
      };
      const status = resolveBeneficiaryStatus(r, form) || fallbackStatus;
      if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
      const row = { Status: status || fallbackStatus };
      cols.forEach((c) => {
        const raw = findAnswer(c.q);
        if (raw === null || raw === undefined || raw === '') {
          row[c.key] = '';
          return;
        }
        if (c.kind === 'checkbox') {
          const selected = Array.isArray(raw)
            ? raw
            : String(raw).split(/[,;|]/).map((s) => s.trim());
          const opt = String(optionText(c.option)).trim().toLowerCase();
          row[c.key] = selected.some((item) => String(item).trim().toLowerCase() === opt) ? '1' : '0';
        } else {
          row[c.key] = formatChoiceAnswer(raw, c.q);
        }
      });
      rows.push(row);
    });
  };

  ingest(beforeForm, beforeResponses, 'Beneficiary');
  ingest(afterForm, afterResponses, 'Non-Beneficiary');

  return {
    columns,
    rows,
    statusCounts,
    respondentCount: rows.length,
  };
};