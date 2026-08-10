import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ChevronLeft, ChevronRight, FileSpreadsheet, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { generateAssessmentHeaders, mapResponseToAssessmentColumns } from '../lib/preprocessing';

// ==================== UTILITY FUNCTIONS ====================
const isNoAnswer = (val) => !val || val === '' || val === '--' || (Array.isArray(val) && val.length === 0);

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
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAnswerForQuestion = (response, question) => {
    const answersArray = response.answers || [];
    const matched = answersArray.find(a => a.question_id === question.id);
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

  const downloadCSV = () => {
    if (responses.length === 0) {
      toast.error('No responses to download');
      return;
    }

    const allQuestions = sections.flatMap(s => s.questions);
    const beneQuestion = allQuestions.find(q => q.code === 'BENE');
    const validQuestions = allQuestions.filter(q =>
      q.code && q.code.trim() && q !== beneQuestion
    );

    if (validQuestions.length === 0 && !beneQuestion) {
      toast.error('No questions with a valid Question Code – cannot generate CSV');
      return;
    }

    const headers = ['RESPONDENT', ...validQuestions.map(q => {
      const title = q.title.replace(/,/g, '').replace(/:/g, '').trim();
      return `${q.code}:${title}`;
    })];

    const rows = responses.map((response, idx) => {
      let prefix = '';
      if (beneQuestion) {
        const beneAnswer = getAnswerForQuestion(response, beneQuestion);
        const isBene = beneAnswer && (beneAnswer === 'Yes' || beneAnswer === 'Bene' || beneAnswer === beneQuestion.options?.[0]);
        prefix = isBene ? 'B-' : 'NB-';
      }

      const rawRespondent = response.respondent_id || response.id || `R-${idx + 1}`;
      const respondentId = prefix ? `${prefix}${rawRespondent}` : rawRespondent;

      const rowValues = validQuestions.map(q => {
        const rawAns = getAnswerForQuestion(response, q);
        const numericAns = getNumericAnswer(rawAns, q);
        return String(numericAns);
      });

      return [respondentId, ...rowValues];
    });

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ];
    const csv = csvLines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/\s+/g, '_')}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading responses...</div>;
  if (!form) return null;

  const allQuestions = sections.flatMap(s => s.questions);
  const totalPages = Math.ceil(responses.length / rowsPerPage);
  const start = (currentPage - 1) * rowsPerPage;
  const paginated = responses.slice(start, start + rowsPerPage);
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  let colIdx = 0;
  const sectionLastIndices = [];
  sections.forEach(section => {
    colIdx += section.questions.length;
    sectionLastIndices.push(colIdx - 1);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-slate-600">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {responses.length} responses
            </span>
            <Button variant="outline" onClick={downloadCSV} disabled={responses.length === 0} className="border-cyan-300 text-cyan-700 hover:bg-cyan-50">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <p className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Form responses</p>
          <h2 className="mb-1 text-2xl font-bold sm:text-3xl">{form.title}</h2>
          <p className="text-sm text-slate-300">Responses grouped by section — answers are converted to numeric values when exporting to CSV.</p>
        </section>

        {responses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
              <Inbox className="h-10 w-10" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No responses yet</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Share the form link with respondents to start collecting data. Responses will appear here in real time.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                Rows per page:
                <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">{responses.length}</span> total
                  <span className="mx-2 text-slate-300">|</span>
                  Page <span className="font-semibold text-slate-900">{currentPage}</span> of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th rowSpan={2} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                      <th rowSpan={2} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Submitted At</th>
                      {sections.map(section => (
                        <th key={section.id} colSpan={section.questions.length} className="border-b border-slate-200 bg-slate-100 px-6 py-2 text-center text-sm font-bold text-slate-700">
                          {section.title}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {sections.flatMap((section, secIdx) =>
                        section.questions.map((q, qIdx) => {
                          const isLastCol = (secIdx === sections.length - 1 && qIdx === section.questions.length - 1);
                          return (
                            <th key={q.id} className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${!isLastCol ? 'border-r border-slate-200' : ''}`}>
                              <div className="max-w-xs truncate" title={q.title}>
                                <span className="text-cyan-600">Q{allQuestions.findIndex(qq => qq.id === q.id) + 1}</span>: {q.title}
                              </div>
                            </th>
                          );
                        })
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginated.map((resp, idx) => {
                      const submittedAt = resp.submitted_at?._seconds ? new Date(resp.submitted_at._seconds * 1000).toLocaleString() : 'No date';
                      const globalIdx = start + idx + 1;
                      return (
                        <tr key={resp.id} className="transition hover:bg-cyan-50/30">
                          <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-400">{globalIdx}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{submittedAt}</td>
                          {allQuestions.map((q, colIdx) => {
                            const ans = getAnswerForQuestion(resp, q);
                            const hasRightBorder = sectionLastIndices.includes(colIdx);
                            return (
                              <td key={q.id} className={`max-w-xs truncate px-6 py-4 text-sm ${hasRightBorder ? 'border-r border-slate-200' : ''}`} title={formatAnswerForTable(ans)}>
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

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  <ChevronLeft className="mr-1.5 h-4 w-4" /> Previous
                </Button>
                <span className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <Button size="sm" variant="outline" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default FormResponses;
