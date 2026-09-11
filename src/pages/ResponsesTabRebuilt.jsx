import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  BarChart3, ChevronLeft, ChevronRight, Download, Eye, Inbox, Loader2,
  Search, Users, X,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { isReservedField, normalizeLocationCodes, getQuestionLabel } from '../lib/preprocessing';
import { getAnswerForQuestion } from '../lib/answerResolver';

const COLORS = ['#0d9488', '#d97706', '#2563eb', '#7c3aed', '#dc2626', '#0891b2'];
const isEmpty = (value) => value === null || value === undefined || value === '' || value === '--' || (Array.isArray(value) && value.length === 0);
const display = (value) => isEmpty(value) ? '—' : Array.isArray(value) ? value.join(', ') : String(value);

const responseList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.responses)) return payload.responses;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const fetchResponses = async (formId) => {
  if (!formId) return [];
  try {
    return responseList((await api.get(`/forms/${formId}/responses`)).data);
  } catch {
    return responseList((await api.get(`/forms/public/${formId}/responses`)).data);
  }
};

const sectionsFor = (form) => {
  if (!form) return [];
  if (Array.isArray(form.sections) && form.sections.length) {
    return form.sections.map((section, index) => ({
      ...section,
      section_type: section.section_type || (index === 0 ? 'demographics' : 'questionnaire'),
      questions: section.questions || [],
    }));
  }
  const groups = new Map();
  (form.questions || []).forEach((question) => {
    const title = question.section?.trim() || 'Section 1';
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(question);
  });
  return [...groups.entries()].map(([title, questions], index) => ({
    id: `section_${index}`, title, section_type: index === 0 ? 'demographics' : 'questionnaire', questions,
  }));
};

const questionColumns = (sections, type) => normalizeLocationCodes(
  sections.filter((section) => section.section_type === type).flatMap((section) => section.questions || [])
).filter((question) => !isReservedField(question) && question.type !== 'profile_photo');

const questionMatches = (key, question) => {
  const normalized = String(key || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const candidates = [question.id, question.code, question.title]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase().replace(/[\s_-]+/g, ''));
  return candidates.some((candidate) => normalized === candidate || normalized.startsWith(`${candidate}:`));
};

const answerFromAnyShape = (response, question, sections) => {
  const sources = [response.answers, response.questionnaire_answers, response.demographics];
  for (const source of sources) {
    if (!source) continue;
    const entries = Array.isArray(source)
      ? source.map((value, index) => [index, value])
      : Object.entries(source);
    const hit = entries.find(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return questionMatches(value.question_id, question) || questionMatches(value.qid, question) ||
          questionMatches(value.question_code, question) || questionMatches(value.question_title, question);
      }
      return questionMatches(key, question);
    });
    if (hit) {
      const value = hit[1];
      const answer = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'answer')
        ? value.answer : value;
      if (!isEmpty(answer)) return answer;
    }
  }

  const directKey = Object.keys(response).find((key) => questionMatches(key, question));
  if (directKey && !isEmpty(response[directKey])) return response[directKey];

  const aliases = {
    age: ['age', 'edad'], gender: ['gender', 'sex'], municipality: ['municipality', 'area'],
    barangay: ['barangay', 'brgy'], province: ['province', 'prov'],
  };
  const codeAndTitle = [question.code, question.title].filter(Boolean).join(' ').toLowerCase();
  const alias = Object.entries(aliases).find(([, names]) => names.some((name) => codeAndTitle.includes(name)));
  if (alias && !isEmpty(response[alias[0]])) return response[alias[0]];

  // Last resort for old positional submissions. Keep source sections isolated.
  const allQuestions = sections.flatMap((section) => section.questions || []);
  const index = allQuestions.findIndex((item) => item.id === question.id);
  const positional = Array.isArray(response.answers) ? response.answers[index] : undefined;
  if (positional && typeof positional === 'object' && Object.prototype.hasOwnProperty.call(positional, 'answer')) return positional.answer;
  return !isEmpty(positional) ? positional : getAnswerForQuestion(response, question, { sections });
};

const dateText = (value) => {
  if (!value) return 'No date';
  const date = typeof value === 'object' && value._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleString();
};

