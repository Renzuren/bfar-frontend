// A saved form carries its questions twice: nested in `sections` and as a flat
// `questions` list. Respondents answer the `sections` copy (FormFill), so
// answers are keyed by those question ids. The two copies can disagree: the
// built-in fields (Respondent ID/Name, Municipality, Barangay, Province) were
// generated separately for each list, a millisecond apart, so their ids
// differ. Reading the flat list first therefore missed those answers. Prefer
// `sections`, and fall back to `questions` only for legacy forms without them.

/** The form's questions in answer order, each tagged with its section title as `_section`. */
export const flattenFormQuestions = (form) => {
  if (!form) return [];
  if (Array.isArray(form.sections) && form.sections.some((s) => (s?.questions || []).length)) {
    return form.sections.flatMap((s) => (s.questions || []).map((q) => ({ ...q, _section: s.title || '' })));
  }
  if (Array.isArray(form.questions)) {
    return form.questions.map((q) => ({ ...q, _section: '' }));
  }
  return [];
};
