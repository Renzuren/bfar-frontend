// src/lib/mlNarrativeFacts.js
// ============================================================
// The statistics behind the Narrative Report of a saved ML analysis (a CSV
// run through ML Upload and saved to the dashboard): dataset size, group
// sizes, treated-vs-comparison means of the columns that mattered most, and
// the propensity score matching result in the same shape the project
// Narrative Report sends (narrativeFacts.mlFacts). Aggregates only.
// ============================================================

import { mlFacts } from './narrativeFacts';
import { toNumLoose, isBeneficiary, isNonBeneficiary } from './localImpact';

const MAX_COMPARED_COLUMNS = 12;
const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

// 1 = treated (beneficiary), 0 = comparison, null = unknown.
export const groupOfValue = (value) => {
  if (isBeneficiary(value)) return 1;
  if (isNonBeneficiary(value)) return 0;
  const n = toNumLoose(value);
  if (n === 1) return 1;
  if (n === 0) return 0;
  return null;
};

const meanOf = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Treated vs comparison mean of one column, from the saved rows.
const compareColumn = (rows, treatCol, col) => {
  const t = [];
  const c = [];
  rows.forEach((row) => {
    const g = groupOfValue(row[treatCol]);
    const v = toNumLoose(row[col]);
    if (g === null || v === null) return;
    (g === 1 ? t : c).push(v);
  });
  if (!t.length || !c.length) return null;
  const tm = meanOf(t);
  const cm = meanOf(c);
  return { column: col, treated_mean: round2(tm), comparison_mean: round2(cm), difference: round2(tm - cm), n_treated: t.length, n_comparison: c.length };
};

/**
 * Everything the report shows besides the narrative text:
 * { treatCol, outcomeCol, rowsTotal, treated, comparison, comparisons, balance, drivers, att }.
 */
export const buildMlReportData = (record) => {
  const results = record?.analysisResults || {};
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  const treatCol = results.treatment_column || record?.treatmentColumn || '';
  const outcomeCol = results.outcome_column || record?.outcomeColumn || '';
  let treated = 0;
  let comparison = 0;
  rows.forEach((row) => {
    const g = groupOfValue(row[treatCol]);
    if (g === 1) treated += 1;
    else if (g === 0) comparison += 1;
  });

  const drivers = (results.model_interpretation?.feature_contributions || []).slice(0, 10);
  // The outcome first, then the strongest drivers of participation.
  const columns = [outcomeCol, ...drivers.map((d) => d.feature)]
    .filter((col, i, all) => col && col !== treatCol && all.indexOf(col) === i)
    .slice(0, MAX_COMPARED_COLUMNS);
  const comparisons = columns.map((col) => compareColumn(rows, treatCol, col)).filter(Boolean);

  const balance = [...(results.covariate_balance?.per_feature || [])]
    .sort((a, b) => Math.abs(b.smd_before || 0) - Math.abs(a.smd_before || 0))
    .slice(0, 12);

  return {
    treatCol,
    outcomeCol,
    rowsTotal: results.rows ?? rows.length,
    rowsKept: rows.length,
    treated,
    comparison,
    comparisons,
    balance,
    balanceThreshold: results.covariate_balance?.balance_threshold ?? null,
    drivers,
    att: results.att_result || null,
    balanceSummary: results.covariate_balance || null,
  };
};

/** The JSON Gemini writes the report from. */
export const buildMlNarrativeFacts = (record, data) => {
  const impact = mlFacts({
    result_json: JSON.stringify(record?.analysisResults || {}),
    settings: { treatmentColumn: data.treatCol, outcomeColumn: data.outcomeCol, excludeFeatures: '' },
    saved_at: record?.createdAt || null,
  }, []);
  if (impact && Number(record?.caliperRatio) && Number(record.caliperRatio) !== 0.2) {
    impact.method = impact.method.replace('caliper of 0.2 SD', `caliper of ${record.caliperRatio} SD`);
  }
  return {
    project: {
      title: record?.title || 'ML Analysis',
      design: 'no_baseline',
      group_a: 'Beneficiaries (treated)',
      group_b: 'Non-beneficiaries (comparison)',
      source: `Uploaded dataset${record?.fileName ? ` "${record.fileName}"` : ''}`,
    },
    dataset: {
      rows_analysed: data.rowsTotal,
      rows_in_saved_copy: data.rowsKept,
      treated_rows: data.treated,
      comparison_rows: data.comparison,
      columns: Array.isArray(record?.columns) ? record.columns.length : null,
      treatment_column: data.treatCol,
      outcome_column: data.outcomeCol,
    },
    group_comparison: {
      note: 'Means before matching, from the saved rows. Columns are the outcome and the strongest drivers of participation.',
      items: data.comparisons,
    },
    impact_analysis: impact,
  };
};

export const mlFactsFingerprint = (facts) => {
  const text = JSON.stringify(facts);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${hash.toString(36)}`;
};

/** The saved narrative on an analysis record, or null. */
export const readSavedMlNarrative = (record) => {
  const saved = record?.narrativeReport;
  if (!saved || typeof saved.narrative_json !== 'string') return null;
  try {
    return { ...saved, narrative: JSON.parse(saved.narrative_json) };
  } catch (_) {
    return null;
  }
};
