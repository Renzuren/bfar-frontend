// src/pages/NoBaselineAnalysisReport.js
// ============================================================
// ANALYSIS REPORT TAB — No-Baseline projects
// Mirrors the full MLUpload.js layout & pipeline, but fully
// automatic: the combined dataset is built from the Beneficiary
// + Non-Beneficiary responses and the ML analysis runs
// automatically against the same `/train` endpoint.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { escapeCsvCell } from '../lib/csv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  Inbox,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Save,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/apiMiddleware';
import { buildCombinedDataset } from '../lib/combinedDataset';
import { resolveServiceUrl } from '../lib/apiBase';
import { fetchWithRetry } from '../lib/fetchRetry';
import { enrichImpact, isBeneficiary } from '../lib/localImpact';
import MLAnalyticsPanel, { MLAnalysisSkeleton } from '../components/MLAnalyticsPanel';
import AutoChartsReport from '../components/AutoChartsReport';

const NoBaselineAnalysisReport = () => {
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;

  const ML_API_URL = resolveServiceUrl(process.env.REACT_APP_ML_API_URL, 'http://localhost:8000');

  // ---------- Automatic data state ----------
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [availableColumns, setAvailableColumns] = useState([]);

  // ---------- Analysis state ----------
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const ranRef = useRef(false);

  // ---------- Configuration ----------
  const [treatmentColumn] = useState('Status');
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [includeFeatures, setIncludeFeatures] = useState('');
  const [caliperRatio, setCaliperRatio] = useState(0.2);

  // ---------- Data-preview table state (mirrors ML Upload) ----------
  const [showPreview, setShowPreview] = useState(true);
  const [tablePage, setTablePage] = useState(0);
  const tableRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const ROWS_PER_PAGE = 100;

  // ---------- Scroll helpers (mirror ML Upload) ----------
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

  // ---------- Fetch both questionnaires + responses and build the combined dataset ----------
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!project) return;
      setIsLoading(true);
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

        const cols = (merged.columns || []).filter(c => c !== 'Status');
        setAvailableColumns(cols);
        const incomeCol = cols.find(c => /income|kita/i.test(c));
        if (incomeCol) setOutcomeColumn(incomeCol);
        else if (cols.length) setOutcomeColumn(cols[0]);
        else setOutcomeColumn('');
      } catch (err) {
        if (!cancelled) setError('Failed to load questionnaire data.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [project]);

  // ---------- Analyze: call /train (mirrors ML Upload handleAnalyze) ----------
  const buildCSVString = (cols, dataRows) => {
    const lines = [cols.map(escapeCsvCell).join(',')];
    dataRows.forEach((row) => {
      lines.push(cols.map((col) => escapeCsvCell(row[col])).join(','));
    });
    return '\ufeff' + lines.join('\r\n');
  };

  const handleAnalyze = useCallback(async () => {
    if (!dataset || dataset.rows.length === 0) {
      setError('No data available to analyze');
      return;
    }
    if (!outcomeColumn) {
      setError('Please select an outcome column.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);
    setShowPreview(true);
    setUploadProgress(10);

    try {
      // The ML service binarizes the treatment column by taking the
      // alphabetically-last unique value as "treated"; the labels
      // "Beneficiary"/"Non-Beneficiary" would make it pick Non-Beneficiary.
      // Send a numeric 0/1 encoding instead (Beneficiary = treated = 1) so
      // the treated/control direction is correct for everything downstream.
      const apiRows = dataset.rows.map((row) => ({
        ...row,
        Status: isBeneficiary(row.Status) ? '1' : '0',
      }));
      const csvString = buildCSVString(dataset.columns, apiRows);
      const blob = new Blob([csvString], { type: 'text/csv' });
      const fileToSend = new File([blob], 'combined-responses.csv', { type: 'text/csv' });

      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('treatment_column', treatmentColumn);
      formData.append('outcome_column', outcomeColumn);
      if (includeFeatures.trim()) formData.append('include_features', includeFeatures.trim());
      formData.append('caliper_ratio', String(caliperRatio));

      setUploadProgress(30);
      const endpoint = `${ML_API_URL.replace(/\/$/, '')}/train`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await fetchWithRetry(
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
      clearTimeout(timeout);
      setUploadProgress(80);

      if (!response.ok) {
        let errorMsg = `Server returned ${response.status}`;
        try {
          const errorJson = await response.json();
          if (errorJson.error) errorMsg = errorJson.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const result = await response.json();
      // Guarantee the Impact tab is fully populated even when the service
      // reports zero matched pairs (empty ATT / no pair-details button / no
      // Pre-Post profile) -- enrichImpact recomputes the gap from the actual
      // responses using the service's own propensity scores.
      setAnalysisResults(enrichImpact(result, dataset, outcomeColumn, caliperRatio));
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1200);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Training may be taking too long.');
      } else {
        setError(`Analysis failed: ${err.message || 'Unknown error'}`);
      }
      setUploadProgress(0);
    } finally {
      setIsAnalyzing(false);
    }
  }, [dataset, outcomeColumn, includeFeatures, caliperRatio, treatmentColumn, ML_API_URL]);

  // ---------- Auto-run the analysis once the combined dataset is ready ----------
  useEffect(() => {
    if (!dataset) return;
    if (ranRef.current) return;
    if (!dataset.columns.length || !dataset.rows.length) return;
    if (!outcomeColumn) return; // wait for outcome selection
    ranRef.current = true;
    handleAnalyze();
  }, [dataset, handleAnalyze, outcomeColumn]);

  const hasForms = Boolean(project?.before_form && project?.after_form);
  const hasData = Boolean(dataset && dataset.respondentCount > 0);
  const hasAnalysableData = Boolean(dataset && dataset.columns.length > 0 && dataset.rows.length > 0);

  const groupStats = useMemo(() => {
    if (!dataset) return { Beneficiary: 0, 'Non-Beneficiary': 0 };
    return dataset.statusCounts || { Beneficiary: 0, 'Non-Beneficiary': 0 };
  }, [dataset]);

  // ---------- Main render (mirrors ML Upload layout) ----------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-3 pb-24 pt-0 sm:px-4">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-900 sm:text-base">Analysis Report</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden border-slate-200 text-[10px] text-slate-400 sm:inline-flex">
                PSM · SES Impact
              </Badge>
            </div>
          </div>
        </header>

        {/* How it works - only show before data is loaded */}
        {!dataset && !isLoading && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-300">How it works</p>
              <h2 className="mb-6 text-2xl font-bold">Automatic ML Analysis Pipeline</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-blue-300">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">1. Collect</h4>
                    <p className="text-sm text-blue-200">Beneficiary & Non-Beneficiary responses</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-indigo-300">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">2. Combine</h4>
                    <p className="text-sm text-blue-200">Merge both groups into one dataset</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-emerald-300">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">3. Auto-Analyze</h4>
                    <p className="text-sm text-blue-200">PS scores, balance, SHAP & impact</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-purple-300">
                    <Save className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">4. Review</h4>
                    <p className="text-sm text-blue-200">Save or download results for later</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Loading state */}
        {isLoading && <MLAnalysisSkeleton />}

        {/* Empty states */}
        {!isLoading && !hasForms && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Inbox className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No Questionnaires Yet</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Create both a Beneficiary and a Non-Beneficiary questionnaire to run the automatic ML analysis.
            </p>
          </div>
        )}

        {!isLoading && hasForms && !hasData && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Inbox className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No Responses Collected Yet</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Responses from both groups are required. The analysis will run automatically as soon as data is available.
            </p>
          </div>
        )}

        {/* Automatic Data Card (mirrors ML Upload's Import File card) */}
        {!isLoading && hasAnalysableData && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Automatic Dataset</h2>
                  <p className="text-xs text-slate-500">
                    Combined Beneficiary + Non-Beneficiary responses · no upload needed
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-800 flex-1">{error}</p>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Dataset summary stats */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Users className="h-4 w-4" /> Respondents
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {dataset.respondentCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <Layers className="h-4 w-4" /> Beneficiaries
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                    {groupStats.Beneficiary.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-rose-600">
                    <ListChecks className="h-4 w-4" /> Non-Beneficiaries
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700">
                    {groupStats['Non-Beneficiary'].toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-violet-600">
                    <BrainCircuit className="h-4 w-4" /> Features
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-violet-700">
                    {(dataset.columns.length - 1).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Configuration options (mirrors ML Upload) */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Group / Treatment Column
                  </Label>
                  <Input value="Status" readOnly className="h-10 text-sm bg-white" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Outcome Column
                  </Label>
                  <Select value={outcomeColumn} onValueChange={setOutcomeColumn}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map((col) => (
                        <SelectItem key={col} value={col} className="text-sm">{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Include Features
                  </Label>
                  <Input
                    value={includeFeatures}
                    onChange={(e) => setIncludeFeatures(e.target.value)}
                    placeholder="B3:AGE, B5:SEX, ..."
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Caliper Ratio
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={caliperRatio}
                    onChange={(e) => setCaliperRatio(parseFloat(e.target.value) || 0.2)}
                    className="h-10 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Larger = looser matching (try 2–5 if no matches)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Preview (mirrors ML Upload) */}
        {dataset && dataset.rows.length > 0 && (() => {
          const totalPages = Math.ceil(dataset.rows.length / ROWS_PER_PAGE);
          const pageData = dataset.rows.slice(tablePage * ROWS_PER_PAGE, (tablePage + 1) * ROWS_PER_PAGE);
          return (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
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
                                        String(row[column]).toLowerCase().includes('benef')
                                          ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
                                          : 'inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700'
                                      }
                                    >
                                      <span className={String(row[column]).toLowerCase().includes('benef') ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-rose-500'} />
                                      {row[column]}
                                    </span>
                                  ) : (
                                    row[column] === '' || row[column] === null || row[column] === undefined
                                      ? <span className="font-medium text-slate-400">N/A</span>
                                      : row[column]
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

        {/* Action Buttons */}
        {hasAnalysableData && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !outcomeColumn}
              className="gap-2 bg-blue-600 text-sm shadow-sm hover:bg-blue-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" /> Run Analysis
                </>
              )}
            </Button>
            <Button
              onClick={() => { ranRef.current = false; handleAnalyze(); }}
              disabled={isAnalyzing || !outcomeColumn}
              variant="outline"
              className="gap-2 border-slate-200 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> Re-run
            </Button>
          </div>
        )}

        {/* Progress bar (mirrors ML Upload) */}
        {isAnalyzing && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="w-full">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-slate-500 mt-1 text-center">Training in progress… {uploadProgress}%</p>
          </div>
        )}

        {/* Analysis error after auto-run failed */}
        {error && hasAnalysableData && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Analysis could not be completed</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Analysis Results (mirrors ML Upload) */}
        {analysisResults && (
          <MLAnalyticsPanel
            analysisResults={analysisResults}
            columns={dataset.columns}
            rows={dataset.rows}
            treatmentColumn={treatmentColumn}
            defaultTab="impact"
          />
        )}

        {/* Auto charts (computed live from the combined dataset) */}
        {dataset && dataset.rows.length > 0 && (
          <AutoChartsReport columns={dataset.columns} rows={dataset.rows} />
        )}
      </div>
    </div>
  );
};

export default NoBaselineAnalysisReport;