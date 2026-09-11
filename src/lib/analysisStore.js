// src/lib/analysisStore.js
// ============================================================
// Browser-local persistence for ML analysis results. The ML /train
// service returns JSON; this store keeps a copy of each run (with a
// trimmed copy of the source rows) so results survive page reloads
// and can be listed on the dashboard.
// ============================================================

const STORAGE_KEY = 'bfar.savedAnalyses.v1';
const MAX_ROWS_KEPT = 1000;

const clone = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
};

const readList = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
};

const writeList = (list) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(list, (key, value) => (value === undefined ? null : value))
  );
};

export const getSavedAnalyses = () => readList();

export const getSavedAnalysis = (id) =>
  readList().find((analysis) => analysis.id === id) || null;

/**
 * Persists an analysis run. Returns the saved record (with its id), or
 * null if even the results-only payload could not be stored.
 *
 * To respect the localStorage quota the source rows are capped, and if
 * the payload is still too large it is retried without the rows/columns
 * and flagged with `truncated: true` so the detail page can warn the user.
 */
export const saveAnalysis = (record) => {
  const list = readList();
  const entry = {
    id: record.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: (record.title || 'Analysis').trim() || 'Analysis',
    fileName: record.fileName || '',
    createdAt: record.createdAt || new Date().toISOString(),
    analysisResults: clone(record.analysisResults),
    treatmentColumn: record.treatmentColumn || '',
    outcomeColumn: record.outcomeColumn || '',
    caliperRatio: record.caliperRatio ?? 0.2,
    truncated: false,
  };

  const rest = list.filter((analysis) => analysis.id !== entry.id);
  const rows = Array.isArray(record.rows) ? record.rows.slice(0, MAX_ROWS_KEPT) : [];
  const columns = Array.isArray(record.columns) ? record.columns : [];

  try {
    writeList([entry, ...rest].map((a) => ({ ...a, columns: a.id === entry.id ? columns : a.columns, rows: a.id === entry.id ? rows : a.rows })));
  } catch (_) {
    // Quota exceeded — retry storing results only.
    try {
      writeList([{ ...entry, truncated: true, columns: [], rows: [] }, ...rest]);
    } catch (_) {
      return null;
    }
  }
  return getSavedAnalysis(entry.id);
};

export const deleteAnalysis = (id) => {
  writeList(readList().filter((analysis) => analysis.id !== id));
  return true;
};