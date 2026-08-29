import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Menu, ChevronLeft, ChevronRight, Inbox, Users, UserCheck, UserX,
  Search, X, IdCard, LayoutDashboard, BarChart3, FileSpreadsheet,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { normalizeLocationCodes, isReservedField, getQuestionLabel } from '../lib/preprocessing';

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

const LOCATION_MATCHERS = {
  Municipality: (q) => {
    const code = normalizeQuestionCode(q);
    const title = String(q.title || '').toLowerCase();
    return code === 'A1' || code === 'A1AREA' || title === 'area' || title.includes('municipal');
  },
  Barangay: (q) => {
    const code = normalizeQuestionCode(q);
    const title = String(q.title || '').toLowerCase();
    return code === 'A2' || title.includes('barangay') || title.includes('brgy');
  },
  Province: (q) => {
    const code = normalizeQuestionCode(q);
    const title = String(q.title || '').toLowerCase();
    return code === 'A3' || title.includes('province') || title.includes('prov');
  },
};

// Sort indicator for table headers
const SortIcon = ({ active, dir }) =>
  active ? (
    dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-violet-600" />
      : <ChevronDown className="h-3 w-3 text-violet-600" />
  ) : (
    <ChevronsUpDown className="h-3 w-3 text-slate-300 transition group-hover:text-slate-500" />
  );

