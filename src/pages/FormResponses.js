import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Menu, Download, ChevronLeft, ChevronRight, FileSpreadsheet,
  Inbox, Users, UserCheck, UserX, Search, X, IdCard,
  LayoutDashboard, BarChart3, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { generateAssessmentHeaders, mapResponseToAssessmentColumns, normalizeLocationCodes, getQuestionLabel, isReservedField } from '../lib/preprocessing';

// ==================== UTILITY FUNCTIONS ====================
const isNoAnswer = (val) => !val || val === '' || val === '--' || (Array.isArray(val) && val.length === 0);

const isBeneficiaryQuestion = (question) =>
  String(question.code || '').trim().toUpperCase() === 'BENE' ||
  String(question.title || '').toLowerCase().includes('beneficiary');

const normalizeQuestionCode = (question) =>
  String(question.code || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .replace(/^([A-Z])0+/, '$1');

const LOCATION_KEYS = [
  {
    key: 'municipality',
    label: 'Municipality',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A1' || code === 'A1AREA' || title === 'area' || title.includes('municipal');
    }
  },
  {
    key: 'barangay',
    label: 'Barangay',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A2' || title.includes('barangay') || title.includes('brgy');
    }
  },
  {
    key: 'province',
    label: 'Province',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A3' || title.includes('province') || title.includes('prov');
    }
  }
];

// Sort indicator for table headers
const SortIcon = ({ active, dir }) =>
  active ? (
    dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-cyan-600" />
      : <ChevronDown className="h-3 w-3 text-cyan-600" />
  ) : (
    <ChevronsUpDown className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
  );

// Sortable table header cell (supports rowSpan for the two-row header)
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

const getNumericAnswer = (answer, question) => {
  if (isNoAnswer(answer)) return '—';

  if (question.type === 'checkboxes' && Array.isArray(answer)) {
    const indices = answer
      .map(opt => {
        const idx = (question.options || []).findIndex(o => o === opt);
        return idx !== -1 ? idx + 1 : null;
      })
      .filter(i => i !== null);
    return indices.length ? indices.join(',') : '—';
  }

  if (['multiple_choice', 'dropdown'].includes(question.type)) {
    const idx = (question.options || []).findIndex(o => o === answer);
    return idx !== -1 ? (idx + 1).toString() : answer;
  }

  return answer;
};

