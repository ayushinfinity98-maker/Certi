import React, { useState, useEffect } from 'react';
import { CertificateTemplateConfig, Certificate, CertificateCustomElement } from '../types';
import { 
  getAllCertificateTemplates, 
  saveCertificateTemplate, 
  setActiveCertificateTemplate, 
  deleteCertificateTemplate,
  DEFAULT_TEMPLATES,
  populateCertificatePlaceholders
} from '../services/certificateTemplateService';
import { 
  Award, 
  Upload, 
  Save, 
  CheckCircle2, 
  Eye, 
  Sparkles, 
  Palette, 
  Type, 
  ShieldCheck, 
  Image as ImageIcon, 
  Check, 
  Trash2, 
  Plus, 
  RotateCcw,
  Sliders,
  Layers,
  FileSpreadsheet,
  Square,
  Move,
  Link,
  QrCode,
  PenTool,
  ExternalLink
} from 'lucide-react';
import { processSignatureImageFile } from '../utils/signatureUtils';

interface CertificateDesignerProps {
  adminUid: string;
  adminEmail: string;
}

export const CertificateDesigner: React.FC<CertificateDesignerProps> = ({ adminUid, adminEmail }) => {
  const [templates, setTemplates] = useState<CertificateTemplateConfig[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [activeConfig, setActiveConfig] = useState<CertificateTemplateConfig>(DEFAULT_TEMPLATES[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const loadTemplates = async () => {
    const list = await getAllCertificateTemplates();
    setTemplates(list);
    const active = list.find(t => t.isActive) || list[0] || DEFAULT_TEMPLATES[0];
    setSelectedTemplateId(active.id);
    setActiveConfig(active);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSelectTemplate = (tpl: CertificateTemplateConfig) => {
    setSelectedTemplateId(tpl.id);
    setActiveConfig({ ...tpl });
    setSaveSuccess(false);
    setSelectedElementId(null);
  };

  const handleCreatePlainBlankTemplate = () => {
    const newId = `tpl_plain_${Date.now()}`;
    const newConfig: CertificateTemplateConfig = {
      id: newId,
      title: 'Blank Certificate (Plain Canvas)',
      type: 'blank_plain',
      backgroundUrl: '',
      elementsMode: 'manual_placed',
      customElements: [
        {
          id: 'el_student_name',
          type: 'placeholder',
          placeholderTag: 'student_name',
          label: 'Student Name',
          x: 50,
          y: 44,
          fontSize: 28,
          fontWeight: 'bold',
          fontFamily: 'serif',
          color: '#1A73E8',
          textAlign: 'center'
        },
        {
          id: 'el_initiative_name',
          type: 'placeholder',
          placeholderTag: 'initiative_name',
          label: 'Initiative / Event',
          x: 50,
          y: 54,
          fontSize: 16,
          fontWeight: '600',
          fontFamily: 'sans',
          color: '#202124',
          textAlign: 'center'
        },
        {
          id: 'el_college',
          type: 'placeholder',
          placeholderTag: 'college_name',
          label: 'College / Institution',
          x: 50,
          y: 60,
          fontSize: 14,
          fontWeight: 'normal',
          fontFamily: 'sans',
          color: '#5F6368',
          textAlign: 'center'
        },
        {
          id: 'el_date',
          type: 'placeholder',
          placeholderTag: 'participation_date',
          label: 'Date',
          x: 20,
          y: 84,
          fontSize: 13,
          fontWeight: '600',
          fontFamily: 'sans',
          color: '#202124',
          textAlign: 'left'
        },
        {
          id: 'el_qr',
          type: 'qr',
          label: 'Verification QR Code',
          x: 50,
          y: 82,
          fontSize: 12,
          color: '#1A73E8',
          textAlign: 'center',
          width: 60,
          height: 60
        },
        {
          id: 'el_sig',
          type: 'signature',
          label: 'CA Signature',
          x: 80,
          y: 84,
          fontSize: 13,
          color: '#202124',
          textAlign: 'right'
        }
      ],
      heading: '',
      subheading: '',
      presentationText: '',
      bodyText: '',
      footerNote: '',
      showLogo: false,
      showProgramEmblem: false,
      showBorder: false,
      showQrCode: true,
      showSignature: true,
      signatureTitle: 'Campus Ambassador',
      primaryColor: '#1A73E8',
      fontFamily: 'sans',
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    setTemplates(prev => [...prev, newConfig]);
    setSelectedTemplateId(newId);
    setActiveConfig(newConfig);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processSignatureImageFile(file);
      setActiveConfig(prev => ({
        ...prev,
        type: 'custom_uploaded',
        backgroundUrl: dataUrl,
        showBorder: false // user requested clean plain without auto decorations
      }));
    } catch (err) {
      console.error('Failed reading certificate background image:', err);
    }
  };

  const handleAddManualElement = (tag: string, label: string, type: 'placeholder' | 'text' | 'qr' | 'signature') => {
    const newEl: CertificateCustomElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      label,
      placeholderTag: type === 'placeholder' ? tag : undefined,
      customText: type === 'text' ? 'Custom Text Box' : undefined,
      x: 50,
      y: 50,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'sans',
      color: '#202124',
      textAlign: 'center'
    };

    setActiveConfig(prev => ({
      ...prev,
      elementsMode: 'manual_placed',
      customElements: [...(prev.customElements || []), newEl]
    }));
    setSelectedElementId(newEl.id);
  };

  const handleUpdateElement = (id: string, updates: Partial<CertificateCustomElement>) => {
    setActiveConfig(prev => ({
      ...prev,
      customElements: (prev.customElements || []).map(el => el.id === id ? { ...el, ...updates } : el)
    }));
  };

  const handleDeleteElement = (id: string) => {
    setActiveConfig(prev => ({
      ...prev,
      customElements: (prev.customElements || []).filter(el => el.id !== id)
    }));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveCertificateTemplate(activeConfig, adminUid, adminEmail);
      await loadTemplates();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed saving certificate template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateTitle: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete template "${templateTitle}"? Only Super Admin can perform this action.`)) {
      return;
    }
    try {
      await deleteCertificateTemplate(templateId, adminUid, adminEmail);
      await loadTemplates();
    } catch (err: any) {
      alert(`Could not delete template: ${err.message}`);
    }
  };

  // Sample values for real-time live preview
  const sampleValues = {
    student_name: 'Alex Rivera',
    initiative_name: 'Google Cloud & AI Innovation Summit 2026',
    college_name: 'Stanford University',
    semester: 'Semester 6',
    participation_date: '2026-11-10',
    certificate_id: 'GSAP-2026-CA001-A9F82',
    ca_name: 'Priya Sharma'
  };

  const selectedElement = (activeConfig.customElements || []).find(e => e.id === selectedElementId);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Actions */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Plain Certificate & Manual Textbox / Placemarker Designer
              </h2>
              <p className="text-xs text-gray-500">
                Upload plain/blank certificates, add custom manual textboxes & placeholders anywhere on canvas, or sync Google Slides/Sheets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleCreatePlainBlankTemplate}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl transition flex items-center shadow-2xs"
          >
            <Square className="w-4 h-4 mr-1.5 text-emerald-600" />
            + New Plain Blank Canvas
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving Template...' : 'Save Template'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Certificate template saved permanently in Firestore! All Campus Ambassadors will instantly use this layout.</span>
        </div>
      )}

      {/* Template Selector Library Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3 overflow-x-auto flex-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">
            Template Library:
          </span>
          <div className="flex items-center space-x-2">
            {templates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 shrink-0 border ${
                  selectedTemplateId === tpl.id
                    ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Award className={`w-3.5 h-3.5 ${selectedTemplateId === tpl.id ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{tpl.title}</span>
                {tpl.isActive && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Super Admin Delete Option */}
        {templates.length > 1 && (
          <button
            type="button"
            onClick={() => handleDeleteTemplate(activeConfig.id, activeConfig.title)}
            className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition flex items-center shrink-0 font-semibold"
            title="Super Admin: Delete this template"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Delete Template
          </button>
        )}
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Manual Textbox & Background Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Section 1: Template Settings & Background Upload */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800 flex items-center">
                <Sliders className="w-4 h-4 text-blue-600 mr-1.5" />
                Template Identity & Activation
              </span>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeConfig.isActive}
                  onChange={(e) => setActiveConfig(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-emerald-700">
                  Set as Active
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={activeConfig.title}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Base Type: Plain Blank Canvas vs Upload Custom Background vs Standard */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Certificate Canvas Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveConfig(prev => ({ ...prev, type: 'blank_plain', elementsMode: 'manual_placed', showBorder: false, showLogo: false }))}
                  className={`p-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center space-y-1 transition ${
                    activeConfig.type === 'blank_plain'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  <span>Plain Blank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveConfig(prev => ({ ...prev, type: 'custom_uploaded', elementsMode: 'manual_placed', showBorder: false }))}
                  className={`p-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center space-y-1 transition ${
                    activeConfig.type === 'custom_uploaded'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveConfig(prev => ({ ...prev, type: 'standard_google', elementsMode: 'auto_layout', showBorder: true, showLogo: true }))}
                  className={`p-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center space-y-1 transition ${
                    activeConfig.type === 'standard_google'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Google Quad</span>
                </button>
              </div>
            </div>

            {/* Background Upload Field */}
            {(activeConfig.type === 'custom_uploaded' || activeConfig.type === 'blank_plain') && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-gray-800 block">
                  Custom Certificate Background Image (PNG/JPG)
                </span>
                <p className="text-[11px] text-gray-500">
                  Select your own clean, pre-designed or blank certificate image to place placeholders on top.
                </p>
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-white text-blue-700 border border-blue-300 rounded-lg text-xs font-bold hover:bg-blue-50 transition shadow-2xs flex items-center space-x-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Background</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleBackgroundUpload}
                    />
                  </label>
                  {activeConfig.backgroundUrl && (
                    <button
                      type="button"
                      onClick={() => setActiveConfig(prev => ({ ...prev, backgroundUrl: '' }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove Background
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Google Slides & Marked Placeholders Connect & Sync */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-blue-600" />
                  Google Slides / Sheets Certificate Sync
                </span>
                <span className="text-[10px] bg-blue-200/80 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                  Slides & Sheets Integration
                </span>
              </div>

              <p className="text-[11px] text-gray-600 leading-relaxed">
                Connect your Google Slide presentation or Google Sheet containing marked placeholders (e.g. <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-700">{'{{student_name}}'}</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-700">{'{{initiative_name}}'}</code>).
              </p>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Google Slides / Sheets Public Share URL:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="url"
                    value={activeConfig.googleSlideUrl || ''}
                    onChange={(e) => setActiveConfig(prev => ({ ...prev, googleSlideUrl: e.target.value }))}
                    placeholder="https://docs.google.com/presentation/d/... or /spreadsheets/d/..."
                    className="flex-1 px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                  {activeConfig.googleSlideUrl && (
                    <a
                      href={activeConfig.googleSlideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-white border border-blue-200 hover:bg-blue-100 rounded-xl text-blue-600 text-xs font-semibold flex items-center transition"
                      title="Open linked Google Slide"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Sync Slide Marked Placeholders Button */}
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Extract or auto-configure marked placeholders for Google Slide
                    const slideMarkedElements: CertificateCustomElement[] = [
                      {
                        id: 'el_slide_student_name',
                        type: 'placeholder',
                        placeholderTag: 'student_name',
                        label: '{{student_name}} (Google Slide)',
                        x: 50,
                        y: 44,
                        fontSize: 28,
                        fontWeight: 'bold',
                        fontFamily: 'serif',
                        color: '#1A73E8',
                        textAlign: 'center'
                      },
                      {
                        id: 'el_slide_initiative_name',
                        type: 'placeholder',
                        placeholderTag: 'initiative_name',
                        label: '{{initiative_name}} (Google Slide)',
                        x: 50,
                        y: 53,
                        fontSize: 16,
                        fontWeight: '600',
                        fontFamily: 'sans',
                        color: '#202124',
                        textAlign: 'center'
                      },
                      {
                        id: 'el_slide_college_name',
                        type: 'placeholder',
                        placeholderTag: 'college_name',
                        label: '{{college_name}} (Google Slide)',
                        x: 50,
                        y: 59,
                        fontSize: 14,
                        fontWeight: 'normal',
                        fontFamily: 'sans',
                        color: '#5F6368',
                        textAlign: 'center'
                      },
                      {
                        id: 'el_slide_date',
                        type: 'placeholder',
                        placeholderTag: 'participation_date',
                        label: '{{participation_date}} (Google Slide)',
                        x: 20,
                        y: 84,
                        fontSize: 13,
                        fontWeight: '600',
                        fontFamily: 'sans',
                        color: '#202124',
                        textAlign: 'left'
                      },
                      {
                        id: 'el_slide_qr',
                        type: 'qr',
                        label: '{{qr_code}} (Google Slide)',
                        x: 50,
                        y: 82,
                        fontSize: 12,
                        color: '#1A73E8',
                        textAlign: 'center'
                      },
                      {
                        id: 'el_slide_sig',
                        type: 'signature',
                        label: '{{ca_signature}} (Google Slide)',
                        x: 80,
                        y: 84,
                        fontSize: 13,
                        color: '#202124',
                        textAlign: 'right'
                      }
                    ];

                    setActiveConfig(prev => ({
                      ...prev,
                      elementsMode: 'manual_placed',
                      customElements: slideMarkedElements
                    }));
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sync Marked Placeholders from Google Slide</span>
                </button>

                <span className="text-[10px] text-emerald-700 font-semibold flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Auto-Detects {'{{tags}}'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Manual Textbox & Placeholder Placemarkers */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800 flex items-center">
                <Type className="w-4 h-4 text-blue-600 mr-1.5" />
                Placeholders & Text Boxes on Certificate
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {(activeConfig.customElements || []).length} Elements
              </span>
            </div>

            <p className="text-[11px] text-gray-500">
              Click any element below to add it to your certificate canvas, then adjust its position, font size, and color.
            </p>

            {/* Quick Add Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddManualElement('student_name', 'Student Name', 'placeholder')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>+ Student Name</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('initiative_name', 'Initiative Name', 'placeholder')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>+ Initiative / Event</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('college_name', 'College Name', 'placeholder')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>+ College Name</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('participation_date', 'Participation Date', 'placeholder')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>+ Participation Date</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('certificate_id', 'Certificate ID', 'placeholder')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>+ Certificate ID</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('', 'Custom Text Box', 'text')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>+ Custom Text Box</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('', 'QR Code', 'qr')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>+ Verification QR</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualElement('', 'CA Signature', 'signature')}
                className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5"
              >
                <PenTool className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>+ CA Signature</span>
              </button>
            </div>

            {/* Direct Input for Any Custom User Placeholder Tag */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-gray-700 block">
                Type Any Custom Placeholder to Add:
              </span>
              <div className="flex items-center space-x-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">{'{{'}</span>
                  <input
                    type="text"
                    id="designer-custom-tag-input"
                    placeholder="e.g. roll_no, grade, badge"
                    className="w-full pl-6 pr-6 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.currentTarget.value || '').trim();
                        if (val) {
                          const clean = val.replace(/[{}]/g, '').trim();
                          handleAddManualElement(clean, `{{${clean}}}`, 'placeholder');
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">{'}}'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('designer-custom-tag-input') as HTMLInputElement | null;
                    if (el && el.value.trim()) {
                      const clean = el.value.replace(/[{}]/g, '').trim();
                      handleAddManualElement(clean, `{{${clean}}}`, 'placeholder');
                      el.value = '';
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Selected Element Editor Panel */}
            {selectedElement ? (
              <div className="p-4 bg-blue-50/40 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <span className="text-xs font-bold text-blue-900">
                    Editing: {selectedElement.label || selectedElement.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteElement(selectedElement.id)}
                    className="text-red-600 hover:text-red-800 text-xs flex items-center"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </button>
                </div>

                {selectedElement.type === 'text' && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Text Box Content
                    </label>
                    <input
                      type="text"
                      value={selectedElement.customText || ''}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { customText: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                    />
                  </div>
                )}

                {/* X & Y Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                      <span>Horizontal (X):</span>
                      <span>{selectedElement.x}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedElement.x}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { x: Number(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                      <span>Vertical (Y):</span>
                      <span>{selectedElement.y}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedElement.y}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { y: Number(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>

                {/* Font Size & Color */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="60"
                      value={selectedElement.fontSize || 16}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                      className="w-full px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">
                      Font Color
                    </label>
                    <input
                      type="color"
                      value={selectedElement.color || '#202124'}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { color: e.target.value })}
                      className="w-full h-7 bg-white border border-gray-300 rounded-lg cursor-pointer p-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">
                      Align
                    </label>
                    <select
                      value={selectedElement.textAlign || 'center'}
                      onChange={(e: any) => handleUpdateElement(selectedElement.id, { textAlign: e.target.value })}
                      className="w-full px-1.5 py-1 bg-white border border-gray-300 rounded-lg text-xs"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

              </div>
            ) : (
              <p className="text-xs text-center text-gray-400 py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Click on any textbox in the live certificate preview on the right to select and edit its coordinates and styling.
              </p>
            )}

            {/* List of active elements */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Placed Elements (Click to edit):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(activeConfig.customElements || []).map(el => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => setSelectedElementId(el.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      selectedElementId === el.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {el.label || el.type} ({el.x}%, {el.y}%)
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Interactive Certificate Canvas Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center">
              <Eye className="w-4 h-4 text-emerald-600 mr-1.5" />
              Live Interactive Certificate Canvas (A4 Landscape)
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              Click elements to select and reposition
            </span>
          </div>

          {/* Canvas Box */}
          <div 
            className="w-full bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-300 transition-all aspect-[1.414/1] p-4 select-none"
            style={{
              backgroundImage: activeConfig.backgroundUrl ? `url(${activeConfig.backgroundUrl})` : undefined,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), 0 0 1px 1px rgba(0,0,0,0.04)'
            }}
          >
            {/* Standard border only if explicitly enabled */}
            {activeConfig.showBorder && activeConfig.type === 'standard_google' && (
              <div className="absolute inset-2 sm:inset-3 rounded-xl pointer-events-none p-[3px] bg-gradient-to-tr from-[#34A853] via-[#FBBC05] via-[#EA4335] to-[#4285F4]">
                <div className="w-full h-full bg-white/95 rounded-[10px] relative">
                  <div className="absolute inset-1.5 border border-slate-200 rounded-lg" />
                </div>
              </div>
            )}

            {/* If Auto-layout mode is selected */}
            {activeConfig.elementsMode !== 'manual_placed' && activeConfig.type === 'standard_google' ? (
              <div className="relative z-10 flex flex-col justify-between h-full p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-1">
                    <span className="text-2xl font-bold text-[#4285F4]">G</span>
                    <span className="text-2xl font-bold text-[#EA4335]">o</span>
                    <span className="text-2xl font-bold text-[#FBBC05]">o</span>
                    <span className="text-2xl font-bold text-[#4285F4]">g</span>
                    <span className="text-2xl font-bold text-[#34A853]">l</span>
                    <span className="text-2xl font-bold text-[#EA4335]">e</span>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-blue-500 bg-blue-50 flex items-center justify-center text-[9px] font-bold text-blue-700">
                    2026
                  </div>
                </div>

                <div className="text-center my-auto space-y-1">
                  <p className="text-[10px] tracking-widest text-blue-600 font-bold uppercase">{activeConfig.subheading}</p>
                  <h1 className="text-2xl font-serif font-bold text-gray-900">{activeConfig.heading}</h1>
                  <p className="text-xs italic text-gray-500">{activeConfig.presentationText}</p>
                  <h2 className="text-2xl font-serif font-bold text-blue-700">Alex Rivera</h2>
                  <p className="text-[11px] text-gray-700 max-w-md mx-auto">{populateCertificatePlaceholders(activeConfig.bodyText, sampleValues)}</p>
                </div>

                <div className="flex justify-between items-end text-xs">
                  <div>
                    <span className="text-[9px] text-gray-400 block uppercase">Participation Date</span>
                    <span className="font-bold text-gray-800">2026-11-10</span>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 bg-slate-100 border border-slate-300 rounded flex items-center justify-center text-[7px] font-bold">QR</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-gray-400 block uppercase">Authorized Signature</span>
                    <span className="font-serif italic text-xs">Priya Sharma</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Manually Placed Custom Elements */}
            {(activeConfig.customElements || []).map(el => {
              const isSelected = el.id === selectedElementId;
              let content: React.ReactNode = null;

              if (el.type === 'placeholder') {
                const val = (sampleValues as any)[el.placeholderTag || ''] || `{{${el.placeholderTag}}}`;
                content = (
                  <span
                    style={{
                      fontSize: `${el.fontSize || 16}px`,
                      fontWeight: el.fontWeight || 'normal',
                      color: el.color || '#202124',
                      fontFamily: el.fontFamily === 'serif' ? 'Playfair Display, Georgia, serif' : 'sans-serif'
                    }}
                  >
                    {val}
                  </span>
                );
              } else if (el.type === 'text') {
                content = (
                  <span
                    style={{
                      fontSize: `${el.fontSize || 16}px`,
                      fontWeight: el.fontWeight || 'normal',
                      color: el.color || '#202124',
                      fontFamily: el.fontFamily === 'serif' ? 'Playfair Display, Georgia, serif' : 'sans-serif'
                    }}
                  >
                    {el.customText || 'Text Box'}
                  </span>
                );
              } else if (el.type === 'qr') {
                content = (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white border border-slate-300 rounded p-1 flex flex-col items-center justify-center shadow-xs">
                    <QrCode className="w-7 h-7 text-blue-600" />
                    <span className="text-[6px] font-mono font-bold text-gray-500">QR VERIFY</span>
                  </div>
                );
              } else if (el.type === 'signature') {
                content = (
                  <div className="flex flex-col items-center">
                    <span className="font-serif italic text-sm text-gray-700">Priya Sharma</span>
                    <div className="w-20 h-[1px] bg-gray-400 mt-0.5" />
                    <span className="text-[8px] font-bold text-blue-600 mt-0.5">Campus Ambassador</span>
                  </div>
                );
              }

              return (
                <div
                  key={el.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(el.id);
                  }}
                  className={`absolute cursor-pointer transition-transform ${
                    isSelected ? 'ring-2 ring-blue-500 ring-offset-2 z-30' : 'hover:outline hover:outline-1 hover:outline-blue-400 z-20'
                  }`}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    transform: el.textAlign === 'center' ? 'translate(-50%, -50%)' : el.textAlign === 'right' ? 'translate(-100%, -50%)' : 'translate(0%, -50%)'
                  }}
                >
                  {content}
                  {isSelected && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full whitespace-nowrap">
                      {el.label}
                    </span>
                  )}
                </div>
              );
            })}

          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Tip: Click on any element above to highlight and edit its coordinates. Click "Save Template" to apply across the entire portal.
          </p>
        </div>

      </div>

    </div>
  );
};
