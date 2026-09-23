// src/lib/responsesDataset.js
// ============================================================
// The "All Responses" dataset: how Beneficiary + Non-Beneficiary
// responses are read, merged into columns and numerically coded.
// Shared by the All Responses CSV export (pages/ResponsesTabRebuilt.jsx)
// and the No-Baseline Analysis Report, so the report sends the ML
// service exactly the CSV a user would download and upload on the
// ML Upload page -- the two can't drift apart.
// ============================================================

import { isReservedField, normalizeLocationCodes, normalizeQuestionCode } from './preprocessing';
import { getAnswerForQuestion } from './answerResolver';
import { buildTextCodebook, encodeAnswerNumeric, isTextQuestion, textCodeKey } from './combinedDataset';
import { resolveRespondentGroup, groupCode } from './respondentGroup';

export const isEmpty = (value) => value === null || value === undefined || value === '' || value === '--' || (Array.isArray(value) && value.length === 0);
export const display = (value) => isEmpty(value) ? '—' : Array.isArray(value) ? value.join(', ') : String(value);

// The backend returns responses newest-first, so on its own the table and CSV would
// start at the latest id (e.g. B-0150). Order by respondent number instead so they
// start at B-0001; records with no number keep their submission order after that.
export const respondentNumber = (response) => {
  const match = String(response?.respondent_id || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : Infinity;
};
export const submittedSeconds = (response) => {
  const value = response?.submitted_at;
  if (value && typeof value === 'object') return value._seconds ?? value.seconds ?? 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time / 1000;
};
export const byRespondentNumber = (a, b) =>
  (respondentNumber(a) - respondentNumber(b)) || (submittedSeconds(a) - submittedSeconds(b));

export const isBeneficiaryQuestion = (question) =>
  String(question?.code || '').trim().toUpperCase() === 'BENE' ||
  String(question?.title || '').toLowerCase().includes('beneficiary');

export const sectionsFor = (form) => {
  if (!form) return [];
  if (Array.isArray(form.sections) && form.sections.length) {
    return form.sections.map((section, index) => ({
      ...section,
      section_type: section.section_type || (index === 0 ? 'demographics' : 'questionnaire'),
      questions: section.questions || [],
    }));
  }
  const groups = new Map();
  (form.questions || []).forEach((question) => {
    const title = question.section?.trim() || 'Section 1';
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(question);
  });
  return [...groups.entries()].map(([title, questions], index) => ({
    id: `section_${index}`, title, section_type: index === 0 ? 'demographics' : 'questionnaire', questions,
  }));
};

export const questionColumns = (sections, type) => normalizeLocationCodes(
  sections.filter((section) => section.section_type === type).flatMap((section) => section.questions || [])
).filter((question) => !isReservedField(question) && question.type !== 'profile_photo');

export const questionMatches = (key, question) => {
  const normalized = String(key || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const candidates = [question.id, question.code, question.title]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase().replace(/[\s_-]+/g, ''));
  return candidates.some((candidate) => normalized === candidate || normalized.startsWith(`${candidate}:`));
};

export const answerFromAnyShape = (response, question, sections) => {
  const sources = [response.answers, response.questionnaire_answers, response.demographics];
  for (const source of sources) {
    if (!source) continue;
    const entries = Array.isArray(source)
      ? source.map((value, index) => [index, value])
      : Object.entries(source);
    const hit = entries.find(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return questionMatches(value.question_id, question) || questionMatches(value.qid, question) ||
          questionMatches(value.question_code, question) || questionMatches(value.question_title, question);
      }
      return questionMatches(key, question);
    });
    if (hit) {
      const value = hit[1];
      const answer = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'answer')
        ? value.answer : value;
      if (!isEmpty(answer)) return answer;
    }
  }

  const directKey = Object.keys(response).find((key) => questionMatches(key, question));
  if (directKey && !isEmpty(response[directKey])) return response[directKey];

  const aliases = {
    age: ['age', 'edad'], gender: ['gender', 'sex'], municipality: ['municipality', 'area'],
    barangay: ['barangay', 'brgy'], province: ['province', 'prov'],
  };
  const codeAndTitle = [question.code, question.title].filter(Boolean).join(' ').toLowerCase();
  const alias = Object.entries(aliases).find(([, names]) => names.some((name) => codeAndTitle.includes(name)));
  if (alias && !isEmpty(response[alias[0]])) return response[alias[0]];

  // Last resort for old positional submissions. Keep source sections isolated.
  // Guard against legacy responses whose positional array is aligned to an
  // older form order: if the record carries a question id that does not belong
  // to this question, treat it as unanswered instead of misassigning its value.
  const allQuestions = sections.flatMap((section) => section.questions || []);
  const index = allQuestions.findIndex((item) => item.id === question.id);
  const positional = Array.isArray(response.answers) ? response.answers[index] : undefined;
  const misaligned = (record) => record && typeof record === 'object'
    && (record.question_id || record.qid)
    && !questionMatches(record.question_id || record.qid, question);
  if (positional && typeof positional === 'object' && Object.prototype.hasOwnProperty.call(positional, 'answer')) {
    return misaligned(positional) ? '' : positional.answer;
  }
  if (!isEmpty(positional)) return misaligned(positional) ? '' : positional;
  return getAnswerForQuestion(response, question, { sections });
};

