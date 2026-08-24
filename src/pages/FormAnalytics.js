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

  const { demographicsQuestions, questionnaireQuestions } = useMemo(() => {
    if (!form) return { demographicsQuestions: [], questionnaireQuestions: [] };

    const allQuestions = form.questions?.length
      ? form.questions
      : form.sections
        ? form.sections.flatMap(s => s.questions || [])
        : [];

    let demoIds = new Set();
    let questIds = new Set();

    (form.sections || [])
      .filter(s => s.section_type === 'demographics')
      .forEach(s => {
        (s.questions || []).forEach(q => demoIds.add(q.id));
      });
    (form.sections || [])
      .filter(s => s.section_type === 'questionnaire')
      .forEach(s => {
        (s.questions || []).forEach(q => questIds.add(q.id));
      });

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

  const locationStats = useMemo(() => {
    const stats = { municipalities: {}, barangays: {}, provinces: {} };
    responses.forEach(r => {
      if (r.municipality) stats.municipalities[r.municipality] = (stats.municipalities[r.municipality] || 0) + 1;
      if (r.barangay) stats.barangays[r.barangay] = (stats.barangays[r.barangay] || 0) + 1;
      if (r.province) stats.provinces[r.province] = (stats.provinces[r.province] || 0) + 1;
    });
    return stats;
  }, [responses]);

  const locationChartData = useMemo(() => {
    const data = [];
    Object.entries(locationStats.provinces || {}).forEach(([name, count]) => {
      data.push({ name, value: count, type: 'Province' });
    });
    Object.entries(locationStats.municipalities || {}).forEach(([name, count]) => {
      data.push({ name, value: count, type: 'Municipality' });
    });
    return data.slice(0, 20);
  }, [locationStats]);

  if (loading || !form || !analytics) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />
          <p className="text-sm font-medium text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const totalResponses = analytics.total_responses || 0;

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

  const profilePhotos = responses
    .filter(r => r.profile_photo_url)
    .map(r => ({
      photoUrl: r.profile_photo_url,
      respondentName: r.full_name || r.respondent_id || 'Unknown',
      respondentId: r.respondent_id || '',
    }));

  const totalBeneficiaries = responses.filter(r => r.is_beneficiary === true || r.is_beneficiary === 'true').length;
  const totalNonBeneficiaries = totalResponses - totalBeneficiaries;

  const ChartFooter = ({ chartData }) => (
    <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Answer Distribution</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-100">
            <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: getChartColors(chartData.length)[idx] }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700">{item.name}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const ChoiceChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={300}>
      {chartType === "bar" ? (
        <BarChart data={data} margin={{ top: 10, right: 20, left: -12, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.04)' }} />
          <Bar dataKey="value" name="Responses" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Bar>
        </BarChart>
      ) : (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Pie>
          <Tooltip content={renderTooltip} />
          <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
        </PieChart>
      )}
    </ResponsiveContainer>
  );

  const RatingChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={300}>
      {chartType === "bar" ? (
        <BarChart data={data} margin={{ top: 10, right: 20, left: -12, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.04)' }} />
          <Bar dataKey="value" name="Responses" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((entry, i) => <Cell key={`cell-${i}`} fill={getChartColors(data.length)[i]} />)}
          </Bar>
        </BarChart>
      ) : (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
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
        <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${badgeColor === 'purple' ? 'bg-purple-50 text-purple-600' : 'bg-sky-50 text-sky-600'}`}>
                  {questionData.type.replace('_', ' ')}
                </span>
                <h3 className="text-[15px] font-semibold text-slate-800">{getQuestionAnalyticsLabel(questionData, index)}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-600">{questionData.totalAnswered || 0} answered</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500">{questionData.totalNoAnswer || 0} not answered</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ChoiceChart data={chartData} />
            <ChartFooter chartData={chartData} />
          </div>
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
        <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600">
                  Rating
                </span>
                <h3 className="text-[15px] font-semibold text-slate-800">{getQuestionAnalyticsLabel(questionData, index)}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-600">
                  <svg className="h-3.5 w-3.5 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  Avg {avgRating} / 5
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-600">{questionData.totalAnswered || 0} answered</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500">{questionData.totalNoAnswer || 0} not answered</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <RatingChart data={chartData} />
            <ChartFooter chartData={chartData} />
          </div>
        </Card>
      );
    }

    if ((questionData.responses || []).length === 0 && (questionData.totalNoAnswer || 0) > 0) {
      return (
        <Card key={index} className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${badgeColor === 'purple' ? 'bg-purple-50 text-purple-600' : 'bg-sky-50 text-sky-600'}`}>
              {questionData.type.replace('_', ' ')}
            </span>
            <h3 className="text-[15px] font-semibold text-slate-800">{getQuestionAnalyticsLabel(questionData, index)}</h3>
          </div>
          <p className="text-sm italic text-slate-400">No responses provided.</p>
        </Card>
      );
    }

    return (
      <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${badgeColor === 'purple' ? 'bg-purple-50 text-purple-600' : 'bg-sky-50 text-sky-600'}`}>
                {questionData.type.replace('_', ' ')}
              </span>
              <h3 className="text-[15px] font-semibold text-slate-800">{getQuestionAnalyticsLabel(questionData, index)}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-600">{questionData.totalAnswered || 0} answered</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500">{questionData.totalNoAnswer || 0} not answered</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Responses</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(questionData.responses || []).map((response, idx) => (
                <div key={idx} className="rounded-lg bg-white p-3 ring-1 ring-slate-100">
                  <p className="text-sm text-slate-700">{response}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-3 py-4 sm:px-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              {backState?.project_id ? 'Back' : 'Dashboard'}
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-900">{form.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalResponses > 0 && (
              <span className="hidden rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-600 ring-1 ring-cyan-100 sm:inline-flex">
                {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
              </span>
            )}
            {totalResponses > 0 && (
              <Button variant="outline" size="sm" onClick={downloadAnalyticsCSV} className="gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div ref={exportRef} className="w-full px-3 pb-24 pt-0 sm:px-4">
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Analytics Overview</p>
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{form.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium text-white/90 ring-1 ring-white/10">
              <BarChart3 className="h-3.5 w-3.5" />
              {totalResponses} {totalResponses === 1 ? 'submission' : 'submissions'}
            </span>
          </div>
        </section>

        {totalResponses > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-5 lg:grid-cols-5">
            <Card className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Responses</p>
              <p className="mt-1.5 text-3xl font-bold text-cyan-600">{totalResponses}</p>
            </Card>
            <Card className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Beneficiaries</p>
              <p className="mt-1.5 text-3xl font-bold text-emerald-600">{totalBeneficiaries}</p>
            </Card>
            <Card className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Non-Beneficiaries</p>
              <p className="mt-1.5 text-3xl font-bold text-violet-600">{totalNonBeneficiaries}</p>
            </Card>
            <Card className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Questions</p>
              <p className="mt-1.5 text-3xl font-bold text-blue-600">{allAnalyticsData.length}</p>
            </Card>
            <div className="flex items-stretch rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${chartType === 'bar' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
              >
                <ChartColumnBig className="h-4 w-4" /> Bar
              </button>
              <button
                type="button"
                onClick={() => setChartType('pie')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${chartType === 'pie' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
              >
                <ChartPie className="h-4 w-4" /> Pie
              </button>
            </div>
          </div>
        )}

        {totalResponses === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
              <Inbox className="h-10 w-10" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No responses yet</h3>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
              Share your form and start collecting responses. Analytics will appear here automatically once data comes in.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {demographicsData.length > 0 && (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Demographics</h2>
                    <p className="text-xs text-slate-400">Respondent information and profile data</p>
                  </div>
                </div>

                {profilePhotos.length > 0 && (
                  <Card className="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-purple-500" />
                        <h3 className="text-sm font-bold text-slate-800">Profile Photos</h3>
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-600">{profilePhotos.length}</span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {profilePhotos.map((photo, idx) => (
                          <div key={idx} className="group relative">
                            <div className="aspect-square overflow-hidden rounded-2xl border-2 border-slate-100 bg-slate-50 transition-all group-hover:border-cyan-300 group-hover:shadow-md">
                              <img
                                src={photo.photoUrl}
                                alt={photo.respondentName}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="hidden h-full w-full items-center justify-center bg-slate-50">
                                <User className="h-8 w-8 text-slate-200" />
                              </div>
                            </div>
                            <p className="mt-2 truncate text-center text-xs font-medium text-slate-600">{photo.respondentName}</p>
                            {photo.respondentId && (
                              <p className="truncate text-center text-[10px] text-slate-300">{photo.respondentId}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {locationChartData.length > 0 && (
                  <Card className="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-slate-800">Location Distribution</h3>
                      </div>
                    </div>
                    <div className="p-6">
                      <ResponsiveContainer width="100%" height={Math.max(200, locationChartData.length * 35)}>
                        {chartType === 'bar' ? (
                          <BarChart data={locationChartData} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
                            <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.04)' }} />
                            <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                              {locationChartData.map((entry, i) => (
                                <Cell key={`cell-${i}`} fill={entry.type === 'Province' ? '#8b5cf6' : '#0ea5e9'} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <PieChart>
                            <Pie data={locationChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                              {locationChartData.map((entry, i) => (
                                <Cell key={`cell-${i}`} fill={entry.type === 'Province' ? '#8b5cf6' : '#0ea5e9'} />
                              ))}
                            </Pie>
                            <Tooltip content={renderTooltip} />
                            <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                <div className="space-y-6">
                  {demographicsData.map((questionData, index) =>
                    renderQuestionChart(questionData, index, 'purple')
                  )}
                </div>
              </div>
            )}

            {questionnaireData.length > 0 && (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <BarChart3 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Questionnaire Results</h2>
                    <p className="text-xs text-slate-400">Survey questions and response analytics</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {questionnaireData.map((questionData, index) =>
                    renderQuestionChart(questionData, index, 'cyan')
                  )}
                </div>
              </div>
            )}

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
