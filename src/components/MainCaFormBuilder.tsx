import React, { useEffect, useRef, useState } from 'react';
import {
  CaFormField,
  CampusAmbassador,
  CaRegistrationForm,
  FormFieldType,
  FormSubmission
} from '../types';
import {
  buildDefaultCoreFormFields,
  deleteCaForm,
  importFormSubmissionToStudent,
  QUICK_CUSTOM_FORM_FIELD_PRESETS,
  rejectFormSubmission,
  saveCaForm,
  subscribeToAllCaForms,
  subscribeToAllFormSubmissions,
  subscribeToFormsForCA,
  subscribeToFormSubmissionsByFormCreator,
  subscribeToFormSubmissionsForCA
} from '../services/formService';
import {
  Plus,
  Link2,
  Check,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Users,
  CheckCircle2,
  XCircle,
  Save,
  ExternalLink,
  AlertCircle,
  Sparkles,
  FileText,
  UserCheck
} from 'lucide-react';

interface MainCaFormBuilderProps {
  ca: CampusAmbassador;
  actorUid: string;
  actorEmail: string;
  actorRole?: 'admin' | 'ca';
  isAdminMode?: boolean;
}

export const MainCaFormBuilder: React.FC<MainCaFormBuilderProps> = ({
  ca,
  actorUid,
  actorEmail,
  actorRole = 'ca',
  isAdminMode = false
}) => {
  const [forms, setForms] = useState<CaRegistrationForm[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [editingForm, setEditingForm] = useState<CaRegistrationForm | null>(null);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [caFilter, setCaFilter] = useState<string>('all');
  const [formFilter, setFormFilter] = useState<string>('all');

  // New custom field draft
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');

  const autoImportingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubForms = isAdminMode
      ? subscribeToAllCaForms(setForms)
      : subscribeToFormsForCA(ca.uid, setForms);

    if (isAdminMode) {
      const unsubSubs = subscribeToAllFormSubmissions(setSubmissions);
      return () => {
        unsubForms();
        unsubSubs();
      };
    }

    let ownSubs: FormSubmission[] = [];
    let creatorSubs: FormSubmission[] = [];

    const mergeAndSet = () => {
      const merged = new Map<string, FormSubmission>();
      [...creatorSubs, ...ownSubs].forEach(item => {
        merged.set(item.id, item);
      });
      const sorted = Array.from(merged.values()).sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      setSubmissions(sorted);
    };

    const unsubOwn = subscribeToFormSubmissionsForCA(ca.uid, (list) => {
      ownSubs = list;
      mergeAndSet();
    });

    const unsubCreator = subscribeToFormSubmissionsByFormCreator(ca.uid, (list) => {
      creatorSubs = list;
      mergeAndSet();
    });

    return () => {
      unsubForms();
      unsubOwn();
      unsubCreator();
    };
  }, [ca.uid, isAdminMode]);

  // Auto-sync pending submissions into Students when form.autoAddStudent is enabled (strictly for submissions owned by this CA or Admin)
  useEffect(() => {
    if (forms.length === 0 || submissions.length === 0) return;
    const formMap = new Map(forms.map(f => [f.id, f]));

    const pendingToAutoSync = submissions.filter(sub => {
      if (sub.status !== 'pending') return false;
      if (!isAdminMode && sub.caUid !== ca.uid) return false;
      if (autoImportingIdsRef.current.has(sub.id)) return false;
      const parentForm = formMap.get(sub.formId);
      return parentForm ? parentForm.autoAddStudent !== false : true;
    });

    if (pendingToAutoSync.length === 0) return;

    pendingToAutoSync.forEach(async (sub) => {
      autoImportingIdsRef.current.add(sub.id);
      try {
        await importFormSubmissionToStudent(sub, actorEmail);
      } catch (err) {
        console.warn('Auto-import submission notice:', err);
      }
    });
  }, [forms, submissions, actorEmail, ca.uid, isAdminMode]);

  const handleCreateNewForm = () => {
    const now = new Date().toISOString();
    const id = `form_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setEditingForm({
      id,
      caUid: ca.uid,
      caId: ca.caId,
      caName: ca.name,
      caCollege: ca.college,
      title: 'Event Participation & Certificate Form',
      description: 'Fill out your accurate details below. Your name and details will appear directly on your verified certificate.',
      isActive: true,
      autoAddStudent: true,
      fields: buildDefaultCoreFormFields(ca),
      createdAt: now,
      updatedAt: now
    });
    setStatusMessage(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm) return;
    if (!editingForm.title.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a form title.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const saved = await saveCaForm(editingForm, actorUid, actorEmail, actorRole);
      setEditingForm(null);
      setStatusMessage({
        type: 'success',
        text: `Form "${saved.title}" saved! Share link is ready to send to students.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed saving form.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFormActive = async (form: CaRegistrationForm) => {
    try {
      await saveCaForm({ ...form, isActive: !form.isActive }, actorUid, actorEmail, actorRole);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Could not toggle form status.' });
    }
  };

  const handleDeleteForm = async (form: CaRegistrationForm) => {
    if (!window.confirm(`Delete form "${form.title}"? Existing imported student records will remain intact.`)) {
      return;
    }
    try {
      await deleteCaForm(form.id, actorUid, actorEmail, actorRole);
      if (editingForm?.id === form.id) setEditingForm(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Could not delete form.' });
    }
  };

  const getShareUrl = (formId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/form/${formId}`;
  };

  const handleCopyLink = (formId: string) => {
    navigator.clipboard.writeText(getShareUrl(formId));
    setCopiedFormId(formId);
    setTimeout(() => setCopiedFormId(null), 2500);
  };

  const updateField = (fieldId: string, patch: Partial<CaFormField>) => {
    setEditingForm(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fields: prev.fields.map(f => (f.id === fieldId ? { ...f, ...patch } : f))
      };
    });
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setEditingForm(prev => {
      if (!prev) return null;
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= prev.fields.length) return prev;
      const copy = [...prev.fields];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, item);
      return { ...prev, fields: copy };
    });
  };

  const removeCustomField = (fieldId: string) => {
    setEditingForm(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fields: prev.fields.filter(f => f.id !== fieldId)
      };
    });
  };

  const addCustomField = (preset?: Omit<CaFormField, 'id'>) => {
    if (!editingForm) return;
    if (preset) {
      if (editingForm.fields.some(f => f.key.toLowerCase() === preset.key.toLowerCase())) {
        return;
      }
      const added: CaFormField = {
        ...preset,
        id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`
      };
      setEditingForm(prev => (prev ? { ...prev, fields: [...prev.fields, added] } : null));
      return;
    }

    const cleanLabel = newFieldLabel.trim();
    if (!cleanLabel) return;
    const cleanKey = (newFieldKey.trim() || cleanLabel)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!cleanKey) return;
    if (editingForm.fields.some(f => f.key.toLowerCase() === cleanKey)) {
      setStatusMessage({ type: 'error', text: `Field key "${cleanKey}" already exists in this form.` });
      return;
    }

    const optionsList = newFieldType === 'select'
      ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const customField: CaFormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      key: cleanKey,
      label: cleanLabel,
      type: newFieldType,
      required: newFieldRequired,
      enabled: true,
      placeholder: `Enter ${cleanLabel}`,
      options: optionsList,
      isCore: false,
      linkedPlaceholderTag: cleanKey
    };

    setEditingForm(prev => (prev ? { ...prev, fields: [...prev.fields, customField] } : null));
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptions('');
  };

  const handleManualImportSubmission = async (sub: FormSubmission) => {
    try {
      await importFormSubmissionToStudent(sub, actorEmail);
      setStatusMessage({ type: 'success', text: `Added ${sub.fullName} to Registered Students.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Could not import submission.' });
    }
  };

  const handleRejectSubmission = async (sub: FormSubmission) => {
    try {
      await rejectFormSubmission(sub.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Could not reject submission.' });
    }
  };

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  // Group submissions by referring CA ("kisne form bharwaya")
  const caBreakdownMap = new Map<string, {
    uid: string;
    caId: string;
    name: string;
    college: string;
    count: number;
    isSelf: boolean;
  }>();

  submissions.forEach((sub) => {
    const refUid = sub.referringCaUid || sub.caUid;
    const existing = caBreakdownMap.get(refUid);
    if (existing) {
      existing.count += 1;
    } else {
      caBreakdownMap.set(refUid, {
        uid: refUid,
        caId: sub.referringCaId || sub.caId,
        name: sub.referringCaName || (refUid === ca.uid ? ca.name : sub.caId),
        college: sub.referringCaCollege || sub.college,
        count: 1,
        isSelf: refUid === (sub.formCreatorUid || ca.uid)
      });
    }
  });
  const caBreakdownList = Array.from(caBreakdownMap.values()).sort((a, b) => b.count - a.count);

  const filteredSubmissions = submissions.filter((sub) => {
    const refUid = sub.referringCaUid || sub.caUid;
    const matchesCa = caFilter === 'all' || refUid === caFilter;
    const matchesForm = formFilter === 'all' || sub.formId === formFilter;
    return matchesCa && matchesForm;
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              Main CA Shareable Student Forms
            </h3>
            <p className="text-xs text-gray-500">
              Create custom registration forms, choose exactly what info students fill, and share the public link with anyone (no login required).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateNewForm}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create New Form
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage(null)} className="font-bold ml-3">✕</button>
        </div>
      )}

      {/* Form Editor Panel */}
      {editingForm && (
        <form onSubmit={handleSaveForm} className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">
                Configure Form Fields & Share Settings
              </h4>
              <p className="text-[11px] text-gray-500 font-mono">
                Public Link: {getShareUrl(editingForm.id)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setEditingForm(null)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {isSaving ? 'Saving...' : 'Save & Publish Form'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Form Title *</label>
              <input
                type="text"
                required
                value={editingForm.title}
                onChange={(e) => setEditingForm(prev => (prev ? { ...prev, title: e.target.value } : null))}
                placeholder="e.g. GenAI Study Jam Registration"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center space-x-4 pt-5">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingForm.isActive}
                  onChange={(e) => setEditingForm(prev => (prev ? { ...prev, isActive: e.target.checked } : null))}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span className="font-bold text-gray-800">Accepting Responses (Active)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingForm.autoAddStudent}
                  onChange={(e) => setEditingForm(prev => (prev ? { ...prev, autoAddStudent: e.target.checked } : null))}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span className="font-bold text-gray-800">Auto-Add to Students List</span>
              </label>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-gray-700 mb-1">Instructions / Description for Students</label>
            <textarea
              rows={2}
              value={editingForm.description || ''}
              onChange={(e) => setEditingForm(prev => (prev ? { ...prev, description: e.target.value } : null))}
              placeholder="Explain what this form is for and ensure students double-check their name spelling..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Field Builder List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">
                Form Questions / Information Required ({editingForm.fields.filter(f => f.enabled).length} visible to students)
              </span>
              <span className="text-[11px] text-gray-400">
                Turn off any core field & set a fixed default if you do not want students to type it.
              </span>
            </div>

            <div className="space-y-2">
              {editingForm.fields.map((field, idx) => (
                <div
                  key={field.id}
                  className={`p-3 rounded-xl border text-xs transition ${
                    field.enabled ? 'bg-slate-50 border-slate-200' : 'bg-gray-50 border-dashed border-gray-300 opacity-75'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                        Field Label {field.isCore ? '(Core)' : `(${field.key})`}
                      </label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                        {field.enabled ? 'Input Placeholder' : 'Fixed Default Value (Hidden)'}
                      </label>
                      {field.enabled ? (
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                          placeholder="Hint shown to student"
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                        />
                      ) : (
                        <input
                          type="text"
                          value={field.defaultValue || ''}
                          onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                          placeholder="Auto-filled value"
                          className="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold"
                        />
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Pre-fill / Default</label>
                      <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        value={field.defaultValue || ''}
                        onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                        placeholder="Optional default"
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    </div>

                    <div className="md:col-span-4 flex items-center justify-end space-x-2 pt-3 md:pt-0">
                      <label className="flex items-center space-x-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          disabled={!field.enabled || field.key === 'fullName' || field.key === 'email'}
                          className="rounded text-indigo-600 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-semibold text-gray-700">Required</span>
                      </label>

                      <button
                        type="button"
                        disabled={field.key === 'fullName' || field.key === 'email'}
                        onClick={() => updateField(field.id, { enabled: !field.enabled })}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center disabled:opacity-40 ${
                          field.enabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-200 text-gray-600 border-gray-300'
                        }`}
                        title={field.enabled ? 'Visible on form' : 'Hidden on form (uses default value)'}
                      >
                        {field.enabled ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                        {field.enabled ? 'Ask' : 'Hidden'}
                      </button>

                      <button
                        type="button"
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === editingForm.fields.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {!field.isCore && (
                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove Custom Field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Custom Fields */}
            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-indigo-950 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Add Extra Custom Information Fields (Can also be mapped to Certificate Placeholders)
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_CUSTOM_FORM_FIELD_PRESETS.map(preset => {
                  const alreadyAdded = editingForm.fields.some(
                    f => f.key.toLowerCase() === preset.key.toLowerCase()
                  );
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addCustomField(preset)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[11px] font-semibold text-indigo-900 disabled:opacity-40 transition"
                    >
                      + {preset.label} ({preset.key})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="Custom Field Label (e.g. GitHub Handle)"
                  className="sm:col-span-4 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                />
                <input
                  type="text"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  placeholder="Placeholder key (optional, e.g. github)"
                  className="sm:col-span-3 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono"
                />
                <select
                  value={newFieldType}
                  onChange={(e: any) => setNewFieldType(e.target.value)}
                  className="sm:col-span-2 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                  <option value="textarea">Long Text</option>
                </select>
                <label className="sm:col-span-1 flex items-center justify-center space-x-1 bg-white border border-gray-200 rounded-lg px-2 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Req</span>
                </label>
                <button
                  type="button"
                  onClick={() => addCustomField()}
                  disabled={!newFieldLabel.trim()}
                  className="sm:col-span-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-40"
                >
                  + Add Field
                </button>
              </div>

              {newFieldType === 'select' && (
                <input
                  type="text"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="Dropdown options separated by commas (e.g. Track A, Track B, Track C)"
                  className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs"
                />
              )}
            </div>
          </div>
        </form>
      )}

      {/* Existing Forms List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
        <h4 className="text-sm font-bold text-gray-900">Your Shareable Forms ({forms.length})</h4>

        {forms.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-gray-300 rounded-2xl space-y-2">
            <p className="text-xs text-gray-500">
              No shareable student forms created yet. Click <strong>Create New Form</strong> to generate a public link for students.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forms.map((form) => {
              const formSubs = submissions.filter(s => s.formId === form.id);
              const shareUrl = getShareUrl(form.id);

              return (
                <div key={form.id} className="p-4 rounded-2xl border border-gray-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-bold text-gray-900">{form.title}</h5>
                        <p className="text-[11px] text-gray-500">
                          {form.fields.filter(f => f.enabled).length} questions &bull; {formSubs.length} response(s)
                          {isAdminMode && ` • Owner: ${form.caName}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFormActive(form)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          form.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border-gray-300'
                        }`}
                      >
                        {form.isActive ? 'Open' : 'Closed'}
                      </button>
                    </div>

                    <div className="p-2 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-blue-700 truncate">{shareUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(form.id)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold flex items-center shrink-0"
                      >
                        {copiedFormId === form.id ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3 h-3 mr-1" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-200/70 text-xs">
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold flex items-center text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open Public Form
                    </a>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingForm(form)}
                        className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 flex items-center"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteForm(form)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Delete Form"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Submissions Feed */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-gray-900">
              Student Form Responses &amp; CA Referrals ({submissions.length})
            </h4>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {pendingCount} Pending Import
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {forms.length > 1 && (
              <select
                value={formFilter}
                onChange={(e) => setFormFilter(e.target.value)}
                className="px-2.5 py-1 border border-gray-300 rounded-xl text-[11px] bg-white"
              >
                <option value="all">All Forms</option>
                {forms.map(f => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Referring CA Breakdown Strip ("Kisne Form Bharwaya") */}
        {caBreakdownList.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <span className="text-[11px] font-bold text-gray-700 flex items-center">
              <UserCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Submissions by Campus Ambassador (Click a CA to filter students):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCaFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                  caFilter === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                All CAs ({submissions.length})
              </button>
              {caBreakdownList.map((entry) => (
                <button
                  key={entry.uid}
                  type="button"
                  onClick={() => setCaFilter(caFilter === entry.uid ? 'all' : entry.uid)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition flex items-center space-x-1.5 ${
                    caFilter === entry.uid
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-indigo-50'
                  }`}
                >
                  <span>{entry.name}</span>
                  <span className={`font-mono text-[10px] ${caFilter === entry.uid ? 'text-indigo-100' : 'text-gray-500'}`}>
                    ({entry.caId})
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      caFilter === entry.uid
                        ? 'bg-white/20 text-white'
                        : entry.isSelf
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {entry.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredSubmissions.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            No form responses received yet. Share a form link or let Standard CAs distribute it to their assigned students.
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-2.5 px-3">Student Details</th>
                  <th className="py-2.5 px-3">Referred By (Kisne Bharwaya)</th>
                  <th className="py-2.5 px-3">Form &amp; Event</th>
                  <th className="py-2.5 px-3">Custom Form Info</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubmissions.map((sub) => {
                  const isOwnSubmission = isAdminMode || sub.caUid === ca.uid;
                  const refName = sub.referringCaName || (sub.caUid === ca.uid ? ca.name : sub.caId);
                  const refId = sub.referringCaId || sub.caId;
                  const isFromStandardCa = (sub.referringCaUid || sub.caUid) !== (sub.formCreatorUid || ca.uid);

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/70">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900">{sub.fullName}</div>
                        <div className="text-[11px] font-mono text-gray-500">{sub.email}</div>
                        <div className="text-[10px] text-gray-400">
                          {sub.college} {sub.semester ? `• ${sub.semester}` : ''}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Submitted: {new Date(sub.submittedAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900 flex items-center flex-wrap gap-1">
                          <span>{refName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              isFromStandardCa
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {isFromStandardCa ? 'Standard CA' : 'Direct'}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-gray-500">{refId}</div>
                        {sub.referringCaCollege && (
                          <div className="text-[10px] text-gray-400">{sub.referringCaCollege}</div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-800">{sub.formTitle}</div>
                        <div className="text-[11px] text-blue-600">{sub.initiativeName} ({sub.participationDate})</div>
                      </td>

                      <td className="py-2.5 px-3">
                        {Object.keys(sub.customFields || {}).length === 0 ? (
                          <span className="text-[10px] text-gray-400 italic">Standard fields only</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(sub.customFields || {}).map(([k, v]) => (
                              <span
                                key={k}
                                className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded text-[10px]"
                              >
                                <span className="font-mono font-bold">{k}:</span> {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            sub.status === 'imported'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : sub.status === 'rejected'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {sub.status === 'imported'
                            ? 'Added to Students'
                            : !isOwnSubmission && sub.status === 'pending'
                            ? 'Pending CA Sync'
                            : sub.status}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {sub.status === 'pending' && isOwnSubmission && (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleManualImportSubmission(sub)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold"
                            >
                              Import
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSubmission(sub)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