export const cleanHeaderPart = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const optionText = (option) => {
  if (option && typeof option === 'object') return option.label ?? option.value ?? option.title ?? option.text ?? option.name ?? option.choice ?? '';
  return option;
};
export const normalizeText = (value) => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\s]+/g, ' ')
  .trim();

export const normalizeForMatch = (question) => {
  const code = normalizeQuestionCode(question);
  const title = String(question?.title || '').toLowerCase().replace(/[\s_-]+/g, '');
  // Two questions are only the same column when BOTH code and title match --
  // the Beneficiary and Non-Beneficiary questionnaires reuse the same codes
  // (e.g. "K1"/"K01", or the literal same code "J4a") for entirely different
  // questions, so matching on code alone merges unrelated answers together.
  return code && title ? `${code}::${title}` : (code || title || String(question?.id || ''));
};

export const mergeQuestionLists = (beforeQuestions, afterQuestions) => {
  const byKey = new Map();
  const order = [];
  const register = (q, source) => {
    const key = normalizeForMatch(q);
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        question: q,
        beforeQ: source === 'before' ? q : null,
        afterQ: source === 'after' ? q : null,
        sources: new Set([source]),
      });
      order.push(key);
    } else {
      existing.sources.add(source);
      if (source === 'before') existing.beforeQ = q;
      else existing.afterQ = q;
    }
  };
  beforeQuestions.forEach((q) => register(q, 'before'));
  afterQuestions.forEach((q) => register(q, 'after'));
  return order.map((key) => byKey.get(key));
};

export const unionOptions = (...lists) => {
  const seen = new Set();
  const out = [];
  lists.filter(Boolean).forEach((list) => (list || []).forEach((option) => {
    const key = normalizeText(optionText(option));
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(option);
  }));
  return out;
};

export const unwrapAnswer = (item) => {
  if (item && typeof item === 'object') {
    if (Object.prototype.hasOwnProperty.call(item, 'answer')) return unwrapAnswer(item.answer);
    if (Object.prototype.hasOwnProperty.call(item, 'value')) return unwrapAnswer(item.value);
    if (Object.prototype.hasOwnProperty.call(item, 'response')) return unwrapAnswer(item.response);
    if (Object.prototype.hasOwnProperty.call(item, 'label')) return item.label;
    if (Object.prototype.hasOwnProperty.call(item, 'option')) return item.option;
    if (Object.prototype.hasOwnProperty.call(item, 'text')) return item.text;
    if (Object.prototype.hasOwnProperty.call(item, 'name')) return item.name;
  }
  return item;
};

export const unwrapValue = (value) => (Array.isArray(value) ? value.map(unwrapAnswer) : unwrapAnswer(value));

export const exportQuestionHeader = (question, index) => {
  const code = cleanHeaderPart(question.code || normalizeQuestionCode(question));
  const title = cleanHeaderPart(question.title);
  if (code) return title && !code.endsWith(`_${title}`) ? `${code}_${title}` : code;
  return `Q${index + 1}`;
};

/**
 * Per-row readers used by the responses table and the export. `row` is
 * { response, source: 'before' | 'after', sections }.
 */
export const makeRowAccessors = ({ beforeForm, afterForm, beforeDemo, afterDemo, beforeQuestions, afterQuestions }) => {
  const answer = (row, question) => answerFromAnyShape(row.response, question, row.sections);
  const location = (row, field) => {
    if (!isEmpty(row.response[field])) return display(row.response[field]);
    const questions = [...(row.source === 'before' ? beforeDemo : afterDemo), ...(row.source === 'before' ? beforeQuestions : afterQuestions)];
    const match = questions.find((question) => {
      const text = `${question.code || ''} ${question.title || ''}`.toLowerCase();
      return text.includes(field) || (field === 'municipality' && text.includes('area')) || (field === 'barangay' && text.includes('brgy'));
    });
    return match ? display(answer(row, match)) : '—';
  };
  const name = (row) => row.response.full_name || row.response.name || '—';

  // Group code for the GROUP column / export: Beneficiary = 1, Non-Beneficiary = 0.
  // Same rule as every other screen (see lib/respondentGroup.js).
  const groupOf = (row) => groupCode(resolveRespondentGroup(
    row.response,
    row.source === 'before' ? beforeForm : afterForm,
    () => {
      const beneQuestion = row.sections.flatMap((section) => section.questions || []).find(isBeneficiaryQuestion);
      return beneQuestion ? answer(row, beneQuestion) : null;
    },
  ));

  // The stored respondent id (e.g. "B-0001"), exactly as the Beneficiary /
  // Non-Beneficiary "View Responses" pages show it. It used to be renumbered by
  // row position (B-1, B-2, ...), so the same record had a different id here.
  const respondentId = (row) => row.response.respondent_id || row.response.id || '—';

  return { answer, location, name, groupOf, respondentId };
};

