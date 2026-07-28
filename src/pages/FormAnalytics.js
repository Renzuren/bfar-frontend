import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ArrowLeft, BarChart3, Download } from 'lucide-react';
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
  ResponsiveContainer
} from 'recharts';
import { preprocessAnalyticsData } from '../lib/preprocessing';
import { api } from '../lib/apiMiddleware';

const CHART_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#ddb02b', '#94a3b8'];

// Helper: treat -- as no answer
const isNoAnswer = (value) => {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (value === '--') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const computeQuestionAnalytics = (responses, question, totalSubmissions) => {
  // Collect all answers for this question (including empty ones)
  const allAnswers = responses
    .map((response) => response.answers?.find((answer) => answer.question_id === question.id))
    .map((ans) => ans ? ans.answer : null); // preserve null for missing answers

  // Valid answers (non-null, not "--")
  const validAnswers = allAnswers.filter(ans => !isNoAnswer(ans));

  // Count of "No answer"
  const noAnswerCount = totalSubmissions - validAnswers.length;

  if (['multiple_choice', 'checkboxes', 'dropdown'].includes(question.type)) {
    const optionCounts = {};
    validAnswers.forEach((answer) => {
      if (Array.isArray(answer)) {
        answer.forEach(item => {
          if (!isNoAnswer(item)) optionCounts[item] = (optionCounts[item] || 0) + 1;
        });
      } else {
        optionCounts[answer] = (optionCounts[answer] || 0) + 1;
      }
    });
    // Add "No answer" count
    if (noAnswerCount > 0) {
      optionCounts['Not answered'] = noAnswerCount;
    }
    return {
      ...question,
      responses: Object.entries(optionCounts).map(([option, count]) => ({ option, count })),
      totalAnswered: validAnswers.length,
      totalNoAnswer: noAnswerCount,
    };
  }

  if (question.type === 'rating') {
    const ratings = validAnswers.map(v => Number(v)).filter(r => !isNaN(r));
    const ratingCounts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    ratings.forEach(r => ratingCounts[r]++);
    // Add "Not answered" as a separate category
    if (noAnswerCount > 0) {
      ratingCounts['Not answered'] = noAnswerCount;
    }
    return {
      ...question,
      responses: ratings, // keep numeric ratings for average
      distribution: ratingCounts,
      totalAnswered: ratings.length,
      totalNoAnswer: noAnswerCount,
    };
  }

  // Text responses
  const textResponses = validAnswers.filter(t => !isNoAnswer(t));
  return {
    ...question,
    responses: textResponses,
    totalAnswered: textResponses.length,
    totalNoAnswer: noAnswerCount,
  };
};

const computeFallbackAnalytics = (responses, questions) => {
  const totalSubmissions = responses.length;
  const questionsData = (questions || []).map((question) =>
    computeQuestionAnalytics(responses, question, totalSubmissions)
  );
  return { total_responses: totalSubmissions, questions: questionsData };
};

const FormAnalytics = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState("bar");
  const exportRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [formRes, responsesRes] = await Promise.all([
          api.get(`/forms/${id}`),
          api.get(`/forms/${id}/responses`)
        ]);

        setForm(formRes.data);
        setResponses(responsesRes.data || []);

        let analyticsPayload = null;
        try {
          const analyticsRes = await api.get(`/forms/${id}/analytics`);
          analyticsPayload = preprocessAnalyticsData(analyticsRes.data);
        } catch (analyticsError) {
          console.warn('Analytics endpoint fetch failed, using local fallback analytics', analyticsError);
          toast.error('Analytics endpoint unavailable. Using local fallback analytics.');
          analyticsPayload = computeFallbackAnalytics(responsesRes.data || [], formRes.data.questions || []);
        }

        setAnalytics(analyticsPayload);
      } catch (error) {
        toast.error('Failed to load form analytics');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const renderTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-900/10 text-sm">
        <p className="font-semibold text-slate-900">{item.name}</p>
        <p className="text-slate-600">{item.value} responses</p>
      </div>
    );
  };

  const escapeCsvValue = (value) => `"${String(value).replace(/"/g, '""')}"`;

  const downloadAnalyticsCSV = () => {
    const rows = [];
    rows.push(['Form Title', form.title]);
    rows.push(['Total Submissions', totalResponses]);
    rows.push([]);

    questionsData.forEach((question) => {
      rows.push([question.title]);
      rows.push(['Total answered', question.totalAnswered || 0]);
      rows.push(['Not answered', question.totalNoAnswer || 0]);
      rows.push([]);

      if (['multiple_choice', 'checkboxes', 'dropdown'].includes(question.type)) {
        rows.push(['Option', 'Count']);
        (question.responses || []).forEach((response) => {
          rows.push([response.option, response.count]);
        });
      } else if (question.type === 'rating') {
        rows.push(['Rating', 'Count']);
        if (question.distribution) {
          Object.entries(question.distribution).forEach(([rating, count]) => {
            rows.push([rating === 'Not answered' ? 'Not answered' : `${rating} Star`, count]);
          });
        }
        const validRatings = (question.responses || []).filter(r => !isNoAnswer(r));
        const avg = validRatings.length ? (validRatings.reduce((a,b)=>a+b,0)/validRatings.length).toFixed(1) : '0';
        rows.push(['Average (excluding not answered)', avg]);
      } else {
        rows.push(['Response']);
        (question.responses || []).forEach((response) => {
          rows.push([response]);
        });
      }
      rows.push([]);
    });

    const csv = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/\s+/g, '_')}-analytics.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  const getChartColors = (count) => CHART_COLORS.slice(0, Math.max(count, 1));

  if (loading || !form || !analytics) {
    return (
      <div className="min-h-screen bg-[#F8FDFF] flex items-center justify-center">
        <p className="text-slate-600">Loading analytics...</p>
      </div>
    );
  }

  const totalResponses = analytics.total_responses || 0;
  const questionsData = analytics.questions || [];

  return (
    <div className="min-h-screen bg-[#F8FDFF]">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button onClick={() => navigate('/dashboard')} variant="ghost" className="text-slate-600 hover:text-[#003366]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div ref={exportRef} className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#003366] mb-2">{form.title}</h2>
          <p className="text-base text-slate-600">
            Analytics Overview - {totalResponses} {totalResponses === 1 ? 'submission' : 'submissions'}
          </p>
        </div>

        {totalResponses > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap gap-3">
              {['bar', 'pie'].map((type) => (
                <Button key={type} size="sm" variant={chartType === type ? 'default' : 'outline'} onClick={() => setChartType(type)}>
                  {type === 'bar' ? 'Bar Chart' : 'Pie Chart'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="outline" onClick={downloadAnalyticsCSV}>
                <Download className="w-4 h-4 mr-2" /> Download CSV
              </Button>
            </div>
          </div>
        )}

        {totalResponses === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No data to analyze yet</h3>
            <p className="text-slate-600">Collect responses to see analytics</p>
          </div>
        ) : (
          <div className="space-y-8">
            {questionsData.map((questionData, index) => {
              if (!questionData) return null;

              // Multiple choice / checkboxes / dropdown
              if (['multiple_choice', 'checkboxes', 'dropdown'].includes(questionData.type)) {
                const chartData = (questionData.responses || []).map(r => ({ name: r.option, value: r.count }));
                if (chartData.length === 0) return null;
                return (
                  <Card key={index} className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold text-[#003366]">{questionData.title}</h3>
                      <div className="text-sm text-slate-500">
                        Answered: {questionData.totalAnswered || 0} | Not answered: {questionData.totalNoAnswer || 0}
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600">
                        {questionData.type.replace('_', ' ')}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={340}>
                      {chartType === "bar" ? (
                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: -12, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={60} />
                          <YAxis tick={{ fill: '#475569' }} />
                          <Tooltip content={renderTooltip} />
                          <Legend verticalAlign="top" height={36} />
                          <Bar dataKey="value" radius={[12,12,0,0]}>
                            {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(chartData.length)[i]} />)}
                          </Bar>
                        </BarChart>
                      ) : (
                        <PieChart>
                          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} labelLine={false} label={({ name, percent }) => `${name}: ${(percent*100).toFixed(0)}%`}>
                            {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(chartData.length)[i]} />)}
                          </Pie>
                          <Tooltip content={renderTooltip} />
                          <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {chartData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: getChartColors(chartData.length)[idx] }} />
                          <div><p className="text-sm font-medium text-slate-800">{item.name}</p><p className="text-sm text-slate-500">{item.value} responses</p></div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              }

              // Rating
              if (questionData.type === 'rating') {
                const distribution = questionData.distribution || {};
                const chartData = Object.entries(distribution)
                  .map(([rating, count]) => ({ name: rating === 'Not answered' ? 'Not answered' : `${rating} Star`, value: count }))
                  .filter(d => d.value > 0);
                const validRatings = (questionData.responses || []).filter(r => !isNoAnswer(r));
                const avgRating = validRatings.length ? (validRatings.reduce((a,b)=>a+b,0)/validRatings.length).toFixed(1) : '-';
                if (chartData.length === 0) return null;
                return (
                  <Card key={index} className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold text-[#003366]">{questionData.title}</h3>
                      <div className="text-sm text-slate-500">
                        Answered: {questionData.totalAnswered || 0} | Not answered: {questionData.totalNoAnswer || 0}
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600">Rating</span>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        Avg (excl. not answered): {avgRating} / 5
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={340}>
                      {chartType === "bar" ? (
                        <BarChart data={chartData} margin={{ top:10, right:20, left:-12, bottom:20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill:'#475569', fontSize:12 }} />
                          <YAxis tick={{ fill:'#475569' }} />
                          <Tooltip content={renderTooltip} />
                          <Legend verticalAlign="top" height={36} />
                          <Bar dataKey="value" radius={[12,12,0,0]}>
                            {chartData.map((entry,i) => <Cell key={`cell-${i}`} fill={getChartColors(chartData.length)[i]} />)}
                          </Bar>
                        </BarChart>
                      ) : (
                        <PieChart>
                          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} labelLine={false} label={({ percent }) => `${(percent*100).toFixed(0)}%`}>
                            {chartData.map((entry,i) => <Cell key={`cell-${i}`} fill={getChartColors(chartData.length)[i]} />)}
                          </Pie>
                          <Tooltip content={renderTooltip} />
                          <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {chartData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: getChartColors(chartData.length)[idx] }} />
                          <div><p className="text-sm font-medium text-slate-800">{item.name}</p><p className="text-sm text-slate-500">{item.value} responses</p></div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              }

              // Text responses
              if ((questionData.responses || []).length === 0 && (questionData.totalNoAnswer || 0) > 0) {
                return (
                  <Card key={index} className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold text-[#003366]">{questionData.title}</h3>
                      <div className="text-sm text-slate-500">
                        Answered: 0 | Not answered: {questionData.totalNoAnswer || totalResponses}
                      </div>
                    </div>
                    <p className="text-slate-500 italic">No responses provided.</p>
                  </Card>
                );
              }
              return (
                <Card key={index} className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold text-[#003366]">{questionData.title}</h3>
                    <div className="text-sm text-slate-500">
                      Answered: {questionData.totalAnswered || 0} | Not answered: {questionData.totalNoAnswer || 0}
                    </div>
                  </div>
                  {(questionData.responses || []).map((response, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3 mb-2">
                      <p className="text-slate-700">{response}</p>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormAnalytics;