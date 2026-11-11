import React, { useState, useEffect } from 'react';
import { CertificateTemplateConfig, Certificate } from '../types';
import { 
  getAllCertificateTemplates, 
  saveCertificateTemplate, 
  setActiveCertificateTemplate, 
  DEFAULT_TEMPLATES,
  populateCertificatePlaceholders
} from '../services/certificateTemplateService';
import { CertificateTemplate } from './CertificateTemplate';
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
  Image, 
  Check, 
  Trash2, 
  Plus, 
  RotateCcw,
  Sliders,
  Layers
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
  const [previewMode, setPreviewMode] = useState<'editor' | 'fullscreen'>('editor');

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
  };

  const handleCreateNewTemplate = () => {
    const newId = `tpl_custom_${Date.now()}`;
    const newConfig: CertificateTemplateConfig = {
      id: newId,
      title: 'New Custom Certificate Template',
      type: 'standard_google',
      heading: 'Certificate of Achievement',
      subheading: 'Google Student Ambassador Program 2026',
      presentationText: 'This certificate is proudly presented to',
      bodyText: 'for active and exemplary participation in "{{initiative_name}}" organized under the Google Student Ambassador Program 2026 at {{college_name}} ({{semester}}).',
      footerNote: 'Official Program Issuance',
      showLogo: true,
      showProgramEmblem: true,
      showBorder: true,
      showQrCode: true,
      showSignature: true,
      signatureTitle: 'Campus Ambassador',
      primaryColor: '#1A73E8',
      fontFamily: 'serif',
      isActive: false,
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
        backgroundUrl: dataUrl
      }));
    } catch (err) {
      console.error('Failed reading certificate background image:', err);
    }
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

  const handleSetActiveNow = async (templateId: string) => {
    await setActiveCertificateTemplate(templateId, adminUid, adminEmail);
    await loadTemplates();
  };

  const insertPlaceholder = (tag: string) => {
    setActiveConfig(prev => ({
      ...prev,
      bodyText: prev.bodyText + ` {{${tag}}}`
    }));
  };

  // Mock certificate instance for real-time preview
  const sampleCertificate: Certificate = {
    certificateId: 'GSAP-2026-CA001-A9F82',
    studentId: 'sample_student_01',
    studentName: 'Alex Rivera',
    initiativeName: 'Google Cloud & AI Innovation Summit 2026',
    semester: 'Semester 6',
    college: 'Stanford University',
    participationDate: '2026-11-10',
    caUid: 'ca_demo_stanford_001',
    caName: 'Priya Sharma',
    caId: 'CA-2026-001',
    signatureUrl: '',
    programName: 'Google Student Ambassador Program 2026',
    status: 'valid',
    verificationUrl: 'https://google-student-ambassador-2026.web.app/verify/GSAP-2026-CA001-A9F82',
    issuedAt: new Date().toISOString()
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Certificate Templates & Placeholder Designer
              </h2>
              <p className="text-xs text-gray-500">
                Super Admin can upload certificate designs, customize dynamic placeholders, and select the active template for all Ambassadors.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleCreateNewTemplate}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition flex items-center shadow-2xs"
          >
            <Plus className="w-4 h-4 mr-1.5 text-gray-600" />
            Create / Upload New
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
          <span>Certificate template saved permanently in database! All Campus Ambassadors will immediately use this design.</span>
        </div>
      )}

      {/* Template Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center space-x-3 overflow-x-auto">
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

      {/* Editor Grid: Controls on Left, Live Certificate Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls & Placeholders (5 columns) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Section 1: Template Info & Active Status */}
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
                  Set as Active Template
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Template Title
              </label>
              <input
                type="text"
                value={activeConfig.title}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Type selector: Google Quad Frame vs Custom Uploaded Background */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Design & Background Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveConfig(prev => ({ ...prev, type: 'standard_google' }))}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    activeConfig.type === 'standard_google'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Google Quad Border</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveConfig(prev => ({ ...prev, type: 'custom_uploaded' }))}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    activeConfig.type === 'custom_uploaded'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Image className="w-4 h-4" />
                  <span>Custom Uploaded Base</span>
                </button>
              </div>
            </div>

            {/* Upload Certificate Image if custom_uploaded selected */}
            {activeConfig.type === 'custom_uploaded' && (
              <div className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-xl space-y-2">
                <span className="text-xs font-bold text-blue-900 block">
                  Upload Certificate Background (PNG/JPG)
                </span>
                <label className="cursor-pointer px-3.5 py-2 bg-white text-blue-700 border border-blue-300 rounded-lg text-xs font-bold hover:bg-blue-50 transition shadow-2xs flex items-center justify-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Select Background Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleBackgroundUpload}
                  />
                </label>
                {activeConfig.backgroundUrl && (
                  <p className="text-[11px] text-emerald-700 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Custom background uploaded and active
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Placeholder & Text Customization */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <span className="text-xs font-bold text-gray-800 flex items-center pb-2 border-b border-gray-100">
              <Type className="w-4 h-4 text-blue-600 mr-1.5" />
              Certificate Typography & Headings
            </span>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Main Certificate Heading
              </label>
              <input
                type="text"
                value={activeConfig.heading}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, heading: e.target.value }))}
                placeholder="e.g. Certificate of Participation"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Subheading / Program Title
              </label>
              <input
                type="text"
                value={activeConfig.subheading}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, subheading: e.target.value }))}
                placeholder="e.g. Google Student Ambassador Program 2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Presentation Text (Before Student Name)
              </label>
              <input
                type="text"
                value={activeConfig.presentationText}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, presentationText: e.target.value }))}
                placeholder="e.g. This certificate is proudly and honorably presented to"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Participation Description (with Dynamic Placeholders)
                </label>
              </div>
              <textarea
                rows={4}
                value={activeConfig.bodyText}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, bodyText: e.target.value }))}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden leading-relaxed"
              />

              {/* Clickable Placeholders Chips */}
              <div className="mt-2 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Click to insert placeholder:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'student_name',
                    'initiative_name',
                    'college_name',
                    'semester',
                    'participation_date',
                    'certificate_id',
                    'ca_name'
                  ].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertPlaceholder(tag)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-[10px] font-mono text-blue-700 border border-slate-200 transition"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Visual Toggles & Elements */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Visual Elements On Certificate:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={activeConfig.showLogo}
                    onChange={(e) => setActiveConfig(prev => ({ ...prev, showLogo: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Google Logo</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={activeConfig.showProgramEmblem}
                    onChange={(e) => setActiveConfig(prev => ({ ...prev, showProgramEmblem: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>2026 Program Emblem</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={activeConfig.showQrCode}
                    onChange={(e) => setActiveConfig(prev => ({ ...prev, showQrCode: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Verification QR Code</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={activeConfig.showSignature}
                    onChange={(e) => setActiveConfig(prev => ({ ...prev, showSignature: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span>Ambassador Signature</span>
                </label>
              </div>
            </div>

            {/* Custom Signature Title */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Authorized Signer Title
              </label>
              <input
                type="text"
                value={activeConfig.signatureTitle}
                onChange={(e) => setActiveConfig(prev => ({ ...prev, signatureTitle: e.target.value }))}
                placeholder="e.g. Campus Ambassador"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Live Real-Time Certificate Preview (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center">
              <Eye className="w-4 h-4 text-emerald-600 mr-1.5" />
              Live Real-Time Certificate Preview (A4 Aspect Ratio)
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              Dynamic placeholders mapped to sample student
            </span>
          </div>

          {/* Render Customized Visual Certificate */}
          <div 
            className="w-full bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200 transition-all aspect-[1.414/1] flex flex-col justify-between p-6 sm:p-10 select-none"
            style={{
              backgroundImage: activeConfig.type === 'custom_uploaded' && activeConfig.backgroundUrl ? `url(${activeConfig.backgroundUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), 0 0 1px 1px rgba(0,0,0,0.04)'
            }}
          >
            {/* Border: standard Google quad border if enabled */}
            {activeConfig.showBorder && activeConfig.type === 'standard_google' && (
              <div className="absolute inset-2 sm:inset-3 rounded-xl pointer-events-none p-[3px] bg-gradient-to-tr from-[#34A853] via-[#FBBC05] via-[#EA4335] to-[#4285F4]">
                <div className="w-full h-full bg-white/95 rounded-[10px] relative">
                  <div className="absolute inset-1.5 border border-slate-200 rounded-lg" />
                </div>
              </div>
            )}

            {/* Certificate Content Overlays */}
            <div className="relative z-10 flex flex-col justify-between h-full">
              
              {/* Header Top */}
              <div className="flex items-start justify-between">
                {activeConfig.showLogo ? (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1">
                      <span className="text-2xl sm:text-3xl font-bold text-[#4285F4]">G</span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#EA4335]">o</span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#FBBC05]">o</span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#4285F4]">g</span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#34A853]">l</span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#EA4335]">e</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-semibold tracking-wider text-gray-500 uppercase mt-0.5">
                      Student Ambassador Program
                    </p>
                  </div>
                ) : <div />}

                {activeConfig.showProgramEmblem && (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-blue-500 bg-blue-50/70 flex flex-col items-center justify-center text-center p-1 shadow-inner">
                    <span className="text-[10px] font-bold text-blue-700 tracking-tight leading-none">2026</span>
                    <span className="text-[7px] font-bold uppercase tracking-widest text-gray-600 mt-0.5">OFFICIAL</span>
                    <span className="text-[6px] font-medium text-gray-500 uppercase">PROGRAM</span>
                  </div>
                )}
              </div>

              {/* Center Body */}
              <div className="text-center my-3 space-y-1.5 sm:space-y-2">
                <p className="text-[9px] sm:text-[11px] font-bold tracking-[0.2em] text-blue-600 uppercase">
                  {activeConfig.subheading}
                </p>

                <h1 className="text-2xl sm:text-4xl font-serif font-bold text-gray-900 tracking-tight">
                  {activeConfig.heading}
                </h1>

                <p className="text-xs sm:text-sm italic text-gray-500 font-sans">
                  {activeConfig.presentationText}
                </p>

                {/* Recipient Student Name */}
                <div className="py-1">
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-blue-700 tracking-tight">
                    Alex Rivera
                  </h2>
                  <div className="w-28 sm:w-36 h-0.5 bg-yellow-400 mx-auto mt-1 rounded-full" />
                </div>

                {/* Body Text with populated placeholders */}
                <p className="text-[11px] sm:text-xs text-gray-700 max-w-lg mx-auto leading-relaxed">
                  {populateCertificatePlaceholders(activeConfig.bodyText, {
                    student_name: 'Alex Rivera',
                    initiative_name: 'Google Cloud & AI Innovation Summit 2026',
                    college_name: 'Stanford University',
                    semester: 'Semester 6',
                    participation_date: '2026-11-10',
                    certificate_id: 'GSAP-2026-CA001-A9F82',
                    ca_name: 'Priya Sharma'
                  })}
                </p>
              </div>

              {/* Bottom Footer Section */}
              <div className="grid grid-cols-3 items-end pt-3 border-t border-gray-100">
                {/* Left Date */}
                <div className="text-left space-y-0.5">
                  <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-gray-400 block">
                    Participation Date
                  </span>
                  <p className="text-xs font-semibold text-gray-800">
                    2026-11-10
                  </p>
                  <div className="w-20 sm:w-24 h-[1px] bg-gray-300" />
                  <p className="text-[8px] text-gray-500">
                    {activeConfig.footerNote || 'Official Program Issuance'}
                  </p>
                </div>

                {/* Center QR & ID */}
                <div className="flex flex-col items-center text-center">
                  {activeConfig.showQrCode ? (
                    <>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 border border-slate-300 rounded p-1 flex items-center justify-center">
                        <div className="w-full h-full bg-slate-800 rounded-xs flex items-center justify-center text-[7px] text-white font-mono font-bold">
                          QR VERIFY
                        </div>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-mono font-bold text-blue-600 mt-1">
                        GSAP-2026-CA001-A9F82
                      </span>
                    </>
                  ) : null}
                </div>

                {/* Right Signature */}
                <div className="text-right flex flex-col items-end space-y-0.5">
                  {activeConfig.showSignature ? (
                    <>
                      <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-gray-400 block">
                        Authorized Signature
                      </span>
                      <div className="h-8 flex items-center justify-end">
                        <span className="text-xs font-serif italic text-gray-700">
                          Priya Sharma
                        </span>
                      </div>
                      <div className="w-24 sm:w-28 h-[1px] bg-gray-300" />
                      <p className="text-xs font-bold text-gray-800">
                        Priya Sharma
                      </p>
                      <p className="text-[8px] text-blue-600 font-semibold">
                        {activeConfig.signatureTitle} (CA-2026-001)
                      </p>
                    </>
                  ) : null}
                </div>

              </div>

            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Tip: All changes saved here automatically synchronize across the entire platform and Cloud Firestore.
          </p>
        </div>

      </div>

    </div>
  );
};
