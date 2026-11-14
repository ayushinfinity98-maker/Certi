import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CertificateTemplateConfig } from '../types';
import { logAuditEvent } from './dataService';

export const DEFAULT_CERT_TEMPLATE_ID = 'tpl_gsap_participation_2026';
const LOCAL_STORAGE_TEMPLATES_KEY = 'gsap_certificate_templates_persistent';
const LOCAL_STORAGE_ACTIVE_TPL_KEY = 'gsap_active_cert_template_id';

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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
  }
];

/**
 * Loads templates from localStorage cache to guarantee 0 data loss
 */
function getCachedTemplates(): CertificateTemplateConfig[] {
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

/**
 * Saves templates into localStorage mirror so they never erase
 */
function setCachedTemplates(templates: CertificateTemplateConfig[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('Cache write warning:', e);
  }
}

/**
 * Fetches all certificate templates (Firestore + localStorage permanent fallback)
 */
export async function getAllCertificateTemplates(): Promise<CertificateTemplateConfig[]> {
  try {
    const snap = await getDocs(collection(db, 'certificateTemplates'));
    if (!snap.empty) {
      const fromDb = snap.docs.map(d => ({ ...d.data(), id: d.id } as CertificateTemplateConfig));
      // Merge with cache preserving any newer local updates
      const cached = getCachedTemplates();
      const map = new Map<string, CertificateTemplateConfig>();
      cached.forEach(t => map.set(t.id, t));
      fromDb.forEach(t => map.set(t.id, t));
      const merged = Array.from(map.values());
      setCachedTemplates(merged);
      return merged;
    }

    // Seed initial templates if Firestore is empty
    const initial = getCachedTemplates();
    for (const tpl of initial) {
      try {
        await setDoc(doc(db, 'certificateTemplates', tpl.id), tpl);
      } catch (e) {
        // ignore write error if offline
      }
    }
    setCachedTemplates(initial);
    return initial;
  } catch (err) {
    console.warn('Firestore templates offline, using permanent local storage:', err);
    return getCachedTemplates();
  }
}

/**
 * Super Admin explicit delete template function ("delete krne ka super admin ko option aye tb delete ho")
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
  // If deleted template was active, activate the first remaining
  if (!remaining.some(t => t.isActive) && remaining.length > 0) {
    remaining[0].isActive = true;
  }

  setCachedTemplates(remaining);

  try {
    await deleteDoc(doc(db, 'certificateTemplates', templateId));
    if (remaining.length > 0 && remaining[0].isActive) {
      await setDoc(doc(db, 'certificateTemplates', remaining[0].id), { isActive: true }, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore delete template notice:', err);
  }

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
 * Returns the currently active template that CAs will automatically use
 */
export async function getActiveCertificateTemplate(): Promise<CertificateTemplateConfig> {
  const all = await getAllCertificateTemplates();
  const active = all.find(t => t.isActive) || all[0] || DEFAULT_TEMPLATES[0];
  return active;
}

/**
 * Saves or updates a certificate template permanently
 */
export async function saveCertificateTemplate(
  template: CertificateTemplateConfig,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const all = await getAllCertificateTemplates();
  const now = new Date().toISOString();
  const updated: CertificateTemplateConfig = {
    ...template,
    updatedBy: adminUid,
    updatedAt: now
  };

  // If this template is set as active, deactivate others
  const nextList = all.map(t => {
    if (t.id === updated.id) return updated;
    if (updated.isActive) return { ...t, isActive: false };
    return t;
  });

  if (!nextList.some(t => t.id === updated.id)) {
    nextList.push(updated);
  }

  setCachedTemplates(nextList);

  // Save to Firestore
  try {
    await setDoc(doc(db, 'certificateTemplates', updated.id), updated, { merge: true });
    if (updated.isActive) {
      for (const t of nextList) {
        if (t.id !== updated.id) {
          await setDoc(doc(db, 'certificateTemplates', t.id), { isActive: false }, { merge: true });
        }
      }
    }
  } catch (err) {
    console.warn('Firestore write notice:', err);
  }

  // Audit log
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
 * Sets a specific template as the active certificate template
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

  setCachedTemplates(nextList);

  try {
    for (const t of nextList) {
      await setDoc(doc(db, 'certificateTemplates', t.id), { isActive: t.isActive }, { merge: true });
    }
  } catch (e) {
    console.warn('Firestore active template notice:', e);
  }

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
