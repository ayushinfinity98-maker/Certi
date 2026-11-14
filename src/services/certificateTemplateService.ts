import { doc, getDocs, setDoc, deleteDoc, collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { CertificateTemplateConfig } from '../types';
import { logAuditEvent } from './dataService';

export const DEFAULT_CERT_TEMPLATE_ID = 'tpl_gsap_participation_2026';
const LOCAL_STORAGE_TEMPLATES_KEY = 'gsap_certificate_templates_persistent';

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
}

export function normalizePlaceholderTag(tag?: string): string {
  return (tag || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isSignaturePlaceholderTag(tag?: string): boolean {
  const norm = normalizePlaceholderTag(tag);
  return norm === 'sign' || norm === 'signature' || norm === 'ca_sign' || norm === 'ca_signature' || norm === 'e_signature';
}

export function isQrPlaceholderTag(tag?: string): boolean {
  const norm = normalizePlaceholderTag(tag);
  return norm === 'qr' || norm === 'qr_code' || norm === 'qrcode' || norm === 'verification_qr';
}

export function resolvePlaceholderValue(
  tag: string | undefined,
  values: CertificatePlaceholderValues
): string | undefined {
  const norm = normalizePlaceholderTag(tag);
  if (!norm) return undefined;

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
      const raw = values as unknown as Record<string, string | undefined>;
      return raw[tag || ''] ?? raw[norm];
    }
  }
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
  values: CertificatePlaceholderValues
): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawTag) => {
    const resolved = resolvePlaceholderValue(rawTag, values);
    return resolved !== undefined ? resolved : match;
  });
}
