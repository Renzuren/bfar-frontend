import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Save, ChevronLeft, ChevronRight, Layers, Pencil, GripVertical, UserPlus, Copy, User, ClipboardList, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import useDragAutoScroll from '../hooks/useDragAutoScroll';
import { normalizeLocationCodes, isReservedField } from '../lib/preprocessing';

const DEMOGRAPHICS_QUESTION_TYPES = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating Scale (1-5)' },
  { value: 'profile_photo', label: 'Profile Photo / Image Upload' },
];

const QUESTIONNAIRE_QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating Scale (1-5)' },
];

const SECTION_TYPE_CONFIG = {
  demographics: { label: 'Demographics', icon: User, color: 'indigo', description: 'Collect respondent profile information (name, age, location, photo, etc.)' },
  questionnaire: { label: 'Questionnaire', icon: ClipboardList, color: 'cyan', description: 'Survey questions to assess impact or gather feedback' },
};

const generateCSVHeaders = (questions) => {
  const shouldSkipQuestion = (questionType, title = '') => {
    const skipKeywords = ['name', 'address', 'comment', 'specify', 'consent', 'text'];
    const lowerTitle = title.toLowerCase();
    return skipKeywords.some(keyword => lowerTitle.includes(keyword));
  };
  const headers = [];
  questions.forEach((question) => {
    if (!shouldSkipQuestion(question.type, question.title) && question.code) {
      const sanitizedTitle = question.title.replace(/,/g, '').replace(/:/g, '').trim();
      const header = sanitizedTitle ? `${question.code}:${sanitizedTitle}` : question.code;
      headers.push(header);
    }
  });
  return headers.join(',');
};

