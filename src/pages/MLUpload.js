import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, Database, BarChart3, ArrowLeft, Import, ChevronLeft, ChevronRight, FileText, TrendingUp, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';

const MLUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [showPreview, setShowPreview] = useState(false);
  
  // Scroll state for table
  const [scrollPosition, setScrollPosition] = useState(0);
  const tableRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      validateAndProcessFile(selectedFile);
    }
  };

  // Validate and process file
  const validateAndProcessFile = (file) => {
    setError(null);
    
    // Validate file object
    if (!file || typeof file !== 'object') {
      setError('Invalid file selected');
      return;
    }
    
    // Check file name
    if (!file.name || file.name.trim() === '') {
      setError('File name is required');
      return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`);
      return;
    }
    
    if (file.size === 0) {
      setError('File is empty');
      return;
    }
    
    // Check file extension with better validation
    const fileName = file.name.toLowerCase().trim();
    const isCSV = fileName.endsWith('.csv');
    const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    
    if (!isCSV && !isXLSX) {
      setError(`Unsupported file type: ${fileName.split('.').pop() || 'unknown'}. Only CSV and XLSX files are supported`);
      return;
    }
    
    // Check for common invalid file patterns
    const invalidPatterns = [
      /\.(exe|bat|cmd|com|pif|scr|msi|dll|vbs|js|jar|app|deb|pkg|dmg|img|pdf)$/i
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(fileName))) {
      setError('Invalid file type. Please upload only CSV or XLSX files');
      return;
    }
    
    setFile(file);
    setShowPreview(false);
    
    try {
      if (isCSV) {
        parseCSV(file);
      } else if (isXLSX) {
        parseXLSX(file);
      }
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error('File processing error:', err);
    }
  };

  // Parse CSV file
  const parseCSV = (file) => {
    setIsLoading(true);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        
        if (!text.trim()) {
          setError('CSV file is empty');
          setIsLoading(false);
          return;
        }
        
        // Better CSV parsing that handles quoted commas
        const rows = parseCSVRows(text);
        
        if (rows.length === 0) {
          setError('No valid data found in CSV');
          setIsLoading(false);
          return;
        }
        
        // Extract headers
        const headers = rows[0].map(header => header.trim());
        
        // Filter out empty headers
        const validHeaders = headers.filter(header => header.length > 0);
        
        if (validHeaders.length === 0) {
          setError('No valid column headers found');
          setIsLoading(false);
          return;
        }
        
        setColumns(validHeaders);
        
        // Extract data rows
        const data = rows.slice(1).map(row => {
          const rowObj = {};
          validHeaders.forEach((header, index) => {
            rowObj[header] = row[index] || '';
          });
          return rowObj;
        }).filter(row => Object.values(row).some(value => value.trim())); // Filter empty rows
        
        setCsvData(data);
        setCurrentPage(1); // Reset to first page when new data is loaded
        setIsLoading(false);
        
      } catch (err) {
        setError('Failed to parse CSV file. Please check the file format.');
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };

  // Parse XLSX file
  const parseXLSX = (file) => {
    setIsLoading(true);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xlsxData = new Uint8Array(e.target.result);
        
        // Performance optimization: limit sheet reading for large files
        const readOptions = {
          type: 'array',
          cellDates: false,
          cellStyles: false
        };
        
        const workbook = XLSX.read(xlsxData, readOptions);
        
        // Get first worksheet (performance optimization)
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON format with performance options
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          blankrows: false
        });
        
        if (!jsonData || jsonData.length === 0) {
          setError('XLSX file is empty or has no valid data');
          setIsLoading(false);
          return;
        }
        
        // Extract and validate headers
        const firstRow = jsonData[0];
        const headers = Object.keys(firstRow).map(key => 
          firstRow[key] !== undefined && firstRow[key] !== null 
            ? firstRow[key].toString().trim() 
            : ''
        ).filter(header => header.length > 0);
        
        if (headers.length === 0) {
          setError('No valid column headers found in XLSX file');
          setIsLoading(false);
          return;
        }
        
        setColumns(headers);
        
        // Process data rows with performance optimization
        const processedData = jsonData.slice(1).map((row, index) => {
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
        }).filter(row => 
          Object.values(row).some(value => value && value.toString().trim())
        );
        
        setCsvData(processedData);
        setCurrentPage(1);
        setIsLoading(false);
        
      } catch (err) {
        console.error('XLSX parsing error:', err);
        setError(`Failed to parse XLSX file: ${err.message || 'Invalid file format'}`);
        setIsLoading(false);
      }
    };
    
    reader.onerror = (error) => {
      console.error('File reading error:', error);
      setError('Failed to read XLSX file. Please try again.');
      setIsLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Better CSV parsing that handles quoted fields
  const parseCSVRows = (text) => {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' && !inQuotes) {
        // Row separator
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    // Add last field and row
    if (currentField.trim() || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) {
        rows.push(currentRow);
      }
    }
    
    return rows;
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndProcessFile(droppedFile);
    }
  };

  // Scroll handling functions
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

  // Get max scroll width
  const getMaxScroll = () => {
    if (!tableRef.current) return 0;
    return tableRef.current.scrollWidth - tableRef.current.clientWidth;
  };

  // Calculate scroll percentage for display
  const getScrollPercentage = () => {
    const maxScroll = getMaxScroll();
    if (maxScroll <= 0) return 0;
    return Math.round((scrollPosition / maxScroll) * 100);
  };

  // Handle analyze button click
  const handleAnalyze = async () => {
    if (csvData.length === 0) {
      setError('No data available to analyze');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    setShowPreview(true);
    
    try {
      // Simulate ML analysis processing with progressive feedback
      const startTime = Date.now();
      
      // Step 1: Data validation (quick)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Pattern recognition (medium)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 3: Analysis completion (quick)
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const analysisTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Generate consistent mock results based on actual data
      const mockResults = {
        summary: {
          totalRows: csvData.length,
          totalColumns: columns.length,
          dataTypes: columns.map(col => {
            const uniqueValues = [...new Set(csvData.map(row => row[col]))];
            const nullCount = csvData.filter(row => !row[col]).length;
            return {
              name: col,
              type: uniqueValues.length <= 10 ? 'categorical' : 'text',
              uniqueValues: uniqueValues.length,
              nullCount: nullCount,
              completeness: ((csvData.length - nullCount) / csvData.length * 100).toFixed(1)
            };
          }),
          completeness: Math.floor(csvData.reduce((acc, row) => {
            const nonNullCount = columns.filter(col => row[col]).length;
            return acc + (nonNullCount / columns.length);
          }, 0) / csvData.length * 100),
          analysisTime: `${analysisTime}s`
        },
        output: {
          predictions: csvData.slice(0, Math.min(5, csvData.length)).map((row, index) => {
            // Generate more realistic predictions based on data patterns
            const score = Math.random();
            const prediction = score > 0.6 ? 'Positive' : score > 0.3 ? 'Neutral' : 'Negative';
            return {
              id: index + 1,
              input: row,
              prediction: prediction,
              confidence: (0.7 + Math.random() * 0.25).toFixed(3)
            };
          }),
          modelAccuracy: (0.85 + Math.random() * 0.1).toFixed(3),
          confidence: (0.75 + Math.random() * 0.2).toFixed(3)
        },
        metrics: {
          accuracy: (0.85 + Math.random() * 0.1).toFixed(3),
          precision: (0.82 + Math.random() * 0.12).toFixed(3),
          recall: (0.80 + Math.random() * 0.15).toFixed(3),
          f1Score: (0.81 + Math.random() * 0.12).toFixed(3),
          rocAuc: (0.88 + Math.random() * 0.08).toFixed(3)
        }
      };
      
      setAnalysisResults(mockResults);
      setActiveTab('summary');
    } catch (err) {
      setError('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  // Handle import form from CSV/XLSX
  const handleImportForm = () => {
    if (csvData.length === 0 || columns.length === 0) {
      setError('No data available to import');
      return;
    }
    
    // Clear any existing errors
    setError(null);
    
    try {
      // Detect if this is survey questionnaire data
      const isSurveyData = detectSurveyData();
      
      // Create form structure from data
      let formFields;
      let formTitle;
      let formDescription;
      
      if (isSurveyData) {
        // Handle survey questionnaire data
        formFields = createSurveyFormFields();
        formTitle = `Survey Form - ${file?.name?.replace(/\.(csv|xlsx|xls)$/, '') || 'Survey Data'}`;
        formDescription = `Survey questionnaire created from ${file?.name} with ${columns.length} questions and ${csvData.length} responses`;
      } else {
        // Handle regular data
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

      // Navigate to form builder with pre-filled data
      navigate('/forms/new', { 
        state: { importedData: formData },
        replace: true // Ensure clean navigation
      });
    } catch (err) {
      console.error('Form import error:', err);
      setError(`Failed to create form: ${err.message || 'Unknown error occurred'}`);
    }
  };

  // Detect if data represents a survey questionnaire
  const detectSurveyData = () => {
    if (csvData.length === 0 || columns.length === 0) return false;
    
    // Enhanced survey keyword detection
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
    
    // Improved survey pattern detection
    let surveyScore = 0;
    let maxScore = 0;
    
    // Check for question patterns in column names
    const questionPatterns = columns.filter(col => 
      /q\d+|question|ques|what|when|how|why|which|where|who/.test(col.toLowerCase())
    );
    if (questionPatterns.length > 0) surveyScore += 2;
    maxScore += 2;
    
    // Check for answer/response patterns
    const answerPatterns = columns.filter(col => 
      /answer|response|reply|feedback|comment|note/.test(col.toLowerCase())
    );
    if (answerPatterns.length > 0) surveyScore += 2;
    maxScore += 2;
    
    // Check for limited unique values (multiple choice)
    const limitedOptionsCount = columns.filter(col => {
      const uniqueValues = [...new Set(csvData.map(row => row[col]))].filter(val => val);
      return uniqueValues.length >= 2 && uniqueValues.length <= 8;
    }).length;
    if (limitedOptionsCount > 0) surveyScore += 1;
    maxScore += 1;
    
    // Check for rating scales
    const ratingScales = columns.filter(col => {
      const values = csvData.map(row => row[col]).filter(val => val);
      const numericValues = values.filter(val => !isNaN(val) && val !== '');
      return numericValues.length >= 3 && 
        Math.max(...numericValues) <= 10 && 
        Math.min(...numericValues) >= 1;
    }).length;
    if (ratingScales > 0) surveyScore += 1;
    maxScore += 1;
    
    // Check for boolean patterns
    const booleanColumns = columns.filter(col => {
      const uniqueValues = [...new Set(csvData.map(row => row[col]))].filter(val => val);
      const booleanValues = ['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'];
      return uniqueValues.length === 2 && 
        uniqueValues.every(val => booleanValues.includes(val.toString().toLowerCase()));
    }).length;
    if (booleanColumns > 0) surveyScore += 1;
    maxScore += 1;
    
    // Calculate confidence score
    const confidence = maxScore > 0 ? (surveyScore / maxScore) : 0;
    
    // Return true if confidence is above threshold
    return confidence >= 0.3; // 30% confidence threshold
  };

  // Create form fields optimized for survey data
  const createSurveyFormFields = () => {
    return columns.map((column, index) => {
      const columnName = column.toLowerCase();
      const uniqueValues = [...new Set(csvData.map(row => row[column]))].filter(val => val);
      
      // Determine field type based on column data
      let fieldType = 'text';
      let options = [];
      
      // Check for boolean/yes-no responses
      if (uniqueValues.length === 2 && 
          uniqueValues.some(val => ['yes', 'no', 'true', 'false', '1', '0'].includes(val.toLowerCase()))) {
        fieldType = 'radio';
        options = uniqueValues;
      }
      // Check for multiple choice (3-10 options)
      else if (uniqueValues.length >= 3 && uniqueValues.length <= 10) {
        fieldType = 'select';
        options = uniqueValues;
      }
      // Check for rating scales (1-5, 1-10)
      else if (uniqueValues.some(val => !isNaN(val)) && 
               uniqueValues.some(val => Number(val) >= 1) && 
               uniqueValues.some(val => Number(val) <= 10)) {
        fieldType = 'radio';
        options = uniqueValues.filter(val => !isNaN(val)).sort((a, b) => Number(a) - Number(b));
      }
      // Check for text responses
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

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handleBackToDashboard}
          variant="outline"
          className="bg-white hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center justify-center gap-3">
            <BarChart3 className="w-10 h-10 text-blue-600" />
            Machine Learning Analysis
          </h1>
          <p className="text-slate-600 text-lg">Upload your CSV data for intelligent analysis</p>
        </div>
        <div className="w-32"></div> {/* Spacer for centering */}
      </div>

        {/* File Upload Section */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Upload className="w-5 h-5" />
              Import File
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                  <div className="ml-auto pl-3">
                    <button
                      onClick={() => setError(null)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 relative ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-slate-600">Processing CSV file...</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-slate-700 font-medium mb-2">
                    {file ? file.name : 'Drop your CSV or XLSX file here or click to browse'}
                  </p>
                  <p className="text-slate-500 text-sm">
                    Supports CSV and XLSX files (max 10MB)
                  </p>
                  {file && (
                    <p className="text-xs text-slate-400 mt-1">
                      Size: {(file.size / 1024).toFixed(2)} KB
                    </p>
                  )}
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
                    variant="outline"
                    className="bg-white hover:bg-slate-50"
                    disabled={isLoading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Preview */}
        {csvData.length > 0 && showPreview && (
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
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
                {columns.length > 6 && (
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                )}
                {columns.length > 6 && (
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                )}
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
                      {csvData.map((row, rowIndex) => (
                        <tr 
                          key={rowIndex} 
                          className={`hover:bg-slate-50 transition-colors ${
                            rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          {columns.map((column, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap min-w-[140px]"
                            >
                              {row[column] || (
                                <span className="text-slate-400 italic">—</span>
                              )}
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

        {/* Empty State */}
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
                Upload a CSV file above to see your data preview and begin analysis
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {csvData.length > 0 && (
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleImportForm}
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Import className="w-5 h-5 mr-2" />
              Create Form from CSV
            </Button>
            <Button
              onClick={handleAnalyze}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Analyze Data
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MLUpload;
