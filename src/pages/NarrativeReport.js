import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
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
  User,
  MapPin,
  Camera,
  Users,
  ArrowLeft,
  Calendar,
  TrendingUp,
  ClipboardList,
  Hash,
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
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;
  const navigate = useNavigate();
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

  const { beforeDemographics, beforeQuestionnaire, afterDemographics, afterQuestionnaire } = useMemo(() => {
    const splitQuestions = (form, questions) => {
      if (!form) return { demographics: [], questionnaire: [] };
      const demoSection = form.sections?.find(s => s.section_type === 'demographics');
      const questSection = form.sections?.find(s => s.section_type === 'questionnaire');
      let demoIds = new Set();
      let questIds = new Set();
      if (demoSection) (demoSection.questions || []).forEach(q => demoIds.add(q.id));
      if (questSection) (questSection.questions || []).forEach(q => questIds.add(q.id));
      if (demoIds.size === 0 && questIds.size === 0) {
        const systemFields = ['RESP-01', 'RESP-02', 'A1', 'A2', 'A3'];
        questions.forEach(q => {
          const code = String(q.code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const isSystem = systemFields.some(sf => code === sf || code === sf.replace('-', ''));
          if (isSystem || q.type === 'profile_photo' || q.type === 'respondent_name' || q.type === 'location_text') {
            demoIds.add(q.id);
          } else {
            questIds.add(q.id);
          }
        });
      }
      return {
        demographics: questions.filter(q => demoIds.has(q.id)),
        questionnaire: questions.filter(q => questIds.has(q.id)),
      };
    };
    const bDemo = splitQuestions(beforeForm, beforeQuestions);
    const aDemo = splitQuestions(afterForm, afterQuestions);
    return {
      beforeDemographics: bDemo.demographics,
      beforeQuestionnaire: bDemo.questionnaire,
      afterDemographics: aDemo.demographics,
      afterQuestionnaire: aDemo.questionnaire,
    };
  }, [beforeForm, afterForm, beforeQuestions, afterQuestions]);

  const comparisonData = useMemo(() => {
    const paired = [];

    beforeQuestionnaire.forEach((bq) => {
      const aq = afterQuestionnaire.find((a) => a.code === bq.code || a.title === bq.title);
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
  }, [beforeQuestionnaire, afterQuestionnaire, beforeResponses, afterResponses]);

  const demographicsComparison = useMemo(() => {
    const paired = [];
    beforeDemographics.forEach((bq) => {
      if (bq.type === 'profile_photo') return;
      const aq = afterDemographics.find((a) => a.code === bq.code || a.title === bq.title);
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
        paired.push({ question: bq, afterQuestion: aq, type: bq.type, data, beforeAnalytics, afterAnalytics });
      } else if (bq.type === 'rating') {
        const beforeAnalytics = computeQuestionAnalytics(beforeResponses, bq);
        const afterAnalytics = computeQuestionAnalytics(afterResponses, aq);
        paired.push({
          question: bq, afterQuestion: aq, type: 'rating',
          beforeAvg: beforeAnalytics.average || 0, afterAvg: afterAnalytics.average || 0,
          beforeDistribution: beforeAnalytics.distribution || {}, afterDistribution: afterAnalytics.distribution || {},
          beforeAnalytics, afterAnalytics,
        });
      }
    });
    return paired;
  }, [beforeDemographics, afterDemographics, beforeResponses, afterResponses]);

  const beforeProfilePhotos = useMemo(() =>
    beforeResponses.filter(r => r.profile_photo_url).map(r => ({
      photoUrl: r.profile_photo_url,
      name: r.full_name || r.respondent_id || 'Unknown',
      id: r.respondent_id || '',
    })),
  [beforeResponses]);

  const afterProfilePhotos = useMemo(() =>
    afterResponses.filter(r => r.profile_photo_url).map(r => ({
      photoUrl: r.profile_photo_url,
      name: r.full_name || r.respondent_id || 'Unknown',
      id: r.respondent_id || '',
    })),
  [afterResponses]);

  const locationComparison = useMemo(() => {
    const countBy = (responses, field) => {
      const counts = {};
      responses.forEach(r => {
        if (r[field]) counts[r[field]] = (counts[r[field]] || 0) + 1;
      });
      return counts;
    };
    const provinces = {
      before: countBy(beforeResponses, 'province'),
      after: countBy(afterResponses, 'province'),
    };
    const municipalities = {
      before: countBy(beforeResponses, 'municipality'),
      after: countBy(afterResponses, 'municipality'),
    };
    const barangays = {
      before: countBy(beforeResponses, 'barangay'),
      after: countBy(afterResponses, 'barangay'),
    };

    const buildChartData = (beforeCounts, afterCounts) => {
      const allKeys = new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)]);
      return Array.from(allKeys).map(name => ({
        name,
        Before: beforeCounts[name] || 0,
        After: afterCounts[name] || 0,
      }));
    };

    return {
      provinces: buildChartData(provinces.before, provinces.after),
      municipalities: buildChartData(municipalities.before, municipalities.after),
      barangays: buildChartData(barangays.before, barangays.after),
    };
  }, [beforeResponses, afterResponses]);

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

  const handlePrint = () => {
    window.print();
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

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading || !project) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3 w-32 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-72 w-full animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!project.before_form || !project.after_form) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200">
          <Inbox className="h-12 w-12 text-slate-300" />
        </div>
        <h3 className="mb-3 text-2xl font-bold text-slate-900">Incomplete Setup</h3>
        <p className="max-w-md text-center text-sm leading-relaxed text-slate-500">
          {!project.before_form && !project.after_form
            ? 'Create both Before and After questionnaires to generate a narrative report.'
            : !project.before_form
            ? 'Create the Before questionnaire first to begin comparison analysis.'
            : 'Create the After questionnaire to compare results with the Before survey.'}
        </p>
        <Button onClick={() => navigate(-1)} variant="outline" className="mt-6 rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  if (comparisonData.length === 0 && beforeResponses.length === 0 && afterResponses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200">
          <ClipboardList className="h-12 w-12 text-slate-300" />
        </div>
        <h3 className="mb-3 text-2xl font-bold text-slate-900">No Responses Yet</h3>
        <p className="max-w-md text-center text-sm leading-relaxed text-slate-500">
          Collect responses from both Before and After questionnaires to see comparison data here.
        </p>
        <Button onClick={() => navigate(-1)} variant="outline" className="mt-6 rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const hasDemographicsData = demographicsComparison.length > 0 || beforeProfilePhotos.length > 0 || afterProfilePhotos.length > 0 || locationComparison.provinces.length > 0;

  const renderComparisonCard = (item, index) => {
    const qLabel = getQuestionLabel(item.question, index);

    if (item.type === 'rating') {
      const change = getChangeDirection(item.beforeAvg, item.afterAvg);
      const ChangeIcon = change.icon;
      const distData = Object.keys(item.beforeDistribution || {}).map((rating) => ({
        name: rating === 'Not answered' ? 'N/A' : `${rating} Star`,
        Before: item.beforeDistribution[rating] || 0,
        After: item.afterDistribution[rating] || 0,
      }));

      const beforeBarData = distData.map((d) => ({ name: d.name, value: d.Before }));
      const afterBarData = distData.map((d) => ({ name: d.name, value: d.After }));

      return (
        <Card key={index} className="overflow-hidden rounded-2xl border-0 bg-white shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/50">
                  <TrendingUp className="h-3 w-3" />
                  Rating
                </span>
                <h3 className="text-base font-bold text-slate-900">{qLabel}</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Before</p>
                  <p className="text-xl font-bold text-blue-600">{item.beforeAvg.toFixed(1)}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200/50 ${change.color}`}>
                  <ChangeIcon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">After</p>
                  <p className="text-xl font-bold text-teal-600">{item.afterAvg.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Before</p>
                </div>
                <div className="rounded-xl bg-blue-50/40 p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={beforeBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }} />
                      <Bar dataKey="value" name="Responses" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">After</p>
                </div>
                <div className="rounded-xl bg-teal-50/40 p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={afterBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ccfbf1" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(20, 184, 166, 0.06)' }} />
                      <Bar dataKey="value" name="Responses" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    const beforeBarData = item.data.map((d) => ({ option: d.option, value: parseFloat(d.before) }));
    const afterBarData = item.data.map((d) => ({ option: d.option, value: parseFloat(d.after) }));

    return (
      <Card key={index} className="overflow-hidden rounded-2xl border-0 bg-white shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/50">
              <BarChart3 className="h-3 w-3" />
              {item.type.replace('_', ' ')}
            </span>
            <h3 className="text-base font-bold text-slate-900">{qLabel}</h3>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Before</p>
              </div>
              <div className="rounded-xl bg-blue-50/40 p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={beforeBarData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" vertical={false} />
                    <XAxis dataKey="option" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: '%', position: 'insideTopLeft', offset: 10 }} />
                    <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }} />
                    <Bar dataKey="value" name="Before" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">After</p>
              </div>
              <div className="rounded-xl bg-teal-50/40 p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={afterBarData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccfbf1" vertical={false} />
                    <XAxis dataKey="option" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: '%', position: 'insideTopLeft', offset: 10 }} />
                    <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(20, 184, 166, 0.06)' }} />
                    <Bar dataKey="value" name="After" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl ring-1 ring-slate-200/60">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Option</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-blue-600">Before</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-teal-600">After</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {item.data.map((d, i) => {
                  const diff = parseFloat(d.after) - parseFloat(d.before);
                  const diffColor = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400';
                  const DiffIcon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
                  return (
                    <tr key={i} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{d.option}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{d.before}% <span className="text-blue-400/70">({d.beforeCount})</span></td>
                      <td className="px-4 py-3 text-right text-teal-600">{d.after}% <span className="text-teal-400/70">({d.afterCount})</span></td>
                      <td className={`px-4 py-3 text-right font-semibold ${diffColor}`}>
                        <span className="inline-flex items-center gap-1">
                          <DiffIcon className="h-3.5 w-3.5" />
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-white shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative px-8 py-10 sm:px-12 sm:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white/90"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Project
              </button>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-blue-300 ring-1 ring-blue-400/20">
                  Narrative Report
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{project.title}</h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                Generated {generatedDate}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={generatePDF}
                disabled={generating}
                className="rounded-xl px-5 py-2.5 bg-white text-slate-900 shadow-lg shadow-black/10 hover:bg-slate-50"
              >
                <Download className="mr-2 h-4 w-4" />
                {generating ? 'Generating...' : 'Export PDF'}
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="rounded-xl px-5 py-2.5 border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Card className="rounded-2xl border-0 bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-200/50">
              <ArrowDownRight className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Before Responses</p>
              <p className="text-2xl font-bold text-blue-600">{beforeResponses.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border-0 bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 ring-1 ring-teal-200/50">
              <ArrowUpRight className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">After Responses</p>
              <p className="text-2xl font-bold text-teal-600">{afterResponses.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border-0 bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-200/50">
              <Hash className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Compared</p>
              <p className="text-2xl font-bold text-violet-600">{comparisonData.length}</p>
            </div>
          </div>
        </Card>
        <div className="flex items-center gap-1 rounded-2xl border-0 bg-white p-1.5 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
              chartType === 'bar'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <ChartColumnBig className="h-4 w-4" /> Bar
          </button>
          <button
            type="button"
            onClick={() => setChartType('pie')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
              chartType === 'pie'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <ChartPie className="h-4 w-4" /> Pie
          </button>
        </div>
      </section>

      <div ref={reportRef} className="space-y-10">
        {hasDemographicsData && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                <User className="h-4.5 w-4.5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Demographics Comparison</h2>
                <p className="text-xs text-slate-500">Respondent profiles and location distribution</p>
              </div>
            </div>

            {(beforeProfilePhotos.length > 0 || afterProfilePhotos.length > 0) && (
              <Card className="mb-6 overflow-hidden rounded-2xl border-0 bg-white shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-violet-500" />
                    <h3 className="text-base font-bold text-slate-900">Profile Photos</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Before ({beforeProfilePhotos.length})</p>
                      </div>
                      {beforeProfilePhotos.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 py-8 text-left text-sm italic text-slate-400">No photos collected</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {beforeProfilePhotos.map((photo, idx) => (
                            <div key={idx} className="text-center">
                              <div className="aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-blue-200/50">
                                <img src={photo.photoUrl} alt={photo.name} className="h-full w-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                <div className="hidden h-full w-full items-center justify-center"><User className="h-6 w-6 text-slate-300" /></div>
                              </div>
                              <p className="mt-1.5 truncate text-[10px] font-medium text-slate-500">{photo.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">After ({afterProfilePhotos.length})</p>
                      </div>
                      {afterProfilePhotos.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 py-8 text-left text-sm italic text-slate-400">No photos collected</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {afterProfilePhotos.map((photo, idx) => (
                            <div key={idx} className="text-center">
                              <div className="aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-teal-200/50">
                                <img src={photo.photoUrl} alt={photo.name} className="h-full w-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                <div className="hidden h-full w-full items-center justify-center"><User className="h-6 w-6 text-slate-300" /></div>
                              </div>
                              <p className="mt-1.5 truncate text-[10px] font-medium text-slate-500">{photo.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {locationComparison.provinces.length > 0 && (
              <Card className="mb-6 overflow-hidden rounded-2xl border-0 bg-white shadow-md shadow-slate-200/60 ring-1 ring-slate-200/60">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-teal-500" />
                    <h3 className="text-base font-bold text-slate-900">Location Distribution</h3>
                  </div>
                </div>
                <div className="space-y-6 p-6">
                  {[
                    { label: 'Provinces', data: locationComparison.provinces },
                    { label: 'Municipalities', data: locationComparison.municipalities },
                    { label: 'Barangays', data: locationComparison.barangays },
                  ].filter(section => section.data.length > 0).map((section) => (
                    <div key={section.label}>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{section.label}</p>
                      <div className="rounded-xl bg-slate-50/50 p-4">
                        <ResponsiveContainer width="100%" height={Math.max(180, section.data.length * 30)}>
                          <BarChart data={section.data} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                            <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }} />
                            <Legend />
                            <Bar dataKey="Before" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                            <Bar dataKey="After" fill="#14b8a6" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {demographicsComparison.length > 0 && (
              <div className="space-y-6">
                {demographicsComparison.map((item, index) => renderComparisonCard(item, index))}
              </div>
            )}
          </div>
        )}

        {comparisonData.length > 0 && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <BarChart3 className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Questionnaire Comparison</h2>
                <p className="text-xs text-slate-500">Before vs. After survey question responses</p>
              </div>
            </div>

            <div className="space-y-6">
              {comparisonData.map((item, index) => renderComparisonCard(item, index))}
            </div>
          </div>
        )}
      </div>

      {(comparisonData.length > 0 || hasDemographicsData) && (
        <div className="flex flex-col items-center gap-3 border-t border-slate-200/60 pt-8 sm:flex-row sm:justify-center">
          <Button onClick={saveReport} className="rounded-xl px-5 py-2.5 bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800">
            <FileText className="mr-2 h-4 w-4" /> Save Report
          </Button>
          <Button onClick={generatePDF} disabled={generating} variant="outline" className="rounded-xl px-5 py-2.5">
            <Download className="mr-2 h-4 w-4" />
            {generating ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={handlePrint} variant="outline" className="rounded-xl px-5 py-2.5">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
      )}
    </div>
  );
};

export default NarrativeReport;