const QuestionnaireBuilder = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const outletCtx = useOutletContext();
  const project = outletCtx?.project;

  const questionnaireType = searchParams.get('type') || 'before';
  const formField = questionnaireType === 'before' ? 'before_form' : 'after_form';

  const [selectedType, setSelectedType] = useState(questionnaireType);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questions: []
  });

  const [sections, setSections] = useState([
    {
      id: `section_demographics_${Date.now()}`,
      title: 'Demographics',
      section_type: 'demographics',
      questions: []
    },
    {
      id: `section_questionnaire_${Date.now()}`,
      title: 'Questionnaire',
      section_type: 'questionnaire',
      questions: []
    }
  ]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [copyingFromBefore, setCopyingFromBefore] = useState(false);
  const [editingTabIndex, setEditingTabIndex] = useState(null);
  const [editingTabValue, setEditingTabValue] = useState('');
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [savedFormId, setSavedFormId] = useState(null);

  const currentSectionType = sections[currentSectionIndex]?.section_type || 'demographics';
  const availableTypes = currentSectionType === 'questionnaire' ? QUESTIONNAIRE_QUESTION_TYPES : DEMOGRAPHICS_QUESTION_TYPES;

  const handleDragHover = (target) => {
    if (!dragItem) {
      if (dragOver) setDragOver(null);
      return;
    }
    if (!target) {
      if (dragOver) setDragOver(null);
      return;
    }
    const targetType = target.dataset.dragType;
    const index = Number(target.dataset.dragIndex);
    if (targetType !== dragItem.type || index === dragItem.fromIndex) {
      if (dragOver) setDragOver(null);
      return;
    }
    if (!dragOver || dragOver.type !== targetType || dragOver.index !== index) {
      setDragOver({ type: targetType, index });
    }
  };

  const { startAutoScroll, updateAutoScroll, stopAutoScroll } = useDragAutoScroll({ edgeSize: 140, maxSpeed: 18, onHoverChange: handleDragHover });

  useEffect(() => {
    if (!searchParams.get('type')) {
      setSearchParams({ type: selectedType }, { replace: true });
    }
  }, [searchParams, setSearchParams, selectedType]);

  useEffect(() => {
    setSelectedType(questionnaireType);
  }, [questionnaireType]);

  useEffect(() => {
    const loadForm = async () => {
      if (!project) return;
      const formId = project[formField];
      if (formId) {
        try {
          const response = await api.get(`/forms/${formId}`);
          const fetchedForm = response.data;
          setSavedFormId(formId);

          let loadedSections = [];
          if (fetchedForm.sections && fetchedForm.sections.length > 0) {
            loadedSections = fetchedForm.sections.map((sec, idx) => {
              const sectionType = sec.section_type || (idx === 0 ? 'demographics' : 'questionnaire');
              return {
                ...sec,
                section_type: sectionType,
                questions: normalizeLocationCodes(sec.questions.map(q => ({ ...q, section: q.section || sec.title })))
              };
            });
          } else if (fetchedForm.questions && fetchedForm.questions.length > 0) {
            const sectionMap = new Map();
            normalizeLocationCodes(fetchedForm.questions).forEach(q => {
              const secName = q.section && q.section.trim() ? q.section : 'Section 1';
              if (!sectionMap.has(secName)) sectionMap.set(secName, []);
              sectionMap.get(secName).push(q);
            });
            loadedSections = Array.from(sectionMap.entries()).map(([title, qs], idx) => ({
              id: `section_${Date.now()}_${idx}`,
              title,
              section_type: idx === 0 ? 'demographics' : 'questionnaire',
              questions: qs
            }));
          }

          if (loadedSections.length === 0) {
            loadedSections = [
              { id: `section_demographics_${Date.now()}`, title: 'Demographics', section_type: 'demographics', questions: [] },
              { id: `section_questionnaire_${Date.now()}`, title: 'Questionnaire', section_type: 'questionnaire', questions: [] }
            ];
          }

          // Ensure we always have at least demographics + questionnaire sections
          const hasDemo = loadedSections.some(s => s.section_type === 'demographics');
          const hasQuest = loadedSections.some(s => s.section_type === 'questionnaire');
          if (!hasDemo) {
            loadedSections.unshift({
              id: `section_demographics_${Date.now()}`,
              title: 'Demographics',
              section_type: 'demographics',
              questions: []
            });
          }
          if (!hasQuest) {
            loadedSections.push({
              id: `section_questionnaire_${Date.now()}`,
              title: 'Questionnaire',
              section_type: 'questionnaire',
              questions: []
            });
          }

          loadedSections = loadedSections.map((sec) => {
            const questions = normalizeLocationCodes((sec.questions || []).map(q => ({ ...q, section: q.section || sec.title })));
            return {
              ...sec,
              questions
            };
          });

          setSections(loadedSections);
          setFormData({
            title: fetchedForm.title,
            description: fetchedForm.description || '',
            questions: fetchedForm.questions || []
          });
          setCurrentSectionIndex(0);
        } catch (error) {
          toast.error('Failed to load questionnaire');
        }
      }
      setFetching(false);
    };
    loadForm();
  }, [project, formField]);

  const addQuestion = () => {
    const current = sections[currentSectionIndex];
    const isFirst = currentSectionIndex === 0;

    let newQuestion;
    if (current.section_type === 'demographics' && isFirst && !sections[0].questions.some(q => q.code === 'BENE')) {
      // Auto-suggest beneficiary question if not present
      newQuestion = {
        id: `q_${Date.now()}`,
        type: 'multiple_choice',
        title: '',
        code: '',
        description: '',
        required: false,
        options: ['Option 1', 'Option 2'],
        section: current.title
      };
    } else {
      newQuestion = {
        id: `q_${Date.now()}`,
        type: current.section_type === 'questionnaire' ? 'multiple_choice' : 'short_text',
        title: '',
        code: '',
        description: '',
        required: false,
        options: ['Option 1', 'Option 2'],
        section: current.title
      };
    }

    const updated = sections.map((sec, si) =>
      si === currentSectionIndex
        ? { ...sec, questions: [...sec.questions, newQuestion] }
        : sec
    );
    setSections(updated);
  };

  const addBeneficiaryQuestion = () => {
    const exists = sections.some(section =>
      section.questions.some(q => q.code === 'BENE')
    );
    if (exists) {
      toast.warning('Beneficiary question already exists in this form.');
      return;
    }
    const current = sections[currentSectionIndex];
    const beneQuestion = {
      id: `q_${Date.now()}`,
      type: 'multiple_choice',
      title: 'Are you a beneficiary of the livelihood program?',
      code: 'BENE',
      description: 'Yes — Beneficiary · No — Non-Beneficiary',
      required: true,
      options: ['Yes', 'No'],
      section: current.title
    };
    const updated = sections.map((sec, si) =>
      si === currentSectionIndex
        ? { ...sec, questions: [...sec.questions, beneQuestion] }
        : sec
    );
    setSections(updated);
    toast.success('Beneficiary question added to current section.');
  };

  const updateQuestion = (sectionIdx, qIdx, field, value) => {
    const updated = sections.map((sec, si) =>
      si === sectionIdx
        ? { ...sec, questions: sec.questions.map((q, qi) => qi === qIdx ? { ...q, [field]: value } : q) }
        : sec
    );
    setSections(updated);
  };

  const deleteQuestion = (sectionIdx, qIdx) => {
    const updated = sections.map((sec, si) =>
      si === sectionIdx
        ? { ...sec, questions: sec.questions.filter((_, qi) => qi !== qIdx) }
        : sec
    );
    setSections(updated);
  };

  const handleTypeChange = (sectionIdx, qIdx, newType) => {
    const updated = sections.map((sec, si) => {
      if (si !== sectionIdx) return sec;
      return {
        ...sec,
        questions: sec.questions.map((q, qi) => {
          if (qi !== qIdx) return q;
          const next = { ...q, type: newType };
          if (['multiple_choice', 'checkboxes', 'dropdown'].includes(newType)) {
            next.options = q.options?.length ? [...q.options] : ['Option 1', 'Option 2'];
          } else {
            delete next.options;
          }
          return next;
        }),
      };
    });
    setSections(updated);
  };

  const addOption = (sectionIdx, qIdx) => {
    const updated = sections.map((sec, si) =>
      si === sectionIdx
        ? { ...sec, questions: sec.questions.map((q, qi) => qi === qIdx ? { ...q, options: [...(q.options || []), ''] } : q) }
        : sec
    );
    setSections(updated);
  };

  const updateOption = (sectionIdx, qIdx, optIdx, value) => {
    const updated = sections.map((sec, si) =>
      si === sectionIdx
        ? { ...sec, questions: sec.questions.map((q, qi) => qi === qIdx ? { ...q, options: q.options.map((o, oi) => oi === optIdx ? value : o) } : q) }
        : sec
    );
    setSections(updated);
  };

  const deleteOption = (sectionIdx, qIdx, optIdx) => {
    const updated = sections.map((sec, si) =>
      si === sectionIdx
        ? { ...sec, questions: sec.questions.map((q, qi) => qi === qIdx ? { ...q, options: q.options.filter((_, oi) => oi !== optIdx) } : q) }
        : sec
    );
    setSections(updated);
  };

  const reorderArray = useCallback((arr, from, to) => {
    if (from === to) return arr;
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }, []);

  const resetDrag = useCallback(() => {
    setDragItem(null);
    setDragOver(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  const handleSectionDragStart = (e, fromIndex) => {
    if (editingTabIndex === fromIndex) {
      e.preventDefault();
      return;
    }
    setDragOver(null);
    setDragItem({ type: 'section', fromIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(fromIndex));
    startAutoScroll(e);
  };

  const handleSectionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updateAutoScroll(e);
  };

  const handleQuestionDragStart = (e, fromIndex) => {
    const tag = (e.target.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'OPTION', 'LABEL', 'A'].includes(tag)) {
      e.preventDefault();
      return;
    }
    setDragOver(null);
    setDragItem({ type: 'question', fromIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(fromIndex));
    startAutoScroll(e);
  };

  const handleQuestionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updateAutoScroll(e);
  };

  useEffect(() => {
    if (!dragItem) return undefined;
    const handleDocumentDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };
    const handleDocumentDrop = (e) => {
      e.preventDefault();
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const target = element && element.closest('[data-drag-target]');
      const fromIndex = dragItem.fromIndex;
      if (target && target.dataset.dragType === dragItem.type) {
        const toIndex = Number(target.dataset.dragIndex);
        if (toIndex !== fromIndex) {
          if (dragItem.type === 'question') {
              const updated = [...sections];
              updated[currentSectionIndex].questions = reorderArray(
                updated[currentSectionIndex].questions,
                fromIndex,
                toIndex
              );
              setSections(updated);
          }
        }
      }
      resetDrag();
    };
    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('drop', handleDocumentDrop);
    };
  }, [dragItem, sections, currentSectionIndex, reorderArray, resetDrag]);

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a questionnaire title');
      return false;
    }
    const allQ = sections.flatMap(s => s.questions);
    if (allQ.length === 0) {
      toast.error('Please add at least one question');
      return false;
    }
    for (let i = 0; i < allQ.length; i++) {
      const q = allQ[i];
      if (!q.title.trim()) {
        toast.error(`Question ${i + 1} is missing a title`);
        return false;
      }
      if (['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type)) {
        if (!q.options || q.options.length < 2 || q.options.some(opt => !opt.trim())) {
          toast.error(`Question ${i + 1} needs at least 2 valid options`);
          return false;
        }
      }
    }
    // Validate questionnaire section has no short_text/long_text
    const questSection = sections.find(s => s.section_type === 'questionnaire');
    if (questSection) {
      for (const q of questSection.questions) {
        if (q.type === 'short_text' || q.type === 'long_text') {
          toast.error(`"${q.title || 'Untitled'}" uses ${q.type === 'short_text' ? 'Short Text' : 'Long Text'} which is not allowed in the Questionnaire section. Move it to Demographics or change its type.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const allQuestions = sections.flatMap(s => s.questions);
    const csvHeaders = generateCSVHeaders(allQuestions);
    const payload = {
      ...formData,
      questions: allQuestions,
      sections,
      csvHeaders,
      csvColumnCount: csvHeaders ? csvHeaders.split(',').length : 0,
      project_id: projectId,
      questionnaire_type: questionnaireType,
      updatedAt: new Date().toISOString()
    };
    if (!payload.createdAt) payload.createdAt = new Date().toISOString();

    setLoading(true);
    try {
      let formId = savedFormId;
      if (formId) {
        await api.put(`/forms/${formId}`, payload);
        toast.success('Questionnaire updated successfully!');
      } else {
        const response = await api.post('/forms', payload);
        formId = response.data.id;
        setSavedFormId(formId);
        toast.success('Questionnaire created successfully!');

        await api.put(`/projects/${projectId}`, {
          [formField]: formId,
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save questionnaire');
    } finally {
      setLoading(false);
    }
  };

  const copyFormLink = () => {
    if (!savedFormId) return;
    const link = `${window.location.origin}/f/${savedFormId}`;
    navigator.clipboard.writeText(link);
    toast.success('Questionnaire link copied to clipboard!');
  };

  const handleTypeSwitch = (newType) => {
    const otherField = newType === 'before' ? 'after_form' : 'before_form';
    if (project?.[otherField]) {
      toast.error(`A ${newType === 'before' ? 'Before' : 'After'} questionnaire already exists for this project. Edit it from the ${newType === 'before' ? 'Before' : 'After'} tab.`);
      return;
    }
    setSelectedType(newType);
    setSearchParams({ type: newType }, { replace: true });
    setFormData({ title: '', description: '', questions: [] });
    setSections([
      {
        id: `section_demographics_${Date.now()}`,
        title: 'Demographics',
        section_type: 'demographics',
        questions: []
      },
      {
        id: `section_questionnaire_${Date.now()}`,
        title: 'Questionnaire',
        section_type: 'questionnaire',
        questions: []
      }
    ]);
    setSavedFormId(null);
    setCurrentSectionIndex(0);
  };

  const handleCopyFromBefore = async () => {
    if (!project?.before_form) {
      toast.error('No Before questionnaire to copy from');
      return;
    }
    setCopyingFromBefore(true);
    try {
      const res = await api.get(`/forms/${project.before_form}`);
      const beforeForm = res.data;

      let loadedSections = [];
      if (beforeForm.sections && beforeForm.sections.length > 0) {
        loadedSections = beforeForm.sections.map((sec, idx) => ({
          ...sec,
          id: `section_${sec.section_type || (idx === 0 ? 'demographics' : 'questionnaire')}_${Date.now()}_${idx}`,
          section_type: sec.section_type || (idx === 0 ? 'demographics' : 'questionnaire'),
          questions: (sec.questions || []).map(q => ({ ...q, section: q.section || sec.title })),
        }));
      } else if (beforeForm.questions && beforeForm.questions.length > 0) {
        const sectionMap = new Map();
        beforeForm.questions.forEach(q => {
          const secName = q.section && q.section.trim() ? q.section : 'Section 1';
          if (!sectionMap.has(secName)) sectionMap.set(secName, []);
          sectionMap.get(secName).push({ ...q });
        });
        loadedSections = Array.from(sectionMap.entries()).map(([title, qs], idx) => ({
          id: `section_${Date.now()}_${idx}`,
          title,
          section_type: idx === 0 ? 'demographics' : 'questionnaire',
          questions: qs,
        }));
      }

      if (loadedSections.length === 0) {
        loadedSections = [
          { id: `section_demographics_${Date.now()}`, title: 'Demographics', section_type: 'demographics', questions: [] },
          { id: `section_questionnaire_${Date.now()}`, title: 'Questionnaire', section_type: 'questionnaire', questions: [] },
        ];
      }

      setSections(loadedSections);
      setFormData({
        title: beforeForm.title ? `${beforeForm.title} (After)` : '',
        description: beforeForm.description || '',
        questions: [],
      });
      setCurrentSectionIndex(0);
      toast.success('Questions copied from Before! Edit as needed, then save.');
    } catch (error) {
      toast.error('Failed to load Before questionnaire');
    } finally {
      setCopyingFromBefore(false);
    }
  };

  if (fetching) return <div className="flex items-center justify-center py-20 text-slate-500">Loading questionnaire...</div>;

  const current = sections[currentSectionIndex];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;
  const sectionConfig = SECTION_TYPE_CONFIG[current.section_type] || SECTION_TYPE_CONFIG.demographics;
  const SectionIcon = sectionConfig.icon;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
            Create Questionnaire
          </p>

          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-slate-300">Assign to:</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTypeSwitch('before')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  questionnaireType === 'before'
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-white/10 text-slate-300 ring-1 ring-white/20 hover:bg-white/20'
                }`}
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('after')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  questionnaireType === 'after'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-white/10 text-slate-300 ring-1 ring-white/20 hover:bg-white/20'
                }`}
              >
                After
              </button>
            </div>
          </div>

          <p className="mb-3 text-xs text-slate-400">
            {questionnaireType === 'before'
              ? 'This questionnaire will be distributed to respondents before the intervention or program.'
              : 'This questionnaire will be distributed after the intervention to measure changes from the Before questionnaire.'}
          </p>
          <Input
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder={`Enter ${questionnaireType} questionnaire title`}
            className="mb-3 h-12 border-0 border-b-2 border-white/20 bg-transparent px-0 text-2xl font-bold text-white shadow-none placeholder:text-slate-400 focus:border-cyan-300 focus:ring-0"
          />
          <Textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add a short description (optional)"
            rows={2}
            className="max-w-2xl border-0 bg-white/5 px-0 text-sm text-slate-200 placeholder:text-slate-400 focus:ring-0"
          />
        </div>
      </section>

      {/* Section Type Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Layers className="h-4 w-4 text-cyan-600" />
          Sections
        </div>
        <div className="flex flex-wrap gap-2">
          {questionnaireType === 'after' && project?.before_form && !savedFormId && (
            <Button onClick={handleCopyFromBefore} variant="outline" size="sm" disabled={copyingFromBefore} className="border-violet-300 text-violet-700 hover:bg-violet-50">
              {copyingFromBefore ? (
                <span className="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              {copyingFromBefore ? 'Copying...' : 'Copy from Before'}
            </Button>
          )}
          <Button onClick={addBeneficiaryQuestion} variant="outline" size="sm" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50">
            <UserPlus className="mr-1.5 h-4 w-4" /> Beneficiary Q
          </Button>
          {savedFormId && (
            <Button onClick={copyFormLink} variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <Copy className="mr-1.5 h-4 w-4" /> Copy Link
            </Button>
          )}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-3">
        {sections.map((sec, idx) => {
          const cfg = SECTION_TYPE_CONFIG[sec.section_type] || SECTION_TYPE_CONFIG.demographics;
          const Icon = cfg.icon;
          return (
            <button
              key={sec.id}
              onClick={() => setCurrentSectionIndex(idx)}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition ${
                idx === currentSectionIndex
                  ? `bg-${cfg.color}-600 text-white shadow-lg shadow-${cfg.color}-600/20`
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-bold">{cfg.label}</span>
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${idx === currentSectionIndex ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {sec.questions.filter(q => !isReservedField(q)).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className={`flex items-center justify-between border-b border-slate-100 px-6 py-4 ${
          current.section_type === 'demographics' ? 'bg-indigo-50/50' : 'bg-cyan-50/50'
        }`}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              current.section_type === 'demographics' ? 'bg-indigo-100 text-indigo-600' : 'bg-cyan-100 text-cyan-600'
            }`}>
              <SectionIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{sectionConfig.label} Section</p>
              <p className="text-sm text-slate-500">{sectionConfig.description}</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 px-6 py-2">
          {(() => {
            const surveyNumbers = new Map();
            let surveyCount = 0;
            current.questions.forEach(question => {
              if (!isReservedField(question)) surveyNumbers.set(question.id, ++surveyCount);
            });
            return current.questions.map((q, qIdx) => {
            const isPhoto = q.type === 'profile_photo';
            return (
            <div
              key={q.id}
              draggable
              data-drag-target="question"
              data-drag-type="question"
              data-drag-index={qIdx}
              onDragStart={(e) => handleQuestionDragStart(e, qIdx)}
              onDragOver={handleQuestionDragOver}
              onDragEnd={resetDrag}
              className={`py-6 transition ${dragItem?.type === 'question' && dragItem.fromIndex === qIdx ? 'opacity-50' : ''} ${dragOver?.type === 'question' && dragOver.index === qIdx ? 'rounded-xl bg-cyan-50/60' : ''}`}
            >
              <div className="flex gap-4">
                <div className="flex cursor-grab items-start pt-2 text-slate-300 active:cursor-grabbing" title="Drag to reorder questions">
                    <GripVertical className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ${
                      isPhoto ? 'bg-purple-50 text-purple-700 ring-purple-100' :
                      'bg-cyan-50 text-cyan-700 ring-cyan-100'
                    }`}>
                      {isPhoto ? <Camera className="h-3.5 w-3.5" /> : surveyNumbers.get(q.id)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {isPhoto ? 'Profile Photo' : 'Question'}
                    </span>
                    {isPhoto && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 ring-1 ring-purple-100">Image Upload</span>}
                    {q.required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100">Required</span>}
                  </div>
                  {isPhoto ? (
                    <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/50 p-4">
                      <div className="flex items-center gap-3">
                        <Camera className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="text-sm font-semibold text-purple-800">Profile Photo / Image Upload</p>
                          <p className="text-xs text-purple-500">Respondents will upload a JPG, JPEG, or PNG image (max 5MB)</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div><Label>Field label</Label><Input value={q.title} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'title', e.target.value)} placeholder="e.g. Profile Photo" /></div>
                        <div><Label>Question code</Label><Input value={q.code || ''} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'code', e.target.value)} placeholder="e.g. PHOTO" /></div>
                        <div className="lg:col-span-2"><Label>Description (optional)</Label><Input value={q.description || ''} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'description', e.target.value)} placeholder="Add helper text" /></div>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="lg:col-span-2"><Label>Question text</Label><Input value={q.title} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'title', e.target.value)} placeholder="Enter your question" /></div>
                    <div><Label>Type</Label><Select value={q.type} onValueChange={v => handleTypeChange(currentSectionIndex, qIdx, v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availableTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Question code</Label><Input value={q.code || ''} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'code', e.target.value)} placeholder="e.g., A1" /></div>
                    <div className="lg:col-span-2"><Label>Description (optional)</Label><Input value={q.description || ''} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'description', e.target.value)} placeholder="Add helper text" /></div>
                  </div>

                  {['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type) && (
                    <div className="rounded-xl bg-slate-50/80 p-4">
                      <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Options</Label>
                      <div className="space-y-2">
                        {q.options?.map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-400 ring-1 ring-slate-200">{oi + 1}</div>
                            <Input value={opt} onChange={e => updateOption(currentSectionIndex, qIdx, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                            <Button variant="outline" size="icon" onClick={() => deleteOption(currentSectionIndex, qIdx, oi)} className="text-rose-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => addOption(currentSectionIndex, qIdx)} className="mt-3 text-cyan-700 hover:bg-cyan-50">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Option
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={q.required} onCheckedChange={c => updateQuestion(currentSectionIndex, qIdx, 'required', c)} />
                      <Label className="text-sm font-medium text-slate-700">Required question</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => deleteQuestion(currentSectionIndex, qIdx)} className="text-rose-500 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
            );
            });
          })()}
        </div>

        <div className="border-t border-slate-100 px-6 py-5">
          <Button variant="outline" className="w-full border-dashed text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" /> Add Question to {sectionConfig.label}
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between pb-10">
        <Button variant="outline" onClick={() => setCurrentSectionIndex(currentSectionIndex - 1)} disabled={isFirst}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        {!isLast ? (
          <Button onClick={() => setCurrentSectionIndex(currentSectionIndex + 1)} className="bg-slate-900 text-white hover:bg-slate-800">
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700" onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" /> {loading ? 'Saving...' : 'Save Questionnaire'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuestionnaireBuilder;
