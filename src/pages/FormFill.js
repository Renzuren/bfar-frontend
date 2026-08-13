import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Check, ChevronLeft, ChevronRight, Send, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';

const pad4 = (n) => String(n).padStart(4, '0');

const isBeneficiaryQuestion = (question) =>
  String(question.code || '').trim().toUpperCase() === 'BENE' ||
  String(question.title || '').toLowerCase().includes('beneficiary');

const normalizeQuestionCode = (question) =>
  String(question.code || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .replace(/^([A-Z])0+/, '$1');

const REQUIRED_LOCATION_FIELDS = [
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

const computeNextRespondentId = (status, responses) => {
  const prefix = status === 'Yes' ? 'B' : status === 'No' ? 'NB' : null;
  if (!prefix) return null;
  let maxNum = 0;
  (responses || []).forEach((r) => {
    const id = r.respondent_id || '';
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return `${prefix}-${pad4(maxNum + 1)}`;
};

const RESPONDENT_NAME_REQUIRED_MESSAGE = 'Respondent Name is required before you can proceed.';
const locationRequiredMessage = (label) => `${label} is required before you can proceed.`;

const FormFill = () => {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [respondentName, setRespondentName] = useState('');
  const [nameAttempted, setNameAttempted] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState({});
  const [locationValues, setLocationValues] = useState({ municipality: '', barangay: '', province: '' });
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sections, setSections] = useState([]);
  const [existingResponses, setExistingResponses] = useState([]);
  const [submittedRespondentId, setSubmittedRespondentId] = useState(null);

  const allQuestions = sections.flatMap(s => s.questions);
  const locationFields = REQUIRED_LOCATION_FIELDS.map(field => ({
    ...field,
    question: allQuestions.find(field.matches)
  }));
  const locationQuestionIds = locationFields
    .filter(field => field.question)
    .map(field => field.question.id);

  const hasRespondentName = String(respondentName || '').trim().length > 0;
  const getLocationValue = (field) => field.question
    ? String(answers[field.question.id] || '').trim()
    : String(locationValues[field.key] || '').trim();
  const locationValueFor = (key) => {
    const field = locationFields.find(f => f.key === key);
    return field ? getLocationValue(field) : '';
  };
  const hasLocationValue = (field) => getLocationValue(field).length > 0;
  const allLocationsFilled = locationFields.every(hasLocationValue);

  const validateRespondentName = () => {
    if (!hasRespondentName) {
      setNameAttempted(true);
      toast.error(RESPONDENT_NAME_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  };

  const validateLocations = () => {
    let valid = true;
    locationFields.forEach(field => {
      if (!hasLocationValue(field)) {
        setLocationAttempted(prev => ({ ...prev, [field.key]: true }));
        toast.error(locationRequiredMessage(field.label));
        valid = false;
      }
    });
    return valid;
  };

  const fetchForm = useCallback(async () => {
    try {
      const response = await api.get(`/forms/public/${id}`);
      const fetchedForm = response.data;
      setForm(fetchedForm);

      let formSections = [];

      if (fetchedForm.sections && fetchedForm.sections.length > 0) {
        formSections = fetchedForm.sections;
      } else if (fetchedForm.questions && fetchedForm.questions.length > 0) {
        const sectionMap = new Map();
        fetchedForm.questions.forEach(q => {
          const secName = q.section && q.section.trim() ? q.section : 'Section 1';
          if (!sectionMap.has(secName)) sectionMap.set(secName, []);
          sectionMap.get(secName).push(q);
        });
        formSections = Array.from(sectionMap.entries()).map(([title, questions], idx) => ({
          id: `sec_${idx}`,
          title,
          questions
        }));
      } else {
        formSections = [{ id: 'default', title: 'Section 1', questions: [] }];
      }

      setSections(formSections);

      const initialAnswers = {};
      const allQuestions = formSections.flatMap(s => s.questions);
      allQuestions.forEach(q => {
        if (q.type === 'checkboxes') initialAnswers[q.id] = [];
        else if (q.type === 'rating') initialAnswers[q.id] = 3;
        else initialAnswers[q.id] = '';
      });
      setAnswers(initialAnswers);

      try {
        const res = await api.get(`/forms/public/${id}/responses`);
        setExistingResponses(res.data || []);
      } catch (e) {
        setExistingResponses([]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Form not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  const handleCheckboxChange = (questionId, option, checked) => {
    const current = answers[questionId] || [];
    if (checked) setAnswers({ ...answers, [questionId]: [...current, option] });
    else setAnswers({ ...answers, [questionId]: current.filter(opt => opt !== option) });
  };

  const validateCurrentSection = () => {
    const currentQs = sections[currentSectionIndex]?.questions || [];
    for (const q of currentQs) {
      if (q.required) {
        const ans = answers[q.id];
        const isEmpty = !ans || (Array.isArray(ans) && ans.length === 0);
        if (isEmpty) {
          toast.error(`Please answer: ${q.title}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!validateRespondentName()) return;
    if (!validateLocations()) return;
    if (!validateCurrentSection()) return;
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateRespondentName()) return;
    if (!validateLocations()) return;
    if (!validateCurrentSection()) return;

    setSubmitting(true);
    try {
      const allQuestions = sections.flatMap(s => s.questions);
      const formattedAnswers = allQuestions.map(q => ({
        question_id: q.id,
        answer: answers[q.id]
      }));
      const response = await api.post(`/forms/public/${id}/responses`, {
        email: answers.email,
        full_name: respondentName.trim(),
        age: answers.age,
        gender: answers.gender,
        municipality: locationValueFor('municipality'),
        barangay: locationValueFor('barangay'),
        province: locationValueFor('province'),
        answers: formattedAnswers
      });
      setSubmittedRespondentId(response.data?.respondent_id || null);
      setSubmitted(true);
      toast.success('Response submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading form...</div>;
  if (!form) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Form not found</div>;

  if (submitted) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
          <Check className="h-10 w-10" />
        </div>
        <h2 className="mb-3 text-3xl font-bold text-slate-900">Thank You!</h2>
        <p className="mb-2 text-lg text-slate-600">Your response has been submitted successfully.</p>
        {submittedRespondentId && (
          <div className="mx-auto mb-3 mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2">
            <Fingerprint className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">Respondent ID: {submittedRespondentId}</span>
          </div>
        )}
        <p className="text-sm text-slate-400">You can close this page now.</p>
      </div>
    </div>
  );

  const current = sections[currentSectionIndex];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;
  const progress = ((currentSectionIndex + 1) / sections.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-slate-50 to-slate-50 py-12">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white sm:p-10">
            <div className="relative">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <FileText className="h-6 w-6 text-cyan-300" />
              </div>
              <h1 className="mb-1 text-xl font-bold text-white">General Assessment e-Forms</h1>
              <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{form.title}</h2>
            </div>
          </div>
          {form.description && (
            <div className="border-b border-slate-100 px-8 py-4">
              <p className="text-base leading-relaxed text-slate-600">{form.description}</p>
            </div>
          )}
          <div className="px-8 py-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">
                Section {currentSectionIndex + 1} of {sections.length}: {current.title}
              </span>
              <span className="font-medium text-cyan-600">{Math.round(progress)}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
            <Label htmlFor="respondent-name" className="mb-2 block text-lg font-bold text-slate-900">
              Respondent Name <span className="ml-1 text-rose-500">*</span>
            </Label>
            <p className="mb-4 text-sm text-slate-500">
              Enter your full name. This is required before you can continue the assessment.
            </p>
            <Input
              id="respondent-name"
              type="text"
              placeholder="e.g. Juan Dela Cruz"
              value={respondentName}
              onChange={(e) => {
                setRespondentName(e.target.value);
                if (nameAttempted && String(e.target.value || '').trim()) setNameAttempted(false);
              }}
              required
              autoComplete="name"
              className={nameAttempted && !hasRespondentName ? 'border-rose-400 ring-2 ring-rose-100' : ''}
            />
            {nameAttempted && !hasRespondentName && (
              <p role="alert" className="mt-2 text-sm font-medium text-rose-500">
                {RESPONDENT_NAME_REQUIRED_MESSAGE}
              </p>
            )}

            {locationFields.map(field => (
              <div key={field.key} className="mt-6 border-t border-slate-100 pt-6">
                <Label htmlFor={`respondent-${field.key}`} className="mb-2 block text-lg font-bold text-slate-900">
                  {field.label} <span className="ml-1 text-rose-500">*</span>
                </Label>
                <p className="mb-4 text-sm text-slate-500">
                  Enter the {field.label.toLowerCase()} you belong to. This is required before you can continue the assessment.
                </p>
                {['dropdown', 'multiple_choice'].includes(field.question?.type) ? (
                  <Select value={answers[field.question.id] || ''} onValueChange={v => setAnswers({ ...answers, [field.question.id]: v })}>
                    <SelectTrigger id={`respondent-${field.key}`} className={locationAttempted[field.key] && !hasLocationValue(field) ? 'border-rose-400 ring-2 ring-rose-100' : ''}>
                      <SelectValue placeholder={`Select your ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.question.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`respondent-${field.key}`}
                    type="text"
                    placeholder={`e.g. ${field.label}`}
                    value={getLocationValue(field)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (field.question) {
                        setAnswers({ ...answers, [field.question.id]: v });
                      } else {
                        setLocationValues(prev => ({ ...prev, [field.key]: v }));
                      }
                      if (locationAttempted[field.key] && String(v || '').trim()) {
                        setLocationAttempted(prev => ({ ...prev, [field.key]: false }));
                      }
                    }}
                    required
                    className={locationAttempted[field.key] && !hasLocationValue(field) ? 'border-rose-400 ring-2 ring-rose-100' : ''}
                  />
                )}
                {locationAttempted[field.key] && !hasLocationValue(field) && (
                  <p role="alert" className="mt-2 text-sm font-medium text-rose-500">
                    {locationRequiredMessage(field.label)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {current.questions.filter(q => !locationQuestionIds.includes(q.id)).map((question, idx) => (
            <div key={question.id} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md sm:p-7">
              <Label className="mb-2 block text-lg font-bold text-slate-900">
                {idx + 1}. {question.title}
                {question.required && <span className="ml-1 text-rose-500">*</span>}
              </Label>
              {question.description && <p className="mb-4 text-sm text-slate-500">{question.description}</p>}

              {question.type === 'short_text' && (
                <Input value={answers[question.id] || ''} onChange={e => setAnswers({ ...answers, [question.id]: e.target.value })} required={question.required} />
              )}
              {question.type === 'long_text' && (
                <Textarea value={answers[question.id] || ''} onChange={e => setAnswers({ ...answers, [question.id]: e.target.value })} rows={4} required={question.required} />
              )}
              {question.type === 'multiple_choice' && (
                <>
                  <RadioGroup value={answers[question.id] || ''} onValueChange={v => setAnswers({ ...answers, [question.id]: v })} required={question.required}>
                    <div className="space-y-2">
                      {question.options?.map((opt, oi) => (
                        <div key={oi} className={`flex items-center gap-3 rounded-xl border p-3 transition ${answers[question.id] === opt ? 'border-cyan-400 bg-cyan-50/60 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'}`}>
                          <RadioGroupItem value={opt} id={`${question.id}-${oi}`} />
                          <Label htmlFor={`${question.id}-${oi}`} className="cursor-pointer text-base font-normal text-slate-800">
                            {opt}
                            {isBeneficiaryQuestion(question) && (opt === 'Yes' ? ' — Beneficiary' : opt === 'No' ? ' — Non-Beneficiary' : '')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  {isBeneficiaryQuestion(question) && (answers[question.id] === 'Yes' || answers[question.id] === 'No') && (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <Fingerprint className="h-4 w-4" />
                        Respondent ID
                      </span>
                      <span className="text-lg font-bold tracking-wide text-emerald-900">
                        {computeNextRespondentId(answers[question.id], existingResponses) || '—'}
                      </span>
                    </div>
                  )}
                </>
              )}
              {question.type === 'checkboxes' && (
                <div className="space-y-2">
                  {question.options?.map((opt, oi) => (
                    <div key={oi} className={`flex items-center gap-3 rounded-xl border p-3 transition ${answers[question.id]?.includes(opt) ? 'border-cyan-400 bg-cyan-50/60 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'}`}>
                      <Checkbox id={`${question.id}-${oi}`} checked={answers[question.id]?.includes(opt)} onCheckedChange={c => handleCheckboxChange(question.id, opt, c)} />
                      <Label htmlFor={`${question.id}-${oi}`} className="cursor-pointer text-base font-normal text-slate-800">{opt}</Label>
                    </div>
                  ))}
                </div>
              )}
              {question.type === 'dropdown' && (
                <Select value={answers[question.id] || ''} onValueChange={v => setAnswers({ ...answers, [question.id]: v })} required={question.required}>
                  <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                  <SelectContent>
                    {question.options?.map((opt, oi) => <SelectItem key={oi} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {question.type === 'date' && (
                <Input type="date" value={answers[question.id] || ''} onChange={e => setAnswers({ ...answers, [question.id]: e.target.value })} required={question.required} />
              )}
              {question.type === 'rating' && (
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAnswers({ ...answers, [question.id]: r })}
                      className={`h-12 w-12 rounded-xl border-2 text-lg font-bold transition-all ${
                        answers[question.id] === r
                          ? 'border-cyan-500 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-600'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2 pb-10">
            <Button type="button" onClick={handlePrevious} disabled={isFirst} variant="outline" className="text-slate-700">
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            {!isLast ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!hasRespondentName || !allLocationsFilled}
                className="bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!hasRespondentName || !allLocationsFilled || submitting}
                className="bg-emerald-600 px-8 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit Response'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormFill;
