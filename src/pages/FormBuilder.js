import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, ChevronLeft, ChevronRight, Layers, Pencil, GripVertical, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating Scale (1-5)' }
];

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

const FormBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;

  const importedData = location.state?.importedData;
  const isImportMode = !!importedData && !isEditMode;

  const [formData, setFormData] = useState({
    title: importedData?.title || '',
    description: importedData?.description || '',
    questions: []
  });

  const [sections, setSections] = useState(() => {
    if (isImportMode && importedData?.fields) {
      return [{
        id: `section_${Date.now()}`,
        title: 'Imported Fields',
        questions: importedData.fields.map((field, index) => ({
          id: field.id,
          title: field.label,
          type: 'multiple_choice',
          required: field.required || false,
          placeholder: field.placeholder || '',
          options: ['Option 1', 'Option 2'],
          code: field.label.toLowerCase().replace(/\s+/g, '_'),
          section: 'Imported Fields'
        }))
      }];
    } else if (!isEditMode) {
      return [{ id: `section_${Date.now()}`, title: 'Untitled Section', questions: [] }];
    }
    return [];
  });
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const [editingTabIndex, setEditingTabIndex] = useState(null);
  const [editingTabValue, setEditingTabValue] = useState('');
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const fetchForm = useCallback(async () => {
    try {
      const response = await api.get(`/forms/${id}`);
      const fetchedForm = response.data;

      let loadedSections = [];

      if (fetchedForm.sections && fetchedForm.sections.length > 0) {
        loadedSections = fetchedForm.sections.map(sec => ({
          ...sec,
          questions: sec.questions.map(q => ({ ...q, section: q.section || sec.title }))
        }));
      } else if (fetchedForm.questions && fetchedForm.questions.length > 0) {
        const sectionMap = new Map();
        fetchedForm.questions.forEach(q => {
          const secName = q.section && q.section.trim() ? q.section : 'Section 1';
          if (!sectionMap.has(secName)) sectionMap.set(secName, []);
          sectionMap.get(secName).push(q);
        });
        loadedSections = Array.from(sectionMap.entries()).map(([title, qs], idx) => ({
          id: `section_${Date.now()}_${idx}`,
          title,
          questions: qs
        }));
      } else {
        loadedSections = [{ id: `section_${Date.now()}`, title: 'Section 1', questions: [] }];
      }

      setSections(loadedSections);
      setFormData({
        title: fetchedForm.title,
        description: fetchedForm.description || '',
        questions: fetchedForm.questions || []
      });
      setCurrentSectionIndex(0);
    } catch (error) {
      toast.error('Failed to fetch form');
      navigate('/dashboard');
    } finally {
      setFetching(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isEditMode) fetchForm();
  }, [isEditMode, fetchForm]);

  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: `New Section ${sections.length + 1}`,
      questions: []
    };
    setSections([...sections, newSection]);
    setCurrentSectionIndex(sections.length);
  };

  const deleteSection = (index) => {
    if (sections.length === 1) {
      toast.error('You must keep at least one section');
      return;
    }
    const newSections = [...sections];
    newSections.splice(index, 1);
    setSections(newSections);
    if (currentSectionIndex >= newSections.length) setCurrentSectionIndex(newSections.length - 1);
  };

  const renameSection = (index, newTitle) => {
    const newSections = [...sections];
    newSections[index].title = newTitle;
    newSections[index].questions = newSections[index].questions.map(q => ({ ...q, section: newTitle }));
    setSections(newSections);
  };

  const moveQuestionToSection = (questionId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newSections = [...sections];
    const qIndex = newSections[fromIdx].questions.findIndex(q => q.id === questionId);
    if (qIndex === -1) return;
    const [moved] = newSections[fromIdx].questions.splice(qIndex, 1);
    moved.section = newSections[toIdx].title;
    newSections[toIdx].questions.push(moved);
    setSections(newSections);
    toast.success(`Moved to "${newSections[toIdx].title}"`);
  };

  const addQuestion = () => {
    const current = sections[currentSectionIndex];
    const newQuestion = {
      id: `q_${Date.now()}`,
      type: 'multiple_choice',
      title: '',
      code: '',
      description: '',
      required: false,
      options: ['Option 1', 'Option 2'],
      section: current.title
    };
    const updated = [...sections];
    updated[currentSectionIndex].questions.push(newQuestion);
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
    const updated = [...sections];
    updated[currentSectionIndex].questions.push(beneQuestion);
    setSections(updated);
    toast.success('Beneficiary question added to current section.');
  };

  const updateQuestion = (sectionIdx, qIdx, field, value) => {
    const updated = [...sections];
    updated[sectionIdx].questions[qIdx][field] = value;
    setSections(updated);
  };

  const deleteQuestion = (sectionIdx, qIdx) => {
    const updated = [...sections];
    updated[sectionIdx].questions.splice(qIdx, 1);
    setSections(updated);
  };

  const handleTypeChange = (sectionIdx, qIdx, newType) => {
    const updated = [...sections];
    const q = updated[sectionIdx].questions[qIdx];
    q.type = newType;
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(newType)) {
      q.options = q.options?.length ? q.options : ['Option 1', 'Option 2'];
    } else {
      delete q.options;
    }
    setSections(updated);
  };

  const addOption = (sectionIdx, qIdx) => {
    const updated = [...sections];
    const q = updated[sectionIdx].questions[qIdx];
    q.options = [...(q.options || []), ''];
    setSections(updated);
  };

  const updateOption = (sectionIdx, qIdx, optIdx, value) => {
    const updated = [...sections];
    updated[sectionIdx].questions[qIdx].options[optIdx] = value;
    setSections(updated);
  };

  const deleteOption = (sectionIdx, qIdx, optIdx) => {
    const updated = [...sections];
    updated[sectionIdx].questions[qIdx].options.splice(optIdx, 1);
    setSections(updated);
  };

  const reorderArray = (arr, from, to) => {
    if (from === to) return arr;
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const resetDrag = () => {
    setDragItem(null);
    setDragOver(null);
  };

  const handleSectionDragStart = (e, fromIndex) => {
    if (editingTabIndex === fromIndex) {
      e.preventDefault();
      return;
    }
    setDragItem({ type: 'section', fromIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(fromIndex));
  };

  const handleSectionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSectionDrop = (e, toIndex) => {
    e.preventDefault();
    if (!dragItem || dragItem.type !== 'section') {
      resetDrag();
      return;
    }
    const fromIndex = dragItem.fromIndex;
    const currentId = sections[currentSectionIndex]?.id;
    const next = reorderArray(sections, fromIndex, toIndex);
    setSections(next);
    const newIdx = next.findIndex(s => s.id === currentId);
    if (newIdx !== -1) setCurrentSectionIndex(newIdx);
    resetDrag();
  };

  const handleQuestionDragStart = (e, fromIndex) => {
    const tag = (e.target.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'OPTION', 'LABEL', 'A'].includes(tag)) {
      e.preventDefault();
      return;
    }
    setDragItem({ type: 'question', fromIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(fromIndex));
  };

  const handleQuestionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleQuestionDrop = (e, toIndex) => {
    e.preventDefault();
    if (!dragItem || dragItem.type !== 'question') {
      resetDrag();
      return;
    }
    const fromIndex = dragItem.fromIndex;
    if (fromIndex === toIndex) {
      resetDrag();
      return;
    }
    const updated = [...sections];
    updated[currentSectionIndex].questions = reorderArray(
      updated[currentSectionIndex].questions,
      fromIndex,
      toIndex
    );
    setSections(updated);
    resetDrag();
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a form title');
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
      csvColumnCount: csvHeaders.split(',').length,
      updatedAt: new Date().toISOString()
    };
    if (!payload.createdAt) payload.createdAt = new Date().toISOString();
    setLoading(true);
    try {
      if (isEditMode) {
        await api.put(`/forms/${id}`, payload);
        toast.success('Form updated successfully!');
      } else {
        const response = await api.post('/forms', payload);
        toast.success('Form created successfully!');
        navigate(`/forms/${response.data.id}/edit`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save form');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading form...</div>;
  if (sections.length === 0) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading sections...</div>;

  const current = sections[currentSectionIndex];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-slate-600">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 sm:inline-flex">
              <Layers className="h-3.5 w-3.5" />
              {isEditMode ? 'Editing form' : 'New form'}
            </span>
            <Button onClick={handleSave} disabled={loading} className="bg-cyan-600 text-white hover:bg-cyan-700">
              <Save className="mr-2 h-4 w-4" /> {loading ? 'Saving...' : 'Save Form'}
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6">
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
            {isEditMode ? 'Edit form' : 'Create a new form'}
          </p>
          <Input
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter your form title"
            className="mb-3 h-12 border-0 border-b-2 border-white/20 bg-transparent px-0 text-2xl font-bold text-white shadow-none placeholder:text-slate-400 focus:border-cyan-300 focus:ring-0"
          />
          <Textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add a short description (optional)"
            rows={2}
            className="max-w-2xl border-0 bg-white/5 px-0 text-sm text-slate-200 placeholder:text-slate-400 focus:ring-0"
          />
        </section>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Layers className="h-4 w-4 text-cyan-600" />
            Sections <span className="hidden text-slate-400 sm:inline">(drag tabs to reorder · double-click to rename)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addBeneficiaryQuestion} variant="outline" size="sm" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50">
              <UserPlus className="mr-1.5 h-4 w-4" /> Beneficiary Q
            </Button>
            <Button onClick={addSection} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Add Section
            </Button>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {sections.map((sec, idx) => {
            if (editingTabIndex === idx) {
              return <Input key={sec.id} value={editingTabValue} onChange={e => setEditingTabValue(e.target.value)} onBlur={() => { if (editingTabValue.trim()) renameSection(idx, editingTabValue); setEditingTabIndex(null); }} onKeyDown={e => { if (e.key === 'Enter') { if (editingTabValue.trim()) renameSection(idx, editingTabValue); setEditingTabIndex(null); } if (e.key === 'Escape') setEditingTabIndex(null); }} className="w-auto min-w-[120px] text-sm" autoFocus />;
            }
            return (
              <button
                key={sec.id}
                draggable
                onDragStart={(e) => handleSectionDragStart(e, idx)}
                onDragOver={handleSectionDragOver}
                onDragEnter={() => {
                  if (dragItem?.type === 'section' && dragItem.fromIndex !== idx) setDragOver({ type: 'section', index: idx });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
                }}
                onDrop={(e) => handleSectionDrop(e, idx)}
                onDragEnd={resetDrag}
                onClick={() => setCurrentSectionIndex(idx)}
                onDoubleClick={() => { setEditingTabValue(sec.title); setEditingTabIndex(idx); }}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  idx === currentSectionIndex
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                } ${
                  dragItem?.type === 'section' && dragItem.fromIndex === idx ? 'opacity-50' : ''
                } ${
                  dragOver?.type === 'section' && dragOver.index === idx ? 'ring-2 ring-cyan-400 bg-cyan-50 text-slate-900' : ''
                }`}
                title="Drag to reorder sections"
              >
                <span className={`font-bold ${idx === currentSectionIndex ? 'text-cyan-300' : 'text-slate-400'}`}>{idx + 1}.</span>
                <span className="max-w-[160px] truncate">{sec.title}</span>
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${idx === currentSectionIndex ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {sec.questions.length}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
              <Input value={current.title} onChange={e => renameSection(currentSectionIndex, e.target.value)} className="border-0 bg-transparent text-lg font-bold text-slate-900 shadow-none focus:ring-0" />
              <Pencil className="h-4 w-4 shrink-0 text-slate-300" />
            </div>
            <span className="hidden shrink-0 text-xs text-slate-400 md:inline">Drag questions to reorder</span>
            <Button variant="ghost" size="sm" onClick={() => deleteSection(currentSectionIndex)} disabled={sections.length === 1} className="text-rose-500 hover:bg-rose-50 hover:text-rose-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="divide-y divide-slate-100 px-6 py-2">
            {current.questions.map((q, qIdx) => (
              <div
                key={q.id}
                draggable
                onDragStart={(e) => handleQuestionDragStart(e, qIdx)}
                onDragOver={handleQuestionDragOver}
                onDragEnter={() => {
                  if (dragItem?.type === 'question' && dragItem.fromIndex !== qIdx) setDragOver({ type: 'question', index: qIdx });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
                }}
                onDrop={(e) => handleQuestionDrop(e, qIdx)}
                onDragEnd={resetDrag}
                className={`py-6 transition ${
                  dragItem?.type === 'question' && dragItem.fromIndex === qIdx ? 'opacity-50' : ''
                } ${
                  dragOver?.type === 'question' && dragOver.index === qIdx ? 'rounded-xl bg-cyan-50/60' : ''
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex cursor-grab items-start pt-2 text-slate-300 active:cursor-grabbing" title="Drag to reorder questions">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-xs font-bold text-cyan-700 ring-1 ring-cyan-100">
                        {qIdx + 1}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Question</span>
                      {q.required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100">Required</span>}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="lg:col-span-2"><Label>Question text</Label><Input value={q.title} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'title', e.target.value)} placeholder="Enter your question" /></div>
                      <div><Label>Type</Label><Select value={q.type} onValueChange={v => handleTypeChange(currentSectionIndex, qIdx, v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
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
                        <div className="w-44">
                          <Select value={currentSectionIndex.toString()} onValueChange={val => moveQuestionToSection(q.id, currentSectionIndex, parseInt(val))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{sections.map((sec, idx) => <SelectItem key={sec.id} value={idx.toString()}>{sec.title}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteQuestion(currentSectionIndex, qIdx)} className="text-rose-500 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-6 py-5">
            <Button variant="outline" className="w-full border-dashed text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" /> Add Question to this Section
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
              <Save className="mr-2 h-4 w-4" /> {loading ? 'Saving...' : 'Publish Form'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default FormBuilder;
