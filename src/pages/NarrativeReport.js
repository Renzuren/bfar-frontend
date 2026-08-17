import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Download,
  BarChart3,
  ChartColumnBig,
  ChartPie,
  Inbox,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { normalizeLocationCodes, isReservedField, getQuestionLabel } from '../lib/preprocessing';
import { api } from '../lib/apiMiddleware';

const CHART_COLORS = ['#0ea5e9', '#2563eb', '#14b8a6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#ddb02b', '#94a3b8'];

const isNoAnswer = (value) => {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (value === '--') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const computeQuestionAnalytics = (responses, question) => {
  const allAnswers = responses
    .map((response) => response.answers?.find((a) => a.question_id === question.id))
    .map((ans) => (ans ? ans.answer : null));

  const validAnswers = allAnswers.filter((ans) => !isNoAnswer(ans));

  if (['multiple_choice', 'checkboxes', 'dropdown'].includes(question.type)) {
    const optionCounts = {};
    validAnswers.forEach((answer) => {
      if (Array.isArray(answer)) {
        answer.forEach((item) => {
          if (!isNoAnswer(item)) optionCounts[item] = (optionCounts[item] || 0) + 1;
        });
      } else {
        optionCounts[answer] = (optionCounts[answer] || 0) + 1;
      }
    });
    return {
      responses: Object.entries(optionCounts).map(([option, count]) => ({ option, count })),
      totalAnswered: validAnswers.length,
      totalNoAnswer: responses.length - validAnswers.length,
    };
  }

  if (question.type === 'rating') {
    const ratings = validAnswers.map((v) => Number(v)).filter((r) => !isNaN(r));
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((r) => distribution[r]++);
    return {
      responses: ratings,
      distribution,
      average: avg,
      totalAnswered: ratings.length,
      totalNoAnswer: responses.length - ratings.length,
    };
  }

  return {
    responses: validAnswers,
    totalAnswered: validAnswers.length,
    totalNoAnswer: responses.length - validAnswers.length,
  };
};

const NarrativeReport = () => {
  const { project } = useOutletContext();
  const reportRef = useRef(null);
  const [beforeForm, setBeforeForm] = useState(null);
  const [afterForm, setAfterForm] = useState(null);
  const [beforeResponses, setBeforeResponses] = useState([]);
  const [afterResponses, setAfterResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!project) return;
      try {
        const promises = [];

        if (project.before_form) {
          promises.push(
            api.get(`/forms/${project.before_form}`).then((r) => setBeforeForm(r.data)),
            api.get(`/forms/${project.before_form}/responses`).then((r) => setBeforeResponses(r.data || []))
          );
        }
        if (project.after_form) {
          promises.push(
            api.get(`/forms/${project.after_form}`).then((r) => setAfterForm(r.data)),
            api.get(`/forms/${project.after_form}/responses`).then((r) => setAfterResponses(r.data || []))
          );
        }

        await Promise.all(promises);
      } catch (error) {
        toast.error('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [project]);

  const beforeQuestions = useMemo(() => {
    if (!beforeForm) return [];
    const qs = beforeForm.sections
      ? beforeForm.sections.flatMap((s) => s.questions || [])
      : beforeForm.questions || [];
    return normalizeLocationCodes(qs).filter((q) => !isReservedField(q));
  }, [beforeForm]);

  const afterQuestions = useMemo(() => {
    if (!afterForm) return [];
    const qs = afterForm.sections
      ? afterForm.sections.flatMap((s) => s.questions || [])
      : afterForm.questions || [];
    return normalizeLocationCodes(qs).filter((q) => !isReservedField(q));
  }, [afterForm]);

  const comparisonData = useMemo(() => {
    const paired = [];

    beforeQuestions.forEach((bq) => {
      const aq = afterQuestions.find((a) => a.code === bq.code || a.title === bq.title);
      if (!aq) return;

      if (['multiple_choice', 'checkboxes', 'dropdown'].includes(bq.type)) {
        const beforeAnalytics = computeQuestionAnalytics(beforeResponses, bq);
        const afterAnalytics = computeQuestionAnalytics(afterResponses, aq);

        const allOptions = new Set([
          ...beforeAnalytics.responses.map((r) => r.option),
          ...afterAnalytics.responses.map((r) => r.option),
        ]);

        const beforeTotal = beforeAnalytics.totalAnswered || 1;
        const afterTotal = afterAnalytics.totalAnswered || 1;

        const data = Array.from(allOptions).map((option) => {
          const bCount = beforeAnalytics.responses.find((r) => r.option === option)?.count || 0;
          const aCount = afterAnalytics.responses.find((r) => r.option === option)?.count || 0;
          return {
            option,
            before: ((bCount / beforeTotal) * 100).toFixed(1),
            after: ((aCount / afterTotal) * 100).toFixed(1),
            beforeCount: bCount,
            afterCount: aCount,
          };
        });

        paired.push({
          question: bq,
          afterQuestion: aq,
          type: bq.type,
          data,
          beforeAnalytics,
          afterAnalytics,
        });
      } else if (bq.type === 'rating') {
        const beforeAnalytics = computeQuestionAnalytics(beforeResponses, bq);
        const afterAnalytics = computeQuestionAnalytics(afterResponses, aq);

        paired.push({
          question: bq,
          afterQuestion: aq,
          type: 'rating',
          beforeAvg: beforeAnalytics.average || 0,
          afterAvg: afterAnalytics.average || 0,
          beforeDistribution: beforeAnalytics.distribution || {},
          afterDistribution: afterAnalytics.distribution || {},
          beforeAnalytics,
          afterAnalytics,
        });
      }
    });

    return paired;
  }, [beforeQuestions, afterQuestions, beforeResponses, afterResponses]);

  const renderTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl shadow-slate-900/10">
        {payload.map((item, idx) => (
          <p key={idx} style={{ color: item.color }} className="font-medium">
            {item.name}: {item.value}%
          </p>
        ))}
      </div>
    );
  };

  const getChangeDirection = (before, after) => {
    const diff = after - before;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-slate-500', label: 'No change' };
    if (diff > 0) return { icon: ArrowUpRight, color: 'text-emerald-600', label: `+${diff.toFixed(1)}` };
    return { icon: ArrowDownRight, color: 'text-rose-600', label: `${diff.toFixed(1)}` };
  };

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`${(project?.title || 'narrative-report').replace(/\s+/g, '_')}-narrative-report.pdf`);
      toast.success('Report downloaded as PDF');
    } catch (error) {
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const saveReport = async () => {
    try {
      const reportPayload = {
        project_id: project.id,
        title: `${project.title} - Narrative Report`,
        generated_at: new Date().toISOString(),
        before_form_id: project.before_form,
        after_form_id: project.after_form,
        before_responses_count: beforeResponses.length,
        after_responses_count: afterResponses.length,
        comparison_data: comparisonData.length,
      };
      await api.post('/reports', reportPayload);
      toast.success('Report saved successfully');
    } catch (error) {
      toast.error('Failed to save report');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading report data...
      </div>
    );
  }

  if (!project.before_form || !project.after_form) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
          <Inbox className="h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">Incomplete Data</h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          {!project.before_form && !project.after_form
            ? 'Create both Before and After questionnaires to generate a narrative report.'
            : !project.before_form
            ? 'Create the Before questionnaire first.'
            : 'Create the After questionnaire to compare results.'}
        </p>
      </div>
    );
  }

  if (comparisonData.length === 0 && beforeResponses.length === 0 && afterResponses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
          <Inbox className="h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">No responses yet</h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          Collect responses from both Before and After questionnaires to see comparison data here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Narrative Report</p>
          <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">{project.title}</h2>
          <p className="max-w-2xl text-base text-slate-300">
            Comparison of Before vs. After intervention results.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={generatePDF} disabled={generating} className="bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400">
              <Download className="mr-2 h-4 w-4" />
              {generating ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button onClick={saveReport} className="bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20">
              <FileText className="mr-2 h-4 w-4" />
              Save Report
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Before Responses</p>
          <p className="mt-1.5 text-3xl font-bold text-indigo-600">{beforeResponses.length}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">After Responses</p>
          <p className="mt-1.5 text-3xl font-bold text-emerald-600">{afterResponses.length}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Questions Compared</p>
          <p className="mt-1.5 text-3xl font-bold text-cyan-600">{comparisonData.length}</p>
        </Card>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${chartType === 'bar' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <ChartColumnBig className="h-4 w-4" /> Bar
          </button>
          <button
            type="button"
            onClick={() => setChartType('pie')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${chartType === 'pie' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <ChartPie className="h-4 w-4" /> Pie
          </button>
        </div>
      </section>

      <div ref={reportRef} className="space-y-8">
        {comparisonData.map((item, index) => {
          const qLabel = getQuestionLabel(item.question, index);

          if (item.type === 'rating') {
            const change = getChangeDirection(item.beforeAvg, item.afterAvg);
            const ChangeIcon = change.icon;
            const distData = Object.keys(item.beforeDistribution || {}).map((rating) => ({
              name: rating === 'Not answered' ? 'N/A' : `${rating} Star`,
              Before: item.beforeDistribution[rating] || 0,
              After: item.afterDistribution[rating] || 0,
            }));

            return (
              <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                      Rating
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{qLabel}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Before</p>
                      <p className="text-lg font-bold text-indigo-600">{item.beforeAvg.toFixed(1)}</p>
                    </div>
                    <ChangeIcon className={`h-5 w-5 ${change.color}`} />
                    <div className="text-center">
                      <p className="text-xs text-slate-400">After</p>
                      <p className="text-lg font-bold text-emerald-600">{item.afterAvg.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={distData} margin={{ top: 10, right: 20, left: -12, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b' }} />
                    <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }} />
                    <Legend />
                    <Bar dataKey="Before" fill="#818cf8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="After" fill="#34d399" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            );
          }

          return (
            <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
                    {item.type.replace('_', ' ')}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{qLabel}</h3>
                </div>
              </div>

              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={item.data} margin={{ top: 10, right: 20, left: -12, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="option" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#64748b' }} label={{ value: '%', position: 'insideTopLeft', offset: 10 }} />
                    <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }} />
                    <Legend />
                    <Bar dataKey="before" name="Before" fill="#818cf8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="after" name="After" fill="#34d399" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-2 text-center text-sm font-semibold text-indigo-700">Before</p>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={item.data.map((d) => ({ name: d.option, value: parseInt(d.before) || 0 }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {item.data.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="mb-2 text-center text-sm font-semibold text-emerald-700">After</p>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={item.data.map((d) => ({ name: d.option, value: parseInt(d.after) || 0 }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {item.data.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Option</th>
                      <th className="px-4 py-2 text-right font-semibold text-indigo-600">Before</th>
                      <th className="px-4 py-2 text-right font-semibold text-emerald-600">After</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.data.map((d, i) => {
                      const diff = parseFloat(d.after) - parseFloat(d.before);
                      const diffColor = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400';
                      return (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="px-4 py-2 text-slate-800">{d.option}</td>
                          <td className="px-4 py-2 text-right text-indigo-600">{d.before}% ({d.beforeCount})</td>
                          <td className="px-4 py-2 text-right text-emerald-600">{d.after}% ({d.afterCount})</td>
                          <td className={`px-4 py-2 text-right font-medium ${diffColor}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      {comparisonData.length > 0 && (
        <div className="flex justify-center">
          <Button onClick={saveReport} className="bg-cyan-600 text-white hover:bg-cyan-700">
            <FileText className="mr-2 h-4 w-4" /> Save This Report
          </Button>
        </div>
      )}
    </div>
  );
};

export default NarrativeReport;
