import React, { useEffect, useState } from 'react';
import {
  CampusAmbassador,
  CaRegistrationForm,
  CertificateTemplateConfig,
  PlaceholderRoleConfig,
  PlaceholderSourceType
} from '../types';
import {
  DEFAULT_PLACEHOLDER_ROLES,
  DEFAULT_TEMPLATES,
  getActiveCertificateTemplate,
  getCertificateFieldConfig,
  getOverlayPlaceholderElements,
  isPlaceholderEnabled,
  isQrPlaceholderTag,
  isSignaturePlaceholderTag,
  normalizePlaceholderTag,
  populateCertificatePlaceholders,
  resolvePlaceholderValue,
  saveCertificateFieldConfig,
  subscribeToActiveCertificateTemplate,
  subscribeToCertificateFieldConfig
} from '../services/certificateTemplateService';
import { subscribeToAllCaForms, subscribeToFormsForCA } from '../services/formService';
import {
  Sliders,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  QrCode,
  Sparkles,
  Layers
} from 'lucide-react';

interface PlaceholderRoleManagerProps {
  ca?: CampusAmbassador;
  actorUid: string;
  actorEmail: string;
  actorRole: 'admin' | 'main_ca';
}

export const PlaceholderRoleManager: React.FC<PlaceholderRoleManagerProps> = ({
  ca,
  actorUid,
  actorEmail,
  actorRole
}) => {
  const [template, setTemplate] = useState<CertificateTemplateConfig>(DEFAULT_TEMPLATES[0]);
  const [roles, setRoles] = useState<PlaceholderRoleConfig[]>(DEFAULT_PLACEHOLDER_ROLES);
  const [forms, setForms] = useState<CaRegistrationForm[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const isDirtyRef = useRefState();

  const [newTag, setNewTag] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPlaceOnCanvas, setNewPlaceOnCanvas] = useState(true);

  useEffect(() => {
    getActiveCertificateTemplate().then(setTemplate).catch(() => {});
    getCertificateFieldConfig()
      .then(cfg => {
        if (!isDirtyRef.current) setRoles(cfg.roles);
      })
      .catch(() => {});

    const unsubTpl = subscribeToActiveCertificateTemplate(setTemplate);
    const unsubCfg = subscribeToCertificateFieldConfig(cfg => {
      if (!isDirtyRef.current) setRoles(cfg.roles);
    });
    const unsubForms =
      actorRole === 'admin'
        ? subscribeToAllCaForms(setForms)
        : ca?.uid
          ? subscribeToFormsForCA(ca.uid, setForms)
          : () => {};

    return () => {
      unsubTpl();
      unsubCfg();
      unsubForms();
    };
  }, [actorRole, ca?.uid]);

  // Discover all placeholders used on the active certificate template + any custom form fields
  const templatePlaceholders = (template.customElements || [])
    .filter(el => el.type === 'placeholder' && el.placeholderTag)
    .map(el => el.placeholderTag as string);

  const customFormFieldKeys = Array.from(
    new Set(
      forms
        .flatMap(f => f.fields)
        .filter(f => !f.isCore)
        .map(f => f.key)
    )
  );

  // Merge any template placeholders missing from roles
  const mergedRoles: PlaceholderRoleConfig[] = [...roles];
  templatePlaceholders.forEach(tag => {
    const norm = normalizePlaceholderTag(tag);
    if (!mergedRoles.some(r => normalizePlaceholderTag(r.tag) === norm)) {
      mergedRoles.push({
        tag,
        label: `{{${tag}}}`,
        enabled: true,
        sourceType: customFormFieldKeys.includes(tag) ? 'custom_form_field' : 'student_field',
        sourceKey: tag,
        roleDescription: `Mapped placeholder {{${tag}}} on active certificate template`
      });
    }
  });

  const updateRole = (tag: string, patch: Partial<PlaceholderRoleConfig>) => {
    isDirtyRef.current = true;
    const normTarget = normalizePlaceholderTag(tag);
    setRoles(prev => {
      const exists = prev.some(r => normalizePlaceholderTag(r.tag) === normTarget);
      const base = exists ? prev : mergedRoles;
      return base.map(r => (normalizePlaceholderTag(r.tag) === normTarget ? { ...r, ...patch } : r));
    });
  };

  const handleAddPlaceholderRole = () => {
    const clean = newTag.replace(/[{}]/g, '').trim();
    if (!clean) return;
    const norm = normalizePlaceholderTag(clean);
    if (mergedRoles.some(r => normalizePlaceholderTag(r.tag) === norm)) {
      setSaveStatus({ type: 'error', text: `Placeholder "{{${clean}}}" is already configured.` });
      return;
    }

    isDirtyRef.current = true;
    const isCustomForm = customFormFieldKeys.some(k => normalizePlaceholderTag(k) === norm);
    const created: PlaceholderRoleConfig = {
      tag: clean,
      label: `{{${clean}}}`,
      enabled: true,
      sourceType: isCustomForm ? 'custom_form_field' : 'static_text',
      sourceKey: isCustomForm ? clean : '',
      staticValue: isCustomForm ? '' : clean,
      roleDescription: newDescription.trim() || `Displays ${clean} on the certificate`,
      renderOnCanvas: newPlaceOnCanvas,
      x: 50,
      y: 72,
      fontSize: 14,
      color: '#202124',
      fontWeight: '600',
      fontFamily: 'sans'
    };

    setRoles([...mergedRoles, created]);
    setNewTag('');
    setNewDescription('');
  };

  const handleRemoveRole = (tag: string) => {
    const norm = normalizePlaceholderTag(tag);
    isDirtyRef.current = true;
    setRoles(mergedRoles.filter(r => normalizePlaceholderTag(r.tag) !== norm));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await saveCertificateFieldConfig(
        mergedRoles,
        actorUid,
        actorEmail,
        actorRole,
        actorRole === 'main_ca' ? ca?.uid : undefined
      );
      isDirtyRef.current = false;
      setSaveStatus({
        type: 'success',
        text: 'Certificate placeholder roles & field visibility saved! All dashboards, previews, verification pages, and PDFs are updated immediately.'
      });
    } catch (err: any) {
      setSaveStatus({ type: 'error', text: err?.message || 'Failed saving placeholder roles.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Sample values for real-time preview including custom form fields
  const sampleCustomFields: Record<string, string> = {};
  customFormFieldKeys.forEach(k => {
    sampleCustomFields[k] = `[${k} sample]`;
  });

  const sampleValues = {
    student_name: 'Alex Rivera',
    initiative_name: 'Google Cloud & AI Innovation Summit 2026',
    college_name: ca?.college || 'Stanford University',
    semester: 'Semester 6',
    participation_date: '2026-11-10',
    certificate_id: 'GSAP-2026-CA001-A9F82',
    ca_name: ca?.name || 'Priya Sharma',
    ca_id: ca?.caId || 'CA-2026-001',
    program_name: 'Google Student Ambassador Program 2026',
    customFields: sampleCustomFields
  };

  const isManualMode = template.elementsMode === 'manual_placed' || template.type === 'blank_plain';
  const combinedPreviewElements = [
    ...(template.customElements || []),
    ...getOverlayPlaceholderElements(template, mergedRoles)
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              Certificate Info & Placeholder Role Controller
            </h3>
            <p className="text-xs text-gray-500">
              Choose what information appears on certificates and define what each placeholder does (map to form fields, CA info, or fixed text).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'Saving Rules...' : 'Save Certificate Rules'}
        </button>
      </div>

      {saveStatus && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
            saveStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {saveStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{saveStatus.text}</span>
          </div>
          <button type="button" onClick={() => setSaveStatus(null)} className="font-bold ml-3">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Placeholder Rules Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900 flex items-center">
                <Layers className="w-4 h-4 mr-1.5 text-purple-600" />
                Active Certificate Placeholders & Their Jobs ({mergedRoles.length})
              </span>
              <span className="text-[11px] text-gray-400">
                Active Template: <strong className="text-gray-700">{template.title}</strong>
              </span>
            </div>

            <div className="space-y-3">
              {mergedRoles.map((role) => {
                const isDefaultCore = DEFAULT_PLACEHOLDER_ROLES.some(
                  d => normalizePlaceholderTag(d.tag) === normalizePlaceholderTag(role.tag)
                );

                return (
                  <div
                    key={role.tag}
                    className={`p-3.5 rounded-2xl border text-xs space-y-2.5 transition ${
                      role.enabled ? 'bg-slate-50/70 border-slate-200' : 'bg-gray-50 border-dashed border-gray-300 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-lg font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
                          {role.label || `{{${role.tag}}}`}
                        </span>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={role.enabled !== false}
                            onChange={(e) => updateRole(role.tag, { enabled: e.target.checked })}
                            className="rounded text-purple-600 w-3.5 h-3.5"
                          />
                          <span className="font-bold text-gray-800">
                            {role.enabled !== false ? 'Show on Certificate' : 'Hidden on Certificate'}
                          </span>
                        </label>
                      </div>

                      {!isDefaultCore && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRole(role.tag)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                          title="Remove custom placeholder rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          What Information Fills This Placeholder?
                        </label>
                        <select
                          value={`${role.sourceType}::${role.sourceKey}`}
                          onChange={(e) => {
                            const [srcType, srcKey] = e.target.value.split('::') as [PlaceholderSourceType, string];
                            updateRole(role.tag, { sourceType: srcType, sourceKey: srcKey });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold"
                        >
                          <optgroup label="Student / Core Form Info">
                            <option value="student_field::student_name">Student Full Name</option>
                            <option value="student_field::initiative_name">Event / Initiative Name</option>
                            <option value="student_field::college_name">College / University</option>
                            <option value="student_field::semester">Semester / Year</option>
                            <option value="student_field::participation_date">Participation Date</option>
                            <option value="student_field::student_email">Student Email</option>
                          </optgroup>

                          {customFormFieldKeys.length > 0 && (
                            <optgroup label="Custom Form Fields (From Your Forms)">
                              {customFormFieldKeys.map(k => (
                                <option key={k} value={`custom_form_field::${k}`}>
                                  Form Field: {k}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          <optgroup label="Campus Ambassador Info">
                            <option value="ca_field::ca_name">Issuing CA Name</option>
                            <option value="ca_field::ca_id">Issuing CA ID</option>
                            <option value="ca_field::ca_signature">CA E-Signature Image</option>
                          </optgroup>

                          <optgroup label="System / Verification">
                            <option value="system_field::certificate_id">Unique Certificate ID</option>
                            <option value="system_field::verification_qr">Verification QR Code</option>
                            <option value="system_field::program_name">Program Name</option>
                          </optgroup>

                          <optgroup label="Fixed Text">
                            <option value="static_text::fixed">Fixed Custom Text</option>
                          </optgroup>
                        </select>
                      </div>

                      {role.sourceType === 'static_text' ? (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Fixed Text Value
                          </label>
                          <input
                            type="text"
                            value={role.staticValue || ''}
                            onChange={(e) => updateRole(role.tag, { staticValue: e.target.value })}
                            placeholder="Exact text printed for this placeholder"
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Fallback Value (If Empty)
                          </label>
                          <input
                            type="text"
                            value={role.fallbackValue || ''}
                            onChange={(e) => updateRole(role.tag, { fallbackValue: e.target.value })}
                            placeholder="Optional fallback"
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Placeholder Job / Role Note
                      </label>
                      <input
                        type="text"
                        value={role.roleDescription || ''}
                        onChange={(e) => updateRole(role.tag, { roleDescription: e.target.value })}
                        placeholder="Describe what this placeholder does..."
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs"
                      />
                    </div>

                    {/* Optional canvas coordinates for overlay placeholders */}
                    {(!templatePlaceholders.some(tp => normalizePlaceholderTag(tp) === normalizePlaceholderTag(role.tag)) || role.renderOnCanvas) && (
                      <div className="pt-1 border-t border-gray-200/70 flex items-center flex-wrap gap-3 text-[11px]">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(role.renderOnCanvas)}
                            onChange={(e) => updateRole(role.tag, {
                              renderOnCanvas: e.target.checked,
                              x: role.x ?? 50,
                              y: role.y ?? 72
                            })}
                            className="rounded text-purple-600"
                          />
                          <span className="font-semibold text-gray-700">Place on Certificate Canvas</span>
                        </label>

                        {role.renderOnCanvas && (
                          <>
                            <label className="flex items-center space-x-1">
                              <span className="text-gray-500">X%:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={role.x ?? 50}
                                onChange={(e) => updateRole(role.tag, { x: Number(e.target.value) })}
                                className="w-16 px-1.5 py-0.5 bg-white border border-gray-300 rounded"
                              />
                            </label>
                            <label className="flex items-center space-x-1">
                              <span className="text-gray-500">Y%:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={role.y ?? 72}
                                onChange={(e) => updateRole(role.tag, { y: Number(e.target.value) })}
                                className="w-16 px-1.5 py-0.5 bg-white border border-gray-300 rounded"
                              />
                            </label>
                            <label className="flex items-center space-x-1">
                              <span className="text-gray-500">Size:</span>
                              <input
                                type="number"
                                min={10}
                                max={48}
                                value={role.fontSize ?? 14}
                                onChange={(e) => updateRole(role.tag, { fontSize: Number(e.target.value) })}
                                className="w-14 px-1.5 py-0.5 bg-white border border-gray-300 rounded"
                              />
                            </label>
                            <input
                              type="color"
                              value={role.color || '#202124'}
                              onChange={(e) => updateRole(role.tag, { color: e.target.value })}
                              className="w-7 h-6 rounded border border-gray-300 bg-white cursor-pointer"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add New Custom Placeholder */}
            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2.5 text-xs">
              <span className="font-bold text-purple-950 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                Add New Custom Placeholder Rule (e.g. {'{{roll_no}}'}, {'{{track}}'}, {'{{grade}}'})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Tag name (e.g. roll_no)"
                  className="sm:col-span-4 px-3 py-1.5 bg-white border border-gray-300 rounded-xl font-mono text-xs"
                />
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this placeholder's job?"
                  className="sm:col-span-5 px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddPlaceholderRole}
                  disabled={!newTag.trim()}
                  className="sm:col-span-3 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Rule
                </button>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer text-[11px] text-gray-700">
                <input
                  type="checkbox"
                  checked={newPlaceOnCanvas}
                  onChange={(e) => setNewPlaceOnCanvas(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <span>Render this custom placeholder onto the certificate canvas automatically</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Live Certificate Preview */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3 sticky top-20">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span className="flex items-center">
                <Eye className="w-4 h-4 mr-1.5 text-emerald-600" />
                Live Certificate Preview (With Your Rules)
              </span>
            </div>

            <div
              className="w-full bg-white rounded-xl shadow-md overflow-hidden relative border border-gray-300 aspect-[1.414/1] p-3 select-none"
              style={{
                backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : undefined,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundColor: template.backgroundColor || '#FFFFFF'
              }}
            >
              {!isManualMode ? (
                <div className="relative z-10 flex flex-col justify-between h-full p-3 text-center">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">{template.subheading}</div>
                  <div className="space-y-1 my-auto">
                    <div className="text-lg font-serif font-bold text-gray-900">{template.heading}</div>
                    {isPlaceholderEnabled('name', mergedRoles) && (
                      <div className="text-lg font-serif font-bold text-blue-700">
                        {resolvePlaceholderValue('name', sampleValues, mergedRoles) || sampleValues.student_name}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-600 max-w-xs mx-auto">
                      {populateCertificatePlaceholders(template.bodyText || '', sampleValues, mergedRoles)}
                    </p>
                  </div>
                  <div className="flex items-end justify-between text-[9px] text-gray-600 pt-2 border-t border-gray-100">
                    <span>{isPlaceholderEnabled('date', mergedRoles) ? resolvePlaceholderValue('date', sampleValues, mergedRoles) : ''}</span>
                    <span>{isPlaceholderEnabled('qr', mergedRoles) ? '[QR]' : ''}</span>
                    <span>{isPlaceholderEnabled('CA Name', mergedRoles) ? resolvePlaceholderValue('CA Name', sampleValues, mergedRoles) : ''}</span>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 w-full h-full">
                  {combinedPreviewElements.map(el => {
                    if (el.type === 'placeholder' && !isPlaceholderEnabled(el.placeholderTag, mergedRoles)) {
                      return null;
                    }
                    if (el.type === 'qr' && !isPlaceholderEnabled('qr', mergedRoles)) return null;
                    if (el.type === 'signature' && !isPlaceholderEnabled('sign', mergedRoles)) return null;

                    let content: React.ReactNode = null;
                    if (el.type === 'placeholder' && isSignaturePlaceholderTag(el.placeholderTag, mergedRoles)) {
                      content = <span className="font-serif italic text-[11px] text-gray-800">{sampleValues.ca_name} (Sign)</span>;
                    } else if (el.type === 'placeholder' && !isQrPlaceholderTag(el.placeholderTag, mergedRoles)) {
                      const val = resolvePlaceholderValue(el.placeholderTag, sampleValues, mergedRoles) ?? `{{${el.placeholderTag}}}`;
                      content = (
                        <span
                          style={{
                            fontSize: `${Math.max(8, Math.round((el.fontSize || 16) * 0.62))}px`,
                            fontWeight: el.fontWeight || 'normal',
                            color: el.color || '#202124'
                          }}
                        >
                          {val}
                        </span>
                      );
                    } else if (el.type === 'text') {
                      content = (
                        <span
                          style={{
                            fontSize: `${Math.max(8, Math.round((el.fontSize || 16) * 0.62))}px`,
                            color: el.color || '#202124'
                          }}
                        >
                          {populateCertificatePlaceholders(el.customText || '', sampleValues, mergedRoles)}
                        </span>
                      );
                    } else if (el.type === 'qr' || (el.type === 'placeholder' && isQrPlaceholderTag(el.placeholderTag, mergedRoles))) {
                      content = (
                        <div className="w-8 h-8 bg-white border border-slate-300 rounded flex items-center justify-center">
                          <QrCode className="w-5 h-5 text-blue-600" />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={el.id}
                        className="absolute whitespace-nowrap"
                        style={{
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          transform: el.textAlign === 'center' ? 'translate(-50%, -50%)' : el.textAlign === 'right' ? 'translate(-100%, -50%)' : 'translate(0%, -50%)'
                        }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-500">
              Disabled placeholders are hidden on issued certificates, verification views, and PDFs. Mapped placeholders dynamically pull from your selected field or static value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function useRefState() {
  return React.useRef(false);
}