// Sortable table header cell
const SortableTh = ({ label, colKey, sortConfig, onSort, rowSpan }) => (
  <th rowSpan={rowSpan} className="sticky top-0 z-10 bg-slate-50 px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className={`group inline-flex items-center gap-1 transition hover:text-slate-700 ${
        sortConfig.key === colKey ? 'text-violet-700' : ''
      }`}
    >
      {label}
      <SortIcon active={sortConfig.key === colKey} dir={sortConfig.dir} />
    </button>
  </th>
);

// ==================== MAIN COMPONENT ====================
const FormProfiles = ({ embedded = false }) => {
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
    } else {
      navigate(`/forms/${id}/responses`, { state: backState });
    }
  };

  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demographicsQuestions, setDemographicsQuestions] = useState([]);
  const [demographicSections, setDemographicSections] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [municipalityFilter, setMunicipalityFilter] = useState('all');

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', action: () => { setNavOpen(false); navigate('/dashboard'); } },
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
        // Fallback convention: no explicit type => first section is demographics
        if (!formSections.some(s => s.section_type)) {
          formSections = formSections.map((sec, idx) => ({
            ...sec,
            section_type: idx === 0 ? 'demographics' : 'questionnaire'
          }));
        }
      } else if (fetchedForm.questions && fetchedForm.questions.length > 0) {
        formSections = [{
          id: 'default',
          title: 'Section 1',
          section_type: 'demographics',
          questions: fetchedForm.questions
        }];
      }

      const demoQs = normalizeLocationCodes(
        formSections
          .filter(sec => sec.section_type === 'demographics')
          .flatMap(sec => sec.questions || [])
      );
      setDemographicsQuestions(demoQs);

      const demoSections = formSections
        .filter(sec => sec.section_type === 'demographics')
        .map(sec => ({
          ...sec,
          questions: normalizeLocationCodes(
            (sec.questions || []).filter(q =>
              !isReservedField(q) && q.type !== 'profile_photo'
            )
          )
        }))
        .filter(sec => (sec.questions || []).length > 0);
      setDemographicSections(demoSections);
    } catch (error) {
      toast.error('Failed to fetch profiles');
      goBack();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAnswerForQuestion = useCallback((response, question) => {
    const answersArray = response.answers || [];
    const matched = answersArray.find(a => a.question_id === question.id || a.qid === question.id);
    if (matched && !isNoAnswer(matched.answer)) return matched.answer;
    const byTitle = answersArray.find(a => a.question_title === question.title);
    if (byTitle && !isNoAnswer(byTitle.answer)) return byTitle.answer;
    if (answersArray.length && typeof answersArray[0] !== 'object') {
      const idx = demographicsQuestions.findIndex(q => q.id === question.id);
      if (idx >= 0 && idx < answersArray.length && !isNoAnswer(answersArray[idx])) return answersArray[idx];
    }
    return null;
  }, [demographicsQuestions]);

  const formatAnswer = (ans) => isNoAnswer(ans) ? '—' : (Array.isArray(ans) ? ans.join(', ') : String(ans));

  const getBeneficiaryStatus = (response) => {
    const status = response.beneficiary_status;
    if (status === true) return 'Yes';
    if (status === false) return 'No';
    if (status === 'Yes' || status === 'No') return status;
    const rid = response.respondent_id || '';
    if (/^B-/i.test(rid)) return 'Yes';
    if (/^NB-/i.test(rid)) return 'No';
    if (form?.has_baseline === false && form?.questionnaire_type) {
      return form.questionnaire_type === 'before' ? 'Yes' : 'No';
    }
    const beneQuestion = demographicsQuestions.find(isBeneficiaryQuestion);
    if (beneQuestion) {
      const ans = getAnswerForQuestion(response, beneQuestion);
      if (ans === 'Yes') return 'Yes';
      if (ans === 'No') return 'No';
    }
    return null;
  };

  const getRespondentId = (response) => response.respondent_id || response.id || '—';

  const getSubmittedAt = (response) =>
    response.submitted_at?._seconds
      ? new Date(response.submitted_at._seconds * 1000).toLocaleString()
      : 'No date';

  // Resolve location values: top-level response fields first, then demographics questions
  const getLocationForRow = (response, label) => {
    const key = label.toLowerCase();
    if (!isNoAnswer(response[key])) return String(response[key]);
    const matcher = LOCATION_MATCHERS[label];
    if (matcher) {
      const question = demographicsQuestions.find(matcher);
      if (question) {
        const ans = getAnswerForQuestion(response, question);
        if (!isNoAnswer(ans)) return formatAnswer(ans);
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
    if (key.startsWith('dp:')) {
      const question = demoCols.find(q => `dp:${q.id}` === key);
      return question ? formatAnswer(getAnswerForQuestion(response, question)).toLowerCase() : '';
    }
    switch (key) {
      case 'submitted': return response.submitted_at?._seconds || 0;
      case 'respondent_id': return String(getRespondentId(response)).toLowerCase();
      case 'name': return (response.full_name || '').toLowerCase();
      case 'type': {
        const s = getBeneficiaryStatus(response);
        return s === 'Yes' ? 2 : s === 'No' ? 1 : 0;
      }
      case 'municipality':
      case 'barangay':
      case 'province':
        return getLocationForRow(response, key.charAt(0).toUpperCase() + key.slice(1)).toLowerCase();
      default: return '';
    }
  };

  // Unique municipality values for the filter dropdown
  const municipalityOptions = Array.from(
    new Set(
      responses
        .map(r => getLocationForRow(r, 'Municipality'))
        .filter(v => v && v !== '—')
    )
  ).sort((a, b) => a.localeCompare(b));

  // Demographic profile columns (from the form's demographics sections)
  const demoCols = demographicSections.flatMap(s => s.questions || []);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredCount / cardsPerPage));
    setCurrentPage((page) => Math.min(page, pages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, filterStatus, cardsPerPage, searchQuery, municipalityFilter, sortConfig]);

  let profileList = responses.filter(r => {
    if (filterStatus === 'all') return true;
    const status = getBeneficiaryStatus(r);
    return filterStatus === 'yes' ? status === 'Yes' : status === 'No';
  }).filter(r => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      getRespondentId(r).toLowerCase().includes(query) ||
      (r.full_name || '').toLowerCase().includes(query) ||
      demoCols.some(q => formatAnswer(getAnswerForQuestion(r, q)).toLowerCase().includes(query))
    );
  });

  if (municipalityFilter !== 'all') {
    profileList = profileList.filter(r => getLocationForRow(r, 'Municipality') === municipalityFilter);
  }

  if (sortConfig.key) {
    profileList = [...profileList].sort((a, b) => {
      const av = getSortValue(a, sortConfig.key);
      const bv = getSortValue(b, sortConfig.key);
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }

  const filteredProfiles = profileList;
  const filteredCount = filteredProfiles.length;

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / cardsPerPage));
  const start = (currentPage - 1) * cardsPerPage;
  const paginated = filteredProfiles.slice(start, start + cardsPerPage);
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

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
  const showingFrom = filteredProfiles.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + cardsPerPage, filteredProfiles.length);

  if (loading) {
    return embedded ? (
      <div className="flex items-center justify-center py-20 text-slate-500">Loading profiles...</div>
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading profiles...</div>
    );
  }
  if (!form) return null;

  // ==================== RENDER ====================
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
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200/60">
              <IdCard className="h-3.5 w-3.5" />
              {responses.length} {responses.length === 1 ? 'profile' : 'profiles'}
            </span>
          </div>
        </div>
      </header>
      )}

      <main className={embedded ? '' : 'w-full px-3 py-6 pb-24 sm:px-4'}>
        {/* Page Title Banner */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="relative px-6 py-5 sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-violet-100 to-blue-50 opacity-60 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-tr from-cyan-50 to-teal-50 opacity-50 blur-2xl" />
            <div className="relative">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-600">Respondent Profiles</p>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{form.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Demographic information and profile photos for each respondent.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <section className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-50 opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Profiles</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{responses.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
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
                  placeholder="Search profiles..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 sm:w-56"
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
            </div>
          </div>
        </section>

        {/* Empty State */}
        {responses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No profiles yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              Profiles appear here once respondents submit the form.
            </p>
          </div>
        ) : filteredProfiles.length === 0 ? (
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
                <span>Profiles per page:</span>
                <Select value={cardsPerPage.toString()} onValueChange={(v) => { setCardsPerPage(Number(v)); setCurrentPage(1); }}>
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
                <span className="font-semibold text-slate-800">{filteredProfiles.length}</span>
              </span>
            </div>

            {/* Profiles Table (tablets/desktop) */}
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <SortableTh label="Date/Time Submitted" colKey="submitted" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      <SortableTh label="Respondent ID" colKey="respondent_id" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      <SortableTh label="Name" colKey="name" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      <SortableTh label="Type" colKey="type" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      <SortableTh label="Municipality" colKey="municipality" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      <SortableTh label="Barangay" colKey="barangay" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      <SortableTh label="Province" colKey="province" sortConfig={sortConfig} onSort={toggleSort} rowSpan={demoCols.length ? 2 : undefined} />
                      {demographicSections.map(section => (
                        <th key={section.id} colSpan={section.questions.length} className="border-b border-slate-200 bg-slate-100/90 px-6 py-2.5 text-left text-xs font-bold text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-violet-500" />
                            {section.title}
                          </span>
                        </th>
                      ))}
                    </tr>
                    {demoCols.length > 0 && (
                      <tr>
                        {demoCols.map((q, qIdx) => (
                          <th
                            key={q.id}
                            className="sticky top-[37px] z-10 border-b border-r border-slate-200/80 bg-slate-50/80 px-6 py-2.5 text-left"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(`dp:${q.id}`)}
                              className={`group inline-flex max-w-full items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition hover:text-slate-700 ${
                                sortConfig.key === `dp:${q.id}` ? 'text-violet-700' : 'text-slate-500'
                              }`}
                            >
                              <span className="truncate">{getQuestionLabel(q, qIdx)}</span>
                              <SortIcon active={sortConfig.key === `dp:${q.id}`} dir={sortConfig.dir} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map((resp, idx) => {
                      const status = getBeneficiaryStatus(resp);
                      const name = resp.full_name || 'Unnamed';
                      return (
                        <tr key={resp.id || idx} className={`transition hover:bg-violet-50/30 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{getSubmittedAt(resp)}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{getRespondentId(resp)}</td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center gap-3">
                              {resp.profile_photo_url ? (
                                <img
                                  src={resp.profile_photo_url}
                                  alt={name}
                                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.classList.remove('hidden'); }}
                                />
                              ) : null}
                              <div className={`${resp.profile_photo_url ? 'hidden' : ''} flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-400 ring-1 ring-slate-200`}>
                                {(name || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-slate-800">{name}</span>
                            </div>
                          </td>
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
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'Municipality')}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'Barangay')}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{getLocationForRow(resp, 'Province')}</td>
                          {demoCols.map((q, qIdx) => {
                            const ans = getAnswerForQuestion(resp, q);
                            return (
                              <td
                                key={q.id}
                                className="max-w-[180px] truncate px-6 py-4 text-sm text-slate-600"
                                title={`${getQuestionLabel(q, qIdx)}: ${formatAnswer(ans)}`}
                              >
                                {formatAnswer(ans)}
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

            {/* Profiles Cards (mobile) */}
            <div className="space-y-4 md:hidden">
              {paginated.map((resp, idx) => {
                const status = getBeneficiaryStatus(resp);
                const name = resp.full_name || 'Unnamed';
                return (
                  <div key={resp.id || idx} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                      {resp.profile_photo_url ? (
                        <img
                          src={resp.profile_photo_url}
                          alt={name}
                          className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.classList.remove('hidden'); }}
                        />
                      ) : null}
                      <div className={`${resp.profile_photo_url ? 'hidden' : ''} flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-400 ring-1 ring-slate-200`}>
                        {(name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                        <p className="truncate text-xs text-slate-500">{getRespondentId(resp)}</p>
                      </div>
                      {status === 'Yes' ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Beneficiary
                        </span>
                      ) : status === 'No' ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Non-Beneficiary
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200/60">—</span>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Submitted</dt>
                        <dd className="mt-0.5 text-slate-700">{getSubmittedAt(resp)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Municipality</dt>
                        <dd className="mt-0.5 truncate text-slate-700">{getLocationForRow(resp, 'Municipality')}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Barangay</dt>
                        <dd className="mt-0.5 truncate text-slate-700">{getLocationForRow(resp, 'Barangay')}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Province</dt>
                        <dd className="mt-0.5 truncate text-slate-700">{getLocationForRow(resp, 'Province')}</dd>
                      </div>
                      {demoCols.map((q, qIdx) => (
                        <div key={q.id} className="min-w-0">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{getQuestionLabel(q, qIdx)}</dt>
                          <dd className="mt-0.5 truncate text-slate-700">{formatAnswer(getAnswerForQuestion(resp, q))}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
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

export default FormProfiles;
