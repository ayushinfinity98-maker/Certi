import React, { useState, useEffect } from 'react';
import { 
  Type, 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Save, 
  Sliders, 
  Eye, 
  RotateCcw, 
  ExternalLink,
  FileSpreadsheet,
  QrCode,
  PenTool,
  Move
} from 'lucide-react';
import { CertificateCustomElement, CertificateTemplateConfig } from '../types';
import {
  getActiveCertificateTemplate,
  saveCertificateTemplate,
  populateCertificatePlaceholders,
  resolvePlaceholderValue,
  isSignaturePlaceholderTag,
  isQrPlaceholderTag,
  normalizePlaceholderTag,
  STANDARD_SLIDE_PLACEHOLDER_PRESETS
} from '../services/certificateTemplateService';

interface PlaceholdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  actorUid: string;
  actorEmail: string;
  onSaved?: () => void;
}

export const PlaceholdersModal: React.FC<PlaceholdersModalProps> = ({
  isOpen,
  onClose,
  actorUid,
  actorEmail,
  onSaved
}) => {
  const [template, setTemplate] = useState<CertificateTemplateConfig | null>(null);
  const [elements, setElements] = useState<CertificateCustomElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getActiveCertificateTemplate().then(tpl => {
        setTemplate(tpl);
        setElements(tpl.customElements || []);
        if (tpl.customElements && tpl.customElements.length > 0) {
          setSelectedId(tpl.customElements[0].id);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen || !template) return null;

  const handleAddPlaceholder = (tag: string, label: string, type: 'placeholder' | 'text' | 'qr' | 'signature') => {
    const norm = normalizePlaceholderTag(tag);
    const preset = STANDARD_SLIDE_PLACEHOLDER_PRESETS.find(p => {
      const pNorm = normalizePlaceholderTag(p.tag);
      if (pNorm === norm) return true;
      if (pNorm === 'name' && norm === 'student_name') return true;
      if (pNorm === 'event' && norm === 'initiative_name') return true;
      if (pNorm === 'university' && norm === 'college_name') return true;
      if (pNorm === 'date' && norm === 'participation_date') return true;
      return false;
    });

    const newEl: CertificateCustomElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      label,
      placeholderTag: type === 'placeholder' ? tag : undefined,
      customText: type === 'text' ? 'Custom Text' : undefined,
      x: preset ? preset.x : 50,
      y: preset ? preset.y : 50,
      fontSize: preset ? preset.fontSize : 16,
      fontWeight: preset ? preset.fontWeight : '600',
      fontFamily: preset ? preset.fontFamily : 'sans',
      color: preset ? preset.color : '#202124',
      textAlign: 'center'
    };

    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const handleAddAllStandardPlaceholders = () => {
    const existingNorms = new Set(
      elements
        .filter(e => e.type === 'placeholder' && e.placeholderTag)
        .map(e => normalizePlaceholderTag(e.placeholderTag))
    );

    const toAdd: CertificateCustomElement[] = [];
    STANDARD_SLIDE_PLACEHOLDER_PRESETS.forEach((preset, idx) => {
      const pNorm = normalizePlaceholderTag(preset.tag);
      const aliasPresent =
        existingNorms.has(pNorm) ||
        (pNorm === 'name' && existingNorms.has('student_name')) ||
        (pNorm === 'event' && existingNorms.has('initiative_name')) ||
        (pNorm === 'university' && existingNorms.has('college_name')) ||
        (pNorm === 'date' && existingNorms.has('participation_date'));

      if (!aliasPresent) {
        toAdd.push({
          id: `el_std_${Date.now()}_${idx}`,
          type: 'placeholder',
          label: preset.label,
          placeholderTag: preset.tag,
          x: preset.x,
          y: preset.y,
          fontSize: preset.fontSize,
          fontWeight: preset.fontWeight,
          fontFamily: preset.fontFamily,
          color: preset.color,
          textAlign: 'center'
        });
      }
    });

    if (toAdd.length === 0) return;
    setElements(prev => [...prev, ...toAdd]);
    setSelectedId(toAdd[0].id);
  };

  const handleUpdateElement = (id: string, updates: Partial<CertificateCustomElement>) => {
    setElements(prev => prev.map(el => (el.id === id ? { ...el, ...updates } : el)));
  };

  const handleDeleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      const updatedTemplate: CertificateTemplateConfig = {
        ...template,
        elementsMode: 'manual_placed',
        customElements: elements
      };
      await saveCertificateTemplate(updatedTemplate, actorUid, actorEmail);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        if (onSaved) onSaved();
      }, 1500);
    } catch (err) {
      console.error('Failed saving certificate placeholders:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedElement = elements.find(e => e.id === selectedId);

  // Sample values for live visualization
  const sampleValues = {
    student_name: 'Alex Rivera',
    initiative_name: 'Google Cloud & AI Innovation Summit 2026',
    college_name: 'Stanford University',
    semester: 'Semester 6',
    participation_date: '2026-11-10',
    certificate_id: 'GSAP-2026-CA001-A9F82',
    ca_name: 'Priya Sharma'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-gray-100 flex flex-col space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                Add & Position Certificate Placeholders
              </h3>
              <p className="text-xs text-gray-500">
                Active Certificate Template: <span className="font-semibold text-blue-700">{template.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Placeholders updated and saved permanently to the active certificate!</span>
          </div>
        )}

        {/* Modal Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Quick Add Placeholders */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <span className="text-xs font-bold text-gray-800 block">
                Click to Add Placeholders on Certificate:
              </span>

              <button
                type="button"
                onClick={handleAddAllStandardPlaceholders}
                className="w-full py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-[11px] font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Add All 6 Slide Placeholders</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('name', '{{name}}', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{'{{name}}'} (Student)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('event', '{{event}}', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{'{{event}}'} (Event)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('university', '{{university}}', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{'{{university}}'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('sign', '{{sign}}', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <PenTool className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{'{{sign}}'} (Signature)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('date', '{{date}}', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{'{{date}}'} (Date)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('CA Name', '{{CA Name}}', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{'{{CA Name}}'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('certificate_id', 'Certificate ID', 'placeholder')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Certificate ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('', 'Custom Text', 'text')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Custom Text Box</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('', 'QR Code', 'qr')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <QrCode className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPlaceholder('', 'CA Signature Block', 'signature')}
                  className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold text-left transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <PenTool className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Signature Block</span>
                </button>

              </div>

              {/* Add Custom User-Defined Placeholder Tag */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-gray-700 block mb-1">
                  Type Custom Placeholder Tag:
                </span>
                <div className="flex items-center space-x-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">{'{{'}</span>
                    <input
                      type="text"
                      id="custom-placeholder-input"
                      placeholder="e.g. rank, project_url, roll_no"
                      className="w-full pl-6 pr-6 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.currentTarget.value || '').trim();
                          if (val) {
                            const clean = val.replace(/[{}]/g, '').trim();
                            handleAddPlaceholder(clean, `{{${clean}}}`, 'placeholder');
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
                      const input = document.getElementById('custom-placeholder-input') as HTMLInputElement | null;
                      if (input && input.value.trim()) {
                        const clean = input.value.replace(/[{}]/g, '').trim();
                        handleAddPlaceholder(clean, `{{${clean}}}`, 'placeholder');
                        input.value = '';
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Element Editor */}
            {selectedElement ? (
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <span className="text-xs font-bold text-blue-900">
                    Editing: {selectedElement.label || selectedElement.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteElement(selectedElement.id)}
                    className="text-red-600 hover:text-red-800 text-xs flex items-center font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </button>
                </div>

                {selectedElement.type === 'text' && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Text Box Content:
                    </label>
                    <input
                      type="text"
                      value={selectedElement.customText || ''}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { customText: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs"
                    />
                  </div>
                )}

                {/* X & Y percentage coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                      <span>Horizontal (X):</span>
                      <span className="font-bold text-blue-600">{selectedElement.x}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={selectedElement.x}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { x: Number(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                      <span>Vertical (Y):</span>
                      <span className="font-bold text-blue-600">{selectedElement.y}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={selectedElement.y}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { y: Number(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Size, Color, Alignment */}
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
                      className="w-full px-2 py-1 bg-white border border-gray-300 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      value={selectedElement.color || '#202124'}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { color: e.target.value })}
                      className="w-full h-7 bg-white border border-gray-300 rounded-xl cursor-pointer p-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">
                      Alignment
                    </label>
                    <select
                      value={selectedElement.textAlign || 'center'}
                      onChange={(e: any) => handleUpdateElement(selectedElement.id, { textAlign: e.target.value })}
                      className="w-full px-1.5 py-1 bg-white border border-gray-300 rounded-xl text-xs"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

              </div>
            ) : (
              <p className="text-xs text-center text-gray-400 py-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                Click on any placeholder on the certificate preview to adjust its position and styling.
              </p>
            )}

            {/* Elements Pill List */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Active Elements ({elements.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {elements.map(el => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => setSelectedId(el.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      selectedId === el.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {el.label || el.type} ({el.x}%, {el.y}%)
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Certificate Live Preview Column (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span className="flex items-center">
                <Eye className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Live Certificate Canvas
              </span>
              <span className="text-[11px] text-gray-400">Click elements directly to select</span>
            </div>

            {/* Canvas Viewport */}
            <div
              className="w-full bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-300 transition-all aspect-[1.414/1] p-4 select-none"
              style={{
                backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : undefined,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundColor: template.backgroundColor || '#FFFFFF',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)'
              }}
            >
              {elements.map(el => {
                const isSelected = el.id === selectedId;
                const resolvedFont = el.customFontName
                  ? `"${el.customFontName}", ${el.fontFamily === 'serif' ? 'Georgia, serif' : el.fontFamily === 'mono' ? 'monospace' : 'sans-serif'}`
                  : el.fontFamily === 'serif'
                  ? 'Playfair Display, Georgia, serif'
                  : el.fontFamily === 'mono'
                  ? 'monospace'
                  : 'sans-serif';
                let content: React.ReactNode = null;

                if (el.type === 'placeholder' && isSignaturePlaceholderTag(el.placeholderTag)) {
                  content = (
                    <div className="flex flex-col items-center px-2 py-0.5 border border-dashed border-amber-300/80 rounded bg-amber-50/40">
                      <span
                        className="font-serif italic"
                        style={{
                          fontSize: `${el.fontSize || 15}px`,
                          color: el.color || '#202124'
                        }}
                      >
                        Priya Sharma (Sign)
                      </span>
                    </div>
                  );
                } else if (el.type === 'placeholder' && !isQrPlaceholderTag(el.placeholderTag)) {
                  const val = resolvePlaceholderValue(el.placeholderTag, sampleValues) ?? `{{${el.placeholderTag}}}`;
                  content = (
                    <span
                      style={{
                        fontSize: `${el.fontSize || 16}px`,
                        fontWeight: el.fontWeight || 'normal',
                        color: el.color || '#202124',
                        fontFamily: resolvedFont
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
                        fontFamily: resolvedFont
                      }}
                    >
                      {populateCertificatePlaceholders(el.customText || 'Text Box', sampleValues)}
                    </span>
                  );
                } else if (el.type === 'image' && el.customText) {
                  content = (
                    <img
                      src={el.customText}
                      alt={el.label || 'Slide Graphic'}
                      style={{
                        width: el.width ? `${el.width * 5}px` : '64px',
                        height: el.height ? `${el.height * 3.5}px` : 'auto',
                        objectFit: 'contain'
                      }}
                    />
                  );
                } else if (el.type === 'qr' || (el.type === 'placeholder' && isQrPlaceholderTag(el.placeholderTag))) {
                  content = (
                    <div className="w-11 h-11 sm:w-13 sm:h-13 bg-white border border-slate-300 rounded p-1 flex flex-col items-center justify-center shadow-xs">
                      <QrCode className="w-6 h-6 text-blue-600" />
                      <span className="text-[6px] font-mono font-bold text-gray-500">QR VERIFY</span>
                    </div>
                  );
                } else if (el.type === 'signature') {
                  content = (
                    <div className="flex flex-col items-center">
                      <span className="font-serif italic text-xs text-gray-700">Priya Sharma</span>
                      <div className="w-16 h-[1px] bg-gray-400 mt-0.5" />
                      <span className="text-[7px] font-bold text-blue-600 mt-0.5">Campus Ambassador</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={el.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(el.id);
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
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Changes will apply dynamically to all certificate previews and generated PDF files.
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? 'Saving Placeholders...' : 'Save Placeholders'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
