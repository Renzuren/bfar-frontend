// src/lib/answerResolver.js
// Shared answer resolution used by the responses pages (ResponsesTab,
// FormResponses). Answers can be stored in several shapes depending on how the
// response was submitted or imported:
//   - array of records like { question_id, answer } (FormFill), possibly also
//     carrying qid / question_code / question_title
//   - object keyed by question id / code ({ "B03": "46", ... })
//   - plain positional array of primitive values aligned to the form's section
//     question order
// The resolver tries them all so answers render even when the stored question
// ids no longer match the live form (e.g. a copied or re-saved After form).

const isNoAnswer = (val) =>
  val === null ||
  val === undefined ||
  val === '' ||
  val === '--' ||
  (Array.isArray(val) && val.length === 0);

const normalizeAnswerKey = (key) => {
  const value = String(key || '').trim();
  const codeMatch = value.match(/^([a-z]+)[\s_-]*(\d+)(.*)$/i);
  if (codeMatch) {
    return `${codeMatch[1].toLowerCase()}${Number(codeMatch[2])}${codeMatch[3].toLowerCase()}`;
  }
  return value.toLowerCase();
};

const answerKeyMatches = (answerKey, questionKeys) => {
  const normalizedAnswerKey = normalizeAnswerKey(answerKey);
  return questionKeys.some((questionKey) => {
    if (normalizedAnswerKey === questionKey) return true;
    const normalizedCode = normalizeAnswerKey(questionKey);
    return normalizedAnswerKey.startsWith(`${normalizedCode}:`) ||
      normalizedAnswerKey.startsWith(`${normalizedCode} -`);
  });
};

const getAnswerValue = (record) => {
  if (!record || typeof record !== 'object') return record;
  if (Object.prototype.hasOwnProperty.call(record, 'answer')) return getAnswerValue(record.answer);
  if (Object.prototype.hasOwnProperty.call(record, 'value')) return getAnswerValue(record.value);
  if (Object.prototype.hasOwnProperty.call(record, 'response')) return getAnswerValue(record.response);
  return record;
};

const getQuestionsForAnswerSource = (sections, source) => {
  const allQuestions = sections.flatMap((section) => section.questions || []);
  if (source === 'questionnaire_answers') {
    return sections
      .filter((section) => section.section_type === 'questionnaire')
      .flatMap((section) => section.questions || []);
  }
  if (source === 'demographics') {
    return sections
      .filter((section) => section.section_type === 'demographics')
      .flatMap((section) => section.questions || []);
  }
  return allQuestions;
};

const getAnswerForQuestion = (response, question, { sections = [] } = {}) => {
  const answerSources = [
    response.answers,
    response.questionnaire_answers,
    response.demographics,
  ].filter(Boolean);

  const answerRecords = answerSources.flatMap((answers) => {
    if (Array.isArray(answers)) return answers;
    if (answers && typeof answers === 'object') {
      return Object.entries(answers).map(([key, value]) => ({
        question_id: key,
        answer: value,
      }));
    }
    return [];
  });

  const questionKeys = [question.id, question.code, question.title]
    .filter(Boolean)
    .map(normalizeAnswerKey);

  const matched = answerRecords.find((answer) =>
    [answer.question_id, answer.qid, answer.question_code, answer.question_title]
      .filter(Boolean)
      .some((key) => answerKeyMatches(key, questionKeys))
  );
  const matchedValue = getAnswerValue(matched);
  if (!isNoAnswer(matchedValue)) return matchedValue;

  // Some older submissions store built-in demographic answers directly on the
  // response instead of inside answers/questionnaire_answers.
  const directFields = {
    age: ['age', 'edad'],
    gender: ['gender', 'sex'],
    municipality: ['municipality', 'municipal', 'area'],
    barangay: ['barangay', 'brgy'],
    province: ['province', 'prov'],
  };
  const directKeys = [question.code, question.title]
    .filter(Boolean)
    .map((key) => normalizeAnswerKey(key));
  const directField = Object.entries(directFields).find(([field, aliases]) =>
    directKeys.some((key) => aliases.includes(key) || aliases.some((alias) => key.startsWith(`${alias}:`)))
  );
  if (directField) {
    const directValue = response[directField[0]];
    if (!isNoAnswer(directValue)) return directValue;
  }

  // Positional fallback: answers stored as a plain array aligned to the full
  // section question order. Records are unwrapped, so object arrays like
  // { question_id, answer } (as stored by FormFill) also resolve here.
  // Guard against responses whose positional array is aligned to an older form
  // order: a record whose question id does not belong to this question is
  // ignored (treated as unanswered) instead of misassigning its value.
  for (const [sourceName, answers] of [
    ['answers', response.answers],
    ['questionnaire_answers', response.questionnaire_answers],
    ['demographics', response.demographics],
  ]) {
    if (!answers || typeof answers !== 'object') continue;
    const positionalAnswers = Array.isArray(answers)
      ? answers
      : Object.values(answers);
    const sourceQuestions = getQuestionsForAnswerSource(sections, sourceName);
    const idx = sourceQuestions.findIndex((q) => q.id === question.id);
    if (idx < 0 || idx >= positionalAnswers.length) continue;
    const value = getAnswerValue(positionalAnswers[idx]);
    const rawRecord = positionalAnswers[idx];
    if (rawRecord && typeof rawRecord === 'object' && (rawRecord.question_id || rawRecord.qid)) {
      const rawId = String(rawRecord.question_id || rawRecord.qid || '');
      const keyMatches = [question.id, question.code, question.title]
        .filter(Boolean)
        .some((key) => answerKeyMatches(rawId, [key]));
      if (!keyMatches) continue;
    }
    if (!isNoAnswer(value)) return value;
  }

  return null;
};

export { getAnswerForQuestion, getAnswerValue, isNoAnswer };