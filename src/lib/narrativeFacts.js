// src/lib/narrativeFacts.js
// ============================================================
// The statistics the AI (Gemini) writes the Technical Narrative
// Report from. Aggregates only -- question labels, percentages,
// means, counts and the saved ML analysis summary. No respondent
// names, ids, locations or individual answers are included.
// ============================================================

import { getQuestionLabel } from './preprocessing';
import { exportQuestionHeader, optionText } from './responsesDataset';

const MAX_INDICATORS = 60;
const MAX_OPTIONS = 8;
const MAX_DRIVERS = 8;
const round1 = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 10) / 10 : null);
const round3 = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 1000) / 1000 : null);

// One comparison item from NarrativeReport's pairQuestions -> a compact fact.
// `change` is how much the two groups differ, used to keep the most telling ones.
const indicatorFact = (item) => {
  const question = getQuestionLabel(item.question, 0);
  if (item.type === 'rating') {
    const a = round1(item.beforeAvg);
    const b = round1(item.afterAvg);
    return { fact: { question, kind: 'rating_mean_1_to_5', group_a_mean: a, group_b_mean: b }, change: Math.abs((b ?? 0) - (a ?? 0)) * 20 };
  }
  if (item.type === 'date') return null;
  const options = (item.data || [])
    .map((d) => ({ option: String(d.option), group_a_pct: round1(d.before), group_b_pct: round1(d.after) }))
    .sort((x, y) => Math.max(y.group_a_pct, y.group_b_pct) - Math.max(x.group_a_pct, x.group_b_pct));
  const change = Math.max(0, ...options.map((o) => Math.abs((o.group_b_pct ?? 0) - (o.group_a_pct ?? 0))));
  return {
    fact: {
      question,
      kind: 'percent_of_respondents_choosing_each_option',
      answered_a: item.beforeAnalytics?.totalAnswered ?? null,
      answered_b: item.afterAnalytics?.totalAnswered ?? null,
      options: options.slice(0, MAX_OPTIONS),
    },
    change,
  };
};

// The outcome column of the ML analysis is an export header ("C05_KABUUANG_...");
// find its question so the AI knows what the coded values mean.
const findOutcomeQuestion = (header, forms) => {
  for (const form of forms) {
    const questions = form?.sections ? form.sections.flatMap((s) => s.questions || []) : form?.questions || [];
    const hit = questions.find((q) => exportQuestionHeader(q, 0) === header);
    if (hit) return hit;
  }
  return null;
};

const mlFacts = (mlAnalysis, forms) => {
  if (!mlAnalysis || typeof mlAnalysis.result_json !== 'string') return null;
  let result;
  try { result = JSON.parse(mlAnalysis.result_json); } catch (_) { return null; }
  const settings = mlAnalysis.settings || {};
  const balance = result.covariate_balance || {};
  const att = result.att_result || {};
  const fs = result.feature_selection || {};
  const count = (key) => (Array.isArray(fs[key]) ? fs[key].length : 0);
  const outcomeQ = findOutcomeQuestion(settings.outcomeColumn, forms);
  return {
    analysed_at: mlAnalysis.saved_at || null,
    method: 'Propensity score matching: gradient boosting propensity model scored out-of-fold (5 folds); 1-to-1 nearest-neighbour matching on the logit propensity score within a caliper of 0.2 SD; balance judged by standardized mean difference (SMD).',
    treatment_column: settings.treatmentColumn || result.treatment_column || null,
    outcome: {
      column: settings.outcomeColumn || result.outcome_column || null,
      question: outcomeQ ? getQuestionLabel(outcomeQ, 0) : null,
      coded_options_in_order: outcomeQ?.options?.length ? outcomeQ.options.map((o) => String(optionText(o))) : null,
      note: outcomeQ?.options?.length
        ? 'Outcome values are the 1-based position of the chosen option in coded_options_in_order (coded levels, not amounts).'
        : null,
    },
    respondents_analysed: balance.n_rows ?? result.rows ?? null,
    columns_excluded_by_analyst: settings.excludeFeatures || '',
    features: {
      used_by_model: fs.n_features_selected ?? null,
      excluded_one_group_only: count('excluded_as_group_specific'),
      excluded_after_half_of_before_after_pair: count('excluded_as_wave_pair'),
      excluded_current_or_after_measure: count('excluded_as_post_treatment'),
      excluded_by_analyst: count('excluded_by_user'),
      excluded_leakage: count('excluded_as_leakage'),
      excluded_low_coverage: count('excluded_as_low_coverage'),
      ranked_below_top_30: count('excluded_as_below_top_n'),
    },
    balance: {
      achieved: balance.balance_achieved ?? null,
      smd_threshold: balance.balance_threshold ?? null,
      small_sample_threshold: balance.small_sample ?? null,
      mean_abs_smd_after_matching: round3(balance.mean_abs_smd),
      features_over_threshold: balance.n_features_over_threshold ?? null,
      features_allowed_over_threshold: balance.max_unbalanced_features_allowed ?? null,
      matched_pairs: balance.matched_pairs ?? null,
      overlap_treated_in_control_pct: round1(balance.overlap?.treated_in_control_range_pct),
      overlap_control_in_treated_pct: round1(balance.overlap?.control_in_treated_range_pct),
    },
    att: {
      matched_pairs: att.matched_pairs ?? null,
      att_mean: round3(att.att_mean),
      ci_95: Array.isArray(att.ci_95) ? att.ci_95.map(round3) : null,
      p_value_paired_t_test: round3(att.p_value_paired_ttest),
    },
    top_drivers_of_program_participation: (result.model_interpretation?.feature_contributions || [])
      .slice(0, MAX_DRIVERS)
      .map((c) => ({ feature: c.feature, mean_abs_shap: round3(c.mean_abs_shap), direction: c.direction })),
  };
};

export const buildNarrativeFacts = ({
  project, isBaseline, tabLabels, beforeForm, afterForm, beforeResponses, afterResponses, comparisonData, mlAnalysis,
}) => {
  const indicators = (comparisonData || [])
    .map(indicatorFact)
    .filter(Boolean)
    .sort((x, y) => y.change - x.change);
  return {
    project: {
      title: project?.title || '',
      description: project?.description || '',
      design: isBaseline ? 'baseline' : 'no_baseline',
      group_a: tabLabels.before,
      group_b: tabLabels.after,
    },
    instruments: {
      group_a_questionnaire: beforeForm?.title || null,
      group_b_questionnaire: afterForm?.title || null,
    },
    respondents: { group_a: beforeResponses.length, group_b: afterResponses.length },
    indicators: {
      compared_total: indicators.length,
      listed: Math.min(indicators.length, MAX_INDICATORS),
      note: 'group_a/group_b refer to project.group_a/project.group_b; listed indicators are the ones with the largest differences first.',
      items: indicators.slice(0, MAX_INDICATORS).map((i) => i.fact),
    },
    impact_analysis: isBaseline ? undefined : mlFacts(mlAnalysis, [beforeForm, afterForm]),
  };
};

// Identifies the exact facts a narrative was written from, so the page can tell
// when the data or analysis changed afterwards.
export const narrativeFactsFingerprint = (facts) => {
  const text = JSON.stringify(facts);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${hash.toString(36)}`;
};

// The saved narrative on a project document, or null.
export const readSavedNarrative = (projectDoc) => {
  const saved = projectDoc?.narrative_report;
  if (!saved || typeof saved.narrative_json !== 'string') return null;
  try {
    return { ...saved, narrative: JSON.parse(saved.narrative_json) };
  } catch (_) {
    return null;
  }
};