/**
 * The numeric export table. Every row in `rows` is encoded (not just the ones a
 * caller exports), so text-answer codes don't change with a search/filter.
 * Returns { headers, cellsFor(row) }; cellsFor must be given a row from `rows`.
 */
export const buildExportTable = ({ rows, beforeDemo, afterDemo, beforeQuestions, afterQuestions, accessors }) => {
  const { answer, location, groupOf, respondentId } = accessors;
  const merged = [
    ...mergeQuestionLists(beforeDemo, afterDemo),
    ...mergeQuestionLists(beforeQuestions, afterQuestions),
  ];
  const headerCounts = new Map();
  const columns = merged.map(({ question, beforeQ, afterQ }) => {
    const baseHeader = exportQuestionHeader(question, 0);
    const nextCount = (headerCounts.get(baseHeader) || 0) + 1;
    headerCounts.set(baseHeader, nextCount);
    const header = nextCount === 1 ? baseHeader : `${baseHeader}_${nextCount}`;
    return { header, question, beforeQ, afterQ };
  });

  // Encode every response once, not just the filtered ones: text answers with no
  // option to take a code from are numbered per column (below) across ALL
  // responses, so the codes do not change with the search/filter in view.
  const encoded = new Map(rows.map((row) => [row, columns.map(({ beforeQ, afterQ }) => {
    // Read each answer from the row's OWN form. The two questionnaires reuse
    // some question ids (J1-J4a) for different questions, so looking up a
    // column the row's form never asked would pull in another question's answer.
    const ownQuestion = row.source === 'before' ? beforeQ : afterQ;
    if (!ownQuestion) return { code: '', text: '' };
    // One canonical option list per column, so a label gets the same numeric
    // code whichever group answered it.
    const codingQuestion = { ...ownQuestion, options: unionOptions(beforeQ?.options, afterQ?.options) };
    const value = unwrapValue(answer(row, ownQuestion));
    const code = encodeAnswerNumeric(value, codingQuestion);
    if (code !== '' || !isTextQuestion(codingQuestion)) return { code, text: '' };
    return { code, text: isEmpty(value) ? '' : display(value) };
  })]));

  // A column that has any numeric answer is a numeric column: leave its stray
  // text blank rather than give it a code that could collide with real values.
  const codebooks = columns.map((_, c) => {
    const cells = rows.map((row) => encoded.get(row)[c]);
    return cells.some((cell) => cell.code !== '') ? null : buildTextCodebook(cells.map((cell) => cell.text));
  });
  const exportCell = ({ code, text }, c) => {
    if (code !== '' || !text || !codebooks[c]) return code;
    return codebooks[c].get(textCodeKey(text)) ?? '';
  };

  const headers = ['RESPONSE', 'GROUP', 'Municipality', 'Barangay', 'Province', ...columns.map(({ header }) => header)];
  const cellsFor = (row) => [
    respondentId(row),
    groupOf(row),
    location(row, 'municipality'),
    location(row, 'barangay'),
    location(row, 'province'),
    ...encoded.get(row).map(exportCell),
  ];
  return { headers, cellsFor };
};

/**
 * The full All Responses export for a project, straight from its forms and raw
 * responses -- the same rows, order and values as the Export CSV button with no
 * filter applied. Returns { columns, rows }, each row an object keyed by column
 * with the values exactly as written to the CSV.
 */
export const buildResponsesDataset = ({ beforeForm, afterForm, beforeResponses = [], afterResponses = [] }) => {
  const beforeSections = sectionsFor(beforeForm);
  const afterSections = sectionsFor(afterForm);
  const beforeQuestions = questionColumns(beforeSections, 'questionnaire');
  const afterQuestions = questionColumns(afterSections, 'questionnaire');
  const beforeDemo = questionColumns(beforeSections, 'demographics');
  const afterDemo = questionColumns(afterSections, 'demographics');
  const rows = [
    ...[...beforeResponses].sort(byRespondentNumber).map((response) => ({ response, source: 'before', sections: beforeSections })),
    ...[...afterResponses].sort(byRespondentNumber).map((response) => ({ response, source: 'after', sections: afterSections })),
  ];
  const accessors = makeRowAccessors({ beforeForm, afterForm, beforeDemo, afterDemo, beforeQuestions, afterQuestions });
  const { headers, cellsFor } = buildExportTable({ rows, beforeDemo, afterDemo, beforeQuestions, afterQuestions, accessors });
  return {
    columns: headers,
    rows: rows.map((row) => {
      const cells = cellsFor(row);
      return Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
    }),
  };
};
