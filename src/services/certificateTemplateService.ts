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
      setCachedTemplates(fromDb);
      return fromDb;
    }

    // Seed defaults into firestore and cache
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

/**
 * Replaces placeholders in custom text
 */
export function populateCertificatePlaceholders(
  templateText: string,
  values: {
    student_name: string;
    initiative_name: string;
    college_name: string;
    semester: string;
    participation_date: string;
    certificate_id: string;
    ca_name: string;
  }
): string {
  let result = templateText;
  Object.entries(values).forEach(([k, v]) => {
    const reg = new RegExp(`{{${k}}}`, 'g');
    result = result.replace(reg, v);
  });
  return result;
}
