import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, ChevronLeft, ChevronRight, Layers, Pencil } from 'lucide-react';
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
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating Scale (1-5)' }
];

const generateCSVHeaders = (questions) => {
  const shouldSkipQuestion = (questionType, title = '') => {
    const skipTypes = ['short_text', 'long_text'];
    const skipKeywords = ['name', 'address', 'comment', 'specify', 'consent', 'text'];
    if (skipTypes.includes(questionType)) return true;
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
  
  // Check for imported CSV data
  const importedData = location.state?.importedData;
  const isImportMode = !!importedData && !isEditMode;

  const [formData, setFormData] = useState({ 
    title: importedData?.title || '', 
    description: importedData?.description || '', 
    questions: [] 
  });
  
  const [sections, setSections] = useState(() => {
    if (isImportMode && importedData?.fields) {
      // Create sections from imported CSV fields
      return [{
        id: `section_${Date.now()}`,
        title: 'Imported Fields',
        questions: importedData.fields.map((field, index) => ({
          id: field.id,
          title: field.label,
          type: 'short_text',
          required: field.required || false,
          placeholder: field.placeholder || '',
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

  // ✅ Helper function to add the beneficiary question with one click
  const addBeneficiaryQuestion = () => {
    // Check if a question with code 'BENE' already exists in any section
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
      title: 'Are you a beneficiary?',
      code: 'BENE',
      description: '',
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

  if (fetching) return <div className="min-h-screen bg-[#F8FDFF] flex items-center justify-center">Loading form...</div>;
  if (sections.length === 0) return <div className="min-h-screen bg-[#F8FDFF] flex items-center justify-center">Loading sections...</div>;

  const current = sections[currentSectionIndex];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;

  return (
    <div className="min-h-screen bg-[#F8FDFF]">
      <nav className="bg-white border-b sticky top-0 z-50 p-4 flex justify-between">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}><ArrowLeft className="mr-2 h-4 w-4"/> Dashboard</Button>
        <Button onClick={handleSave} disabled={loading}><Save className="mr-2 h-4 w-4"/> {loading ? 'Saving...' : 'Save Form'}</Button>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8 mb-6">
          <Input placeholder="Form Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="text-lg font-semibold mb-4" />
          <Textarea placeholder="Description (optional)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} />
        </Card>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-[#003366]"/><span className="text-sm">Sections (double‑click tab to rename)</span></div>
          <div className="flex gap-2">
            <Button onClick={addSection} variant="outline" size="sm"><Plus className="mr-1 h-4 w-4"/> Add Section</Button>
            <Button onClick={addBeneficiaryQuestion} variant="outline" size="sm" className="text-[#00AEEF]">
              <Plus className="mr-1 h-4 w-4"/> Add Beneficiary Question
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-2 mb-6">
          {sections.map((sec, idx) => {
            if (editingTabIndex === idx) {
              return <Input key={sec.id} value={editingTabValue} onChange={e => setEditingTabValue(e.target.value)} onBlur={() => { if (editingTabValue.trim()) renameSection(idx, editingTabValue); setEditingTabIndex(null); }} onKeyDown={e => { if (e.key === 'Enter') { if (editingTabValue.trim()) renameSection(idx, editingTabValue); setEditingTabIndex(null); } if (e.key === 'Escape') setEditingTabIndex(null); }} className="w-auto min-w-[120px] text-sm" autoFocus />;
            }
            return (
              <button key={sec.id} onClick={() => setCurrentSectionIndex(idx)} onDoubleClick={() => { setEditingTabValue(sec.title); setEditingTabIndex(idx); }} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${idx === currentSectionIndex ? 'bg-[#003366] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {sec.title} {idx === currentSectionIndex && <span className="ml-2 text-xs">({sec.questions.length})</span>}
              </button>
            );
          })}
        </div>

        <Card className="p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 flex items-center gap-2"><Input value={current.title} onChange={e => renameSection(currentSectionIndex, e.target.value)} className="text-xl font-semibold border border-slate-200 bg-slate-50" /><Pencil className="h-4 w-4 text-slate-400"/></div>
            <Button variant="ghost" size="sm" onClick={() => deleteSection(currentSectionIndex)} disabled={sections.length === 1}><Trash2 className="h-4 w-4 text-red-600"/></Button>
          </div>

          {current.questions.map((q, qIdx) => (
            <div key={q.id} className="border-t pt-4 first:border-0 first:pt-0 mb-6">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1"><Label>Question {qIdx+1}</Label><Input value={q.title} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'title', e.target.value)} placeholder="Question text" /></div>
                    <div className="w-48"><Label>Type</Label><Select value={q.type} onValueChange={v => handleTypeChange(currentSectionIndex, qIdx, v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="w-48"><Label>Question Code</Label><Input value={q.code || ''} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'code', e.target.value)} placeholder="e.g., A1" /></div>
                    <div className="w-48"><Label>Move to</Label><Select value={currentSectionIndex.toString()} onValueChange={val => moveQuestionToSection(q.id, currentSectionIndex, parseInt(val))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sections.map((sec, idx) => <SelectItem key={sec.id} value={idx.toString()}>{sec.title}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <Input placeholder="Description (optional)" value={q.description || ''} onChange={e => updateQuestion(currentSectionIndex, qIdx, 'description', e.target.value)} />
                  {['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type) && (
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {q.options?.map((opt, oi) => <div key={oi} className="flex gap-2"><Input value={opt} onChange={e => updateOption(currentSectionIndex, qIdx, oi, e.target.value)} /><Button variant="outline" size="sm" onClick={() => deleteOption(currentSectionIndex, qIdx, oi)}><Trash2 className="h-4 w-4 text-red-600"/></Button></div>)}
                      <Button variant="outline" size="sm" onClick={() => addOption(currentSectionIndex, qIdx)}><Plus className="mr-1 h-4 w-4"/> Add Option</Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2"><Switch checked={q.required} onCheckedChange={c => updateQuestion(currentSectionIndex, qIdx, 'required', c)}/><Label>Required</Label></div>
                </div>
                <Button variant="outline" size="sm" onClick={() => deleteQuestion(currentSectionIndex, qIdx)}><Trash2 className="h-4 w-4 text-red-600"/></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full mt-4 border-dashed" onClick={addQuestion}><Plus className="mr-2 h-4 w-4"/> Add Question to this Section</Button>
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setCurrentSectionIndex(currentSectionIndex-1)} disabled={isFirst}><ChevronLeft className="mr-2 h-4 w-4"/> Previous</Button>
          {!isLast ? <Button onClick={() => setCurrentSectionIndex(currentSectionIndex+1)}>Next <ChevronRight className="ml-2 h-4 w-4"/></Button> : <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Publish Form'}</Button>}
        </div>
      </div>
    </div>
  );
};

export default FormBuilder;