const Pill = ({ children, tone = 'slate' }) => <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold bg-${tone}-50 text-${tone}-700 ring-1 ring-${tone}-200/70`}>{children}</span>;

const ResponsesTabRebuilt = () => {
  const project = useOutletContext()?.project;
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [beforeForm, setBeforeForm] = useState(null);
  const [afterForm, setAfterForm] = useState(null);
  const [beforeResponses, setBeforeResponses] = useState([]);
  const [afterResponses, setAfterResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [municipality, setMunicipality] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const labels = project?.has_baseline === false
    ? { before: 'Beneficiary', after: 'Non-Beneficiary' }
    : { before: 'Before', after: 'After' };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!project) return;
      setLoading(true);
      try {
        const [beforeFormResult, afterFormResult, beforeList, afterList] = await Promise.all([
          project.before_form ? api.get(`/forms/${project.before_form}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          project.after_form ? api.get(`/forms/${project.after_form}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          fetchResponses(project.before_form), fetchResponses(project.after_form),
        ]);
        if (!active) return;
        setBeforeForm(beforeFormResult.data);
        setAfterForm(afterFormResult.data);
        // Deliberately concatenate. There is no respondent-id deduplication.
        setBeforeResponses(beforeList.map((response, index) => ({ ...response, _source: 'before', _rowKey: `before-${response.id || index}` })));
        setAfterResponses(afterList.map((response, index) => ({ ...response, _source: 'after', _rowKey: `after-${response.id || index}` })));
      } catch {
        toast.error('Failed to load responses');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [project?.before_form, project?.after_form]);

  const beforeSections = useMemo(() => sectionsFor(beforeForm), [beforeForm]);
  const afterSections = useMemo(() => sectionsFor(afterForm), [afterForm]);
  const beforeQuestions = useMemo(() => questionColumns(beforeSections, 'questionnaire'), [beforeSections]);
  const afterQuestions = useMemo(() => questionColumns(afterSections, 'questionnaire'), [afterSections]);
  const beforeDemo = useMemo(() => questionColumns(beforeSections, 'demographics'), [beforeSections]);
  const afterDemo = useMemo(() => questionColumns(afterSections, 'demographics'), [afterSections]);

  const rows = useMemo(() => [
    ...beforeResponses.map((response) => ({ response, source: 'before', sections: beforeSections })),
    ...afterResponses.map((response) => ({ response, source: 'after', sections: afterSections })),
  ], [beforeResponses, afterResponses, beforeSections, afterSections]);

  const answer = (row, question) => answerFromAnyShape(row.response, question, row.sections);
  const location = (row, field) => {
    if (!isEmpty(row.response[field])) return display(row.response[field]);
    const questions = [...(row.source === 'before' ? beforeDemo : afterDemo), ...(row.source === 'before' ? beforeQuestions : afterQuestions)];
    const match = questions.find((question) => {
      const text = `${question.code || ''} ${question.title || ''}`.toLowerCase();
      return text.includes(field) || (field === 'municipality' && text.includes('area')) || (field === 'barangay' && text.includes('brgy'));
    });
    return match ? display(answer(row, match)) : '—';
  };
  const name = (row) => row.response.full_name || row.response.name || '—';
  const respondentId = (row) => row.response.respondent_id || row.response.id || '—';

  const filtered = useMemo(() => rows.filter((row) => {
    if (source !== 'all' && row.source !== source) return false;
    if (municipality !== 'all' && location(row, 'municipality') !== municipality) return false;
    if (!query.trim()) return true;
    const text = [respondentId(row), name(row), location(row, 'municipality'), location(row, 'barangay'), location(row, 'province')].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [rows, source, municipality, query]);

  useEffect(() => { setPage(1); }, [source, municipality, query, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const municipalities = [...new Set(rows.map((row) => location(row, 'municipality')).filter((value) => value !== '—'))].sort();
  const beforeCount = rows.filter((row) => row.source === 'before').length;
  const afterCount = rows.filter((row) => row.source === 'after').length;

  const chartData = (questions, sourceName) => {
    const question = questions.find((item) => /age|edad|gender|sex/i.test(`${item.code} ${item.title}`));
    if (!question) return [];
    const counts = new Map();
    rows.filter((row) => row.source === sourceName).forEach((row) => {
      const value = display(answer(row, question));
      if (value !== '—') counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count }));
  };
  const beforeChart = chartData(beforeDemo, 'before');
  const afterChart = chartData(afterDemo, 'after');

  const exportCsv = () => {
    const columns = [
      ['Source', (row) => row.source === 'before' ? labels.before : labels.after], ['Submitted At', (row) => dateText(row.response.submitted_at)],
      ['Respondent ID', respondentId], ['Name', name], ['Municipality', (row) => location(row, 'municipality')],
      ['Barangay', (row) => location(row, 'barangay')], ['Province', (row) => location(row, 'province')],
      ...beforeQuestions.map((question, index) => [getQuestionLabel(question, index), (row) => row.source === 'before' ? display(answer(row, question)) : '—']),
      ...afterQuestions.map((question, index) => [getQuestionLabel(question, index), (row) => row.source === 'after' ? display(answer(row, question)) : '—']),
    ];
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [columns.map(([label]) => quote(label)).join(','), ...filtered.map((row) => columns.map(([, getter]) => quote(getter(row))).join(','))].join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `${(project?.title || 'project').replace(/\s+/g, '_')}-all-responses.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading responses...</div>;

  return (
    <div className="w-full space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-blue-600 to-violet-700 px-6 py-9 text-white shadow-xl sm:px-10">
        <div className="relative flex items-start gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Eye className="h-7 w-7" /></div><div><h1 className="text-3xl font-bold sm:text-4xl">All Responses</h1><div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white/20 px-3 py-1">{rows.length} total</span><span className="rounded-full bg-emerald-400/25 px-3 py-1">{beforeCount} {labels.before}</span><span className="rounded-full bg-amber-400/25 px-3 py-1">{afterCount} {labels.after}</span></div></div></div>
      </section>

      <div className="flex gap-2 border-b border-slate-200"><button onClick={() => setTab('all')} className={`rounded-t-xl border border-b-0 px-5 py-3 text-sm font-semibold ${tab === 'all' ? 'border-cyan-200 bg-white text-cyan-700' : 'border-transparent bg-slate-50 text-slate-500'}`}>All Responses <span className="ml-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs">{rows.length}</span></button><button onClick={() => setTab('demographics')} className={`rounded-t-xl border border-b-0 px-5 py-3 text-sm font-semibold ${tab === 'demographics' ? 'border-cyan-200 bg-white text-cyan-700' : 'border-transparent bg-slate-50 text-slate-500'}`}>Demographics <span className="ml-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs">{rows.length}</span></button></div>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2"><button onClick={() => setSource('all')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${source === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All {rows.length}</button><button onClick={() => setSource('before')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${source === 'before' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>{labels.before} {beforeCount}</button><button onClick={() => setSource('after')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${source === 'after' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'}`}>{labels.after} {afterCount}</button></div>
        <div className="flex flex-wrap items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search responses..." className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm outline-none focus:border-cyan-300" />{query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-slate-400" /></button>}</div><Select value={municipality} onValueChange={setMunicipality}><SelectTrigger className="h-10 w-44 rounded-xl"><SelectValue placeholder="All Municipalities" /></SelectTrigger><SelectContent><SelectItem value="all">All Municipalities</SelectItem>{municipalities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={exportCsv} className="h-10 border-cyan-200 text-cyan-700"><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>
      </section>

      {tab === 'demographics' && <section className="grid gap-4 lg:grid-cols-2"><ChartPanel title={`${labels.before} demographic distribution`} data={beforeChart} color="#0d9488" /><ChartPanel title={`${labels.after} demographic distribution`} data={afterChart} color="#d97706" /></section>}
      {tab === 'demographics' && <ResponseTable rows={visibleRows} questions={source === 'before' ? beforeDemo.map((question) => ({ question, source: 'before' })) : source === 'after' ? afterDemo.map((question) => ({ question, source: 'after' })) : [...beforeDemo.map((question) => ({ question, source: 'before' })), ...afterDemo.map((question) => ({ question, source: 'after' }))]} answer={answer} location={location} name={name} respondentId={respondentId} tabLabels={labels} />}
      {tab === 'all' && <ResponseTable rows={visibleRows} questions={source === 'before' ? beforeQuestions.map((question) => ({ question, source: 'before' })) : source === 'after' ? afterQuestions.map((question) => ({ question, source: 'after' })) : [...beforeQuestions.map((question) => ({ question, source: 'before' })), ...afterQuestions.map((question) => ({ question, source: 'after' }))]} answer={answer} location={location} name={name} respondentId={respondentId} tabLabels={labels} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm"><div className="flex items-center gap-2">Rows per page <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}><SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div className="flex gap-1"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
      {rows.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><Inbox className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-slate-700">No responses yet</p><Button className="mt-4" onClick={() => navigate(`/projects/${projectId}/create-questionnaire`)}>Create Questionnaire</Button></div>}
    </div>
  );
};

const ChartPanel = ({ title, data, color }) => <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" style={{ color }} /><h3 className="font-semibold text-slate-800">{title}</h3></div>{data.length ? <ResponsiveContainer width="100%" height={230}><BarChart data={data} margin={{ left: 0, right: 8, bottom: 24 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" angle={-25} textAnchor="end" height={55} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill={color} radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-[230px] items-center justify-center text-sm text-slate-400">No chartable demographic answers</div>}</div>;

const ResponseTable = ({ rows, questions, answer, location, name, respondentId, tabLabels }) => <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500"><th className="whitespace-nowrap px-5 py-3">Submitted</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Respondent ID</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Municipality</th><th className="px-5 py-3">Barangay</th><th className="px-5 py-3">Province</th>{questions.map(({ question, source }) => <th key={`${source}-${question.id}`} className="min-w-36 whitespace-nowrap bg-slate-100 px-5 py-3">{source === 'before' ? tabLabels.before : tabLabels.after} · {getQuestionLabel(question)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={row.response._rowKey || `${row.source}-${index}`} className="hover:bg-cyan-50/30"><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">{dateText(row.response.submitted_at)}</td><td className="px-5 py-4"><Pill tone={row.source === 'before' ? 'emerald' : 'amber'}>{row.source === 'before' ? tabLabels.before : tabLabels.after}</Pill></td><td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">{respondentId(row)}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-800">{name(row)}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{location(row, 'municipality')}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{location(row, 'barangay')}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{location(row, 'province')}</td>{questions.map(({ question, source }) => <td key={`${source}-${question.id}`} className="max-w-48 truncate px-5 py-4 text-sm text-slate-600">{row.source === source ? display(answer(row, question)) : '—'}</td>)}</tr>)}</tbody></table></div>{!rows.length && <div className="py-14 text-center text-sm text-slate-400">No matching responses</div>}</div>;

export default ResponsesTabRebuilt;
