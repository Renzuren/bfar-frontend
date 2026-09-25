// src/lib/analysisStore.js
// ============================================================
// Saved ML analysis results, stored on the server per user (/api/analyses)
// so they appear on every device the user signs in from. Earlier versions
// kept them in this browser's localStorage only; moveLocalAnalysesToServer
// uploads any such leftovers once.
// ============================================================

import { api } from './apiMiddleware';

const MAX_ROWS_KEPT = 1000;
// Where older versions of the app stored analyses in the browser.
const LOCAL_KEY = 'bfar.savedAnalyses.v1';
const LEGACY_PANEL_KEY = 'savedAnalyses';
// Saving uploads the result rows, which can take a while on slow connections.
const SAVE_TIMEOUT = 5 * 60 * 1000;

/** Summaries of the user's saved analyses, newest first. */
export const getSavedAnalyses = async () => (await api.get('/analyses')).data || [];

/** The full saved analysis (results, columns, rows), or null if missing. */
export const getSavedAnalysis = async (id) => {
  try {
    return (await api.get(`/analyses/${encodeURIComponent(id)}`)).data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

/**
 * Saves an analysis run and returns its summary (with the server id), or
 * null if it could not be saved.
 */
export const saveAnalysis = async (record) => {
  try {
    const res = await api.post('/analyses', {
      clientId: record.clientId,
      title: (record.title || 'Analysis').trim() || 'Analysis',
      fileName: record.fileName || '',
      createdAt: record.createdAt,
      analysisResults: record.analysisResults,
      columns: Array.isArray(record.columns) ? record.columns : [],
      rows: Array.isArray(record.rows) ? record.rows.slice(0, MAX_ROWS_KEPT) : [],
      treatmentColumn: record.treatmentColumn || '',
      outcomeColumn: record.outcomeColumn || '',
      caliperRatio: record.caliperRatio ?? 0.2,
      truncated: Boolean(record.truncated),
    }, { timeout: SAVE_TIMEOUT, retry: 0 });
    return res.data;
  } catch (_) {
    return null;
  }
};

export const deleteAnalysis = async (id) => {
  await api.delete(`/analyses/${encodeURIComponent(id)}`);
  return true;
};

export const renameAnalysis = async (id, title) =>
  (await api.put(`/analyses/${encodeURIComponent(id)}`, { title: (title || '').trim() || 'Analysis' })).data;

const readLocal = (key) => {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
};

const writeLocal = (key, list) => {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list));
    else localStorage.removeItem(key);
  } catch (_) {
    // Storage unavailable (private mode); nothing to clean up.
  }
};

/**
 * Uploads analyses that older versions saved only in this browser, removing
 * each local copy once the server has it. Safe to call repeatedly: the
 * server ignores an analysis it already imported (same clientId).
 * Returns how many were moved.
 */
export const moveLocalAnalysesToServer = async () => {
  let moved = 0;

  const local = readLocal(LOCAL_KEY);
  const keep = [];
  for (const entry of local) {
    const saved = entry && entry.analysisResults
      ? await saveAnalysis({ ...entry, clientId: `local:${entry.id}` })
      : null;
    if (saved) moved += 1;
    else if (entry && entry.analysisResults) keep.push(entry);
  }
  writeLocal(LOCAL_KEY, keep);

  // The results panel's own Save button used to write here, where the
  // dashboard never looked.
  const legacy = readLocal(LEGACY_PANEL_KEY);
  const keepLegacy = [];
  for (const entry of legacy) {
    const saved = entry && entry.results
      ? await saveAnalysis({
        clientId: `panel:${entry.id}`,
        title: entry.name,
        createdAt: entry.date,
        analysisResults: entry.results,
        treatmentColumn: entry.results.treatment_column,
      })
      : null;
    if (saved) moved += 1;
    else if (entry && entry.results) keepLegacy.push(entry);
  }
  writeLocal(LEGACY_PANEL_KEY, keepLegacy);

  return moved;
};
