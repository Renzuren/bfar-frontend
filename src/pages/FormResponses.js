import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, ChevronLeft, ChevronRight, FileSpreadsheet,
  Inbox, Users, UserCheck, UserX, Search, X,
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
const FormResponses = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const backState = location.state;

  const goBack = () => {
    if (backState?.project_id) {
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

  const fetchData = useCallback(async () => {
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
  }, [responses, filterStatus, rowsPerPage]);

  const getRespondentIdForRow = (response) => {
    if (response.respondent_id) return response.respondent_id;
    return response.id || '—';
  };

  const downloadCSV = () => {
    if (filteredResponses.length === 0) {
      toast.error('No responses to download');
      return;
    }

    const questionCols = normalizeLocationCodes(sections.flatMap(s => s.questions)).filter(q => !isReservedField(q));

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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading responses...</div>;
  if (!form) return null;

  const allQuestionCols = normalizeLocationCodes(sections.flatMap(s => s.questions));
  const tableSections = sections
    .map(sec => ({ ...sec, questions: sec.questions.filter(q => !isReservedField(q)) }))
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

  const filteredResponses = responses.filter(r => {
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="group flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">{backState?.project_id ? 'Back' : 'Dashboard'}</span>
            </button>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <h1 className="hidden max-w-xs truncate text-sm font-semibold text-slate-800 sm:block">
              {form.title}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {responses.length} {responses.length === 1 ? 'response' : 'responses'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
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
        <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition hover:shadow-md">
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

          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition hover:shadow-md">
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

          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition hover:shadow-md">
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
        <section className="mb-5 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
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
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Submitted At</th>
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Respondent ID</th>
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Respondent Name</th>
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Municipality</th>
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Barangay</th>
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Province</th>
                      <th rowSpan={2} className="sticky top-0 z-10 bg-slate-50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
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
                          return (
                            <th key={q.id} className={`sticky top-[37px] z-10 bg-slate-50/80 px-5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm ${!isLastCol ? 'border-r border-slate-200/80' : ''}`}>
                              <div className="max-w-[180px] truncate" title={getQuestionLabel(q, allQuestions.findIndex(qq => qq.id === q.id))}>
                                {getQuestionLabel(q, allQuestions.findIndex(qq => qq.id === q.id))}
                              </div>
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
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-500">{submittedAt}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-slate-900">{respondentId}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-slate-800">{resp.full_name || '—'}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{getLocationForRow(resp, 'municipality')}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{getLocationForRow(resp, 'barangay')}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{getLocationForRow(resp, 'province')}</td>
                          <td className="whitespace-nowrap px-5 py-3.5">
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
                              <td key={q.id} className={`max-w-[180px] truncate px-5 py-3.5 text-sm text-slate-600 ${hasRightBorder ? 'border-r border-slate-200/80' : ''}`} title={formatAnswerForTable(ans)}>
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
