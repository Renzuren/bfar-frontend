// src/lib/mlAnalysisApi.js
// ============================================================
// ML ANALYSIS PIPELINE CLIENT
// Shared API helpers for the ML `/train` endpoint. Both the
// manual ML Upload page and the automatic No-Baseline analysis
// report call the same pipeline; only the file source differs
// (user-uploaded CSV vs. an auto-built combined dataset).
// ============================================================

import { resolveServiceUrl } from './apiBase';
import { fetchWithRetry } from './fetchRetry';
import { escapeCsvCell, withCsvBom } from './csv';

export const DEFAULT_ML_API_URL = 'http://localhost:8000';

export const getMLApiUrl = () =>
  resolveServiceUrl(process.env.REACT_APP_ML_API_URL || DEFAULT_ML_API_URL, DEFAULT_ML_API_URL).replace(/\/$/, '');

/**
 * Serializes a { columns, rows } dataset into a CSV string (UTF-8 with BOM,
 * comma-delimited, RFC-4180 quoting, missing values exported as empty).
 */
export const buildCSVString = (columns, rows) => {
  const lines = [columns.map(escapeCsvCell).join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((col) => escapeCsvCell(row[col])).join(','));
  });
  return withCsvBom(lines.join('\r\n'));
};

/**
 * Calls the ML `/train` endpoint with a CSV built from the given
 * dataset. Returns the parsed JSON analysis result.
 *
 * @param {object} options
 * @param {string[]} options.columns  Column headers
 * @param {object[]} options.rows     Row objects keyed by column name
 * @param {string}   [options.treatmentColumn]
 * @param {string}   [options.outcomeColumn]
 * @param {string}   [options.includeFeatures]
 * @param {number}   [options.caliperRatio]       -- NEW: caliper ratio for matching (default 0.2)
 * @param {string}   [options.mlApiUrl]
 * @param {number}   [options.timeout=120000]
 * @param {(pct:number)=>void} [options.onProgress]
 */
export const runMLAnalysis = async ({
  columns = [],
  rows = [],
  treatmentColumn,
  outcomeColumn,
  includeFeatures,
  caliperRatio,          // <-- NEW
  mlApiUrl,
  timeout = 120000,
  onProgress,
} = {}) => {
  if (!columns.length || !rows.length) {
    throw new Error('No data available to analyze');
  }

  const csvString = buildCSVString(columns, rows);
  const blob = new Blob([csvString], { type: 'text/csv' });
  const file = new File([blob], 'combined-responses.csv', { type: 'text/csv' });

  const formData = new FormData();
  formData.append('file', file);
  if (treatmentColumn) formData.append('treatment_column', treatmentColumn);
  if (outcomeColumn) formData.append('outcome_column', outcomeColumn);
  if (includeFeatures && includeFeatures.trim()) formData.append('include_features', includeFeatures.trim());
  // --- NEW: append caliper_ratio if provided ---
  if (caliperRatio !== undefined && caliperRatio !== null) {
    formData.append('caliper_ratio', String(caliperRatio));
  }

  const endpoint = `${(mlApiUrl || getMLApiUrl()).replace(/\/$/, '')}/train`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  onProgress?.(30);

  let response;
  try {
    response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      },
      {
        retries: 2,
        // Never retry when the timeout fired — the job may still be running server-side.
        shouldRetry: (error) => !error || error.name !== 'AbortError',
      }
    );
  } finally {
    clearTimeout(timer);
  }

  onProgress?.(80);

  if (!response.ok) {
    let errorMsg = `Server returned ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMsg = errorJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const result = await response.json();
  onProgress?.(100);
  return result;
};