// src/lib/mlAnalysisApi.js
// ============================================================
// ML ANALYSIS PIPELINE CLIENT
// Shared API helpers for the ML `/train` endpoint. Both the
// manual ML Upload page and the automatic No-Baseline analysis
// report call the same pipeline; only the file source differs
// (user-uploaded CSV vs. an auto-built combined dataset).
// ============================================================

import { resolveServiceUrl } from './apiBase';

export const DEFAULT_ML_API_URL = 'http://localhost:8000';

export const getMLApiUrl = () =>
  resolveServiceUrl(process.env.REACT_APP_ML_API_URL || DEFAULT_ML_API_URL, DEFAULT_ML_API_URL).replace(/\/$/, '');

const escapeCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

/**
 * Serializes a { columns, rows } dataset into a CSV string.
 */
export const buildCSVString = (columns, rows) => {
  const lines = [columns.map(escapeCell).join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((col) => escapeCell(row[col])).join(','));
  });
  return lines.join('\r\n');
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

  const endpoint = `${(mlApiUrl || getMLApiUrl()).replace(/\/$/, '')}/train`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  onProgress?.(30);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
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