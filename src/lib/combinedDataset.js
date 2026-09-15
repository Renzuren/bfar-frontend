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

const flattenQuestions = (form) => {
  if (!form) return [];
  if (Array.isArray(form.questions) && form.questions.length) {
    return form.questions.map((q) => ({ ...q, _section: '' }));
  }
  if (Array.isArray(form.sections)) {
    return form.sections.flatMap((s) => (s.questions || []).map((q) => ({ ...q, _section: s.title || '' })));
  }
  return [];
};

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

const formatChoiceAnswer = (answer, q) => {
  if (isGeographicQuestion(q)) return String(answer).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (isDateQuestion(q)) return cleanDate(answer);
  const text = String(answer ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return text;
  const choiceTypes = ['multiple_choice', 'dropdown', 'radio', 'checkboxes', 'checkbox', 'single_choice', 'multi_select', 'select', 'choice', 'multiple_response'];
  if (choiceTypes.includes(q.type) || (Array.isArray(q.options) && q.options.length)) {
    const normalized = text.toLowerCase();
    if (['oo', 'yes', 'true', 'meron'].includes(normalized)) return '1';
    if (['hindi', 'no', 'false', 'wala'].includes(normalized)) return '0';
    const idx = (q.options || []).findIndex((option) =>
      String(optionText(option)).trim().toLowerCase() === normalized
    );
    return idx === -1 ? '' : String(idx + 1);
  }
  if (q.type === 'rating') {
    const n = Number(answer);
    return Number.isFinite(n) ? String(n) : '';
  }
  return '';
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

  // Union the questions from both forms, deduped by code (or title) so a
  // copied questionnaire doesn't produce duplicate columns.
  const qByUid = new Map();
  const orderedQs = [];
  [beforeQs, afterQs].forEach((qs) => {
    qs.forEach((q) => {
      if (!q || !q.id) return;
      const uid = normalizeCode(q) || normalizeLabel(q.title);
      if (uid && !qByUid.has(uid)) {
        qByUid.set(uid, q);
        orderedQs.push(q);
      }
    });
  });

  const cols = buildColumnModel(orderedQs);
  if (!cols.length) return { columns: [], rows: [], statusCounts: { Beneficiary: 0, 'Non-Beneficiary': 0 }, respondentCount: 0 };

  const columns = ['Status', ...cols.map((c) => c.key)];
  const rows = [];
  const statusCounts = { Beneficiary: 0, 'Non-Beneficiary': 0 };

  const ingest = (form, responses, fallbackStatus) => {
    if (!form) return;
    responses.forEach((r) => {
      const answers = Array.isArray(r?.answers) ? r.answers : [];
      const findAnswer = (q) => {
        if (!q) return null;
        const qid = q.id;
        const co = normalizeCode(q);
        const t = normalizeLabel(q.title);
        const hit = answers.find((a) =>
          a?.question_id === qid ||
          a?.qid === qid ||
          (co && (normalizeCode({ code: a?.question_code }) === co || normalizeCode({ code: a?.qid }) === co)) ||
          (t && (normalizeLabel(a?.question_title) === t || normalizeLabel(a?.title) === t))
        );
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