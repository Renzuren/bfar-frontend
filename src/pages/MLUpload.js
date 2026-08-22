import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileSpreadsheet, Database, BarChart3, ArrowLeft, Import,
  ChevronLeft, ChevronRight, TrendingUp, AlertCircle, Loader2,
  CheckCircle2, XCircle, Filter,
  Download, Save, Eye, TrendingDown, Minus, BarChart2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';

const MLUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ML_API_URL = process.env.REACT_APP_ML_API_URL || 'http://localhost:8000';

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Treatment, outcome, and feature filter
  const [treatmentColumn, setTreatmentColumn] = useState('');
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [includeFeatures, setIncludeFeatures] = useState('');

  // Save Results modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const scrollPositionRef = useRef(0);
  const [tablePage, setTablePage] = useState(0);
  const tableRef = useRef(null);
  const ROWS_PER_PAGE = 100;

  // ---------- File handling (unchanged) ----------
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) validateAndProcessFile(selectedFile);
  };

  const validateAndProcessFile = (file) => {
    setError(null);
    if (!file || typeof file !== 'object') { setError('Invalid file selected'); return; }
    if (!file.name || file.name.trim() === '') { setError('File name is required'); return; }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { setError(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`); return; }
    if (file.size === 0) { setError('File is empty'); return; }
    const fileName = file.name.toLowerCase().trim();
    const isCSV = fileName.endsWith('.csv');
    const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    if (!isCSV && !isXLSX) { setError(`Unsupported file type. Only CSV and XLSX files are supported`); return; }
    setFile(file);
    setShowPreview(false);
    try {
      if (isCSV) parseCSV(file);
      else parseXLSX(file);
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error(err);
    }
  };

  const parseCSV = (file) => {
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (!text.trim()) { setError('CSV file is empty'); setIsLoading(false); return; }
        const rows = parseCSVRows(text);
        if (rows.length === 0) { setError('No valid data found'); setIsLoading(false); return; }
        const headers = rows[0].map(header => header.trim()).filter(header => header.length > 0);
        if (headers.length === 0) { setError('No valid column headers'); setIsLoading(false); return; }
        setColumns(headers);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setTablePage(0);
        const data = rows.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] || '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value.trim()));
        setCsvData(data);
        setShowPreview(true);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to parse CSV');
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setError('Failed to read file'); setIsLoading(false); };
    reader.readAsText(file);
  };

  const parseXLSX = (file) => {
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xlsxData = new Uint8Array(e.target.result);
        const workbook = XLSX.read(xlsxData, { type: 'array', cellDates: false, cellStyles: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
        if (!jsonData || jsonData.length === 0) { setError('XLSX is empty'); setIsLoading(false); return; }
        const firstRow = jsonData[0];
        const headers = Object.keys(firstRow).map(key =>
          firstRow[key] !== undefined && firstRow[key] !== null
            ? firstRow[key].toString().trim()
            : ''
        ).filter(header => header.length > 0);
        if (headers.length === 0) { setError('No valid headers'); setIsLoading(false); return; }
        setColumns(headers);
        setTreatmentColumn('');
        setOutcomeColumn('');
        setTablePage(0);
        const processedData = jsonData.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, headerIndex) => {
            const cellValue = row[headerIndex];
            rowObj[header] = cellValue !== undefined && cellValue !== null
              ? cellValue.toString()
              : '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value && value.toString().trim()));
        setCsvData(processedData);
        setShowPreview(true);
        setIsLoading(false);
      } catch (err) {
        setError(`Failed to parse XLSX: ${err.message}`);
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setError('Failed to read XLSX'); setIsLoading(false); };
    reader.readAsArrayBuffer(file);
  };

  const parseCSVRows = (text) => {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') { currentField += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField.trim() || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) rows.push(currentRow);
    }
    return rows;
  };

  // Drag and drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndProcessFile(droppedFile);
  };

  // Scroll helpers
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

  // ---------- Convert XLSX to CSV for backend ----------
  const convertXLSXtoCSV = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(firstSheet);
          resolve(csv);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // ---------- Analyze: call /train ----------
  const handleAnalyze = async () => {
    if (csvData.length === 0) {
      setError('No data available to analyze');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setShowPreview(true);
    setUploadProgress(10);

    try {
      let fileToSend = file;
      if (file && file.name.toLowerCase().endsWith('.xlsx')) {
        const csvString = await convertXLSXtoCSV(file);
        const blob = new Blob([csvString], { type: 'text/csv' });
        fileToSend = new File([blob], file.name.replace(/\.xlsx$/i, '.csv'), { type: 'text/csv' });
      }

      const formData = new FormData();
      formData.append('file', fileToSend);
      if (treatmentColumn) formData.append('treatment_column', treatmentColumn);
      if (outcomeColumn) formData.append('outcome_column', outcomeColumn);
      if (includeFeatures.trim()) formData.append('include_features', includeFeatures.trim());

      setUploadProgress(30);
      const endpoint = `${ML_API_URL.replace(/\/$/, '')}/train`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
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
      setAnalysisResults(result);
      // Auto‑switch to the "impact" tab if profiling data exists, else summary
      if (result.profile_updates && result.profile_updates.length > 0) {
        setActiveTab('impact');
      } else {
        setActiveTab('summary');
      }
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
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
  };

  // ---------- Chart Data Preparation (same as before) ----------
  const preparePSHistogram = (psArray) => {
    if (!psArray || psArray.length === 0) return [];
    const bins = 20;
    const min = 0;
    const max = 1;
    const step = (max - min) / bins;
    const hist = Array(bins).fill(0);
    psArray.forEach(p => {
      const idx = Math.min(Math.floor((p - min) / step), bins - 1);
      hist[idx] += 1;
    });
    return hist.map((count, i) => ({
      bin: `${(i * step).toFixed(2)}-${((i + 1) * step).toFixed(2)}`,
      count
    }));
  };

  const prepareSMDBarData = (perFeature) => {
    if (!perFeature || perFeature.length === 0) return [];
    const sorted = [...perFeature].sort((a, b) =>
      Math.abs(b.smd_after || b.smd_before || 0) - Math.abs(a.smd_after || a.smd_before || 0)
    );
    return sorted.slice(0, 20).map(item => ({
      name: item.feature.length > 20 ? item.feature.slice(0, 18) + '…' : item.feature,
      fullName: item.feature,
      before: item.smd_before || 0,
      after: item.smd_after || 0,
    }));
  };

  const prepareFeatureImportance = (selected) => {
    if (!selected || selected.length === 0) return [];
    return selected.slice(0, 15).map(item => ({
      name: item.feature.length > 25 ? item.feature.slice(0, 23) + '…' : item.feature,
      fullName: item.feature,
      importance: item.importance,
    }));
  };

  // ---------- Render Summary (unchanged) ----------
  const renderSummary = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
    const { rows, treatment_column, treatment_detection_method, retrained, retrain_attempts, feature_selection } = analysisResults;
    const topFeatures = feature_selection?.selected || [];
    const importanceData = prepareFeatureImportance(topFeatures);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Rows</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{rows}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Treatment Column</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{treatment_column || 'N/A'}</p>
            <p className="text-[11px] text-slate-400">{treatment_detection_method}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Retrained</p>
            <div className="mt-1 flex items-center gap-2">
              {retrained ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-amber-500" />}
              <span className="text-sm font-semibold text-slate-900">{retrained ? 'Yes' : 'No'}</span>
            </div>
            <p className="text-[11px] text-slate-400">Attempts: {retrain_attempts}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Features Selected</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{feature_selection?.n_features_selected || 0}</p>
          </div>
        </div>

        {importanceData.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Top 15 Feature Importances</h3>
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={importanceData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 'dataMax + 0.05']} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-md">
                              <p className="font-medium text-slate-900">{data.fullName || data.name}</p>
                              <p className="text-slate-600">Importance: {data.importance.toFixed(4)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="importance" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- Render Output (unchanged) ----------
  const renderOutput = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
    const { ps_output, decision_support } = analysisResults;
    const psData = preparePSHistogram(ps_output?.ps);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Min</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.min?.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Max</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.max?.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Mean</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.mean?.toFixed(4)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Median</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{ps_output?.ps_summary?.median?.toFixed(4)}</p>
          </div>
        </div>

        {psData.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Propensity Score Distribution</h3>
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={psData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {psData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index < psData.length / 2 ? '#60a5fa' : '#a78bfa'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {decision_support && decision_support.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Decision Support (PS Quartiles)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Group</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Count</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Mean PS</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {decision_support.map((row, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700">{row.ps_group}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-center text-slate-600">{row.count}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-center font-mono text-slate-600">{row.mean_ps?.toFixed(4)}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-600">{row.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- Render Metrics (unchanged) ----------
  const renderMetrics = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
    const { covariate_balance, model_interpretation } = analysisResults;
    const smdData = prepareSMDBarData(covariate_balance?.per_feature);

    return (
      <div className="space-y-6">
        {covariate_balance && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Balance Achieved</p>
                <div className="mt-1 flex items-center gap-2">
                  {covariate_balance.balance_achieved ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-900">{covariate_balance.balance_achieved ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Mean |SMD|</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.mean_abs_smd?.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Matched Pairs</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.matched_pairs}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Caliper</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.caliper?.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Overlap (Treated in Control)</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.overlap?.treated_in_control_range_pct?.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Overlap (Control in Treated)</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{covariate_balance.overlap?.control_in_treated_range_pct?.toFixed(1)}%</p>
              </div>
            </div>

            {smdData.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Standardized Mean Differences (SMD) – Before vs After Matching</h3>
                </div>
                <div className="p-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={smdData} layout="vertical" margin={{ left: 80, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 'dataMax + 0.2']} />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-md">
                                  <p className="font-medium text-slate-900">{data.fullName || data.name}</p>
                                  <p className="text-slate-600">Before: {data.before.toFixed(4)}</p>
                                  <p className="text-slate-600">After: {data.after.toFixed(4)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar dataKey="before" fill="#f87171" name="Before" />
                        <Bar dataKey="after" fill="#34d399" name="After" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {model_interpretation && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Model Interpretation (SHAP)</h3>
            </div>
            <div className="p-6">
              <p className="mb-4 text-sm text-slate-600">{model_interpretation.method}</p>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <ul className="space-y-1 text-sm">
                  {model_interpretation.feature_contributions?.slice(0, 15).map((item, idx) => (
                    <li key={idx} className="flex justify-between border-b border-slate-100 py-1.5 px-2">
                      <span className="truncate text-slate-700">{item.feature}</span>
                      <span className="whitespace-nowrap font-mono text-slate-600">
                        {item.mean_abs_shap?.toFixed(4)} ({item.direction === 'increases_likelihood' ? '\u2B06' : '\u2B07'})
                      </span>
                    </li>
                  ))}
                  {model_interpretation.feature_contributions?.length > 15 && (
                    <li className="px-2 py-1 text-xs text-slate-400">&hellip; and {model_interpretation.feature_contributions.length - 15} more</li>
                  )}
                </ul>
              </div>
              {model_interpretation.socioeconomic_insights && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="mb-2 text-sm font-semibold text-slate-700">Insights</h5>
                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                    {model_interpretation.socioeconomic_insights.map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- NEW: Render Impact (ATT + Profiling) ----------
  const renderImpact = () => {
    if (!analysisResults) return <p className="text-slate-500">No results yet.</p>;
    const { att_result, profiling_summary, profile_updates, pair_profiles } = analysisResults;

    // Helper to compute percentages
    const calcPct = (count, total) => total > 0 ? (count / total * 100).toFixed(1) : 0;

    return (
      <div className="space-y-6">
        {/* ATT Result Card */}
        {att_result && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Average Treatment Effect on the Treated (ATT)</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Mean ATT</p>
                  <p className="mt-0.5 text-2xl font-bold text-blue-600">{att_result.att_mean?.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">95% CI</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-700">
                    [{att_result.ci_95?.[0]?.toFixed(4)}, {att_result.ci_95?.[1]?.toFixed(4)}]
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">p-value (paired t-test)</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">{att_result.p_value_paired_ttest?.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Matched Pairs</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">{att_result.matched_pairs}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">Caliper: {att_result.caliper?.toFixed(4)}</p>
            </div>
          </div>
        )}

        {/* Profiling Summary Cards */}
        {profiling_summary && (
          <div className="grid grid-cols-3 gap-5">
            <div className="rounded-2xl border border-green-200 bg-green-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Increased</p>
                  <p className="text-2xl font-bold text-green-700">{profiling_summary.increased_count}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Decreased</p>
                  <p className="text-2xl font-bold text-red-700">{profiling_summary.decreased_count}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Minus className="h-8 w-8 text-slate-500" />
                <div>
                  <p className="text-xs font-medium text-slate-500">No Change</p>
                  <p className="text-2xl font-bold text-slate-700">{profiling_summary.no_change_count}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Updates Table with bars */}
        {profile_updates && profile_updates.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-slate-900">Pre‑Post Change Profile (Treated vs Control)</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">Feature</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-600" colSpan="3">Treated</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-600" colSpan="3">Control</th>
                  </tr>
                  <tr className="bg-slate-50/70">
                    <th className="border-b border-slate-200 px-6 py-2"></th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-green-600">↑</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-red-600">↓</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-400">–</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-green-600">↑</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-red-600">↓</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-400">–</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {profile_updates.map((item, idx) => {
                      const tTotal = item.treated.total || 1;
                      const cTotal = item.control.total || 1;
                      return (
                        <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                          <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-700">{item.feature}</td>
                          {/* Treated bars */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.increased}</span>
                              <div className="w-12 h-1.5 bg-green-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.treated.increased / tTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.decreased}</span>
                              <div className="w-12 h-1.5 bg-red-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.treated.decreased / tTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.no_change}</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(item.treated.no_change / tTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          {/* Control bars */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.increased}</span>
                              <div className="w-12 h-1.5 bg-green-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.control.increased / cTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.decreased}</span>
                              <div className="w-12 h-1.5 bg-red-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.control.decreased / cTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.no_change}</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(item.control.no_change / cTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Optional: expandable pair profiles */}
        {pair_profiles && pair_profiles.length > 0 && (
          <details className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-blue-600">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                View matched pair details ({pair_profiles.length} pairs)
              </span>
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Pair</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Treated ID</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Control ID</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Treated Outcome</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Control Outcome</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Difference</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pair_profiles.slice(0, 50).map((pair, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.treated_index}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.control_index}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.treated_outcome?.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.control_outcome?.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{pair.outcome_difference?.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          pair.status === 'Increased' ? 'bg-green-50 text-green-600' :
                          pair.status === 'Decreased' ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>{pair.status}</span>
                      </td>
                    </tr>
                  ))}
                  {pair_profiles.length > 50 && (
                    <tr><td colSpan="7" className="py-3 text-center text-xs text-slate-400">… and {pair_profiles.length - 50} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    );
  };

  // ---------- Save Results (localStorage) ----------
  const handleSaveResults = () => {
    if (!analysisResults) return;
    const saved = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: saveName || `Analysis ${new Date().toLocaleString()}`,
      description: saveDescription || '',
      date: new Date().toISOString(),
      results: analysisResults,
    };
    saved.push(entry);
    localStorage.setItem('savedAnalyses', JSON.stringify(saved));
    setShowSaveModal(false);
    setSaveName('');
    setSaveDescription('');
    alert('Results saved successfully!');
  };

  const handleDownloadJSON = () => {
    if (!analysisResults) return;
    const blob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Form import (unchanged) ----------
  const handleImportForm = () => {
    if (csvData.length === 0 || columns.length === 0) {
      setError('No data available to import');
      return;
    }
    setError(null);
    try {
      const isSurveyData = detectSurveyData();
      let formFields;
      let formTitle;
      let formDescription;

      if (isSurveyData) {
        formFields = createSurveyFormFields();
        formTitle = `Survey Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/, '') || 'Survey Data'}`;
        formDescription = `Survey questionnaire created from ${file?.name} with ${columns.length} questions and ${csvData.length} responses`;
      } else {
        formFields = columns.map((column, index) => ({
          id: `field_${index}`,
          type: 'text',
          label: column,
          required: false,
          placeholder: `Enter ${column}`
        }));
        formTitle = `Imported Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/, '') || 'Data'}`;
        formDescription = `Form created from ${file?.name} import with ${columns.length} fields and ${csvData.length} data rows`;
      }

      const formData = {
        title: formTitle,
        description: formDescription,
        fields: formFields,
        isSurvey: isSurveyData,
        sourceFile: file?.name,
        importType: file?.name?.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX',
        importedAt: new Date().toISOString()
      };

      navigate('/forms/new', { state: { importedData: formData }, replace: true });
    } catch (err) {
      console.error('Form import error:', err);
      setError(`Failed to create form: ${err.message || 'Unknown error occurred'}`);
    }
  };

  // ---------- Survey detection functions (unchanged) ----------
  const detectSurveyData = () => {
    if (csvData.length === 0 || columns.length === 0) return false;
    const surveyKeywords = [
      'question', 'answer', 'response', 'option', 'choice', 'rating', 'score',
      'satisfaction', 'feedback', 'comment', 'agree', 'disagree', 'strongly',
      'scale', 'range', 'multiple', 'single', 'yes', 'no', 'true', 'false',
      'likert', 'satisfied', 'dissatisfied', 'excellent', 'poor',
      'recommend', 'important', 'priority', 'frequency', 'always', 'never',
      'survey', 'poll', 'quiz', 'test', 'assessment'
    ];
    const columnNames = columns.map(col => col.toLowerCase());
    const hasSurveyKeywords = columnNames.some(col =>
      surveyKeywords.some(keyword => col.includes(keyword))
    );
    let surveyScore = 0;
    let maxScore = 0;
    const questionPatterns = columns.filter(col =>
      /q\d+|question|ques|what|when|how|why|which|where|who/.test(col.toLowerCase())
    );
    if (questionPatterns.length > 0) surveyScore += 2;
    maxScore += 2;
    const answerPatterns = columns.filter(col =>
      /answer|response|reply|feedback|comment|note/.test(col.toLowerCase())
    );
    if (answerPatterns.length > 0) surveyScore += 2;
    maxScore += 2;
    const limitedOptionsCount = columns.filter(col => {
      const uniqueValues = [...new Set(csvData.map(row => row[col]))].filter(val => val);
      return uniqueValues.length >= 2 && uniqueValues.length <= 8;
    }).length;
    if (limitedOptionsCount > 0) surveyScore += 1;
    maxScore += 1;
    const ratingScales = columns.filter(col => {
      const values = csvData.map(row => row[col]).filter(val => val);
      const numericValues = values.filter(val => !isNaN(val) && val !== '');
      return numericValues.length >= 3 &&
        Math.max(...numericValues) <= 10 &&
        Math.min(...numericValues) >= 1;
    }).length;
    if (ratingScales > 0) surveyScore += 1;
    maxScore += 1;
    const booleanColumns = columns.filter(col => {
      const uniqueValues = [...new Set(csvData.map(row => row[col]))].filter(val => val);
      const booleanValues = ['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'];
      return uniqueValues.length === 2 &&
        uniqueValues.every(val => booleanValues.includes(val.toString().toLowerCase()));
    }).length;
    if (booleanColumns > 0) surveyScore += 1;
    maxScore += 1;
    const confidence = maxScore > 0 ? (surveyScore / maxScore) : 0;
    return confidence >= 0.3;
  };

  const createSurveyFormFields = () => {
    return columns.map((column, index) => {
      const columnName = column.toLowerCase();
      const uniqueValues = [...new Set(csvData.map(row => row[column]))].filter(val => val);
      let fieldType = 'text';
      let options = [];
      if (uniqueValues.length === 2 &&
          uniqueValues.some(val => ['yes', 'no', 'true', 'false', '1', '0'].includes(val.toLowerCase()))) {
        fieldType = 'radio';
        options = uniqueValues;
      }
      else if (uniqueValues.length >= 3 && uniqueValues.length <= 10) {
        fieldType = 'select';
        options = uniqueValues;
      }
      else if (uniqueValues.some(val => !isNaN(val)) &&
               uniqueValues.some(val => Number(val) >= 1) &&
               uniqueValues.some(val => Number(val) <= 10)) {
        fieldType = 'radio';
        options = uniqueValues.filter(val => !isNaN(val)).sort((a, b) => Number(a) - Number(b));
      }
      else if (uniqueValues.some(val => val.length > 50)) {
        fieldType = 'textarea';
      }
      return {
        id: `field_${index}`,
        type: fieldType,
        label: column,
        required: columnName.includes('required') || columnName.includes('mandatory'),
        placeholder: `Enter ${column}`,
        options: options.length > 0 ? options : undefined
      };
    });
  };

  const handleBackToDashboard = () => navigate('/dashboard');

  // ---------- Main render ----------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-0 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="gap-1.5 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <h1 className="text-sm font-semibold text-slate-900 sm:text-base">ML Data Upload</h1>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden border-slate-200 text-[10px] text-slate-400 sm:inline-flex">
                PSM · SES Impact
              </Badge>
            </div>
          </div>
        </header>

        {/* How it works - only show when no file is uploaded */}
        {!file && !isLoading && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-300">How it works</p>
              <h2 className="mb-6 text-2xl font-bold">ML Analysis Pipeline</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-blue-300">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">1. Upload</h4>
                    <p className="text-sm text-blue-200">Drag & drop your CSV or XLSX file</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-indigo-300">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">2. Configure</h4>
                    <p className="text-sm text-blue-200">Select treatment, outcome & feature filter</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-emerald-300">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">3. Analyze</h4>
                    <p className="text-sm text-blue-200">Get PS scores, balance, SHAP & impact</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-purple-300">
                    <Save className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">4. Save</h4>
                    <p className="text-sm text-blue-200">Store or download results for later</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* File Upload Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Import File</h2>
                <p className="text-xs text-slate-500">Upload CSV or XLSX to prepare the analysis</p>
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

            {/* Drag & Drop */}
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 relative ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70 shadow-lg scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
              } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-slate-600">Processing file...</p>
                  </div>
                </div>
              )}
              <div className="space-y-5">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                  file ? 'bg-emerald-100' : 'bg-blue-100'
                }`}>
                  {file ? (
                    <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                  ) : (
                    <Upload className="w-10 h-10 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-slate-700 font-medium text-lg mb-1">
                    {file ? file.name : 'Drop your CSV or XLSX file here'}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {file
                      ? `Size: ${(file.size / 1024).toFixed(2)} KB`
                      : 'or click to browse (max 10MB)'
                    }
                  </p>
                </div>
                <div className="flex justify-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant={file ? "outline" : "default"}
                    className={`${file ? 'bg-white hover:bg-slate-50 border-slate-300' : 'bg-blue-600 hover:bg-blue-700 text-white'} shadow-sm transition-all`}
                    disabled={isLoading}
                  >
                    {file ? 'Change File' : <><Upload className="w-4 h-4 mr-2" /> Choose File</>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Configuration options */}
            {columns.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Group / Treatment Column
                  </Label>
                  <Select value={treatmentColumn} onValueChange={setTreatmentColumn}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col} className="text-sm">{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      {columns.map((col) => (
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
              </div>
            )}
          </div>
        </div>

        {/* Data Preview */}
        {csvData.length > 0 && showPreview && (() => {
          const totalPages = Math.ceil(csvData.length / ROWS_PER_PAGE);
          const pageData = csvData.slice(tablePage * ROWS_PER_PAGE, (tablePage + 1) * ROWS_PER_PAGE);
          return (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Data Preview</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {csvData.length.toLocaleString()} rows × {columns.length} cols
                </span>
              </div>
              {columns.length > 6 && (
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
            <div className="overflow-x-auto">
              <div className="max-h-96 overflow-y-auto" ref={tableRef} onScroll={handleTableScroll}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-20 bg-slate-50">
                    <tr>
                      {columns.map((column, index) => (
                        <th key={index} className="whitespace-nowrap border-b border-slate-200 px-6 py-3 text-left font-semibold text-slate-600">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pageData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="transition-colors hover:bg-slate-50/50">
                        {columns.map((column, colIndex) => (
                          <td key={colIndex} className="whitespace-nowrap px-6 py-3 text-sm text-slate-600">
                            {row[column] || <span className="text-slate-300">—</span>}
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
                  Showing {(tablePage * ROWS_PER_PAGE + 1).toLocaleString()}–{Math.min((tablePage + 1) * ROWS_PER_PAGE, csvData.length).toLocaleString()} of {csvData.length.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-slate-600">{tablePage + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))} disabled={tablePage >= totalPages - 1}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Empty state – only if no file */}
        {!file && !isLoading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Database className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No file uploaded yet</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Upload a CSV or XLSX file to begin propensity-score matching analysis.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {csvData.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleImportForm}
              variant="outline"
              className="gap-2 border-slate-200 text-sm"
            >
              <Import className="h-4 w-4" /> Create Form from CSV
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="gap-2 bg-blue-600 text-sm shadow-sm hover:bg-blue-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" /> Analyze Data
                </>
              )}
            </Button>
          </div>
        )}

        {/* Progress bar */}
        {isAnalyzing && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="w-full">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-slate-500 mt-1 text-center">Training in progress… {uploadProgress}%</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResults && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Analysis Results</h3>
                  <p className="text-xs text-slate-500">Results are ready to review</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadJSON} className="gap-1.5 text-slate-600">
                  <Download className="h-3.5 w-3.5" /> JSON
                </Button>
                <Button size="sm" onClick={() => setShowSaveModal(true)} className="gap-1.5 bg-blue-600 shadow-sm hover:bg-blue-700">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
            <div className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="output">Output</TabsTrigger>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                  <TabsTrigger value="impact">Impact</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="mt-4">{renderSummary()}</TabsContent>
                <TabsContent value="output" className="mt-4">{renderOutput()}</TabsContent>
                <TabsContent value="metrics" className="mt-4">{renderMetrics()}</TabsContent>
                <TabsContent value="impact" className="mt-4">{renderImpact()}</TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Save Analysis Results</h3>
            <p className="mb-5 text-sm text-slate-500">Store your results locally to access them later.</p>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Name *</Label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., Baseline Analysis 2026"
                  className="mt-1.5 h-11"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Description (optional)</Label>
                <Textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="What was this run about?"
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowSaveModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveResults} disabled={!saveName.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Save className="mr-1.5 h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MLUpload;