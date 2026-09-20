// src/lib/respondentGroup.js
// ============================================================
// ONE definition of "is this response a Beneficiary or a
// Non-Beneficiary", shared by every screen that shows or counts
// them (All Responses, the Beneficiary / Non-Beneficiary
// "View Responses" and "View Profiles" pages, the Before / After
// tables). Each screen used to carry its own copy with slightly
// different precedence, so the same record could be classified
// differently depending on where you looked at it.
//
// Precedence (first hit wins):
//   1. No Baseline questionnaire -- the questionnaire the response
//      belongs to decides ("before" = Beneficiary, "after" =
//      Non-Beneficiary). This is exactly how the backend tags a
//      response on submit (submit_response.js).
//   2. the stored beneficiary_status (Yes/No, true/false, ...)
//   3. the B-/NB- prefix of the respondent id
//   4. the answer to the BENE ("Are you a beneficiary?") question
// ============================================================

export const GROUP_BENEFICIARY = 'Beneficiary';
export const GROUP_NON_BENEFICIARY = 'Non-Beneficiary';

const fromToken = (value) => {
  if (value === true) return GROUP_BENEFICIARY;
  if (value === false) return GROUP_NON_BENEFICIARY;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^(yes|true|1|oo)$|^beneficiar/i.test(text)) return GROUP_BENEFICIARY;
  if (/^(no|false|0|hindi)$|^non[- ]?beneficiar/i.test(text)) return GROUP_NON_BENEFICIARY;
  return null;
};

/**
 * @param {object} response  the stored response
 * @param {object} [form]    the form the response was submitted to
 * @param {*} [beneAnswer]   the response's answer to the BENE question, or a function that
 *                           returns it (only called when steps 1-3 found nothing)
 * @returns {'Beneficiary'|'Non-Beneficiary'|null}
 */
export const resolveRespondentGroup = (response, form, beneAnswer) => {
  if (form?.has_baseline === false && form?.questionnaire_type) {
    return form.questionnaire_type === 'before' ? GROUP_BENEFICIARY : GROUP_NON_BENEFICIARY;
  }
  const stored = fromToken(response?.beneficiary_status);
  if (stored) return stored;
  const id = String(response?.respondent_id || '');
  if (/^NB(-|\d)/i.test(id)) return GROUP_NON_BENEFICIARY;
  if (/^B(-|\d)/i.test(id)) return GROUP_BENEFICIARY;
  return fromToken(typeof beneAnswer === 'function' ? beneAnswer() : beneAnswer);
};

/** The 1 / 0 encoding used in exports: Beneficiary = 1, Non-Beneficiary = 0, unknown = ''. */
export const groupCode = (group) =>
  group === GROUP_BENEFICIARY ? '1' : group === GROUP_NON_BENEFICIARY ? '0' : '';

/** The Yes / No form the View Responses / Profiles / table screens work with. */
export const groupToYesNo = (group) =>
  group === GROUP_BENEFICIARY ? 'Yes' : group === GROUP_NON_BENEFICIARY ? 'No' : null;
