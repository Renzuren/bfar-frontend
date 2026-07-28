import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileSpreadsheet, Database, BarChart3, ArrowLeft, Import,
  ChevronLeft, ChevronRight, TrendingUp, Activity, AlertCircle,
  CheckCircle2, XCircle, Filter, Zap, Layers, ShieldCheck,
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

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  const [scrollPosition, setScrollPosition] = useState(0);
  const tableRef = useRef(null);

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
        const data = rows.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] || '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value.trim()));
        setCsvData(data);
        setCurrentPage(1);
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
        const processedData = jsonData.slice(1).map(row => {
          const rowObj = {};
          headers.forEach((header, headerIndex) => {
            const cellKey = Object.keys(row).find(key =>
              row[key] !== undefined && row[key] !== null
            );
            const cellValue = cellKey ? row[cellKey] : '';
            rowObj[header] = cellValue !== undefined && cellValue !== null
              ? cellValue.toString()
              : '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value && value.toString().trim()));
        setCsvData(processedData);
        setCurrentPage(1);
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
      const newScrollPosition = Math.max(0, scrollPosition - 200);
      tableRef.current.scrollLeft = newScrollPosition;
      setScrollPosition(newScrollPosition);
    }
  };
  const handleScrollRight = () => {
    if (tableRef.current) {
      const maxScroll = tableRef.current.scrollWidth - tableRef.current.clientWidth;
      const newScrollPosition = Math.min(maxScroll, scrollPosition + 200);
      tableRef.current.scrollLeft = newScrollPosition;
      setScrollPosition(newScrollPosition);
    }
  };
  const handleTableScroll = (e) => {
    const newScrollPosition = e.target.scrollLeft;
    setScrollPosition(newScrollPosition);
  };
  const getMaxScroll = () => {
    if (!tableRef.current) return 0;
    return tableRef.current.scrollWidth - tableRef.current.clientWidth;
  };
  const getScrollPercentage = () => {
    const maxScroll = getMaxScroll();
    if (maxScroll <= 0) return 0;
    return Math.round((scrollPosition / maxScroll) * 100);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Rows</div>
              <div className="text-2xl font-bold">{rows}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Treatment Column</div>
              <div className="text-lg font-semibold truncate">{treatment_column || 'N/A'}</div>
              <div className="text-xs text-slate-400">{treatment_detection_method}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Retrained</div>
              <div className="flex items-center gap-2">
                {retrained ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-amber-500" />}
                <span>{retrained ? 'Yes (new model)' : 'No (reused existing)'}</span>
              </div>
              <div className="text-xs text-slate-400">Attempts: {retrain_attempts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Features Selected</div>
              <div className="text-2xl font-bold">{feature_selection?.n_features_selected || 0}</div>
            </CardContent>
          </Card>
        </div>

        {importanceData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 15 Feature Importances</CardTitle>
            </CardHeader>
            <CardContent>
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
                            <div className="bg-white border rounded p-2 shadow text-sm">
                              <p className="font-medium">{data.fullName || data.name}</p>
                              <p>Importance: {data.importance.toFixed(4)}</p>
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
            </CardContent>
          </Card>
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
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-slate-500">Min</div>
              <div className="text-lg font-semibold">{ps_output?.ps_summary?.min?.toFixed(4)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-slate-500">Max</div>
              <div className="text-lg font-semibold">{ps_output?.ps_summary?.max?.toFixed(4)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-slate-500">Mean</div>
              <div className="text-lg font-semibold">{ps_output?.ps_summary?.mean?.toFixed(4)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-slate-500">Median</div>
              <div className="text-lg font-semibold">{ps_output?.ps_summary?.median?.toFixed(4)}</div>
            </CardContent>
          </Card>
        </div>

        {psData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Propensity Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {decision_support && decision_support.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision Support (PS Quartiles)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1 border">Group</th>
                      <th className="px-2 py-1 border">Count</th>
                      <th className="px-2 py-1 border">Mean PS</th>
                      <th className="px-2 py-1 border">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decision_support.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1 border">{row.ps_group}</td>
                        <td className="px-2 py-1 border text-center">{row.count}</td>
                        <td className="px-2 py-1 border text-center">{row.mean_ps?.toFixed(4)}</td>
                        <td className="px-2 py-1 border">{row.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Balance Achieved</div>
                  <div className="flex items-center gap-2 mt-1">
                    {covariate_balance.balance_achieved ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-semibold">{covariate_balance.balance_achieved ? 'Yes' : 'No'}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Mean |SMD|</div>
                  <div className="text-lg font-semibold">{covariate_balance.mean_abs_smd?.toFixed(4)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Matched Pairs</div>
                  <div className="text-lg font-semibold">{covariate_balance.matched_pairs}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Caliper</div>
                  <div className="text-lg font-semibold">{covariate_balance.caliper?.toFixed(4)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Overlap (Treated in Control)</div>
                  <div className="text-lg font-semibold">{covariate_balance.overlap?.treated_in_control_range_pct?.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Overlap (Control in Treated)</div>
                  <div className="text-lg font-semibold">{covariate_balance.overlap?.control_in_treated_range_pct?.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>

            {smdData.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Standardized Mean Differences (SMD) – Before vs After Matching</CardTitle>
                </CardHeader>
                <CardContent>
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
                                <div className="bg-white border rounded p-2 shadow text-sm">
                                  <p className="font-medium">{data.fullName || data.name}</p>
                                  <p>Before: {data.before.toFixed(4)}</p>
                                  <p>After: {data.after.toFixed(4)}</p>
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
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {model_interpretation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model Interpretation (SHAP)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">{model_interpretation.method}</p>
              <div className="max-h-60 overflow-y-auto border rounded p-2">
                <ul className="text-sm space-y-1">
                  {model_interpretation.feature_contributions?.slice(0, 15).map((item, idx) => (
                    <li key={idx} className="flex justify-between border-b border-slate-100 py-1">
                      <span className="truncate">{item.feature}</span>
                      <span className="font-mono">
                        {item.mean_abs_shap?.toFixed(4)} ({item.direction === 'increases_likelihood' ? '⬆' : '⬇'})
                      </span>
                    </li>
                  ))}
                  {model_interpretation.feature_contributions?.length > 15 && (
                    <li className="text-slate-400 text-xs">… and {model_interpretation.feature_contributions.length - 15} more</li>
                  )}
                </ul>
              </div>
              {model_interpretation.socioeconomic_insights && (
                <div className="mt-4 bg-slate-50 p-3 rounded border">
                  <h5 className="font-medium text-sm">Insights</h5>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {model_interpretation.socioeconomic_insights.map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Average Treatment Effect on the Treated (ATT)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Mean ATT</div>
                  <div className="text-2xl font-bold text-blue-600">{att_result.att_mean?.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">95% CI</div>
                  <div className="text-sm font-mono">
                    [{att_result.ci_95?.[0]?.toFixed(4)}, {att_result.ci_95?.[1]?.toFixed(4)}]
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">p‑value (paired t‑test)</div>
                  <div className="text-lg font-semibold">{att_result.p_value_paired_ttest?.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Matched Pairs</div>
                  <div className="text-lg font-semibold">{att_result.matched_pairs}</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-2">Caliper: {att_result.caliper?.toFixed(4)}</div>
            </CardContent>
          </Card>
        )}

        {/* Profiling Summary Cards */}
        {profiling_summary && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-xs text-slate-500">Increased</div>
                  <div className="text-2xl font-bold text-green-700">{profiling_summary.increased_count}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-red-600" />
                <div>
                  <div className="text-xs text-slate-500">Decreased</div>
                  <div className="text-2xl font-bold text-red-700">{profiling_summary.decreased_count}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Minus className="w-8 h-8 text-slate-500" />
                <div>
                  <div className="text-xs text-slate-500">No Change</div>
                  <div className="text-2xl font-bold text-slate-700">{profiling_summary.no_change_count}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Profile Updates Table with bars */}
        {profile_updates && profile_updates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                Pre‑Post Change Profile (Treated vs Control)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2 border text-left">Feature</th>
                      <th className="px-2 py-2 border text-center" colSpan="3">Treated</th>
                      <th className="px-2 py-2 border text-center" colSpan="3">Control</th>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <th className="px-2 py-1 border"></th>
                      <th className="px-2 py-1 border text-xs text-green-600">↑</th>
                      <th className="px-2 py-1 border text-xs text-red-600">↓</th>
                      <th className="px-2 py-1 border text-xs text-slate-400">–</th>
                      <th className="px-2 py-1 border text-xs text-green-600">↑</th>
                      <th className="px-2 py-1 border text-xs text-red-600">↓</th>
                      <th className="px-2 py-1 border text-xs text-slate-400">–</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile_updates.map((item, idx) => {
                      const tTotal = item.treated.total || 1;
                      const cTotal = item.control.total || 1;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-2 py-2 border font-medium">{item.feature}</td>
                          {/* Treated bars */}
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.increased}</span>
                              <div className="w-12 h-2 bg-green-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500"
                                  style={{ width: `${(item.treated.increased / tTotal) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.decreased}</span>
                              <div className="w-12 h-2 bg-red-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-red-500"
                                  style={{ width: `${(item.treated.decreased / tTotal) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.treated.no_change}</span>
                              <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-400"
                                  style={{ width: `${(item.treated.no_change / tTotal) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          {/* Control bars */}
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.increased}</span>
                              <div className="w-12 h-2 bg-green-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500"
                                  style={{ width: `${(item.control.increased / cTotal) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.decreased}</span>
                              <div className="w-12 h-2 bg-red-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-red-500"
                                  style={{ width: `${(item.control.decreased / cTotal) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-xs">{item.control.no_change}</span>
                              <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-400"
                                  style={{ width: `${(item.control.no_change / cTotal) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Optional: expandable pair profiles */}
        {pair_profiles && pair_profiles.length > 0 && (
          <details className="border rounded-lg p-4 bg-slate-50/50">
            <summary className="font-medium cursor-pointer hover:text-blue-600">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View matched pair details ({pair_profiles.length} pairs)
              </span>
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 border">Pair</th>
                    <th className="px-2 py-1 border">Treated ID</th>
                    <th className="px-2 py-1 border">Control ID</th>
                    <th className="px-2 py-1 border">Treated Outcome</th>
                    <th className="px-2 py-1 border">Control Outcome</th>
                    <th className="px-2 py-1 border">Difference</th>
                    <th className="px-2 py-1 border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pair_profiles.slice(0, 50).map((pair, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1 border text-center">{idx + 1}</td>
                      <td className="px-2 py-1 border">{pair.treated_index}</td>
                      <td className="px-2 py-1 border">{pair.control_index}</td>
                      <td className="px-2 py-1 border">{pair.treated_outcome?.toFixed(2)}</td>
                      <td className="px-2 py-1 border">{pair.control_outcome?.toFixed(2)}</td>
                      <td className="px-2 py-1 border">{pair.outcome_difference?.toFixed(2)}</td>
                      <td className="px-2 py-1 border">
                        <Badge variant={pair.status === 'Increased' ? 'success' : pair.status === 'Decreased' ? 'destructive' : 'secondary'}>
                          {pair.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {pair_profiles.length > 50 && (
                    <tr><td colSpan="7" className="text-center text-slate-400 py-2">… and {pair_profiles.length - 50} more</td></tr>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button
            onClick={handleBackToDashboard}
            variant="outline"
            className="bg-white/80 backdrop-blur-sm hover:bg-white border-slate-200 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center space-y-1">
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center gap-3">
              <BarChart3 className="w-10 h-10 text-blue-600" />
              ML Analysis
            </h1>
            <p className="text-slate-600 text-md">Upload your dataset for propensity‑score matching</p>
          </div>
          <div className="w-32 hidden md:block"></div>
        </div>

        {/* How it works - only show when no file is uploaded */}
        {!file && !isLoading && (
          <Card className="border-0 shadow-sm bg-white/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">1. Upload</h4>
                    <p className="text-sm text-slate-500">Drag & drop your CSV or XLSX file</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">2. Configure</h4>
                    <p className="text-sm text-slate-500">Select treatment, outcome & feature filter</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">3. Analyze</h4>
                    <p className="text-sm text-slate-500">Get PS scores, balance, SHAP & impact</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                    <Save className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">4. Save</h4>
                    <p className="text-sm text-slate-500">Store or download results for later</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Upload Card */}
        <Card className="shadow-xl border-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 to-indigo-50/30 pointer-events-none" />
          <CardHeader className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200/50">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Upload className="w-5 h-5 text-blue-600" />
              Import File
            </CardTitle>
          </CardHeader>
          <CardContent className="relative p-6">
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
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/60 rounded-xl border border-slate-200/50">
                <div>
                  <Label htmlFor="treatmentCol" className="text-slate-700 font-medium">
                    Treatment <span className="text-xs font-normal text-slate-400">(optional)</span>
                  </Label>
                  <select
                    id="treatmentCol"
                    value={treatmentColumn}
                    onChange={(e) => setTreatmentColumn(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Auto‑detect</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="outcomeCol" className="text-slate-700 font-medium">
                    Outcome <span className="text-xs font-normal text-slate-400">(optional)</span>
                  </Label>
                  <select
                    id="outcomeCol"
                    value={outcomeColumn}
                    onChange={(e) => setOutcomeColumn(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Auto‑detect</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="includeFeatures" className="text-slate-700 font-medium">
                    <span className="flex items-center gap-1">
                      <Filter className="w-4 h-4" /> Include only
                    </span>
                  </Label>
                  <Input
                    id="includeFeatures"
                    value={includeFeatures}
                    onChange={(e) => setIncludeFeatures(e.target.value)}
                    placeholder="Feature1, Feature2, ..."
                    className="mt-1 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Preview - same as before */}
        {csvData.length > 0 && showPreview && (
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800">
                  <Database className="w-5 h-5" />
                  Data Preview ({csvData.length} rows, {columns.length} columns)
                </div>
                {columns.length > 6 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleScrollLeft}
                      disabled={scrollPosition <= 0}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-500 min-w-[60px] text-center">
                      {getScrollPercentage()}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleScrollRight}
                      disabled={getScrollPercentage() >= 99}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative rounded-lg border overflow-hidden">
                <div
                  className="h-96 overflow-x-auto overflow-y-auto"
                  ref={tableRef}
                  onScroll={handleTableScroll}
                >
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-20">
                      <tr>
                        {columns.map((column, index) => (
                          <th
                            key={index}
                            className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider border-b bg-slate-50 whitespace-nowrap min-w-[140px]"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {csvData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                          {columns.map((column, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap min-w-[140px]"
                            >
                              {row[column] || <span className="text-slate-400 italic">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state – only if no file */}
        {!file && !isLoading && (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-slate-50 to-slate-100">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <Database className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No file uploaded yet
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Upload a CSV or XLSX file above to begin your analysis.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {csvData.length > 0 && (
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              onClick={handleImportForm}
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
            >
              <Import className="w-5 h-5 mr-2" />
              Create Form from CSV
            </Button>
            <Button
              onClick={handleAnalyze}
              size="lg"
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Training Model...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Analyze Data
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
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Analysis Results
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadJSON}
                  className="bg-white hover:bg-slate-50"
                >
                  <Download className="w-4 h-4 mr-1" /> JSON
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="w-4 h-4 mr-1" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
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
            </CardContent>
          </Card>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="w-5 h-5" />
                Save Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="saveName">Name *</Label>
                <Input
                  id="saveName"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., BFAR baseline 2026-07-27"
                />
              </div>
              <div>
                <Label htmlFor="saveDesc">Description (optional)</Label>
                <Textarea
                  id="saveDesc"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="What was this run about?"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveResults} disabled={!saveName.trim()}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MLUpload;