// ==================== MAIN COMPONENT ====================
const FormResponses = ({ embedded = false }) => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const backState = location.state;
  const outletCtx = useOutletContext();
  const [searchParams] = useSearchParams();

  // Standalone mode: params.id is the FORM id.
  // Embedded mode (inside the project dashboard layout): params.id is the
  // PROJECT id and the form id comes from the outlet context (?type=before|after)
  const qType = searchParams.get('type') || backState?.questionnaire_type || 'before';
  const projectId = embedded ? params.id : backState?.project_id;
  const id = embedded
    ? (outletCtx?.project
        ? (qType === 'after' ? outletCtx.project.after_form : outletCtx.project.before_form) || ''
        : '')
    : params.id;

  const goBack = () => {
    if (embedded && projectId) {
      navigate(`/projects/${projectId}/${qType === 'after' ? 'after' : 'before'}`);
    } else if (backState?.project_id) {
      navigate(`/projects/${backState.project_id}/${backState.questionnaire_type === 'after' ? 'after' : 'before'}`);
    } else {
      navigate('/dashboard');
    }
  };
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [municipalityFilter, setMunicipalityFilter] = useState('all');

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', action: () => { setNavOpen(false); goBack(); } },
    { icon: FileSpreadsheet, label: 'View Responses', action: () => { setNavOpen(false); navigate(`/forms/${id}/responses`, { state: backState }); } },
    { icon: IdCard, label: 'View Profiles', action: () => { setNavOpen(false); navigate(`/forms/${id}/profiles`, { state: backState }); } },
    { icon: BarChart3, label: 'Analytics', action: () => { setNavOpen(false); navigate(`/forms/${id}/analytics`, { state: backState }); } },
  ];

  const fetchData = useCallback(async () => {
    if (!id) return; // embedded mode: waiting for project context to load
    try {
      const [formRes, responsesRes] = await Promise.all([
        api.get(`/forms/${id}`),
        api.get(`/forms/${id}/responses`)
      ]);
      const fetchedForm = formRes.data;
      setForm(fetchedForm);
      setResponses(responsesRes.data);

      let formSections = [];
      if (fetchedForm.sections && fetchedForm.sections.length > 0) {
        formSections = fetchedForm.sections;
      } else if (fetchedForm.questions && fetchedForm.questions.length > 0) {
        const groupMap = new Map();
        fetchedForm.questions.forEach(q => {
          const sectionName = (q.section && q.section.trim()) ? q.section : 'Section 1';
          if (!groupMap.has(sectionName)) groupMap.set(sectionName, []);
          groupMap.get(sectionName).push(q);
        });
        formSections = Array.from(groupMap.entries()).map(([title, questions], idx) => ({
          id: `section_${idx}`,
          title,
          questions
        }));
      } else {
        formSections = [{ id: 'default', title: 'Section 1', questions: [] }];
      }
      setSections(formSections);
    } catch (error) {
      toast.error('Failed to fetch responses');
      goBack();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAnswerForQuestion = (response, question) => {
    const answersArray = response.answers || [];
    const matched = answersArray.find(a => a.question_id === question.id || a.qid === question.id);
    if (matched && !isNoAnswer(matched.answer)) return matched.answer;
    const byTitle = answersArray.find(a => a.question_title === question.title);
    if (byTitle && !isNoAnswer(byTitle.answer)) return byTitle.answer;
    if (answersArray.length && typeof answersArray[0] !== 'object') {
      const allQs = sections.flatMap(s => s.questions);
      const idx = allQs.findIndex(q => q.id === question.id);
      if (idx >= 0 && idx < answersArray.length && !isNoAnswer(answersArray[idx])) return answersArray[idx];
    }
    return null;
  };

  const formatAnswerForTable = (ans) => isNoAnswer(ans) ? '—' : (Array.isArray(ans) ? ans.join(', ') : String(ans));

  const getBeneficiaryStatus = (response) => {
    const status = response.beneficiary_status;
    if (status === true) return 'Yes';
    if (status === false) return 'No';
    if (status === 'Yes' || status === 'No') return status;
    const id = response.respondent_id || '';
    if (/^B-/i.test(id)) return 'Yes';
    if (/^NB-/i.test(id)) return 'No';
    // No Baseline: derive from form's questionnaire_type
    if (form?.has_baseline === false && form?.questionnaire_type) {
      return form.questionnaire_type === 'before' ? 'Yes' : 'No';
    }
    const beneQuestion = sections.flatMap(s => s.questions).find(isBeneficiaryQuestion);
    if (beneQuestion) {
      const ans = getAnswerForQuestion(response, beneQuestion);
      if (ans === 'Yes') return 'Yes';
      if (ans === 'No') return 'No';
    }
    return null;
  };

  useEffect(() => {
    const filtered = responses.filter(r => {
      if (filterStatus === 'all') return true;
      const status = getBeneficiaryStatus(r);
      return filterStatus === 'yes' ? status === 'Yes' : status === 'No';
    });
    const pages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    setCurrentPage((page) => Math.min(page, pages));
  }, [responses, filterStatus, rowsPerPage, municipalityFilter, sortConfig]);

  const getRespondentIdForRow = (response) => {
    if (response.respondent_id) return response.respondent_id;
    return response.id || '—';
  };

  const downloadCSV = () => {
    if (filteredResponses.length === 0) {
      toast.error('No responses to download');
      return;
    }

    // Exclude reserved fields and photos — images are already shown in View Profiles
    const questionCols = normalizeLocationCodes(sections.flatMap(s => s.questions))
      .filter(q => !isReservedField(q) && q.type !== 'profile_photo');

    const headers = [
      '#',
      'Submitted At',
      'Respondent ID',
      'Respondent Name',
      'Municipality',
      'Barangay',
      'Province',
      'Status',
      ...questionCols.map((q, idx) => getQuestionLabel(q, idx))
    ];

    const rows = filteredResponses.map((response, rowIdx) => {
      const submittedAt = response.submitted_at?._seconds
        ? new Date(response.submitted_at._seconds * 1000).toLocaleString()
        : 'No date';
      const status = getBeneficiaryStatus(response);

      return [
        rowIdx + 1,
        submittedAt,
        getRespondentIdForRow(response),
        response.full_name || '',
        getLocationForRow(response, 'municipality') === '—' ? '' : getLocationForRow(response, 'municipality'),
        getLocationForRow(response, 'barangay') === '—' ? '' : getLocationForRow(response, 'barangay'),
        getLocationForRow(response, 'province') === '—' ? '' : getLocationForRow(response, 'province'),
        status || '',
        ...questionCols.map(q => {
          const rawAns = getAnswerForQuestion(response, q);
          const numericAns = getNumericAnswer(rawAns, q);
          return String(numericAns);
        })
      ];
    });

    const escapeCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escapeCell).join(','),
      ...rows.map(row => row.map(escapeCell).join(','))
    ];
    const csv = csvLines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(form.title || 'form').replace(/\s+/g, '_')}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  if (loading) {
    return embedded ? (
      <div className="flex items-center justify-center py-20 text-slate-500">Loading responses...</div>
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading responses...</div>
    );
  }
  if (!form) return null;

  const allQuestionCols = normalizeLocationCodes(sections.flatMap(s => s.questions));
  const tableSections = sections
    .map(sec => ({
      ...sec,
      // Hide reserved fields and the photo upload (redundant with View Profiles)
      questions: sec.questions.filter(q =>
        !isReservedField(q) &&
        q.type !== 'profile_photo'
      )
    }))
    .filter(sec => sec.questions.length > 0);
  const allQuestions = normalizeLocationCodes(tableSections.flatMap(s => s.questions));

  const getLocationForRow = (response, key) => {
    if (!isNoAnswer(response[key])) return String(response[key]);
    const field = LOCATION_KEYS.find(f => f.key === key);
    if (field) {
      const question = allQuestionCols.find(field.matches);
      if (question) {
        const ans = getAnswerForQuestion(response, question);
        if (!isNoAnswer(ans)) return formatAnswerForTable(ans);
      }
    }
    return '—';
  };

  const beneficiaryCount = responses.filter(r => getBeneficiaryStatus(r) === 'Yes').length;
  const nonBeneficiaryCount = responses.filter(r => getBeneficiaryStatus(r) === 'No').length;

  const toggleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const getSortValue = (response, key) => {
    if (key.startsWith('q:')) {
      const question = allQuestions.find(q => `q:${q.id}` === key);
      return question ? formatAnswerForTable(getAnswerForQuestion(response, question)).toLowerCase() : '';
    }
    switch (key) {
      case 'submitted': return response.submitted_at?._seconds || 0;
      case 'respondent_id': return String(getRespondentIdForRow(response)).toLowerCase();
      case 'name': return (response.full_name || '').toLowerCase();
      case 'status': {
        const s = getBeneficiaryStatus(response);
        return s === 'Yes' ? 2 : s === 'No' ? 1 : 0;
      }
      case 'municipality':
      case 'barangay':
      case 'province':
        return getLocationForRow(response, key).toLowerCase();
      default: return '';
    }
  };

  // Unique municipality values for the filter dropdown
  const municipalityOptions = Array.from(
    new Set(
      responses
        .map(r => getLocationForRow(r, 'municipality'))
        .filter(v => v && v !== '—')
    )
  ).sort((a, b) => a.localeCompare(b));

  let responseList = responses.filter(r => {
    if (filterStatus === 'all') return true;
    const status = getBeneficiaryStatus(r);
    return filterStatus === 'yes' ? status === 'Yes' : status === 'No';
  }).filter(r => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const respondentId = getRespondentIdForRow(r);
    const name = (r.full_name || '').toLowerCase();
    const municipality = getLocationForRow(r, 'municipality').toLowerCase();
    const barangay = getLocationForRow(r, 'barangay').toLowerCase();
    const province = getLocationForRow(r, 'province').toLowerCase();
    return (
      String(respondentId).toLowerCase().includes(query) ||
      name.includes(query) ||
      municipality.includes(query) ||
      barangay.includes(query) ||
      province.includes(query)
    );
  });

  if (municipalityFilter !== 'all') {
    responseList = responseList.filter(r => getLocationForRow(r, 'municipality') === municipalityFilter);
  }

  if (sortConfig.key) {
    responseList = [...responseList].sort((a, b) => {
      const av = getSortValue(a, sortConfig.key);
      const bv = getSortValue(b, sortConfig.key);
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }

  const filteredResponses = responseList;

  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / rowsPerPage));
  const start = (currentPage - 1) * rowsPerPage;
  const paginated = filteredResponses.slice(start, start + rowsPerPage);
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  let colIdx = 0;
  const sectionLastIndices = [];
  tableSections.forEach(section => {
    colIdx += section.questions.length;
    sectionLastIndices.push(colIdx - 1);
  });

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const showingFrom = filteredResponses.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + rowsPerPage, filteredResponses.length);

  // ==================== LOADING STATE ====================
  if (loading) {
    return embedded ? (
      <div className="flex items-center justify-center py-20 text-slate-500">Loading responses...</div>
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading responses...</div>
    );
  }
  return (
    <div className={embedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100'}>
      {/* Header (standalone mode only — the project layout provides the navbar) */}
      {!embedded && (
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="relative flex w-full items-center justify-between px-3 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              title="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="max-w-xs truncate text-sm font-semibold text-slate-800">
              {form.title}
            </h1>
          </div>
          {navOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNavOpen(false)} />
              <div className="absolute left-6 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(`/forms/${id}/profiles`, { state: backState })}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
            >
              <IdCard className="h-4 w-4" />
              <span className="hidden sm:inline">View Profiles</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {responses.length} {responses.length === 1 ? 'response' : 'responses'}
            </span>
          </div>
        </div>
      </header>
      )}

      <main className={embedded ? '' : 'w-full px-3 py-6 pb-24 sm:px-4'}>
        {/* Page Title Banner */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="relative px-6 py-5 sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-100 to-blue-50 opacity-60 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-50 to-teal-50 opacity-50 blur-2xl" />
            <div className="relative">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-600">Form Responses</p>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{form.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Respondents grouped by section — answers are converted to numeric values when exporting to CSV.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <section className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-50 opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Responses</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{responses.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-50 opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Beneficiaries</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-600">{beneficiaryCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-50 opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Non-Beneficiaries</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-amber-600">{nonBeneficiaryCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <UserX className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </section>

        {/* Controls Bar */}
        <section className="mb-5 rounded-2xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm">
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
                All <span className="ml-1 text-xs opacity-70">{responses.length}</span>
              </button>
              <button
                type="button"
                onClick={() => { setFilterStatus('yes'); setCurrentPage(1); }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  filterStatus === 'yes'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Beneficiaries <span className="ml-1 text-xs opacity-70">{beneficiaryCount}</span>
              </button>
              <button
                type="button"
                onClick={() => { setFilterStatus('no'); setCurrentPage(1); }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  filterStatus === 'no'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Non-Beneficiaries <span className="ml-1 text-xs opacity-70">{nonBeneficiaryCount}</span>
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

              {/* Municipality Filter */}
              <Select
                value={municipalityFilter}
                onValueChange={(v) => { setMunicipalityFilter(v); setCurrentPage(1); }}
              >
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
                  title="Clear municipality filter"
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

        {/* Empty State */}
        {responses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No responses yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              Share the form link with respondents to start collecting data. Responses will appear here in real time.
            </p>
          </div>
        ) : filteredResponses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No results found</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              Try adjusting your search or filter criteria to find what you're looking for.
            </p>
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
                Showing{' '}
                <span className="font-semibold text-slate-800">{showingFrom}–{showingTo}</span>{' '}
                of{' '}
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
                      <SortableTh label="Respondent ID" colKey="respondent_id" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                      <SortableTh label="Respondent Name" colKey="name" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                      <SortableTh label="Municipality" colKey="municipality" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                      <SortableTh label="Barangay" colKey="barangay" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                      <SortableTh label="Province" colKey="province" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                      <SortableTh label="Status" colKey="status" sortConfig={sortConfig} onSort={toggleSort} rowSpan={2} />
                      {tableSections.map(section => (
                        <th key={section.id} colSpan={section.questions.length} className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/90 px-5 py-2.5 text-center text-xs font-bold text-slate-600 backdrop-blur-sm">
                          {section.title}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {tableSections.flatMap((section, secIdx) =>
                        section.questions.map((q, qIdx) => {
                          const isLastCol = (secIdx === tableSections.length - 1 && qIdx === section.questions.length - 1);
                          const colKey = `q:${q.id}`;
                          const isActive = sortConfig.key === colKey;
                          return (
                            <th key={q.id} className={`sticky top-[37px] z-10 bg-slate-50/80 px-6 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm ${!isLastCol ? 'border-r border-slate-200/80' : ''} ${isActive ? 'text-cyan-700' : 'text-slate-500'}`}>
                              <button
                                type="button"
                                onClick={() => toggleSort(colKey)}
                                className="group flex max-w-[180px] items-center gap-1 transition hover:text-slate-700"
                                title={getQuestionLabel(q, allQuestions.findIndex(qq => qq.id === q.id))}
                              >
                                <span className="truncate">{getQuestionLabel(q, allQuestions.findIndex(qq => qq.id === q.id))}</span>
                                <SortIcon active={isActive} dir={sortConfig.dir} />
                              </button>
                            </th>
                          );
                        })
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map((resp, rowIdx) => {
                      const submittedAt = resp.submitted_at?._seconds ? new Date(resp.submitted_at._seconds * 1000).toLocaleString() : 'No date';
                      const status = getBeneficiaryStatus(resp);
                      const respondentId = getRespondentIdForRow(resp);
                      return (
                        <tr key={resp.id} className={`transition hover:bg-cyan-50/30 ${rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{submittedAt}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{respondentId}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">{resp.full_name || '—'}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'municipality')}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'barangay')}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'province')}</td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {status === 'Yes' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Beneficiary
                              </span>
                            ) : status === 'No' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Non-Beneficiary
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200/60">—</span>
                            )}
                          </td>
                          {allQuestions.map((q, colIdx) => {
                            const ans = getAnswerForQuestion(resp, q);
                            const hasRightBorder = sectionLastIndices.includes(colIdx);
                            return (
                              <td key={q.id} className={`max-w-[180px] truncate px-6 py-4 text-sm text-slate-600 ${hasRightBorder ? 'border-r border-slate-200/80' : ''}`} title={formatAnswerForTable(ans)}>
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

                {pageNumbers[0] > 1 && (
                  <>
                    <button
                      onClick={() => goToPage(1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      1
                    </button>
                    {pageNumbers[0] > 2 && <span className="px-1 text-slate-400">...</span>}
                  </>
                )}

                {pageNumbers.map(page => (
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

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}
                    <button
                      onClick={() => goToPage(totalPages)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

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
      </main>
    </div>
  );
};

export default FormResponses;
