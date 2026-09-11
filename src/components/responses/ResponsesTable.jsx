import React, { useState, useMemo } from 'react';
import {
  Inbox, UserCheck, UserX, Search, X, Download,
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { normalizeLocationCodes, isReservedField, getQuestionLabel } from '../../lib/preprocessing';
import { getAnswerForQuestion as resolveAnswerForQuestion } from '../../lib/answerResolver';

const isNoAnswer = (val) => val === null || val === undefined || val === '' || val === '--' || (Array.isArray(val) && val.length === 0);

const normalizeQuestionCode = (question) =>
  String(question.code || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .replace(/^([A-Z])0+/, '$1');

const LOCATION_KEYS = [
  {
    key: 'municipality', label: 'Municipality',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A1' || code === 'A1AREA' || title === 'area' || title.includes('municipal');
    }
  },
  {
    key: 'barangay', label: 'Barangay',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A2' || title.includes('barangay') || title.includes('brgy');
    }
  },
  {
    key: 'province', label: 'Province',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A3' || title.includes('province') || title.includes('prov');
    }
  }
];

const SortIcon = ({ active, dir }) =>
  active ? (
    dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-cyan-600" />
      : <ChevronDown className="h-3 w-3 text-cyan-600" />
  ) : (
    <ChevronsUpDown className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
  );

const SortableTh = ({ label, colKey, sortConfig, onSort, rowSpan, className = '' }) => (
  <th
    rowSpan={rowSpan}
    className={`sticky top-0 z-10 bg-slate-50 px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 ${className}`}
  >
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className={`group inline-flex items-center gap-1 transition hover:text-slate-700 ${
        sortConfig.key === colKey ? 'text-cyan-700' : ''
      }`}
    >
      {label}
      <SortIcon active={sortConfig.key === colKey} dir={sortConfig.dir} />
    </button>
  </th>
);

const formatAnswerForTable = (ans) => isNoAnswer(ans) ? '—' : (Array.isArray(ans) ? ans.join(', ') : String(ans));

const getSectionsForForm = (form) => {
  if (!form) return [];
  if (form.sections && form.sections.length > 0) {
    if (!form.sections.some(section => section.section_type)) {
      return form.sections.map((section, index) => ({
        ...section,
        section_type: index === 0 ? 'demographics' : 'questionnaire',
      }));
    }
    return form.sections;
  }
  if (form.questions && form.questions.length > 0) {
    const groupMap = new Map();
    form.questions.forEach(q => {
      const sec = (q.section && q.section.trim()) ? q.section : 'Section 1';
      if (!groupMap.has(sec)) groupMap.set(sec, []);
      groupMap.get(sec).push(q);
    });
    return Array.from(groupMap.entries()).map(([title, questions], idx) => ({
      id: `section_${idx}`, title, section_type: idx === 0 ? 'demographics' : 'questionnaire', questions,
    }));
  }
  return [];
};

const getDemoSectionsForForm = (form) => {
  const sections = getSectionsForForm(form);
  return sections
    .filter(s => s.section_type === 'demographics')
    .map(sec => ({
      ...sec,
      questions: normalizeLocationCodes(
        (sec.questions || []).filter(q => !isReservedField(q) && q.type !== 'profile_photo')
      ),
    }))
    .filter(sec => (sec.questions || []).length > 0);
};

/**
 * Full-featured responses table (same layout as the project "Responses" tab):
 * source filter pills (All / Before / After), search bar, municipality filter,
 * sortable columns, CSV export and pagination. Used standalone in the Before
 * and After tabs and by the All Responses page.
 */
