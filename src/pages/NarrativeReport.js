import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Download,
  Inbox,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Printer,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { normalizeLocationCodes, isReservedField, getQuestionLabel } from '../lib/preprocessing';
import { api } from '../lib/apiMiddleware';

const BEFORE_COLOR = '#2563eb';
const AFTER_COLOR = '#14b8a6';

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

// Numbered section heading, mirroring "1.0 INTRODUCTION" style of the technical report
const SectionHeading = ({ num, title }) => (
  <div className="mb-6 mt-12 border-b-2 border-slate-800 pb-3 first:mt-0">
    <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
      {num} {title}
    </h2>
  </div>
);

const SubHeading = ({ num, title }) => (
  <h3 className="mb-4 mt-8 text-base font-bold uppercase tracking-wide text-slate-800">
    {num} {title}
  </h3>
);

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

  const { beforeQuestionnaire, afterQuestionnaire } = useMemo(() => {
    const pickQuestionnaire = (form, questions) => {
      if (!form) return [];
      const questSection = form.sections?.find(s => s.section_type === 'questionnaire');
      const questIds = new Set();
      if (questSection) (questSection.questions || []).forEach(q => questIds.add(q.id));
      if (questIds.size === 0) {
        questions.forEach(q => {
          if (q.type !== 'profile_photo' && q.type !== 'respondent_name' && q.type !== 'location_text') {
            questIds.add(q.id);
          }
        });
      }
      return questions.filter(q => questIds.has(q.id));
    };
    return {
      beforeQuestionnaire: pickQuestionnaire(beforeForm, beforeQuestions),
      afterQuestionnaire: pickQuestionnaire(afterForm, afterQuestions),
    };
  }, [beforeForm, afterForm, beforeQuestions, afterQuestions]);

  const pairQuestions = (baseQuestions, baseResponses, targetQuestions, targetResponses) => {
    const paired = [];
    baseQuestions.forEach((bq) => {
      const aq = targetQuestions.find((a) =>
        (a.code && bq.code && a.code === bq.code) || a.title === bq.title
      );
      if (!aq) return;

      if (['multiple_choice', 'checkboxes', 'dropdown'].includes(bq.type)) {
        const beforeAnalytics = computeQuestionAnalytics(baseResponses, bq);
        const afterAnalytics = computeQuestionAnalytics(targetResponses, aq);

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
        const beforeAnalytics = computeQuestionAnalytics(baseResponses, bq);
        const afterAnalytics = computeQuestionAnalytics(targetResponses, aq);

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
  };

  const comparisonData = useMemo(
    () => pairQuestions(beforeQuestionnaire, beforeResponses, afterQuestionnaire, afterResponses),
    [beforeQuestionnaire, afterQuestionnaire, beforeResponses, afterResponses]
  );

  // ==================== AUTO-GENERATED NARRATIVE ====================
  const narrative = useMemo(() => {
    const pairedItems = comparisonData;
    const ratingItems = pairedItems.filter(i => i.type === 'rating');
    const choiceItems = pairedItems.filter(i => i.type !== 'rating');

    const ratingChanges = ratingItems.map(item => ({
      label: getQuestionLabel(item.question, 0),
      before: item.beforeAvg || 0,
      after: item.afterAvg || 0,
      delta: (item.afterAvg || 0) - (item.beforeAvg || 0),
    }));

    const optionChanges = [];
    choiceItems.forEach(item => {
      const qLabel = getQuestionLabel(item.question, 0);
      (item.data || []).forEach(d => {
        const b = parseFloat(d.before);
        const a = parseFloat(d.after);
        if (!isNaN(b) && !isNaN(a)) {
          optionChanges.push({ question: qLabel, option: d.option, before: b, after: a, diff: a - b });
        }
      });
    });

    const improvedRatings = ratingChanges.filter(r => r.delta >= 0.1).sort((a, b) => b.delta - a.delta);
    const declinedRatings = ratingChanges.filter(r => r.delta <= -0.1).sort((a, b) => a.delta - b.delta);
    const increasedOptions = optionChanges.filter(o => o.diff >= 1).sort((a, b) => b.diff - a.diff);
    const decreasedOptions = optionChanges.filter(o => o.diff <= -1).sort((a, b) => a.diff - b.diff);

    // ---- Executive summary highlights ----
    const highlights = [
      ...improvedRatings.slice(0, 2).map(r =>
        `average ratings for "${r.label}" rose from ${r.before.toFixed(1)} to ${r.after.toFixed(1)} (+${r.delta.toFixed(1)} points)`
      ),
      ...increasedOptions.slice(0, 2).map(o =>
        `"${o.option}" under ${o.question} grew from ${o.before.toFixed(1)}% to ${o.after.toFixed(1)}%`
      ),
    ];

    // ---- 4.1 Summary of Findings (numbered, data-cited) ----
    const findings = [];
    findings.push(
      `The Before (benchmark) phase captured ${beforeResponses.length} response${beforeResponses.length === 1 ? '' : 's'}, while the After (current) phase captured ${afterResponses.length} response${afterResponses.length === 1 ? '' : 's'}, covering ${comparisonData.length} comparable questionnaire indicator${comparisonData.length === 1 ? '' : 's'}.`
    );

    improvedRatings.slice(0, 3).forEach(r =>
      findings.push(`Average ratings for "${r.label}" rose from ${r.before.toFixed(1)} to ${r.after.toFixed(1)} (+${r.delta.toFixed(1)} points), indicating improved perception after the program.`)
    );
    declinedRatings.slice(0, 3).forEach(r =>
      findings.push(`Average ratings for "${r.label}" declined from ${r.before.toFixed(1)} to ${r.after.toFixed(1)} (${r.delta.toFixed(1)} points), suggesting an area requiring continued attention.`)
    );
    increasedOptions.slice(0, 4).forEach(o =>
      findings.push(`Selection of "${o.option}" under ${o.question} increased from ${o.before.toFixed(1)}% to ${o.after.toFixed(1)}% (${o.diff >= 0 ? '+' : ''}${o.diff.toFixed(1)} percentage points).`)
    );
    decreasedOptions.slice(0, 4).forEach(o =>
      findings.push(`Selection of "${o.option}" under ${o.question} decreased from ${o.before.toFixed(1)}% to ${o.after.toFixed(1)}% (${o.diff.toFixed(1)} percentage points).`)
    );

    if (!improvedRatings.length && !declinedRatings.length && !increasedOptions.length && !decreasedOptions.length) {
      findings.push('Overall, indicator values remained largely stable between the benchmark and current periods.');
    }

    if (afterResponses.length < beforeResponses.length) {
      findings.push(`Post-program participation (${afterResponses.length}) was lower than the benchmark phase (${beforeResponses.length}), which should be considered when interpreting the results.`);
    }

    // ---- 4.3 Recommendations ----
    const recommendations = [];
    if (improvedRatings.length > 0) {
      recommendations.push(`Sustain and scale up the program components associated with improvements in ${improvedRatings.slice(0, 2).map(r => `"${r.label}"`).join(' and ')}.`);
    } else {
      recommendations.push('Maintain current implementation strategies while identifying new opportunities to raise beneficiary satisfaction.');
    }
    if (declinedRatings.length > 0) {
      recommendations.push(`Conduct focused follow-up and refresher interventions targeting the areas that declined, particularly ${declinedRatings.slice(0, 2).map(r => `"${r.label}"`).join(' and ')}.`);
    }
    if (decreasedOptions.length > 0) {
      recommendations.push(`Investigate shifts in respondent answers such as "${decreasedOptions[0].option}" under ${decreasedOptions[0].question} to understand underlying causes and adjust program delivery accordingly.`);
    }
    if (increasedOptions.length > 0) {
      recommendations.push(`Leverage the momentum behind positive shifts such as "${increasedOptions[0].option}" through continued training, provision of resources, and community engagement.`);
    }
    if (afterResponses.length < beforeResponses.length) {
      recommendations.push('Strengthen participation in post-program monitoring to enhance the reliability of future impact assessments.');
    }
    recommendations.push('Institutionalize periodic benchmark-versus-current data collection to enable longitudinal tracking of the program\u2019s impact on fisherfolk communities.');

    return { highlights, findings, recommendations };
  }, [comparisonData, beforeResponses, afterResponses]);

  // Auto-written interpretation for a paired choice figure
  const describeChoiceItem = (item) => {
    const qLabel = getQuestionLabel(item.question, 0);
    const shifts = (item.data || [])
      .map(d => {
        const b = parseFloat(d.before);
        const a = parseFloat(d.after);
        return { ...d, before: b, after: a, diff: a - b };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const notable = shifts.filter(s => Math.abs(s.diff) >= 0.5).slice(0, 3);
    if (!notable.length) {
      return `Figure 3.${item._figNum} presents the distribution of responses for ${qLabel}. Values remained largely consistent between the benchmark and post-program phases.`;
    }
    const parts = notable.map(s =>
      `"${s.option}" ${s.diff > 0 ? 'rose' : s.diff < 0 ? 'declined' : 'held steady'} from ${s.before.toFixed(1)}% to ${s.after.toFixed(1)}% (${s.diff > 0 ? '+' : ''}${s.diff.toFixed(1)} pp)`
    );
    return `Figure 3.${item._figNum} compares the distribution of responses for ${qLabel} across the two survey phases. The most pronounced shifts were observed where ${parts.join('; ')}, suggesting a change in respondent conditions or perceptions following program implementation.`;
  };

  const describeRatingItem = (item) => {
    const qLabel = getQuestionLabel(item.question, 0);
    const delta = (item.afterAvg || 0) - (item.beforeAvg || 0);
    const direction = delta > 0.05 ? 'an improvement' : delta < -0.05 ? 'a decline' : 'essentially unchanged';
    return `Figure 3.${item._figNum} shows the rating distribution for ${qLabel}. The mean rating moved from ${item.beforeAvg.toFixed(1)} in the benchmark phase to ${item.afterAvg.toFixed(1)} in the current period — ${direction} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} points).`;
  };

  const renderTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl shadow-slate-900/10">
        {payload.map((item, idx) => (
          <p key={idx} style={{ color: item.color }} className="font-medium">
            {item.name}: {item.value}
          </p>
        ))}
      </div>
    );
  };

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
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

  const handlePrint = () => window.print();

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
          Collect responses from both Before and After questionnaires to generate the narrative report.
        </p>
        <Button onClick={() => navigate(-1)} variant="outline" className="mt-6 rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  // Sequential figure numbering across the findings section
  let figCounter = 0;

  // Paired-choice figure: grouped bars + data table + auto interpretation
  const renderChoiceFigure = (item, index) => {
    figCounter += 1;
    item._figNum = figCounter;
    const qLabel = getQuestionLabel(item.question, index);
    const chartData = item.data.map(d => ({ option: d.option, Before: parseFloat(d.before), After: parseFloat(d.after) }));

    return (
      <figure key={index} className="print-break-inside-avoid mb-10 break-inside-avoid-page">
        <figcaption className="mb-3 text-sm font-semibold text-slate-800">
          Figure 3.{item._figNum} — {qLabel}
        </figcaption>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="option" tick={{ fill: '#475569', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: '%', position: 'insideTopLeft', offset: 10 }} />
              <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Before" fill={BEFORE_COLOR} radius={[4, 4, 0, 0]} />
              <Bar dataKey="After" fill={AFTER_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <table className="mt-4 min-w-full border border-slate-300 text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Option</th>
              <th className="border border-slate-300 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Benchmark (%)</th>
              <th className="border border-slate-300 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Current (%)</th>
              <th className="border border-slate-300 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Change (pp)</th>
            </tr>
          </thead>
          <tbody>
            {item.data.map((d, i) => {
              const diff = parseFloat(d.after) - parseFloat(d.before);
              const DiffIcon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
              const diffColor = diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-rose-700' : 'text-slate-400';
              return (
                <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                  <td className="border border-slate-300 px-3 py-2 font-medium text-slate-800">{d.option}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-600">{d.before} ({d.beforeCount})</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-600">{d.after} ({d.afterCount})</td>
                  <td className={`border border-slate-300 px-3 py-2 text-right font-semibold ${diffColor}`}>
                    <span className="inline-flex items-center gap-1">
                      <DiffIcon className="h-3.5 w-3.5" />
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-3 text-justify text-sm leading-relaxed text-slate-700">{describeChoiceItem(item)}</p>
      </figure>
    );
  };

  // Paired-rating figure: distribution bars + mean change callout + auto interpretation
  const renderRatingFigure = (item, index) => {
    figCounter += 1;
    item._figNum = figCounter;
    const qLabel = getQuestionLabel(item.question, index);
    const distData = Object.keys(item.beforeDistribution || {}).map(rating => ({
      name: `${rating}\u2605`,
      Before: item.beforeDistribution[rating] || 0,
      After: item.afterDistribution[rating] || 0,
    }));
    const delta = (item.afterAvg || 0) - (item.beforeAvg || 0);

    return (
      <figure key={index} className="print-break-inside-avoid mb-10 break-inside-avoid-page">
        <figcaption className="mb-3 text-sm font-semibold text-slate-800">
          Figure 3.{item._figNum} — {qLabel}
        </figcaption>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-6 text-sm">
            <span>Benchmark mean: <strong className="text-blue-700">{item.beforeAvg.toFixed(2)}</strong></span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
              {delta >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-rose-600" />}
              {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
            </span>
            <span>Current mean: <strong className="text-teal-700">{item.afterAvg.toFixed(2)}</strong></span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Before" fill={BEFORE_COLOR} radius={[4, 4, 0, 0]} />
              <Bar dataKey="After" fill={AFTER_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-3 text-justify text-sm leading-relaxed text-slate-700">{describeRatingItem(item)}</p>
      </figure>
    );
  };

  const totalComparable = comparisonData.length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 lg:px-8">
      {/* Floating toolbar (never printed) */}
      <div className="no-print sticky top-[72px] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePrint} variant="outline" className="rounded-xl px-4 py-2">
            <Printer className="mr-2 h-4 w-4" />
            Print to PDF
          </Button>
          <Button onClick={generatePDF} disabled={generating} className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
            <Download className="mr-2 h-4 w-4" />
            {generating ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* ==================== THE REPORT DOCUMENT ==================== */}
      <article ref={reportRef} className="rounded-lg bg-white px-8 py-10 shadow-sm ring-1 ring-slate-200 sm:px-14 sm:py-14">

        {/* ---------- COVER ---------- */}
        <header className="mb-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Technical Narrative Report</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-bold uppercase leading-snug text-slate-900">
            {project.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm italic leading-relaxed text-slate-600">
            An Impact Assessment of Program Beneficiaries Using Benchmark (Before) and Current (After) Survey Data
          </p>
          <div className="mx-auto mt-8 h-0.5 w-28 bg-slate-800" />
          <div className="mt-8 space-y-1 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Bureau of Fisheries and Aquatic Resources</p>
            <p>Generated on {generatedDate}</p>
          </div>
        </header>

        {/* ---------- EXECUTIVE SUMMARY ---------- */}
        <section>
          <SectionHeading num="" title="Executive Summary" />
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <p className="text-justify">
              This report evaluates the impact of {project.title} on fisherfolk-beneficiaries by comparing survey
              data collected before program implementation (benchmark) with data collected afterward (current).
              A total of {beforeResponses.length} benchmark response{beforeResponses.length === 1 ? '' : 's'} and{' '}
              {afterResponses.length} current response{afterResponses.length === 1 ? '' : 's'} were analyzed across{' '}
              {totalComparable} comparable indicator{totalComparable === 1 ? '' : 's'} covering program-relevant
              survey questions.
            </p>
            {narrative.highlights.length > 0 && (
              <p className="text-justify">
                Among the key results, {narrative.highlights.slice(0, 3).join('; ')}. These movements indicate the
                direction of change experienced by beneficiary households during the implementation period.
              </p>
            )}
            <p className="font-semibold text-slate-800">Major policy recommendations advanced by this report:</p>
            <ol className="list-inside list-decimal space-y-1 pl-2">
              {narrative.recommendations.slice(0, 5).map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ol>
            <p className="text-justify">
              Overall, the findings position {project.title} as a meaningful intervention for fisherfolk
              communities, while underscoring the importance of sustained support systems and continuous monitoring
              to secure long-term, inclusive development outcomes.
            </p>
          </div>
        </section>

        {/* ---------- 1.0 INTRODUCTION ---------- */}
        <section>
          <SectionHeading num="1.0" title="Introduction" />

          <SubHeading num="1.1" title="Rationale of the Project" />
          <div className="space-y-4 text-justify text-sm leading-relaxed text-slate-700">
            <p>
              Municipal fisheries remain a critical pillar of the Philippine economy and food system, sustaining the
              livelihoods of coastal households across the country. Yet fisherfolk continue to be among the most
              economically vulnerable groups, constrained by limited access to productive assets, exposure to
              climate and environmental risks, and inadequate institutional support. These structural challenges
              necessitate targeted, evidence-driven interventions.
            </p>
            <p>
              In response, {project.title} was implemented to improve the living conditions and livelihood
              prospects of registered fisherfolk-beneficiaries. To move beyond anecdotal accounts of success, this
              report undertakes a systematic assessment of the program&apos;s outcomes using a benchmark-versus-current
              approach: a Before questionnaire establishes baseline conditions prior to the intervention, while an
              After questionnaire measures the situation of respondents following its implementation. By comparing
              responses across both phases, the study determines the direction and magnitude of change experienced
              by beneficiaries and generates empirical evidence to inform future program planning, targeting, and
              sustainability.
            </p>
          </div>

          <SubHeading num="1.2" title="Objectives of the Project" />
          <div className="text-justify text-sm leading-relaxed text-slate-700">
            <p>The general objective of this assessment was to determine the impact of {project.title} on its fisherfolk-beneficiaries. Specifically, it aimed to:</p>
            <ol className="mt-3 list-inside list-decimal space-y-1.5 pl-2">
              <li>Assess the socioeconomic conditions of fisherfolk-beneficiaries at the benchmark and current phases;</li>
              <li>Compare benchmark (Before) and current (After) levels of program-relevant indicators using matched survey items;</li>
              <li>Identify indicator areas that improved, declined, or remained stable between the two survey phases; and</li>
              <li>Formulate evidence-based recommendations to strengthen program implementation and sustainability.</li>
            </ol>
          </div>
        </section>

        {/* ---------- 2.0 METHODOLOGY ---------- */}
        <section>
          <SectionHeading num="2.0" title="Methodology" />

          <SubHeading num="2.1" title="Research Design" />
          <div className="space-y-4 text-justify text-sm leading-relaxed text-slate-700">
            <p>
              The assessment employed a quantitative, descriptive-comparative design anchored on a
              benchmark-versus-current framework. Structured digital questionnaires were administered to registered
              fisherfolk-respondents in two phases: prior to program implementation (Before/benchmark) and after
              program implementation (After/current). Because the same instrument structure was deployed in both
              phases, responses were matched question-by-question, permitting direct comparison of distributions and
              mean values over time.
            </p>
          </div>

          <SubHeading num="2.2" title="Survey Instruments and Respondents" />
          <div className="overflow-x-auto">
            <table className="min-w-full border border-slate-300 text-sm">
              <tbody>
                <tr className="bg-white">
                  <td className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700">Before instrument</td>
                  <td className="border border-slate-300 px-4 py-2.5 text-slate-600">{beforeForm?.title || 'Before questionnaire'} ({beforeQuestions.length} survey question{beforeQuestions.length === 1 ? '' : 's'})</td>
                </tr>
                <tr className="bg-slate-50/60">
                  <td className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700">After instrument</td>
                  <td className="border border-slate-300 px-4 py-2.5 text-slate-600">{afterForm?.title || 'After questionnaire'} ({afterQuestions.length} survey question{afterQuestions.length === 1 ? '' : 's'})</td>
                </tr>
                <tr className="bg-white">
                  <td className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700">Respondents</td>
                  <td className="border border-slate-300 px-4 py-2.5 text-slate-600">{beforeResponses.length} benchmark / {afterResponses.length} current responses from fisherfolk participants</td>
                </tr>
                <tr className="bg-slate-50/60">
                  <td className="border border-slate-300 px-4 py-2.5 font-semibold text-slate-700">Comparable indicators</td>
                  <td className="border border-slate-300 px-4 py-2.5 text-slate-600">{totalComparable} paired item{totalComparable === 1 ? '' : 's'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <SubHeading num="2.3" title="Statistical Treatment" />
          <div className="space-y-4 text-justify text-sm leading-relaxed text-slate-700">
            <p>
              Descriptive statistics were used throughout the analysis. For choice-based questions (multiple choice,
              checkboxes, dropdown), responses were summarized as frequency and percentage distributions, with
              changes expressed in percentage-point (pp) differences between phases. For rating-scale questions,
              mean scores were computed per phase alongside their distribution across scale points. Geographic
              distribution of respondents (province, municipality, barangay) was likewise compared across phases.
              Results are presented through figures and tables, each accompanied by interpretive discussion.
            </p>
            <p className="text-xs italic text-slate-500">
              Note: Comparisons are limited to questions present in both instruments; unmatched questions are excluded
              from paired analysis. Differences in respondent counts between phases may affect comparability and are
              flagged in the findings where relevant.
            </p>
          </div>
        </section>

        {/* ---------- 3.0 RESEARCH FINDINGS ---------- */}
        <section>
          <SectionHeading num="3.0" title="Research Findings" />

          {comparisonData.length > 0 ? (
            <>
              <SubHeading num="3.1" title="Comparative Analysis: Benchmark versus Current" />
              <div className="space-y-10">
                {comparisonData.map((item, index) =>
                  item.type === 'rating' ? renderRatingFigure(item, index) : renderChoiceFigure(item, index)
                )}
              </div>
            </>
          ) : (
            <p className="text-sm italic text-slate-500">No comparable survey items were found between the two instruments.</p>
          )}
        </section>

        {/* ---------- 4.0 SYNTHESIS AND IMPLICATIONS ---------- */}
        <section>
          <SectionHeading num="4.0" title="Synthesis and Implications" />
          <p className="mb-2 text-justify text-sm leading-relaxed text-slate-700">
            This section synthesizes the key findings drawn from the preceding analyses and highlights their
            implications for policy, program design, and community-level development.
          </p>

          <SubHeading num="4.1" title="Summary of Findings" />
          <ol className="space-y-3">
            {narrative.findings.map((finding, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="shrink-0 font-semibold text-slate-900">{i + 1}.</span>
                <span className="text-justify">{finding}</span>
              </li>
            ))}
          </ol>

          <SubHeading num="4.2" title="Concluding Remarks" />
          <div className="space-y-4 text-justify text-sm leading-relaxed text-slate-700">
            <p>
              This assessment evaluated {project.title} through a systematic comparison of benchmark and current
              survey data from fisherfolk-beneficiaries. Across the {totalComparable} comparable indicator
              {totalComparable === 1 ? '' : 's'}, results show measurable movement in respondent conditions and
              perceptions between the two phases. Improvements were recorded in several domains, while certain
              measures warrant continued monitoring as detailed in the findings.
            </p>
            <p>
              Taken together, the evidence affirms the value of structured before-and-after evaluation in
              determining whether asset-based and livelihood interventions are achieving their intended outcomes.
              Sustained gains will depend on continued institutional support, adaptive implementation, and
              disciplined monitoring so that early improvements translate into durable, long-term benefits for
              fisherfolk households and their communities.
            </p>
          </div>

          <SubHeading num="4.3" title="Recommendations" />
          <ol className="space-y-3">
            {narrative.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="shrink-0 font-semibold text-slate-900">{i + 1}.</span>
                <span className="text-justify">{rec}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Report footer */}
        <footer className="mt-16 border-t border-slate-300 pt-5 text-center text-xs text-slate-400">
          Technical Narrative Report — {project.title} · Generated {generatedDate} · Bureau of Fisheries and Aquatic Resources
        </footer>
      </article>
    </div>
  );
};

export default NarrativeReport;
