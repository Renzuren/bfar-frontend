// src/pages/NoBaselineAnalysisReport.js
// ============================================================
// NO-BASELINE ANALYSIS REPORT
// Automatically builds a combined Beneficiary + Non-Beneficiary
// dataset from the project's before/after questionnaires, sends
// it through the ML `/train` pipeline (the same one the manual
// ML Upload page uses), and renders the shared MLAnalyticsPanel.
// Nothing is dropped manually here — the CSV is assembled in
// memory from the collected responses and the analysis auto-runs
// on load, with a "Re-run" button for refreshing results.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileBarChart2,
  Inbox,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '../lib/apiMiddleware';
import { buildCombinedDataset } from '../lib/combinedDataset';
import { runMLAnalysis } from '../lib/mlAnalysisApi';
import MLAnalyticsPanel, { MLAnalysisSkeleton } from '../components/MLAnalyticsPanel';
import AutoChartsReport from '../components/AutoChartsReport';

const SummaryStat = ({ icon: Icon, label, value, sub, accent = 'text-blue-600', bg = 'bg-blue-50' }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  </div>
);

const NoBaselineAnalysisReport = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;

  const [dataset, setDataset] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const ranRef = useRef(false);

  // Data-preview table state (mirrors the ML Upload preview)
  const [showPreview, setShowPreview] = useState(true);
  const [tablePage, setTablePage] = useState(0);
  const tableRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const ROWS_PER_PAGE = 100;

  const handleScrollLeft = () => {
    if (tableRef.current) {
      const newScrollPosition = Math.max(0, scrollPositionRef.current - 200);
      tableRef.current.scrollLeft = newScrollPosition;
      scrollPositionRef.current = newScrollPosition;
    }
  };
  const handleScrollRight = () => {
    if (tableRef.current) {
      const maxScroll = tableRef.current.scrollWidth - tableRef.current.clientWidth;
      const newScrollPosition = Math.min(maxScroll, scrollPositionRef.current + 200);
      tableRef.current.scrollLeft = newScrollPosition;
      scrollPositionRef.current = newScrollPosition;
    }
  };
  const handleTableScroll = useCallback((e) => {
    scrollPositionRef.current = e.target.scrollLeft;
  }, []);
  const getScrollPercentage = () => {
    if (!tableRef.current) return 0;
    const maxScroll = tableRef.current.scrollWidth - tableRef.current.clientWidth;
    if (maxScroll <= 0) return 0;
    return Math.round((scrollPositionRef.current / maxScroll) * 100);
  };

  // Fetch both questionnaires + responses (mirrors ReportTab / NarrativeReport).
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!project) return;
      setLoading(true);
      setError(null);
      try {
        const [beforeForm, beforeResponses, afterForm, afterResponses] = await Promise.all([
          project.before_form
            ? api.get(`/forms/${project.before_form}`).catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
          project.before_form
            ? api.get(`/forms/${project.before_form}/responses`).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          project.after_form
            ? api.get(`/forms/${project.after_form}`).catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
          project.after_form
            ? api.get(`/forms/${project.after_form}/responses`).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);

        if (cancelled) return;

        const merged = buildCombinedDataset({
          beforeForm: beforeForm.data,
          beforeResponses: beforeResponses.data || [],
          afterForm: afterForm.data,
          afterResponses: afterResponses.data || [],
        });
        setDataset(merged);
        setTablePage(0);
        ranRef.current = false;
      } catch (err) {
        if (!cancelled) setError('Failed to load questionnaire data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [project, reloadKey]);

  // Auto-run the ML analysis once the combined dataset is ready.
  const runAnalysis = useCallback(async () => {
    if (!dataset || !dataset.columns.length || !dataset.rows.length) return;
    setAnalysing(true);
    setError(null);
    setProgress(10);
    try {
      const result = await runMLAnalysis({
        columns: dataset.columns,
        rows: dataset.rows,
        treatmentColumn: 'Status',
        onProgress: setProgress,
      });
      setAnalysisResults(result);
      setProgress(100);
      setTimeout(() => setProgress(0), 1200);
    } catch (err) {
      setError(err.message === 'No data available to analyze'
        ? 'No analyzable data was found.'
        : `Analysis failed: ${err.message || 'Unknown error'}`);
      setProgress(0);
    } finally {
      setAnalysing(false);
    }
  }, [dataset]);

  useEffect(() => {
    if (!dataset) return;
    if (ranRef.current) return;
    if (!dataset.columns.length || !dataset.rows.length) return;
    ranRef.current = true;
    runAnalysis();
  }, [dataset, runAnalysis]);

  const hasForms = Boolean(project?.before_form && project?.after_form);
  const hasData = Boolean(dataset && dataset.respondentCount > 0);
  const hasAnalysableData = Boolean(dataset && dataset.columns.length > 0 && dataset.rows.length > 0);

  const groupStats = useMemo(() => {
    if (!dataset) return { Beneficiary: 0, 'Non-Beneficiary': 0 };
    return dataset.statusCounts || { Beneficiary: 0, 'Non-Beneficiary': 0 };
  }, [dataset]);

  const handleReRun = () => {
    setAnalysisResults(null);
    setError(null);
    ranRef.current = false;
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-8 py-10 text-white shadow-2xl shadow-emerald-900/20 sm:px-12 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <FileBarChart2 className="h-7 w-7" />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-emerald-200">Analysis Report</p>
                <h2 className="mb-2 text-3xl font-bold leading-tight sm:text-4xl">
                  Automatic Impact Analysis
                </h2>
                <p className="max-w-2xl text-base text-emerald-100">
                  Combines Beneficiary and Non-Beneficiary responses into one dataset, then runs the ML
                  matching pipeline automatically. No file upload needed — results are generated from your
                  collected responses.
                </p>
              </div>
            </div>
            {(hasAnalysableData || analysisResults) && (
              <button
                onClick={handleReRun}
                disabled={analysing}
                className="hidden shrink-0 items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-50 sm:inline-flex"
              >
                <RefreshCw className={`h-4 w-4 ${analysing ? 'animate-spin' : ''}`} />
                Re-run Analysis
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Data summary */}
      {dataset && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryStat
            icon={Users}
            label="Respondents"
            value={dataset.respondentCount.toLocaleString()}
            sub="combined dataset rows"
            accent="text-blue-600"
            bg="bg-blue-50"
          />
          <SummaryStat
            icon={Layers}
            label="Beneficiaries"
            value={groupStats.Beneficiary.toLocaleString()}
            sub="Status = Beneficiary"
            accent="text-emerald-600"
            bg="bg-emerald-50"
          />
          <SummaryStat
            icon={ListChecks}
            label="Non-Beneficiaries"
            value={groupStats['Non-Beneficiary'].toLocaleString()}
            sub="Status = Non-Beneficiary"
            accent="text-rose-600"
            bg="bg-rose-50"
          />
          <SummaryStat
            icon={BrainCircuit}
            label="Features"
            value={(dataset.columns.length - 1).toLocaleString()}
            sub="questions mapped to columns"
            accent="text-violet-600"
            bg="bg-violet-50"
          />
        </div>
      )}

      {/* Data Preview (combined Beneficiary + Non-Beneficiary rows) */}
      {dataset && dataset.rows.length > 0 && (() => {
        const totalPages = Math.ceil(dataset.rows.length / ROWS_PER_PAGE);
        const pageData = dataset.rows.slice(tablePage * ROWS_PER_PAGE, (tablePage + 1) * ROWS_PER_PAGE);
        return (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-slate-600"
                >
                  {showPreview ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  Data Preview
                </button>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {dataset.rows.length.toLocaleString()} rows × {dataset.columns.length} cols
                </span>
              </div>
              {showPreview && dataset.columns.length > 6 && (
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleScrollLeft}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[60px] text-center text-xs text-slate-500">{getScrollPercentage()}%</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleScrollRight}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {showPreview && (
              <>
                <div className="overflow-x-auto">
                  <div className="max-h-96 overflow-y-auto" ref={tableRef} onScroll={handleTableScroll}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-20 bg-slate-50">
                        <tr>
                          {dataset.columns.map((column, index) => (
                            <th key={index} className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pageData.map((row, rowIndex) => (
                          <tr key={rowIndex} className="transition-colors hover:bg-slate-50/50">
                            {dataset.columns.map((column, colIndex) => (
                              <td key={colIndex} className="whitespace-nowrap px-6 py-3 text-sm text-slate-600">
                                {column === 'Status' ? (
                                  <span
                                    className={
                                      row[column] === 'Beneficiary'
                                        ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
                                        : 'inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700'
                                    }
                                  >
                                    <span className={row[column] === 'Beneficiary' ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-rose-500'} />
                                    {row[column]}
                                  </span>
                                ) : (
                                  row[column] || <span className="text-slate-300">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                    <p className="text-xs text-slate-500">
                      Showing {(tablePage * ROWS_PER_PAGE + 1).toLocaleString()}–{Math.min((tablePage + 1) * ROWS_PER_PAGE, dataset.rows.length).toLocaleString()} of {dataset.rows.length.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-slate-600">{tablePage + 1} / {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))} disabled={tablePage >= totalPages - 1}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* States */}
      {loading && <MLAnalysisSkeleton />}

      {!loading && !hasForms && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-left shadow-sm">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600">
            <Inbox className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No Questionnaires Yet</h3>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            Create both a Beneficiary and a Non-Beneficiary questionnaire to run the automatic ML analysis.
          </p>
        </div>
      )}

      {!loading && hasForms && !hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-left shadow-sm">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600">
            <Inbox className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No Responses Collected Yet</h3>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            Responses from both groups are required. The analysis will run automatically as soon as data is available.
          </p>
        </div>
      )}

      {!loading && hasData && !hasAnalysableData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-left shadow-sm">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No Analyzable Data</h3>
          <p className="mb-6 max-w-md text-sm text-slate-500">
            Responses exist, but no analyzable questions were found in the questionnaires. Add questions to enable the ML analysis.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Analysis could not be completed</p>
            <p className="mt-0.5 text-red-600">{error}</p>
            <button
              onClick={handleReRun}
              disabled={analysing}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${analysing ? 'animate-spin' : ''}`} />
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Progress during analysis */}
      {analysing && !analysisResults && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Running ML analysis…</p>
              <p className="text-xs text-slate-500">
                Matching {groupStats.Beneficiary.toLocaleString()} beneficiaries against {groupStats['Non-Beneficiary'].toLocaleString()} non-beneficiaries
              </p>
            </div>
          </div>
          {progress > 0 && (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-right text-[11px] tabular-nums text-slate-400">{progress}%</p>
        </div>
      )}

      {/* Analysis results */}
      {analysisResults && !analysing && (
        <MLAnalyticsPanel
          analysisResults={analysisResults}
          columns={dataset.columns}
          rows={dataset.rows}
          treatmentColumn="Status"
          defaultTab="summary"
        />
      )}

      {/* Auto charts (computed live from the combined dataset) */}
      {!loading && hasAnalysableData && (
        <AutoChartsReport
          columns={dataset.columns}
          rows={dataset.rows}
          analysisResults={analysisResults}
        />
      )}
    </div>
  );
};

export default NoBaselineAnalysisReport;