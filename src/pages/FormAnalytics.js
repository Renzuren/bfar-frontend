import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download, ChartColumnBig, ChartPie, Inbox, Camera, User, MapPin, Fingerprint } from 'lucide-react';
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
import { preprocessAnalyticsData, getQuestionLabel, normalizeLocationCodes, isReservedField } from '../lib/preprocessing';
import { api } from '../lib/apiMiddleware';

const CHART_COLORS = ['#0ea5e9', '#2563eb', '#14b8a6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#ddb02b', '#94a3b8'];

const isNoAnswer = (value) => {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (value === '--') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const computeQuestionAnalytics = (responses, question, totalSubmissions) => {
  const allAnswers = responses
    .map((response) => response.answers?.find((answer) => answer.question_id === question.id))
    .map((ans) => ans ? ans.answer : null);

  const validAnswers = allAnswers.filter(ans => !isNoAnswer(ans));

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
    if (noAnswerCount > 0) {
      ratingCounts['Not answered'] = noAnswerCount;
    }
    return {
      ...question,
      responses: ratings,
      distribution: ratingCounts,
      totalAnswered: ratings.length,
      totalNoAnswer: noAnswerCount,
    };
  }

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
          const fetchedForm = formRes.data;
          const allQuestions = Array.isArray(fetchedForm.questions) && fetchedForm.questions.length > 0
            ? fetchedForm.questions
            : (Array.isArray(fetchedForm.sections) ? fetchedForm.sections.flatMap(s => s.questions || []) : []);
          analyticsPayload = computeFallbackAnalytics(responsesRes.data || [], allQuestions);
        }

        setAnalytics(analyticsPayload);
      } catch (error) {
        toast.error('Failed to load form analytics');
        goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const renderTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl shadow-slate-900/10">
        <p className="font-semibold text-slate-900">{item.name}</p>
        <p className="text-slate-600">{item.value} responses</p>
      </div>
    );
  };

  // Question definitions by id so analytics entries (which may lack a code)
  // can still render the "{code}: {title}" label consistently.
  const questionCodeMap = useMemo(() => {
    const map = new Map();
    const questions = form?.questions?.length
      ? form.questions
      : form?.sections
        ? form.sections.flatMap((s) => s.questions || [])
        : [];
    normalizeLocationCodes(questions).forEach((q) => map.set(q.id, q));
    return map;
  }, [form]);

  // Separate demographics from questionnaire questions
  const { demographicsQuestions, questionnaireQuestions } = useMemo(() => {
    if (!form) return { demographicsQuestions: [], questionnaireQuestions: [] };

    const allQuestions = form.questions?.length
      ? form.questions
      : form.sections
        ? form.sections.flatMap(s => s.questions || [])
        : [];

    const demoSection = form.sections?.find(s => s.section_type === 'demographics');
    const questSection = form.sections?.find(s => s.section_type === 'questionnaire');

    let demoIds = new Set();
    let questIds = new Set();

    if (demoSection) {
      (demoSection.questions || []).forEach(q => demoIds.add(q.id));
    }
    if (questSection) {
      (questSection.questions || []).forEach(q => questIds.add(q.id));
    }

    // Fallback: if no section_type metadata, split by index
    if (demoIds.size === 0 && questIds.size === 0) {
      const systemFields = ['RESP-01', 'RESP-02', 'A1', 'A2', 'A3'];
      allQuestions.forEach(q => {
        const code = String(q.code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const isSystem = systemFields.some(sf => code === sf || code === sf.replace('-', ''));
        if (isSystem || q.type === 'profile_photo' || q.type === 'respondent_name' || q.type === 'location_text') {
          demoIds.add(q.id);
        } else {
          questIds.add(q.id);
        }
      });
    }

    const demo = allQuestions.filter(q => demoIds.has(q.id));
    const quest = allQuestions.filter(q => questIds.has(q.id));

    return { demographicsQuestions: demo, questionnaireQuestions: quest };
  }, [form]);

  const getQuestionAnalyticsLabel = (questionData, index) =>
    getQuestionLabel(questionCodeMap.get(questionData?.question_id) || questionData, index);

  const escapeCsvValue = (value) => `"${String(value).replace(/"/g, '""')}"`;

  const downloadAnalyticsCSV = () => {
    const rows = [];
    rows.push(['Form Title', form.title || '']);
    rows.push(['Total Submissions', totalResponses]);
    rows.push([]);

    // Demographics section
    if (demographicsData.length > 0) {
      rows.push(['--- DEMOGRAPHICS ---']);
      rows.push([]);
      demographicsData.forEach((question, index) => {
        rows.push([getQuestionAnalyticsLabel(question, index)]);
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
        } else {
          rows.push(['Response']);
          (question.responses || []).forEach((response) => {
            rows.push([response]);
          });
        }
        rows.push([]);
      });
    }

    // Questionnaire section
    if (questionnaireData.length > 0) {
      rows.push(['--- QUESTIONNAIRE ---']);
      rows.push([]);
      questionnaireData.forEach((question, index) => {
        rows.push([getQuestionAnalyticsLabel(question, index)]);
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
    }

    // Profile photos section
    if (profilePhotos.length > 0) {
      rows.push(['--- PROFILE PHOTOS ---']);
      rows.push(['Respondent', 'Photo URL']);
      profilePhotos.forEach(p => {
        rows.push([p.respondentName || 'Unknown', p.photoUrl || '']);
      });
      rows.push([]);
    }

    const csv = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(form.title || 'form').replace(/\s+/g, '_')}-analytics.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  const getChartColors = (count) => CHART_COLORS.slice(0, Math.max(count, 1));

  // Demographics summary stats (must be before early return)
  const locationStats = useMemo(() => {
    const stats = { municipalities: {}, barangays: {}, provinces: {} };
    responses.forEach(r => {
      if (r.municipality) stats.municipalities[r.municipality] = (stats.municipalities[r.municipality] || 0) + 1;
      if (r.barangay) stats.barangays[r.barangay] = (stats.barangays[r.barangay] || 0) + 1;
      if (r.province) stats.provinces[r.province] = (stats.provinces[r.province] || 0) + 1;
    });
    return stats;
  }, [responses]);

  // Location distribution chart data (must be before early return)
  const locationChartData = useMemo(() => {
    const data = [];
    Object.entries(locationStats.provinces || {}).forEach(([name, count]) => {
      data.push({ name, value: count, type: 'Province' });
    });
    Object.entries(locationStats.municipalities || {}).forEach(([name, count]) => {
      data.push({ name, value: count, type: 'Municipality' });
    });
    return data.slice(0, 20); // Top 20
  }, [locationStats]);

  if (loading || !form || !analytics) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <p>Loading analytics...</p>
      </div>
    );
  }

  const totalResponses = analytics.total_responses || 0;

  // Split analytics into demographics and questionnaire
  const allAnalyticsData = (analytics.questions || []).filter(questionData => {
    if (!questionData) return false;
    const mapped = questionCodeMap.get(questionData.question_id) || questionData;
    return !isReservedField(mapped);
  });

  const demographicsData = allAnalyticsData.filter(q => {
    const qDef = questionCodeMap.get(q.question_id) || q;
    return demographicsQuestions.some(dq => dq.id === qDef.id || dq.id === q.question_id);
  });

  const questionnaireData = allAnalyticsData.filter(q => {
    const qDef = questionCodeMap.get(q.question_id) || q;
    return questionnaireQuestions.some(qq => qq.id === qDef.id || qq.id === q.question_id);
  });

  // Profile photos from responses
  const profilePhotos = responses
    .filter(r => r.profile_photo_url)
    .map(r => ({
      photoUrl: r.profile_photo_url,
      respondentName: r.full_name || r.respondent_id || 'Unknown',
      respondentId: r.respondent_id || '',
    }));

  const StatCard = ({ label, value, tint }) => (
    <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold ${tint}`}>{value}</p>
    </Card>
  );

  const QuestionHeader = ({ questionData, badgeText, index, badgeColor = 'cyan' }) => {
    const colorClasses = {
      cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
      purple: 'bg-purple-50 text-purple-700 ring-purple-100',
      emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    };
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${colorClasses[badgeColor] || colorClasses.cyan}`}>
            {badgeText}
          </span>
          <h3 className="text-lg font-bold text-slate-900">{getQuestionAnalyticsLabel(questionData, index)}</h3>
        </div>
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-emerald-600">{questionData.totalAnswered || 0} answered</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-slate-400">{questionData.totalNoAnswer || 0} not answered</span>
        </div>
      </div>
    );
  };

  const ChartFooter = ({ chartData }) => (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {chartData.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: getChartColors(chartData.length)[idx] }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
            <p className="text-sm text-slate-500">{item.value} responses</p>
          </div>
        </div>
      ))}
    </div>
  );

  const ChoiceChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={320}>
      {chartType === "bar" ? (
        <BarChart data={data} margin={{ top: 10, right: 20, left: -12, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fill: '#64748b' }} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }} />
          <Bar dataKey="value" name="Responses" radius={[8, 8, 0, 0]}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Bar>
        </BarChart>
      ) : (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Pie>
          <Tooltip content={renderTooltip} />
          <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
        </PieChart>
      )}
    </ResponsiveContainer>
  );

  const RatingChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={320}>
      {chartType === "bar" ? (
        <BarChart data={data} margin={{ top: 10, right: 20, left: -12, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
          <YAxis tick={{ fill: '#64748b' }} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }} />
          <Bar dataKey="value" name="Responses" radius={[8, 8, 0, 0]}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Bar>
        </BarChart>
      ) : (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Pie>
          <Tooltip content={renderTooltip} />
          <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
        </PieChart>
      )}
    </ResponsiveContainer>
  );

  const renderQuestionChart = (questionData, index, badgeColor) => {
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(questionData.type)) {
      const chartData = (questionData.responses || []).map(r => ({ name: r.option, value: r.count }));
      if (chartData.length === 0) return null;
      return (
        <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <QuestionHeader questionData={questionData} badgeText={questionData.type.replace('_', ' ')} index={index} badgeColor={badgeColor} />
          <ChoiceChart data={chartData} />
          <ChartFooter chartData={chartData} />
        </Card>
      );
    }

    if (questionData.type === 'rating') {
      const distribution = questionData.distribution || {};
      const chartData = Object.entries(distribution)
        .map(([rating, count]) => ({ name: rating === 'Not answered' ? 'Not answered' : `${rating} Star`, value: count }))
        .filter(d => d.value > 0);
      const validRatings = (questionData.responses || []).filter(r => !isNoAnswer(r));
      const avgRating = validRatings.length ? (validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1) : '-';
      if (chartData.length === 0) return null;
      return (
        <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <QuestionHeader questionData={questionData} badgeText="Rating" index={index} badgeColor={badgeColor} />
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-amber-200">
              Avg {avgRating} / 5
            </span>
            <span className="text-xs text-slate-400">excluding not answered</span>
          </div>
          <RatingChart data={chartData} />
          <ChartFooter chartData={chartData} />
        </Card>
      );
    }

    if ((questionData.responses || []).length === 0 && (questionData.totalNoAnswer || 0) > 0) {
      return (
        <Card key={index} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <QuestionHeader questionData={questionData} badgeText={questionData.type.replace('_', ' ')} index={index} badgeColor={badgeColor} />
          <p className="text-sm italic text-slate-400">No responses provided.</p>
        </Card>
      );
    }

    return (
      <Card key={index} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <QuestionHeader questionData={questionData} badgeText={questionData.type.replace('_', ' ')} index={index} badgeColor={badgeColor} />
        <div className="grid gap-2 sm:grid-cols-2">
          {(questionData.responses || []).map((response, idx) => (
            <div key={idx} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-sm text-slate-700">{response}</p>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Button variant="ghost" onClick={goBack} className="text-slate-600">
            <ArrowLeft className="mr-2 h-4 w-4" /> {backState?.project_id ? 'Back' : 'Dashboard'}
          </Button>
          {totalResponses > 0 && (
            <Button variant="outline" onClick={downloadAnalyticsCSV} className="border-cyan-300 text-cyan-700 hover:bg-cyan-50">
              <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
          )}
        </div>
      </header>

      <div ref={exportRef} className="px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <p className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Analytics overview</p>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{form.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium text-white ring-1 ring-white/20">
              <BarChart3 className="h-3.5 w-3.5" />
              {totalResponses} {totalResponses === 1 ? 'submission' : 'submissions'}
            </span>
          </div>
        </section>

        {totalResponses > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Submissions" value={totalResponses} tint="text-cyan-600" />
            <StatCard label="Questions Analyzed" value={allAnalyticsData.length} tint="text-blue-600" />
            <StatCard label="Demographics" value={demographicsData.length} tint="text-purple-600" />
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
          </div>
        )}

        {totalResponses === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-600">
              <Inbox className="h-10 w-10" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No data to analyze yet</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Share your form and start collecting responses — analytics will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Demographics Section */}
            {demographicsData.length > 0 && (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Demographics</h2>
                    <p className="text-sm text-slate-500">Respondent information and profile data</p>
                  </div>
                </div>

                {/* Profile Photos Gallery */}
                {profilePhotos.length > 0 && (
                  <Card className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-purple-600" />
                      <h3 className="text-lg font-bold text-slate-900">Profile Photos ({profilePhotos.length})</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {profilePhotos.map((photo, idx) => (
                        <div key={idx} className="group relative">
                          <div className="aspect-square overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-sm transition group-hover:border-cyan-400 group-hover:shadow-md">
                            <img
                              src={photo.photoUrl}
                              alt={photo.respondentName}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden h-full w-full items-center justify-center bg-slate-100">
                              <User className="h-8 w-8 text-slate-300" />
                            </div>
                          </div>
                          <p className="mt-2 truncate text-center text-xs font-medium text-slate-600">{photo.respondentName}</p>
                          {photo.respondentId && (
                            <p className="truncate text-center text-[10px] text-slate-400">{photo.respondentId}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Location Distribution */}
                {locationChartData.length > 0 && (
                  <Card className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-lg font-bold text-slate-900">Location Distribution</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(200, locationChartData.length * 35)}>
                      {chartType === 'bar' ? (
                        <BarChart data={locationChartData} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fill: '#64748b' }} />
                          <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 12 }} width={110} />
                          <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }} />
                          <Bar dataKey="value" name="Count" radius={[0, 8, 8, 0]}>
                            {locationChartData.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.type === 'Province' ? '#8b5cf6' : '#0ea5e9'} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : (
                        <PieChart>
                          <Pie data={locationChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                            {locationChartData.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.type === 'Province' ? '#8b5cf6' : '#0ea5e9'} />
                            ))}
                          </Pie>
                          <Tooltip content={renderTooltip} />
                          <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Demographics Questions */}
                <div className="space-y-6">
                  {demographicsData.map((questionData, index) =>
                    renderQuestionChart(questionData, index, 'purple')
                  )}
                </div>
              </div>
            )}

            {/* Questionnaire Section */}
            {questionnaireData.length > 0 && (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Questionnaire Results</h2>
                    <p className="text-sm text-slate-500">Survey questions and response analytics</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {questionnaireData.map((questionData, index) =>
                    renderQuestionChart(questionData, index, 'cyan')
                  )}
                </div>
              </div>
            )}

            {/* If no section split worked, show all */}
            {demographicsData.length === 0 && questionnaireData.length === 0 && allAnalyticsData.length > 0 && (
              <div className="space-y-6">
                {allAnalyticsData.map((questionData, index) =>
                  renderQuestionChart(questionData, index, 'cyan')
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormAnalytics;
