// src/lib/groupReportFacts.js
// ============================================================
// The statistics behind a Group Report: one questionnaire's results (the
// Beneficiary or Non-Beneficiary group, or Before/After), the same numbers its
// View Analytics page shows. They fill the report's tables and are what Gemini
// writes the narrative from. Aggregates only -- question labels, counts,
// percentages and means. No respondent names, ids or individual answers;
// free-text answers are only counted.
// ============================================================

import { getQuestionLabel, isReservedField, normalizeLocationCodes } from './preprocessing';
import { flattenFormQuestions } from './formQuestions';

const CHOICE_TYPES = ['multiple_choice', 'checkboxes', 'dropdown', 'yes_no'];
const MAX_OPTIONS = 10;
const MAX_LOCATIONS = 10;
const MAX_FACT_QUESTIONS = 60;

const round1 = (n) => Math.round(n * 10) / 10;

const isNoAnswer = (value) =>
  value === null || value === undefined || value === '' || value === '--' || (Array.isArray(value) && value.length === 0);

const answerOf = (response, question) =>
  response.answers?.find((answer) => answer.question_id === question.id)?.answer;

// One question's results: option shares (choice), mean and distribution (rating),
// or just how many answered (text, date, number).
const summarizeQuestion = (question, responses, index) => {
  const answers = responses.map((r) => answerOf(r, question)).filter((a) => !isNoAnswer(a));
  const answered = answers.length;
  const base = {
    id: question.id,
    label: getQuestionLabel(question, index),
    type: question.type,
    answered,
    unanswered: responses.length - answered,
  };

  if (CHOICE_TYPES.includes(question.type)) {
    const counts = new Map();
    answers.forEach((answer) => {
      (Array.isArray(answer) ? answer : [answer]).forEach((item) => {
        if (isNoAnswer(item)) return;
        const key = String(item);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    const options = [...counts.entries()]
      .map(([option, count]) => ({ option, count, pct: answered ? round1((count / answered) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
    return { ...base, kind: 'choice', multi: question.type === 'checkboxes', options };
  }

  if (question.type === 'rating') {
    const ratings = answers.map(Number).filter((n) => Number.isFinite(n));
    const distribution = [1, 2, 3, 4, 5].map((value) => ({
      option: String(value),
      count: ratings.filter((r) => r === value).length,
    })).map((d) => ({ ...d, pct: ratings.length ? round1((d.count / ratings.length) * 100) : 0 }));
    const mean = ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
    return { ...base, kind: 'rating', mean, options: distribution };
  }

  if (question.type === 'number') {
    const values = answers.map(Number).filter((n) => Number.isFinite(n));
    const mean = values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
    return {
      ...base,
      kind: 'number',
      mean,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
  }

  return { ...base, kind: 'text' };
};

const topCounts = (responses, field) => {
  const counts = new Map();
  responses.forEach((r) => {
    const value = String(r[field] ?? '').trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, pct: responses.length ? round1((count / responses.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Everything the Group Report shows for one questionnaire:
 * { respondents, demographics, results, municipalities, barangays }.
 * Demographics / results follow the form's section types, like View Analytics.
 */
export const buildGroupReportData = (form, responses = []) => {
  const all = normalizeLocationCodes(flattenFormQuestions(form)).filter((q) => !isReservedField(q) && q.type !== 'profile_photo');
  const demographicIds = new Set(
    (form?.sections || [])
      .filter((s) => s.section_type === 'demographics')
      .flatMap((s) => (s.questions || []).map((q) => q.id))
  );
  const summaries = all.map((q, i) => ({ ...summarizeQuestion(q, responses, i), demographic: demographicIds.has(q.id) }));
  return {
    respondents: responses.length,
    demographics: summaries.filter((s) => s.demographic),
    results: summaries.filter((s) => !s.demographic),
    municipalities: topCounts(responses, 'municipality'),
    barangays: topCounts(responses, 'barangay'),
  };
};

const questionFact = (s) => {
  const fact = { question: s.label, answered: s.answered, unanswered: s.unanswered };
  if (s.kind === 'choice') {
    return {
      ...fact,
      kind: s.multi ? 'percent_of_answering_respondents_choosing_each_option_multi_select' : 'percent_of_answering_respondents_choosing_each_option',
      options: s.options.slice(0, MAX_OPTIONS).map(({ option, pct, count }) => ({ option, pct, count })),
    };
  }
  if (s.kind === 'rating') {
    return { ...fact, kind: 'rating_1_to_5', mean: s.mean, distribution_pct: s.options.map(({ option, pct }) => ({ rating: option, pct })) };
  }
  if (s.kind === 'number') return { ...fact, kind: 'number', mean: s.mean, min: s.min, max: s.max };
  return { ...fact, kind: 'free_text_answers_counted_only' };
};

/** The JSON Gemini writes the Group Report from. */
export const buildGroupReportFacts = ({ project, groupLabel, groupDescription, form, data }) => ({
  project: {
    title: project?.title || '',
    description: project?.description || '',
    design: project?.has_baseline === false ? 'no_baseline' : 'baseline',
  },
  group: { label: groupLabel, description: groupDescription, questionnaire: form?.title || '' },
  respondents: data.respondents,
  location: {
    municipalities: data.municipalities.slice(0, MAX_LOCATIONS),
    barangays: data.barangays.slice(0, MAX_LOCATIONS),
    distinct_municipalities: data.municipalities.length,
    distinct_barangays: data.barangays.length,
  },
  demographics: data.demographics.slice(0, MAX_FACT_QUESTIONS).map(questionFact),
  survey_results: {
    total_questions: data.results.length,
    listed: Math.min(data.results.length, MAX_FACT_QUESTIONS),
    items: data.results.slice(0, MAX_FACT_QUESTIONS).map(questionFact),
  },
});

// Identifies the facts a report was written from, so the page can tell when the
// responses changed afterwards.
export const groupFactsFingerprint = (facts) => {
  const text = JSON.stringify(facts);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${hash.toString(36)}`;
};

/** The saved Group Report for `slot` on a project document, or null. */
export const readSavedGroupReport = (projectDoc, slot) => {
  const saved = projectDoc?.group_reports?.[slot];
  if (!saved || typeof saved.report_json !== 'string') return null;
  try {
    return { ...saved, report: JSON.parse(saved.report_json) };
  } catch (_) {
    return null;
  }
};
