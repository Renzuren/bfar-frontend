import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileSpreadsheet, Database, BarChart3, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, AlertCircle, Loader2,
  XCircle, Filter, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import MLAnalyticsPanel from '../components/MLAnalyticsPanel';
import AutoChartsReport from '../components/AutoChartsReport';
import { resolveServiceUrl } from '../lib/apiBase';
import { fetchWithRetry } from '../lib/fetchRetry';
import { saveAnalysis } from '../lib/analysisStore';

const MLUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ML_API_URL = resolveServiceUrl(process.env.REACT_APP_ML_API_URL, 'http://localhost:8000');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Save-to-dashboard state
  const [analysisTitle, setAnalysisTitle] = useState('');
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  // Treatment, outcome, feature filter, and caliper
  const [treatmentColumn, setTreatmentColumn] = useState('');
  const [outcomeColumn, setOutcomeColumn] = useState('');
  const [excludeFeatures, setExcludeFeatures] = useState('');
  const [caliperRatio, setCaliperRatio] = useState(0.2);   // <-- NEW

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
        const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv' });
        fileToSend = new File([blob], file.name.replace(/\.xlsx$/i, '.csv'), { type: 'text/csv' });
      }

      const formData = new FormData();
      formData.append('file', fileToSend);
      if (treatmentColumn) formData.append('treatment_column', treatmentColumn);
      if (outcomeColumn) formData.append('outcome_column', outcomeColumn);
      if (excludeFeatures.trim()) formData.append('exclude_features', excludeFeatures.trim());
      formData.append('caliper_ratio', String(caliperRatio));   // <-- NEW

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
      setAnalysisResults(result);
      // Show the columns that were actually used — when the user left them on
      // "Auto-detect", the backend picks them, so surface the real names here.
      if (result && result.treatment_column) setTreatmentColumn(result.treatment_column);
      if (result && result.outcome_column) setOutcomeColumn(result.outcome_column);
      setAnalysisTitle(`Analysis · ${(file?.name || 'CSV Data').replace(/\.(csv|xlsx|xls)$/i, '')}`);
      setSavedAnalysisId(null);
      setSaveMessage('');
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

  const handleBackToDashboard = () => navigate('/dashboard');

  // ---------- Save analysis to dashboard ----------
  const handleSaveAnalysis = async () => {
    if (!analysisResults) return;
    setSavingAnalysis(true);
    setSaveMessage('');
    try {
      const saved = await saveAnalysis({
        title: analysisTitle.trim() || `Analysis · ${(file?.name || 'CSV Data').replace(/\.(csv|xlsx|xls)$/i, '')}`,
        fileName: file?.name || '',
        analysisResults,
        columns,
        rows: csvData,
        treatmentColumn,
        outcomeColumn,
        caliperRatio,
      });
      if (saved) {
        setSavedAnalysisId(saved.id);
        setSaveMessage(saved.alreadySaved
          ? `Naka-save na ang analysis na ito sa dashboard mo${saved.title ? ` ("${saved.title}")` : ''}.`
          : 'Analysis saved to your dashboard.');
      } else {
        setSaveMessage('Could not save the analysis. Check your connection and try again.');
      }
    } finally {
      setSavingAnalysis(false);
    }
  };

  // ---------- Main render ----------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-3 pb-24 pt-0 sm:px-4">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between px-4 py-4 sm:px-5">
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
              <h2 className="mb-6 text-2xl font-bold">No Baseline ML Analysis Pipeline</h2>
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

            {/* Configuration options - now with Caliper Ratio */}
            {columns.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
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
                    Exclude Columns
                  </Label>
                  <Input
                    value={excludeFeatures}
                    onChange={(e) => setExcludeFeatures(e.target.value)}
                    placeholder="e.g. K, L, I5"
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
            )}
          </div>
        </div>

        {/* Data Preview */}
        {csvData.length > 0 && (() => {
          const totalPages = Math.ceil(csvData.length / ROWS_PER_PAGE);
          const pageData = csvData.slice(tablePage * ROWS_PER_PAGE, (tablePage + 1) * ROWS_PER_PAGE);
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
                  {csvData.length.toLocaleString()} rows × {columns.length} cols
                </span>
              </div>
              {showPreview && columns.length > 6 && (
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
              </>
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

{/* Save to Dashboard */}
        {analysisResults && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-900">Save to Dashboard</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Name this analysis so it appears on your dashboard.
                </p>
                <Input
                  value={analysisTitle}
                  onChange={(e) => setAnalysisTitle(e.target.value)}
                  placeholder="e.g., Fisherfolk Income Impact 2026"
                  className="mt-3 h-10 max-w-md text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                {savedAnalysisId && (
                  <button
                    onClick={() => navigate(`/ml-analysis/${savedAnalysisId}`)}
                    className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    View saved analysis →
                  </button>
                )}
                {/* One run is saved once; a new run resets this. */}
                <Button
                  onClick={handleSaveAnalysis}
                  disabled={savingAnalysis || Boolean(savedAnalysisId)}
                  className="gap-2 bg-slate-900 text-sm shadow-sm hover:bg-slate-800"
                >
                  {savingAnalysis ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savedAnalysisId ? 'Saved ✓' : 'Save to Dashboard'}
                </Button>
              </div>
            </div>
            {saveMessage && (
              <p className="mt-3 text-xs font-medium text-emerald-600">{saveMessage}</p>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {analysisResults && (
          <MLAnalyticsPanel
            analysisResults={analysisResults}
            columns={columns}
            rows={csvData}
            treatmentColumn={treatmentColumn}
            defaultTab="summary"
          />
        )}

        {/* Auto charts (computed live from the data preview) */}
        {csvData.length > 0 && (
          <AutoChartsReport columns={columns} rows={csvData} treatmentColumn={analysisResults?.treatment_column || treatmentColumn} />
        )}
      </div>
    </div>
  );
};

export default MLUpload;