const ResponsesTable = ({
  project,
  beforeForm,
  afterForm,
  beforeResponses,
  afterResponses,
  initialFilter = 'all',
}) => {
  const isBaseline = project?.has_baseline !== false;
  const tabLabels = isBaseline
    ? { before: 'Before', after: 'After' }
    : { before: 'Beneficiary', after: 'Non-Beneficiary' };

  const [filterStatus, setFilterStatus] = useState(initialFilter); // 'all' | 'before' | 'after'
  const [searchQuery, setSearchQuery] = useState('');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const beforeSections = getSectionsForForm(beforeForm);
  const afterSections = getSectionsForForm(afterForm);

  const beforeQuestionCols = normalizeLocationCodes(beforeSections.flatMap(s => s.questions))
    .filter(q => !isReservedField(q) && q.type !== 'profile_photo');
  const afterQuestionCols = normalizeLocationCodes(afterSections.flatMap(s => s.questions))
    .filter(q => !isReservedField(q) && q.type !== 'profile_photo');

  const beforeDemoSections = getDemoSectionsForForm(beforeForm);
  const afterDemoSections = getDemoSectionsForForm(afterForm);
  const beforeDemoCols = beforeDemoSections.flatMap(s => s.questions || []);
  const afterDemoCols = afterDemoSections.flatMap(s => s.questions || []);

  const allFormQuestions = [...beforeQuestionCols, ...afterQuestionCols];

  const allResponses = useMemo(() => [
    ...(beforeResponses || []).map(r => ({ ...r, _source: 'before' })),
    ...(afterResponses || []).map(r => ({ ...r, _source: 'after' })),
  ], [beforeResponses, afterResponses]);

  const getAnswerForQuestion = (response, question, source) =>
    resolveAnswerForQuestion(response, question, {
      sections: source === 'before' ? beforeSections : afterSections,
    });

  const getBeneficiaryStatus = (response) => {
    const status = response.beneficiary_status;
    if (status === true) return 'Yes';
    if (status === false) return 'No';
    if (status === 'Yes' || status === 'No') return status;
    const rid = response.respondent_id || '';
    if (/^B-/i.test(rid)) return 'Yes';
    if (/^NB-/i.test(rid)) return 'No';
    const source = response._source;
    const form = source === 'before' ? beforeForm : afterForm;
    if (form?.has_baseline === false && form?.questionnaire_type) {
      return form.questionnaire_type === 'before' ? 'Yes' : 'No';
    }
    const allQs = (source === 'before' ? beforeSections : afterSections).flatMap(s => s.questions);
    const beneQ = allQs.find(
      q => String(q.code || '').trim().toUpperCase() === 'BENE' ||
        String(q.title || '').toLowerCase().includes('beneficiary')
    );
    if (beneQ) {
      const ans = getAnswerForQuestion(response, beneQ, source);
      if (ans === 'Yes') return 'Yes';
      if (ans === 'No') return 'No';
    }
    return source === 'before' ? 'Yes' : 'No';
  };

  const getResponseStatus = (response) => {
    if (isBaseline) {
      return response._source === 'before' ? tabLabels.before : tabLabels.after;
    }
    return getBeneficiaryStatus(response) === 'Yes' ? tabLabels.before : tabLabels.after;
  };

  const getRespondentId = (response) => response.respondent_id || response.id || '—';

  const getLocationForRow = (response, key) => {
    if (!isNoAnswer(response[key])) return String(response[key]);
    const source = response._source;
    const questionCols = source === 'before' ? beforeQuestionCols : afterQuestionCols;
    const demoQs = source === 'before' ? beforeDemoCols : afterDemoCols;
    const searchIn = [...demoQs, ...questionCols];
    const field = LOCATION_KEYS.find(f => f.key === key);
    if (field) {
      const question = searchIn.find(field.matches);
      if (question) {
        const ans = getAnswerForQuestion(response, question, source);
        if (!isNoAnswer(ans)) return formatAnswerForTable(ans);
      }
    }
    return '—';
  };

  const toggleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const getSortValue = (response, key) => {
    if (key.startsWith('q:')) {
      const [srcPrefix, qid] = key.split(':').slice(1);
      const qCols = srcPrefix === 'b' ? beforeQuestionCols : afterQuestionCols;
      const question = qCols.find(q => q.id === qid);
      return question ? formatAnswerForTable(getAnswerForQuestion(response, question, srcPrefix === 'b' ? 'before' : 'after')).toLowerCase() : '';
    }
    if (key.startsWith('dp:')) {
      const [srcPrefix, qid] = key.split(':').slice(1);
      const dCols = srcPrefix === 'b' ? beforeDemoCols : afterDemoCols;
      const question = dCols.find(q => q.id === qid);
      return question ? formatAnswerForTable(getAnswerForQuestion(response, question, srcPrefix === 'b' ? 'before' : 'after')).toLowerCase() : '';
    }
    switch (key) {
      case 'submitted': return response.submitted_at?._seconds || 0;
      case 'respondent_id': return String(getRespondentId(response)).toLowerCase();
      case 'name': return (response.full_name || '').toLowerCase();
      case 'source': return response._source || '';
      case 'status': {
        return getResponseStatus(response).toLowerCase();
      }
      case 'municipality':
      case 'barangay':
      case 'province':
        return getLocationForRow(response, key).toLowerCase();
      default: return '';
    }
  };

  let filteredResponses = allResponses.filter(r => {
    if (filterStatus === 'all') return true;
    return filterStatus === 'before' ? r._source === 'before' : r._source === 'after';
  }).filter(r => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      String(getRespondentId(r)).toLowerCase().includes(query) ||
      (r.full_name || '').toLowerCase().includes(query) ||
      getLocationForRow(r, 'municipality').toLowerCase().includes(query) ||
      getLocationForRow(r, 'barangay').toLowerCase().includes(query) ||
      getLocationForRow(r, 'province').toLowerCase().includes(query)
    );
  });

  if (municipalityFilter !== 'all') {
    filteredResponses = filteredResponses.filter(r => getLocationForRow(r, 'municipality') === municipalityFilter);
  }
  if (sortConfig.key) {
    filteredResponses = [...filteredResponses].sort((a, b) => {
      const av = getSortValue(a, sortConfig.key);
      const bv = getSortValue(b, sortConfig.key);
      let cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }

  const beforeCount = allResponses.filter(r => r._source === 'before').length;
  const afterCount = allResponses.filter(r => r._source === 'after').length;

  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / rowsPerPage));
  const start = (currentPage - 1) * rowsPerPage;
  const paginated = filteredResponses.slice(start, start + rowsPerPage);
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  };

  const municipalityOptions = Array.from(
    new Set(allResponses.map(r => getLocationForRow(r, 'municipality')).filter(v => v && v !== '—'))
  ).sort((a, b) => a.localeCompare(b));

  const downloadCSV = () => {
    if (filteredResponses.length === 0) { toast.error('No responses to download'); return; }
    const headers = [
      '#', 'Source', 'Submitted At', 'Respondent ID', 'Respondent Name',
      'Municipality', 'Barangay', 'Province', 'Status',
      ...allFormQuestions.map((q, idx) => getQuestionLabel(q, idx)),
    ];
    const rows = filteredResponses.map((response, rowIdx) => {
      const submittedAt = response.submitted_at?._seconds
        ? new Date(response.submitted_at._seconds * 1000).toLocaleString() : 'No date';
      const status = getResponseStatus(response);
      return [
        rowIdx + 1,
        response._source === 'before' ? tabLabels.before : tabLabels.after,
        submittedAt,
        getRespondentId(response),
        response.full_name || '',
        getLocationForRow(response, 'municipality'),
        getLocationForRow(response, 'barangay'),
        getLocationForRow(response, 'province'),
        status || '',
        ...allFormQuestions.map(q => {
          const rawAns = getAnswerForQuestion(response, q, response._source);
          return String(formatAnswerForTable(rawAns));
        }),
      ];
    });
    const escapeCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCell).join(','), ...rows.map(row => row.map(escapeCell).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project?.title || 'project').replace(/\s+/g, '_')}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  const showingFrom = filteredResponses.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + rowsPerPage, filteredResponses.length);

  return (
    <div className="w-full space-y-8">
      {/* Controls Bar */}
      <section className="rounded-2xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All <span className="ml-1 text-xs opacity-70">{allResponses.length}</span>
            </button>
            <button
              type="button"
              onClick={() => { setFilterStatus('before'); setCurrentPage(1); }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filterStatus === 'before'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {tabLabels.before} <span className="ml-1 text-xs opacity-70">{beforeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => { setFilterStatus('after'); setCurrentPage(1); }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filterStatus === 'after'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              {tabLabels.after} <span className="ml-1 text-xs opacity-70">{afterCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search responses..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-cyan-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 sm:w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select value={municipalityFilter} onValueChange={(v) => { setMunicipalityFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-40 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700">
                <SelectValue placeholder="All Municipalities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Municipalities</SelectItem>
                {municipalityOptions.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {municipalityFilter !== 'all' && (
              <button
                onClick={() => { setMunicipalityFilter('all'); setCurrentPage(1); }}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={downloadCSV}
              disabled={filteredResponses.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      {allResponses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
            <Inbox className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No responses yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
            Share the form links with respondents to start collecting data.
          </p>
        </div>
      ) : filteredResponses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
            <Search className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No results found</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Pagination Top Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Rows per page:</span>
              <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-16 rounded-lg border-slate-200 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-800">{showingFrom}–{showingTo}</span> of{' '}
              <span className="font-semibold text-slate-800">{filteredResponses.length}</span>
            </span>
          </div>

          {/* Data Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50/80">
                    <SortableTh label="Submitted At" colKey="submitted" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Source" colKey="source" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Respondent ID" colKey="respondent_id" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Name" colKey="name" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Municipality" colKey="municipality" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Barangay" colKey="barangay" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Province" colKey="province" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    <SortableTh label="Status" colKey="status" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                    {beforeQuestionCols.length > 0 && (
                      <th colSpan={beforeQuestionCols.length} className="sticky top-0 z-10 border-b border-slate-200 bg-blue-100/90 px-5 py-2.5 text-center text-xs font-bold text-blue-700 backdrop-blur-sm">
                        {tabLabels.before} Questions
                      </th>
                    )}
                    {afterQuestionCols.length > 0 && (
                      <th colSpan={afterQuestionCols.length} className="sticky top-0 z-10 border-b border-slate-200 bg-purple-100/90 px-5 py-2.5 text-center text-xs font-bold text-purple-700 backdrop-blur-sm">
                        {tabLabels.after} Questions
                      </th>
                    )}
                  </tr>
                  <tr>
                    {beforeQuestionCols.map((q, qIdx) => (
                      <th key={`b-${q.id}`} className="sticky top-[37px] z-10 bg-slate-50/80 px-6 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-r border-slate-200/80">
                        <span className="truncate">{getQuestionLabel(q, qIdx)}</span>
                      </th>
                    ))}
                    {afterQuestionCols.map((q, qIdx) => (
                      <th key={`a-${q.id}`} className="sticky top-[37px] z-10 bg-slate-50/80 px-6 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-r border-slate-200/80">
                        <span className="truncate">{getQuestionLabel(q, beforeQuestionCols.length + qIdx)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((resp, rowIdx) => {
                    const submittedAt = resp.submitted_at?._seconds ? new Date(resp.submitted_at._seconds * 1000).toLocaleString() : 'No date';
                    const status = getResponseStatus(resp);
                    const respondentId = getRespondentId(resp);
                    const source = resp._source;

                    return (
                      <tr key={resp.id || `${source}-${rowIdx}`} className={`transition hover:bg-cyan-50/30 ${rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{submittedAt}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            source === 'before'
                              ? 'bg-blue-50 text-blue-700 ring-blue-200/60'
                              : 'bg-purple-50 text-purple-700 ring-purple-200/60'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${source === 'before' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                            {source === 'before' ? tabLabels.before : tabLabels.after}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{respondentId}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">{resp.full_name || '—'}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'municipality')}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'barangay')}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'province')}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {status === tabLabels.before ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {tabLabels.before}
                            </span>
                          ) : status === tabLabels.after ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {tabLabels.after}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200/60">—</span>
                          )}
                        </td>
                        {beforeQuestionCols.map((q) => {
                          if (source !== 'before') {
                            return <td key={`b-${q.id}`} className="max-w-[180px] truncate px-6 py-4 text-sm text-slate-300">—</td>;
                          }
                          const ans = getAnswerForQuestion(resp, q, 'before');
                          return (
                            <td key={`b-${q.id}`} className="max-w-[180px] truncate px-6 py-4 text-sm text-slate-600 border-r border-slate-200/80" title={formatAnswerForTable(ans)}>
                              {formatAnswerForTable(ans)}
                            </td>
                          );
                        })}
                        {afterQuestionCols.map((q) => {
                          if (source !== 'after') {
                            return <td key={`a-${q.id}`} className="max-w-[180px] truncate px-6 py-4 text-sm text-slate-300">—</td>;
                          }
                          const ans = getAnswerForQuestion(resp, q, 'after');
                          return (
                            <td key={`a-${q.id}`} className="max-w-[180px] truncate px-6 py-4 text-sm text-slate-600 border-r border-slate-200/80" title={formatAnswerForTable(ans)}>
                              {formatAnswerForTable(ans)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-1">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium shadow-sm transition ${
                    page === currentPage
                      ? 'border border-slate-900 bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResponsesTable;