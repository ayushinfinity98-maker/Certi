import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  CertificateCustomElement,
  CertificateFieldConfig,
  CertificateTemplateConfig,
  PlaceholderRoleConfig
} from '../types';
import { logAuditEvent } from './dataService';

export const DEFAULT_CERT_TEMPLATE_ID = 'tpl_gsap_participation_2026';
export const DEFAULT_MAPPING_DOC_ID = 'default';
const LOCAL_STORAGE_TEMPLATES_KEY = 'gsap_certificate_templates_persistent';
const LOCAL_STORAGE_MAPPINGS_KEY = 'gsap_certificate_placeholder_mappings_v1';

const SEEDED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/**
 * Recursively strips `undefined` properties so Firestore setDoc/updateDoc never rejects nested arrays/objects.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    });
    return out as T;
  }
  return value;
}

export const DEFAULT_TEMPLATES: CertificateTemplateConfig[] = [
  {
    id: DEFAULT_CERT_TEMPLATE_ID,
    title: 'Google Student Ambassador 2026 - Participation (Official)',
    type: 'standard_google',
    heading: 'Certificate of Participation',
    subheading: 'Google Student Ambassador Program 2026',
    presentationText: 'This certificate is proudly and honorably presented to',
    bodyText: 'for active and exemplary participation in "{{initiative_name}}" organized by the Google Student Ambassador Program 2026 at {{college_name}} ({{semester}}).',
    footerNote: 'Official Program Issuance',
    showLogo: true,
    showProgramEmblem: true,
    showBorder: true,
    showQrCode: true,
    showSignature: true,
    signatureTitle: 'Campus Ambassador',
    primaryColor: '#1A73E8',
    fontFamily: 'serif',
    isActive: true,
    updatedAt: SEEDED_TIMESTAMP
  },
  {
    id: 'tpl_gsap_appreciation_2026',
    title: 'Certificate of Appreciation & Contribution 2026',
    type: 'standard_google',
    heading: 'Certificate of Appreciation',
    subheading: 'Google Student Ambassador Program 2026',
    presentationText: 'This certificate is warmly awarded with deepest appreciation to',
    bodyText: 'in recognition of valuable contributions and exceptional dedication during "{{initiative_name}}" conducted at {{college_name}} ({{semester}}).',
    footerNote: 'Honoring Student Excellence',
    showLogo: true,
    showProgramEmblem: true,
    showBorder: true,
    showQrCode: true,
    showSignature: true,
    signatureTitle: 'Lead Campus Ambassador',
    primaryColor: '#1E8E3E',
    fontFamily: 'serif',
    isActive: false,
    updatedAt: SEEDED_TIMESTAMP
  },
  {
    id: 'tpl_gsap_excellence_2026',
    title: 'Certificate of Excellence & Innovation 2026',
    type: 'standard_google',
    heading: 'Certificate of Excellence',
    subheading: 'Google Student Ambassador Program 2026',
    presentationText: 'Presented for outstanding technological leadership and achievement to',
    bodyText: 'for demonstrating remarkable innovation and technical skills in "{{initiative_name}}" at {{college_name}} ({{semester}}).',
    footerNote: 'Distinction in Technology Innovation',
    showLogo: true,
    showProgramEmblem: true,
    showBorder: true,
    showQrCode: true,
    showSignature: true,
    signatureTitle: 'Authorized Ambassador',
    primaryColor: '#D93025',
    fontFamily: 'serif',
    isActive: false,
    updatedAt: SEEDED_TIMESTAMP
  }
];

function sortTemplates(list: CertificateTemplateConfig[]): CertificateTemplateConfig[] {
  return [...list].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return (a.title || a.id).localeCompare(b.title || b.id);
  });
}

function getCachedTemplates(): CertificateTemplateConfig[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Cache read warning:', e);
  }
  return DEFAULT_TEMPLATES;
}

function setCachedTemplates(templates: CertificateTemplateConfig[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('Cache write warning:', e);
  }
}

/**
 * Fetches all certificate templates directly from Firestore (single source of truth).
 */
export async function getAllCertificateTemplates(): Promise<CertificateTemplateConfig[]> {
  try {
    const snap = await getDocs(collection(db, 'certificateTemplates'));
    if (!snap.empty) {
      const fromDb = sortTemplates(
        snap.docs.map(d => ({ ...d.data(), id: d.id } as CertificateTemplateConfig))
      );
      setCachedTemplates(fromDb);
      return fromDb;
    }

    // Seed initial templates ONLY when Firestore collection is completely empty and Super Admin is authenticated
    const isAdminUser = auth.currentUser?.email?.toLowerCase().trim() === 'ayushinfinity98@gmail.com';
    if (isAdminUser) {
      for (const tpl of DEFAULT_TEMPLATES) {
        await setDoc(doc(db, 'certificateTemplates', tpl.id), stripUndefinedDeep(tpl)).catch(() => {});
      }
      setCachedTemplates(DEFAULT_TEMPLATES);
      return DEFAULT_TEMPLATES;
    }

    return getCachedTemplates();
  } catch (err) {
    console.warn('Firestore templates fetch fallback to local cache:', err);
    return getCachedTemplates();
  }
}

/**
 * Real-time subscription to all certificate templates so updates in 1 place appear everywhere immediately.
 */
export function subscribeToCertificateTemplates(
  onUpdate: (templates: CertificateTemplateConfig[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    return onSnapshot(
      collection(db, 'certificateTemplates'),
      (snap) => {
        if (!snap.empty) {
          const fromDb = sortTemplates(
            snap.docs.map(d => ({ ...d.data(), id: d.id } as CertificateTemplateConfig))
          );
          setCachedTemplates(fromDb);
          onUpdate(fromDb);
        } else {
          onUpdate(getCachedTemplates());
        }
      },
      (err) => {
        console.warn('Certificate templates listener warning:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Could not attach certificateTemplates listener:', err);
    return () => {};
  }
}

/**
 * Real-time subscription to the currently active certificate template.
 */
export function subscribeToActiveCertificateTemplate(
  onUpdate: (template: CertificateTemplateConfig) => void
): Unsubscribe {
  return subscribeToCertificateTemplates((list) => {
    const active = list.find(t => t.isActive) || list[0] || DEFAULT_TEMPLATES[0];
    onUpdate(active);
  });
}

/**
 * Super Admin explicit delete template function
 */
export async function deleteCertificateTemplate(
  templateId: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const all = await getAllCertificateTemplates();
  if (all.length <= 1) {
    throw new Error('At least one certificate template must remain in the system.');
  }

  const remaining = all.filter(t => t.id !== templateId);
  if (!remaining.some(t => t.isActive) && remaining.length > 0) {
    remaining[0].isActive = true;
  }

  try {
    await deleteDoc(doc(db, 'certificateTemplates', templateId));
    if (remaining.length > 0 && remaining[0].isActive) {
      await setDoc(doc(db, 'certificateTemplates', remaining[0].id), { isActive: true }, { merge: true });
    }
  } catch (err: any) {
    console.error('Firestore delete template failed:', err);
    throw new Error(
      err?.code === 'permission-denied'
        ? 'Permission denied: please sign in with your Super Admin Google account to delete templates in Cloud.'
        : (err?.message || 'Failed to delete certificate template from Firestore.')
    );
  }

  setCachedTemplates(remaining);

  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CERTIFICATE_TEMPLATE_DELETED',
    `Super Admin explicitly deleted certificate template ${templateId}`,
    templateId
  );
}

/**
 * Returns the currently active template that CAs and Verification portal use
 */
export async function getActiveCertificateTemplate(): Promise<CertificateTemplateConfig> {
  const all = await getAllCertificateTemplates();
  const active = all.find(t => t.isActive) || all[0] || DEFAULT_TEMPLATES[0];
  return active;
}

/**
 * Saves or updates a certificate template permanently in Firestore
 */
export async function saveCertificateTemplate(
  template: CertificateTemplateConfig,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const all = await getAllCertificateTemplates();
  const now = new Date().toISOString();
  const updated: CertificateTemplateConfig = stripUndefinedDeep({
    ...template,
    updatedBy: adminUid,
    updatedAt: now
  });

  const nextList = all.map(t => {
    if (t.id === updated.id) return updated;
    if (updated.isActive) return { ...t, isActive: false };
    return t;
  });

  if (!nextList.some(t => t.id === updated.id)) {
    nextList.push(updated);
  }

  // Save to Firestore first (overwrite doc cleanly so cleared/removed elements stay synced across all devices)
  try {
    await setDoc(doc(db, 'certificateTemplates', updated.id), updated);
    if (updated.isActive) {
      for (const t of nextList) {
        if (t.id !== updated.id && t.isActive === false) {
          await setDoc(doc(db, 'certificateTemplates', t.id), { isActive: false }, { merge: true });
        }
      }
    }
  } catch (err: any) {
    console.error('Firestore saveCertificateTemplate failed:', err);
    throw new Error(
      err?.code === 'permission-denied'
        ? 'Permission denied: please connect your Super Admin Google session first so changes save to Cloud for everyone.'
        : (err?.message || 'Failed saving certificate template to Firestore.')
    );
  }

  setCachedTemplates(nextList);

  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CERTIFICATE_TEMPLATE_UPDATED',
    `Super Admin saved certificate template "${updated.title}" (Type: ${updated.type}, Active: ${updated.isActive})`,
    updated.id
  );
}

/**
 * Sets a specific template as the active certificate template in Firestore
 */
export async function setActiveCertificateTemplate(
  templateId: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const all = await getAllCertificateTemplates();
  const nextList = all.map(t => ({
    ...t,
    isActive: t.id === templateId
  }));

  try {
    for (const t of nextList) {
      await setDoc(doc(db, 'certificateTemplates', t.id), { isActive: t.isActive }, { merge: true });
    }
  } catch (err: any) {
    console.error('Firestore active template update failed:', err);
    throw new Error(
      err?.code === 'permission-denied'
        ? 'Permission denied: please sign in with your Super Admin Google account to activate templates in Cloud.'
        : (err?.message || 'Failed activating certificate template in Firestore.')
    );
  }

  setCachedTemplates(nextList);

  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CERTIFICATE_TEMPLATE_SELECTED',
    `Super Admin selected active certificate template "${templateId}" for all Ambassador issuance`,
    templateId
  );
}

export interface CertificatePlaceholderValues {
  student_name: string;
  initiative_name: string;
  college_name: string;
  semester: string;
  participation_date: string;
  certificate_id: string;
  ca_name: string;
  student_email?: string;
  ca_id?: string;
  program_name?: string;
  customFields?: Record<string, string>;
}

export function normalizePlaceholderTag(tag?: string): string {
  return (tag || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export const DEFAULT_PLACEHOLDER_ROLES: PlaceholderRoleConfig[] = [
  {
    tag: 'name',
    label: '{{name}}',
    enabled: true,
    sourceType: 'student_field',
    sourceKey: 'student_name',
    roleDescription: 'Displays the student participant full name on the certificate'
  },
  {
    tag: 'event',
    label: '{{event}}',
    enabled: true,
    sourceType: 'student_field',
    sourceKey: 'initiative_name',
    roleDescription: 'Displays the event, workshop, or initiative name'
  },
  {
    tag: 'university',
    label: '{{university}}',
    enabled: true,
    sourceType: 'student_field',
    sourceKey: 'college_name',
    roleDescription: 'Displays the student college or university name'
  },
  {
    tag: 'semester',
    label: '{{semester}}',
    enabled: true,
    sourceType: 'student_field',
    sourceKey: 'semester',
    roleDescription: 'Displays student semester, academic year, or cohort'
  },
  {
    tag: 'date',
    label: '{{date}}',
    enabled: true,
    sourceType: 'student_field',
    sourceKey: 'participation_date',
    roleDescription: 'Displays participation or event date'
  },
  {
    tag: 'CA Name',
    label: '{{CA Name}}',
    enabled: true,
    sourceType: 'ca_field',
    sourceKey: 'ca_name',
    roleDescription: 'Displays the issuing Campus Ambassador full name'
  },
  {
    tag: 'sign',
    label: '{{sign}}',
    enabled: true,
    sourceType: 'ca_field',
    sourceKey: 'ca_signature',
    roleDescription: 'Renders the issuing Campus Ambassador e-signature image'
  },
  {
    tag: 'certificate_id',
    label: '{{certificate_id}}',
    enabled: true,
    sourceType: 'system_field',
    sourceKey: 'certificate_id',
    roleDescription: 'Displays the unique cryptographic certificate ID'
  },
  {
    tag: 'qr',
    label: '{{qr}}',
    enabled: true,
    sourceType: 'system_field',
    sourceKey: 'verification_qr',
    roleDescription: 'Renders the scannable QR verification code'
  }
];

function getCachedFieldConfig(): CertificateFieldConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_MAPPINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CertificateFieldConfig;
        if (parsed && Array.isArray(parsed.roles)) return parsed;
      }
    } catch {
      // ignore
    }
  }
  return {
    id: DEFAULT_MAPPING_DOC_ID,
    roles: DEFAULT_PLACEHOLDER_ROLES,
    updatedAt: SEEDED_TIMESTAMP
  };
}

