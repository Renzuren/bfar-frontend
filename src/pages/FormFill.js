import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  Fingerprint,
  Camera,
  X,
  User,
  MapPin,
  Star,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import {
  isReservedField,
  isTextQuestionType,
  isValidLocationText,
} from '../lib/preprocessing';

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
      return (
        code === 'A1' ||
        code === 'A1AREA' ||
        title === 'area' ||
        title.includes('municipal')
      );
    },
  },
  {
    key: 'barangay',
    label: 'Barangay',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return code === 'A2' || title.includes('barangay') || title.includes('brgy');
    },
  },
  {
    key: 'province',
    label: 'Province',
    matches: (question) => {
      const code = normalizeQuestionCode(question);
      const title = String(question.title || '').toLowerCase();
      return (
        code === 'A3' || title.includes('province') || title.includes('prov')
      );
    },
  },
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

const RESPONDENT_NAME_REQUIRED_MESSAGE =
  'Respondent Name is required before you can proceed.';
const locationRequiredMessage = (label) =>
  `${label} is required before you can proceed.`;

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
  const [locationValues, setLocationValues] = useState({
    municipality: '',
    barangay: '',
    province: '',
  });
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sections, setSections] = useState([]);
  const stepsRef = useRef(null);
  const [existingResponses, setExistingResponses] = useState([]);
  const [submittedRespondentId, setSubmittedRespondentId] = useState(null);

  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoAttempted, setPhotoAttempted] = useState(false);
  const fileInputRef = useRef(null);

  const demographicsQuestions = sections
    .filter((s) => s.section_type === 'demographics')
    .flatMap((s) => s.questions || []);
  const questionnaireQuestions = sections
    .filter((s) => s.section_type === 'questionnaire')
    .flatMap((s) => s.questions || []);

  const profilePhotoQuestion = demographicsQuestions.find(
    (q) => q.type === 'profile_photo'
  );

  const allQuestions = demographicsQuestions.concat(questionnaireQuestions);
  const locationFields = REQUIRED_LOCATION_FIELDS.map((field) => ({
    ...field,
    question: allQuestions.find(field.matches),
  }));
  const locationQuestionIds = locationFields
    .filter((field) => field.question)
    .map((field) => field.question.id);
  const respondentIdQuestion = allQuestions.find(
    (q) =>
      normalizeQuestionCode(q) ===
      normalizeQuestionCode({ code: 'RESP-02' })
  );
  const beneficiaryQuestion = allQuestions.find(isBeneficiaryQuestion);
  const beneficiaryAnswer = beneficiaryQuestion
    ? answers[beneficiaryQuestion.id]
    : null;
  const effectiveBeneficiaryAnswer = beneficiaryAnswer
    || (form?.questionnaire_type && !beneficiaryQuestion
      ? (form.questionnaire_type === 'before' ? 'Yes' : 'No')
      : null);
  const nextRespondentId = computeNextRespondentId(
    effectiveBeneficiaryAnswer,
    existingResponses
  );

  const hasRespondentName = String(respondentName || '').trim().length > 0;
  const getLocationValue = (field) =>
    field.question
      ? String(answers[field.question.id] || '')
      : String(locationValues[field.key] || '');
  const locationValueFor = (key) => {
    const field = locationFields.find((f) => f.key === key);
    return field ? getLocationValue(field).trim() : '';
  };
  const hasLocationValue = (field) =>
    String(getLocationValue(field)).trim().length > 0;
  const allLocationsFilled = locationFields.every(hasLocationValue);
  const locationValidationMessage = (field) => {
    if (!hasLocationValue(field)) return locationRequiredMessage(field.label);
    if (!isValidLocationText(getLocationValue(field)))
      return `${field.label} can only contain letters and spaces.`;
    return '';
  };
  const locationHasError = (field) =>
    locationAttempted[field.key] && !!locationValidationMessage(field);

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
    locationFields.forEach((field) => {
      const value = getLocationValue(field);
      if (!hasLocationValue(field)) {
        setLocationAttempted((prev) => ({ ...prev, [field.key]: true }));
        toast.error(locationRequiredMessage(field.label));
        valid = false;
      } else if (!isValidLocationText(value)) {
        setLocationAttempted((prev) => ({ ...prev, [field.key]: true }));
        toast.error(`${field.label} can only contain letters and spaces.`);
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
        formSections = fetchedForm.sections.map((sec, idx) => ({
          ...sec,
          section_type:
            sec.section_type || (idx === 0 ? 'demographics' : 'questionnaire'),
        }));
      } else if (fetchedForm.questions && fetchedForm.questions.length > 0) {
        const sectionMap = new Map();
        fetchedForm.questions.forEach((q) => {
          const secName =
            q.section && q.section.trim() ? q.section : 'Section 1';
          if (!sectionMap.has(secName)) sectionMap.set(secName, []);
          sectionMap.get(secName).push(q);
        });
        formSections = Array.from(sectionMap.entries()).map(
          ([title, questions], idx) => ({
            id: `sec_${idx}`,
            title,
            section_type: idx === 0 ? 'demographics' : 'questionnaire',
            questions,
          })
        );
      } else {
        formSections = [
          {
            id: 'demographics',
            title: 'Demographics',
            section_type: 'demographics',
            questions: [],
          },
          {
            id: 'questionnaire',
            title: 'Questionnaire',
            section_type: 'questionnaire',
            questions: [],
          },
        ];
      }

      if (!formSections.some((s) => s.section_type === 'demographics')) {
        formSections.unshift({
          id: 'demographics',
          title: 'Demographics',
          section_type: 'demographics',
          questions: [],
        });
      }
      if (!formSections.some((s) => s.section_type === 'questionnaire')) {
        formSections.push({
          id: 'questionnaire',
          title: 'Questionnaire',
          section_type: 'questionnaire',
          questions: [],
        });
      }

      setSections(formSections);

      const initialAnswers = {};
      const allQs = formSections.flatMap((s) => s.questions);
      allQs.forEach((q) => {
        if (q.type === 'checkboxes') initialAnswers[q.id] = [];
        else if (q.type === 'rating') initialAnswers[q.id] = '';
        else initialAnswers[q.id] = '';
      });

      // No Baseline: auto-set beneficiary answer based on questionnaire_type
      if (fetchedForm.has_baseline === false && fetchedForm.questionnaire_type) {
        const autoStatus = fetchedForm.questionnaire_type === 'before' ? 'Yes' : 'No';
        const allFormQuestions = allQs;
        const autoBeneQ = allFormQuestions.find(isBeneficiaryQuestion);
        if (autoBeneQ) {
          initialAnswers[autoBeneQ.id] = autoStatus;
        }
      }

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

  useEffect(() => {
    if (!stepsRef.current) return;
    const active = stepsRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentSectionIndex]);

  const handleCheckboxChange = (questionId, option, checked) => {
    const current = answers[questionId] || [];
    if (checked)
      setAnswers({ ...answers, [questionId]: [...current, option] });
    else
      setAnswers({
        ...answers,
        [questionId]: current.filter((opt) => opt !== option),
      });
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, and PNG images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoFile(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
    setPhotoAttempted(false);
  };

  const handlePhotoRemove = () => {
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoFile(null);
    setProfilePhotoPreview(null);
    setProfilePhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadProfilePhoto = async () => {
    if (!profilePhotoFile || !profilePhotoQuestion) return null;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', profilePhotoFile);
      const res = await api.post(`/forms/public/${id}/upload-photo`, formData, {
        timeout: 60000,
      });
      const url = res.data?.url;
      setProfilePhotoUrl(url);
      return url;
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Failed to upload profile photo';
      toast.error(msg);
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateCurrentSection = () => {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return true;
    const sectionQuestions = currentSection.questions || [];

    if (
      currentSection.section_type === 'demographics' &&
      profilePhotoQuestion?.required
    ) {
      if (!profilePhotoFile && !profilePhotoPreview) {
        setPhotoAttempted(true);
        toast.error('Profile photo is required');
        return false;
      }
    }

    for (const q of sectionQuestions) {
      if (q.type === 'profile_photo') continue;
      if (q.required) {
        const ans = answers[q.id];
        const isEmpty =
          !ans || (Array.isArray(ans) && ans.length === 0);
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
      let photoUrl = profilePhotoUrl;
      if (profilePhotoFile && !photoUrl) {
        photoUrl = await uploadProfilePhoto();
      }

      const demoAnswers = {};
      demographicsQuestions.forEach((q) => {
        if (q.type !== 'profile_photo') {
          demoAnswers[q.id] = answers[q.id];
        }
      });

      const questAnswers = {};
      questionnaireQuestions.forEach((q) => {
        questAnswers[q.id] = answers[q.id];
      });

      const formattedAnswers = allQuestions
        .filter((q) => q.type !== 'profile_photo')
        .map((q) => ({
          question_id: q.id,
          answer: answers[q.id],
        }));

      const response = await api.post(`/forms/public/${id}/responses`, {
        email: answers.email,
        full_name: respondentName.trim(),
        age: answers.age,
        gender: answers.gender,
        municipality: locationValueFor('municipality'),
        barangay: locationValueFor('barangay'),
        province: locationValueFor('province'),
        answers: formattedAnswers,
        profile_photo_url: photoUrl || null,
        demographics:
          Object.keys(demoAnswers).length > 0 ? demoAnswers : null,
        questionnaire_answers:
          Object.keys(questAnswers).length > 0 ? questAnswers : null,
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

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Loading form...
          </p>
        </div>
      </div>
    );

  if (!form)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-slate-700">
            Form not found
          </p>
          <p className="text-sm text-slate-500">
            The form you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );

  if (submitted)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 px-4">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-2xl shadow-emerald-500/5">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 pt-10 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Thank You!</h2>
            <p className="mt-2 text-sm text-emerald-100">
              Your response has been submitted successfully
            </p>
          </div>
          <div className="px-8 py-8 text-center">
            {submittedRespondentId && (
              <div className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-3">
                <Fingerprint className="h-5 w-5 text-emerald-600" />
                <div className="text-left">
                  <p className="text-xs font-medium text-emerald-600">
                    Respondent ID
                  </p>
                  <p className="text-lg font-bold tracking-wide text-emerald-800">
                    {submittedRespondentId}
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500">
              You can safely close this page now.
            </p>
          </div>
        </div>
      </div>
    );

  const currentSection = sections[currentSectionIndex];
  const currentSectionQuestions = currentSection?.questions || [];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;
  const progress = ((currentSectionIndex + 1) / sections.length) * 100;

  const stepLabels = sections.map((s) =>
    s.section_type === 'demographics' ? 'Demographics' : 'Questionnaire'
  );
  if (stepLabels.length < 3) stepLabels.push('Submit');

  const renderQuestion = (question, idx) => {
    if (question.type === 'profile_photo') return null;
    if (locationQuestionIds.includes(question.id)) return null;

    const inputClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#646cff] focus:outline-none focus:ring-1 focus:ring-[#646cff]/30";
    const selectTriggerClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-[#646cff] focus:ring-1 focus:ring-[#646cff]/30";

    return (
      <div
        key={question.id}
        className="rounded-lg border border-slate-200 bg-white py-5 px-6 transition-colors hover:border-slate-300"
      >
        <div className="mb-3">
          <Label className="text-sm font-medium text-slate-900 leading-relaxed">
            <span className="mr-1.5 text-slate-400 text-xs">{idx}.</span>
            {question.title}
            {question.required && <span className="ml-1 text-rose-500">*</span>}
          </Label>
          {question.description && (
            <p className="mt-1 text-xs text-slate-400 ml-5">{question.description}</p>
          )}
        </div>

        <div className="ml-5">
          {isTextQuestionType(question.type) && (
            <Input
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
              required={question.required}
              placeholder="Your answer"
              className={inputClass}
            />
          )}

          {question.type === 'multiple_choice' && (
            <RadioGroup
              value={answers[question.id] || ''}
              onValueChange={(v) => setAnswers({ ...answers, [question.id]: v })}
              required={question.required}
            >
              <div className="space-y-2">
                {question.options?.map((opt, oi) => (
                  <label
                    key={oi}
                    htmlFor={`${question.id}-${oi}`}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                      answers[question.id] === opt
                        ? 'border-[#646cff] bg-[#646cff]/5'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <RadioGroupItem value={opt} id={`${question.id}-${oi}`} className="text-[#646cff]" />
                    <span className="text-sm text-slate-700">
                      {opt}
                      {isBeneficiaryQuestion(question) &&
                        (opt === 'Yes' ? ' — Beneficiary' : opt === 'No' ? ' — Non-Beneficiary' : '')}
                    </span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          )}

          {isBeneficiaryQuestion(question) &&
            (answers[question.id] === 'Yes' || answers[question.id] === 'No') && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <Fingerprint className="h-4 w-4" />
                  Respondent ID
                </span>
                <span className="text-base font-bold tracking-wide text-emerald-800">
                  {computeNextRespondentId(answers[question.id], existingResponses) || '—'}
                </span>
              </div>
            )}

          {question.type === 'checkboxes' && (
            <div className="space-y-2">
              {question.options?.map((opt, oi) => (
                <label
                  key={oi}
                  htmlFor={`${question.id}-${oi}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                    answers[question.id]?.includes(opt)
                      ? 'border-[#646cff] bg-[#646cff]/5'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <Checkbox
                    id={`${question.id}-${oi}`}
                    checked={answers[question.id]?.includes(opt)}
                    onCheckedChange={(c) => handleCheckboxChange(question.id, opt, c)}
                    className="text-[#646cff]"
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {question.type === 'dropdown' && (
            <Select value={answers[question.id] || ''} onValueChange={(v) => setAnswers({ ...answers, [question.id]: v })} required={question.required}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-slate-200">
                {question.options?.map((opt, oi) => (
                  <SelectItem key={oi} value={opt} className="text-sm">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {question.type === 'date' && (
            <Input
              type="date"
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
              required={question.required}
              className={inputClass}
            />
          )}

          {question.type === 'rating' && (
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [question.id]: r })}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${
                    answers[question.id] === r
                      ? 'border-amber-400 bg-amber-50 text-amber-500 scale-110'
                      : 'border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-400'
                  }`}
                >
                  <Star className={`h-4 w-4 ${answers[question.id] === r ? 'fill-amber-400' : ''}`} />
                </button>
              ))}
              {answers[question.id] && (
                <span className="ml-2 text-xs font-medium text-amber-600">{answers[question.id]}/5</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const sectionLabel =
    currentSection?.section_type === 'demographics'
      ? 'Demographics'
      : 'Questionnaire';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6">
        {/* Form Header Card */}
        <div className="overflow-hidden rounded-t-3xl border border-slate-200/60 bg-white shadow-lg shadow-slate-200/50">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-8 py-6 sm:px-10 sm:py-8">
            <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
              {form.title}
            </h2>
          </div>
          {form.description && (
            <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-4">
              <p className="text-sm leading-relaxed text-slate-600">
                {form.description}
              </p>
            </div>
          )}
          {nextRespondentId && (
            <div className="flex items-center justify-between bg-emerald-50/50 px-8 py-3">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                <Fingerprint className="h-3.5 w-3.5" />
                Your Respondent ID
              </span>
              <span className="text-sm font-bold tracking-wide text-emerald-800">
                {nextRespondentId}
              </span>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="mb-6 rounded-b-3xl border border-t-0 border-slate-200/60 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div
            ref={stepsRef}
            className="scrollbar-hide flex items-center gap-1 overflow-x-auto py-1"
            style={{ scrollBehavior: 'smooth' }}
          >
            {stepLabels.map((label, i) => {
              const isActive = i === currentSectionIndex;
              const isCompleted = i < currentSectionIndex;
              const isCompact = sections.length > 8;
              return (
                <React.Fragment key={i}>
                  <div
                    data-active={isActive ? 'true' : 'false'}
                    className={`flex shrink-0 flex-col items-center ${isCompact ? 'gap-1' : 'gap-2'}`}
                  >
                    <div
                      className={`flex items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                        isCompact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
                      } ${
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : isActive
                          ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className={isCompact ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`max-w-[64px] truncate text-center font-medium ${
                        isCompact ? 'text-[10px]' : 'text-xs'
                      } ${
                        isActive
                          ? 'text-blue-600'
                          : isCompleted
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`mb-6 shrink-0 ${isCompact ? 'w-3' : 'mx-1 flex-1'}`}>
                      <div
                        className={`rounded-full transition-all duration-500 ${
                          isCompact ? 'h-0.5 w-3' : 'h-0.5 w-full'
                        } ${
                          i < currentSectionIndex
                            ? 'bg-emerald-400'
                            : i === currentSectionIndex
                            ? 'bg-gradient-to-r from-blue-400 to-slate-200'
                            : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="mt-3 text-center">
            <span className="text-xs text-slate-400">
              Step {currentSectionIndex + 1} of {sections.length}
            </span>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Demographics Section */}
          {currentSection?.section_type === 'demographics' && (
            <>
              {/* Profile Photo Card */}
              {profilePhotoQuestion && (
                <div className="rounded-lg border border-slate-200 bg-white py-5 px-6">
                  <div className="mb-4">
                    <Label className="text-sm font-medium text-slate-900">
                      {profilePhotoQuestion.title || 'Profile Photo'}
                      {profilePhotoQuestion.required && (
                        <span className="ml-1 text-rose-500">*</span>
                      )}
                    </Label>
                    {profilePhotoQuestion.description && (
                      <p className="mt-1 text-xs text-slate-400">{profilePhotoQuestion.description}</p>
                    )}
                  </div>

                  {profilePhotoPreview ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={profilePhotoPreview}
                        alt="Profile preview"
                        className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                      />
                      <div className="flex-1">
                        <p className="mb-2 text-sm text-slate-600">Photo ready</p>
                        <button
                          type="button"
                          onClick={handlePhotoRemove}
                          className="text-sm font-medium text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors ${
                          photoAttempted
                            ? 'border-rose-300 bg-rose-50/50 hover:border-rose-400'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                        }`}
                      >
                        <Upload className={`h-5 w-5 ${photoAttempted ? 'text-rose-400' : 'text-slate-400'}`} />
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-600">Click to upload</p>
                          <p className="text-xs text-slate-400">JPG, PNG — max 5MB</p>
                        </div>
                      </button>
                      {photoAttempted && !profilePhotoFile && (
                        <p
                          role="alert"
                          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-rose-500"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Profile photo is required
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Respondent Info Card */}
              <div className="rounded-lg border border-slate-200 bg-white py-5 px-6">
                <div className="mb-5">
                  <Label className="text-sm font-medium text-slate-900">
                    Respondent Name <span className="text-rose-500">*</span>
                  </Label>
                  <p className="mt-0.5 text-xs text-slate-400">Required fields are marked with <span className="text-rose-500">*</span></p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Input
                      id="respondent-name"
                      type="text"
                      placeholder="Your answer"
                      value={respondentName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRespondentName(v);
                        if (respondentIdQuestion)
                          setAnswers({ ...answers, [respondentIdQuestion.id]: v });
                        if (nameAttempted && String(v || '').trim())
                          setNameAttempted(false);
                      }}
                      required
                      autoComplete="name"
                      className={`h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#646cff] focus:outline-none focus:ring-1 focus:ring-[#646cff]/30 ${
                        nameAttempted && !hasRespondentName
                          ? 'border-rose-300 ring-1 ring-rose-100'
                          : ''
                      }`}
                    />
                    {nameAttempted && !hasRespondentName && (
                      <p role="alert" className="mt-1.5 text-xs text-rose-500">
                        {RESPONDENT_NAME_REQUIRED_MESSAGE}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {locationFields.map((field) => (
                      <div key={field.key}>
                        <Label className="text-sm font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        {field.label}
                      </span>
                      <span className="ml-1 text-rose-500">*</span>
                    </Label>
                    {['dropdown', 'multiple_choice'].includes(
                      field.question?.type
                    ) ? (
                      <Select
                        value={answers[field.question.id] || ''}
                        onValueChange={(v) =>
                          setAnswers({ ...answers, [field.question.id]: v })
                        }
                      >
                        <SelectTrigger
                          id={`respondent-${field.key}`}
                          className={`h-11 w-full mt-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-[#646cff] focus:ring-1 focus:ring-[#646cff]/30 ${
                            locationHasError(field) ? 'border-rose-300 ring-1 ring-rose-100' : ''
                          }`}
                        >
                          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-slate-200">
                          {field.question.options?.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`respondent-${field.key}`}
                        type="text"
                        placeholder="Your answer"
                        value={getLocationValue(field)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (field.question) {
                            setAnswers({ ...answers, [field.question.id]: v });
                          } else {
                            setLocationValues((prev) => ({ ...prev, [field.key]: v }));
                          }
                          if (locationAttempted[field.key] && isValidLocationText(v)) {
                            setLocationAttempted((prev) => ({ ...prev, [field.key]: false }));
                          }
                        }}
                        required
                        className={`h-11 w-full mt-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#646cff] focus:outline-none focus:ring-1 focus:ring-[#646cff]/30 ${
                          locationHasError(field) ? 'border-rose-300 ring-1 ring-rose-100' : ''
                        }`}
                      />
                    )}
                    {locationHasError(field) && (
                      <p role="alert" className="mt-1.5 text-xs text-rose-500">
                        {locationValidationMessage(field)}
                      </p>
                    )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Other Demographics Questions */}
              {(() => {
                const isNoBaselineForm = form?.has_baseline === false;
                const otherQs = currentSectionQuestions.filter(
                  (q) =>
                    !locationQuestionIds.includes(q.id) &&
                    !isReservedField(q) &&
                    q.type !== 'profile_photo' &&
                    !(isNoBaselineForm && isBeneficiaryQuestion(q))
                );
                if (otherQs.length === 0) return null;
                return (
                  <div className="space-y-4">
                    {otherQs.map((q, idx) => (
                        <div key={q.id}>
                          {renderQuestion(q, idx + 1)}
                        </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {/* Questionnaire Section */}
          {currentSection?.section_type === 'questionnaire' && (
            <>
              {currentSectionQuestions.filter((q) => !isReservedField(q) && !(form?.has_baseline === false && isBeneficiaryQuestion(q)))
                .length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center">
                  <p className="text-sm text-slate-400">No questions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSectionQuestions
                    .filter((q) => !isReservedField(q))
                    .map((q, idx) => (
                        <div key={q.id}>
                          {renderQuestion(q, idx + 1)}
                        </div>
                    ))}
                </div>
              )}
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 pb-10">
            <Button
              type="button"
              onClick={handlePrevious}
              disabled={isFirst}
              variant="outline"
              className="h-10 rounded-lg border-slate-300 px-5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            {!isLast ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!hasRespondentName || !allLocationsFilled}
                className="h-10 rounded-lg bg-[#646cff] px-5 text-sm font-medium text-white hover:bg-[#535bf2] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!hasRespondentName || !allLocationsFilled || submitting || uploadingPhoto}
                className="h-10 rounded-lg bg-emerald-600 px-6 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {submitting ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Submitting...</>
                ) : uploadingPhoto ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Send className="mr-1.5 h-4 w-4" /> Submit</>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormFill;