function setCachedFieldConfig(cfg: CertificateFieldConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_MAPPINGS_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

// Live in-memory mapping store so resolvePlaceholderValue / PDF generation stays synced across the app
let liveFieldConfig: CertificateFieldConfig = getCachedFieldConfig();

export function getLiveCertificateFieldConfig(): CertificateFieldConfig {
  return liveFieldConfig;
}

export async function getCertificateFieldConfig(): Promise<CertificateFieldConfig> {
  try {
    const snap = await getDoc(doc(db, 'certificateMappings', DEFAULT_MAPPING_DOC_ID));
    if (snap.exists()) {
      const cfg = { ...snap.data(), id: snap.id } as CertificateFieldConfig;
      liveFieldConfig = cfg;
      setCachedFieldConfig(cfg);
      return cfg;
    }
  } catch (err) {
    console.warn('Could not fetch certificateMappings/default:', err);
  }
  return liveFieldConfig;
}

export function subscribeToCertificateFieldConfig(
  onUpdate: (cfg: CertificateFieldConfig) => void
): Unsubscribe {
  try {
    return onSnapshot(
      doc(db, 'certificateMappings', DEFAULT_MAPPING_DOC_ID),
      (snap) => {
        if (snap.exists()) {
          const cfg = { ...snap.data(), id: snap.id } as CertificateFieldConfig;
          liveFieldConfig = cfg;
          setCachedFieldConfig(cfg);
          onUpdate(cfg);
        } else {
          onUpdate(liveFieldConfig);
        }
      },
      (err) => {
        console.warn('certificateMappings listener notice:', err);
        onUpdate(liveFieldConfig);
      }
    );
  } catch (err) {
    console.warn('Could not attach certificateMappings listener:', err);
    return () => {};
  }
}

export async function saveCertificateFieldConfig(
  roles: PlaceholderRoleConfig[],
  actorUid: string,
  actorEmail: string,
  actorRole: 'admin' | 'main_ca',
  actorCaUid?: string
): Promise<CertificateFieldConfig> {
  const now = new Date().toISOString();
  const payload: CertificateFieldConfig = stripUndefinedDeep({
    id: DEFAULT_MAPPING_DOC_ID,
    roles,
    updatedByUid: actorUid,
    updatedByCaUid: actorCaUid,
    updatedByEmail: actorEmail,
    updatedByRole: actorRole,
    updatedAt: now
  });

  try {
    await setDoc(doc(db, 'certificateMappings', DEFAULT_MAPPING_DOC_ID), payload);
  } catch (err: any) {
    console.error('Failed saving certificateMappings:', err);
    throw new Error(
      err?.code === 'permission-denied'
        ? 'Permission denied: only Super Admin or an active Main CA can update certificate field & placeholder roles.'
        : (err?.message || 'Failed saving certificate placeholder roles to Firestore.')
    );
  }

  liveFieldConfig = payload;
  setCachedFieldConfig(payload);

  await logAuditEvent(
    actorCaUid || actorUid,
    actorEmail,
    actorRole === 'admin' ? 'admin' : 'ca',
    'CERTIFICATE_PLACEHOLDER_ROLES_UPDATED',
    `${actorRole === 'admin' ? 'Admin' : 'Main CA'} updated certificate field visibility & placeholder role mappings (${roles.length} placeholders)`,
    DEFAULT_MAPPING_DOC_ID
  );

  return payload;
}

const PLACEHOLDER_ALIAS_GROUPS: string[][] = [
  ['name', 'student_name', 'student', 'full_name', 'fullname', 'recipient_name', 'participant_name'],
  ['event', 'initiative_name', 'initiative', 'event_name', 'program_event', 'workshop', 'session'],
  ['university', 'college_name', 'college', 'university_name', 'institution', 'institute'],
  ['date', 'participation_date', 'issue_date', 'issued_date', 'event_date'],
  ['ca_name', 'ambassador_name', 'ambassador', 'ca'],
  ['certificate_id', 'cert_id', 'id', 'verification_id'],
  ['semester', 'sem'],
  ['sign', 'signature', 'ca_sign', 'ca_signature', 'e_signature'],
  ['qr', 'qr_code', 'qrcode', 'verification_qr']
];

export function findMatchingPlaceholderRole(
  tag: string | undefined,
  roles?: PlaceholderRoleConfig[]
): PlaceholderRoleConfig | undefined {
  const norm = normalizePlaceholderTag(tag);
  if (!norm) return undefined;
  const list = roles || liveFieldConfig.roles || DEFAULT_PLACEHOLDER_ROLES;

  const exact = list.find(r => normalizePlaceholderTag(r.tag) === norm);
  if (exact) return exact;

  const aliasGroup = PLACEHOLDER_ALIAS_GROUPS.find(group => group.includes(norm));
  if (aliasGroup) {
    return list.find(r => aliasGroup.includes(normalizePlaceholderTag(r.tag)));
  }

  return undefined;
}

export function isPlaceholderEnabled(tag: string | undefined, roles?: PlaceholderRoleConfig[]): boolean {
  const matched = findMatchingPlaceholderRole(tag, roles);
  return matched ? matched.enabled !== false : true;
}

export function isSignaturePlaceholderTag(tag?: string, roles?: PlaceholderRoleConfig[]): boolean {
  const matched = findMatchingPlaceholderRole(tag, roles);
  if (matched) {
    return matched.sourceType === 'ca_field' && matched.sourceKey === 'ca_signature';
  }
  const norm = normalizePlaceholderTag(tag);
  return norm === 'sign' || norm === 'signature' || norm === 'ca_sign' || norm === 'ca_signature' || norm === 'e_signature';
}

export function isQrPlaceholderTag(tag?: string, roles?: PlaceholderRoleConfig[]): boolean {
  const matched = findMatchingPlaceholderRole(tag, roles);
  if (matched) {
    return matched.sourceType === 'system_field' && matched.sourceKey === 'verification_qr';
  }
  const norm = normalizePlaceholderTag(tag);
  return norm === 'qr' || norm === 'qr_code' || norm === 'qrcode' || norm === 'verification_qr';
}

function lookupCustomField(customFields: Record<string, string> | undefined, key: string): string | undefined {
  if (!customFields) return undefined;
  if (customFields[key] !== undefined && customFields[key] !== '') return customFields[key];
  const normTarget = normalizePlaceholderTag(key);
  for (const [k, v] of Object.entries(customFields)) {
    if (normalizePlaceholderTag(k) === normTarget && v !== undefined && v !== '') {
      return v;
    }
  }
  return undefined;
}

export function resolvePlaceholderValue(
  tag: string | undefined,
  values: CertificatePlaceholderValues,
  roles?: PlaceholderRoleConfig[]
): string | undefined {
  const norm = normalizePlaceholderTag(tag);
  if (!norm) return undefined;

  const matchedRole = findMatchingPlaceholderRole(tag, roles);
  if (matchedRole) {
    if (matchedRole.enabled === false) {
      return '';
    }

    switch (matchedRole.sourceType) {
      case 'static_text':
        return matchedRole.staticValue ?? matchedRole.fallbackValue ?? '';

      case 'student_field': {
        const key = matchedRole.sourceKey;
        if (key === 'student_name' || key === 'fullName') return values.student_name || matchedRole.fallbackValue || '';
        if (key === 'initiative_name' || key === 'initiativeName') return values.initiative_name || matchedRole.fallbackValue || '';
        if (key === 'college_name' || key === 'college') return values.college_name || matchedRole.fallbackValue || '';
        if (key === 'semester') return values.semester || matchedRole.fallbackValue || '';
        if (key === 'participation_date' || key === 'participationDate') return values.participation_date || matchedRole.fallbackValue || '';
        if (key === 'student_email' || key === 'email') return values.student_email || matchedRole.fallbackValue || '';
        const cfVal = lookupCustomField(values.customFields, key);
        return cfVal ?? matchedRole.fallbackValue ?? '';
      }

      case 'custom_form_field': {
        const cfVal = lookupCustomField(values.customFields, matchedRole.sourceKey);
        return cfVal ?? matchedRole.fallbackValue ?? '';
      }

      case 'ca_field': {
        if (matchedRole.sourceKey === 'ca_name') return values.ca_name || matchedRole.fallbackValue || '';
        if (matchedRole.sourceKey === 'ca_id') return values.ca_id || matchedRole.fallbackValue || '';
        if (matchedRole.sourceKey === 'ca_signature') return values.ca_name || '';
        return matchedRole.fallbackValue ?? values.ca_name ?? '';
      }

      case 'system_field': {
        if (matchedRole.sourceKey === 'certificate_id') return values.certificate_id || matchedRole.fallbackValue || '';
        if (matchedRole.sourceKey === 'program_name') return values.program_name || 'Google Student Ambassador Program 2026';
        return matchedRole.fallbackValue ?? '';
      }
    }
  }

  switch (norm) {
    case 'student_name':
    case 'name':
    case 'student':
    case 'full_name':
    case 'fullname':
    case 'recipient_name':
    case 'participant_name':
      return values.student_name;

    case 'initiative_name':
    case 'initiative':
    case 'event':
    case 'event_name':
    case 'program_event':
    case 'workshop':
    case 'session':
      return values.initiative_name;

    case 'college_name':
    case 'college':
    case 'university':
    case 'university_name':
    case 'institution':
    case 'institute':
      return values.college_name;

    case 'participation_date':
    case 'date':
    case 'issue_date':
    case 'issued_date':
    case 'event_date':
      return values.participation_date;

    case 'ca_name':
    case 'ambassador_name':
    case 'ambassador':
    case 'ca':
      return values.ca_name;

    case 'certificate_id':
    case 'cert_id':
    case 'id':
    case 'verification_id':
      return values.certificate_id;

    case 'semester':
    case 'sem':
      return values.semester;

    default: {
      const fromCustom = lookupCustomField(values.customFields, tag || norm);
      if (fromCustom !== undefined) return fromCustom;
      const raw = values as unknown as Record<string, string | undefined>;
      return raw[tag || ''] ?? raw[norm];
    }
  }
}

export function getOverlayPlaceholderElements(
  template: CertificateTemplateConfig,
  roles?: PlaceholderRoleConfig[]
): CertificateCustomElement[] {
  const roleList = roles || liveFieldConfig.roles || [];
  const existingNorms = new Set(
    (template.customElements || [])
      .filter(el => el.type === 'placeholder' && el.placeholderTag)
      .map(el => normalizePlaceholderTag(el.placeholderTag))
  );

  return roleList
    .filter(role => role.enabled !== false && role.renderOnCanvas === true)
    .filter(role => !existingNorms.has(normalizePlaceholderTag(role.tag)))
    .map(role => ({
      id: `overlay_${normalizePlaceholderTag(role.tag)}`,
      type: 'placeholder' as const,
      label: role.label || `{{${role.tag}}}`,
      placeholderTag: role.tag,
      x: typeof role.x === 'number' ? role.x : 50,
      y: typeof role.y === 'number' ? role.y : 70,
      fontSize: role.fontSize || 14,
      fontWeight: role.fontWeight || '600',
      fontFamily: role.fontFamily || 'sans',
      color: role.color || '#202124',
      textAlign: 'center' as const
    }));
}

export const STANDARD_SLIDE_PLACEHOLDER_PRESETS: Array<{
  tag: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '600';
  fontFamily: 'serif' | 'sans' | 'mono';
  color: string;
}> = [
  { tag: 'name', label: '{{name}}', x: 50, y: 42.3, fontSize: 24, fontWeight: 'bold', fontFamily: 'serif', color: '#1A73E8' },
  { tag: 'event', label: '{{event}}', x: 46.8, y: 53.9, fontSize: 15, fontWeight: '600', fontFamily: 'sans', color: '#202124' },
  { tag: 'university', label: '{{university}}', x: 77.1, y: 60, fontSize: 13, fontWeight: 'normal', fontFamily: 'sans', color: '#3C4043' },
  { tag: 'sign', label: '{{sign}}', x: 77, y: 83.9, fontSize: 14, fontWeight: '600', fontFamily: 'sans', color: '#202124' },
  { tag: 'date', label: '{{date}}', x: 22.8, y: 84.2, fontSize: 12, fontWeight: '600', fontFamily: 'sans', color: '#202124' },
  { tag: 'CA Name', label: '{{CA Name}}', x: 50, y: 84.6, fontSize: 12, fontWeight: '600', fontFamily: 'sans', color: '#202124' },
];

/**
 * Replaces placeholders in custom text (including common aliases like {{name}}, {{event}}, {{university}}, {{date}}, {{CA Name}})
 */
export function populateCertificatePlaceholders(
  templateText: string,
  values: CertificatePlaceholderValues,
  roles?: PlaceholderRoleConfig[]
): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawTag) => {
    const resolved = resolvePlaceholderValue(rawTag, values, roles);
    return resolved !== undefined ? resolved : match;
  });
}
