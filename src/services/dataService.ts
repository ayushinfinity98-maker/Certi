import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { ACTIVE_FIRESTORE_DB_ID, auth, db, getSecondaryAuth } from '../firebase/config';
import { Student, Certificate, CampusAmbassador, EmailLog, AuditLog } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { dispatchCertificateEmail } from './emailService';
import { generateScriptSignatureDataUrl } from '../utils/signatureUtils';
 
// Storage cache keys for absolute persistence ("sara data save rhe")
const KEY_STUDENTS = 'gsap_students_persistent_cache_v2';
const KEY_CAS = 'gsap_cas_persistent_cache_v2';
const KEY_CERTS = 'gsap_certs_persistent_cache_v2';
const KEY_AUDIT = 'gsap_audit_logs_persistent_cache_v2';
const KEY_EMAIL_LOGS = 'gsap_email_logs_persistent_cache_v2';
 
function loadCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as unknown as T;
      if (typeof parsed === 'object' && parsed !== null) return parsed as unknown as T;
    }
  } catch (e) {
    console.warn(`Cache read error for ${key}:`, e);
  }
  return fallback;
}
 
function saveCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Cache write error for ${key}:`, e);
  }
}
 
// Default Seed Data for 100% Reliability
const INITIAL_CAS: CampusAmbassador[] = [
  {
    uid: 'ca_demo_stanford_001',
    caId: 'CA-2026-001',
    name: 'Priya Sharma',
    email: 'priya.sharma@stanford.edu',
    college: 'Stanford University',
    phone: '+1 650-723-2300',
    status: 'active',
    signatureUrl: generateScriptSignatureDataUrl('Priya Sharma'),
    signatureUpdatedAt: new Date().toISOString(),
    initialPassword: 'Ambassador@Priya26',
    allowGoogleLogin: true,
    googleEmail: 'priya.sharma@stanford.edu',
    permissions: {
      canIssueCertificates: true,
      canImportCsv: true,
      canEditStudents: true,
      canSendEmails: true
    },
    totalStudents: 3,
    totalCertificates: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    uid: 'ca_demo_mit_002',
    caId: 'CA-2026-002',
    name: 'Marcus Vance',
    email: 'marcus.vance@mit.edu',
    college: 'Massachusetts Institute of Technology',
    phone: '+1 617-253-1000',
    status: 'active',
    signatureUrl: generateScriptSignatureDataUrl('Marcus Vance'),
    signatureUpdatedAt: new Date().toISOString(),
    initialPassword: 'Ambassador@Marcus26',
    allowGoogleLogin: true,
    googleEmail: 'marcus.vance@mit.edu',
    permissions: {
      canIssueCertificates: true,
      canImportCsv: true,
      canEditStudents: true,
      canSendEmails: true
    },
    totalStudents: 2,
    totalCertificates: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
 
const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stu_demo_101',
    caUid: 'ca_demo_stanford_001',
    caId: 'CA-2026-001',
    fullName: 'Elena Rostova',
    email: 'elena.rostova@stanford.edu',
    college: 'Stanford University',
    semester: 'Semester 6',
    initiativeName: 'Google Cloud & Gemini AI Study Jam 2026',
    participationDate: '2026-11-08',
    certificateStatus: 'issued',
    certificateId: 'GSAP-2026-CA001-ELN72',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'stu_demo_102',
    caUid: 'ca_demo_stanford_001',
    caId: 'CA-2026-001',
    fullName: 'Liam Chen',
    email: 'liam.chen@stanford.edu',
    college: 'Stanford University',
    semester: 'Semester 6',
    initiativeName: 'Google Cloud & Gemini AI Study Jam 2026',
    participationDate: '2026-11-08',
    certificateStatus: 'issued',
    certificateId: 'GSAP-2026-CA001-LM831',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'stu_demo_103',
    caUid: 'ca_demo_stanford_001',
    caId: 'CA-2026-001',
    fullName: 'Aisha Al-Mansoor',
    email: 'aisha.m@stanford.edu',
    college: 'Stanford University',
    semester: 'Semester 4',
    initiativeName: 'Google Cloud & Gemini AI Study Jam 2026',
    participationDate: '2026-11-08',
    certificateStatus: 'not_issued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'stu_demo_201',
    caUid: 'ca_demo_mit_002',
    caId: 'CA-2026-002',
    fullName: 'David Kim',
    email: 'david.kim@mit.edu',
    college: 'Massachusetts Institute of Technology',
    semester: 'Semester 5',
    initiativeName: 'Android & Firebase Hackathon 2026',
    participationDate: '2026-11-09',
    certificateStatus: 'issued',
    certificateId: 'GSAP-2026-CA002-KIM94',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
 
const INITIAL_CERTS: Certificate[] = [
  {
    certificateId: 'GSAP-2026-CA001-ELN72',
    studentId: 'stu_demo_101',
    studentName: 'Elena Rostova',
    initiativeName: 'Google Cloud & Gemini AI Study Jam 2026',
    semester: 'Semester 6',
    college: 'Stanford University',
    participationDate: '2026-11-08',
    caUid: 'ca_demo_stanford_001',
    caName: 'Priya Sharma',
    caId: 'CA-2026-001',
    signatureUrl: generateScriptSignatureDataUrl('Priya Sharma'),
    programName: 'Google Student Ambassador Program 2026',
    status: 'valid',
    verificationUrl: 'https://google-student-ambassador-2026.web.app/verify/GSAP-2026-CA001-ELN72',
    issuedAt: new Date().toISOString()
  },
  {
    certificateId: 'GSAP-2026-CA001-LM831',
    studentId: 'stu_demo_102',
    studentName: 'Liam Chen',
    initiativeName: 'Google Cloud & Gemini AI Study Jam 2026',
    semester: 'Semester 6',
    college: 'Stanford University',
    participationDate: '2026-11-08',
    caUid: 'ca_demo_stanford_001',
    caName: 'Priya Sharma',
    caId: 'CA-2026-001',
    signatureUrl: generateScriptSignatureDataUrl('Priya Sharma'),
    programName: 'Google Student Ambassador Program 2026',
    status: 'valid',
    verificationUrl: 'https://google-student-ambassador-2026.web.app/verify/GSAP-2026-CA001-LM831',
    issuedAt: new Date().toISOString()
  },
  {
    certificateId: 'GSAP-2026-CA002-KIM94',
    studentId: 'stu_demo_201',
    studentName: 'David Kim',
    initiativeName: 'Android & Firebase Hackathon 2026',
    semester: 'Semester 5',
    college: 'Massachusetts Institute of Technology',
    participationDate: '2026-11-09',
    caUid: 'ca_demo_mit_002',
    caName: 'Marcus Vance',
    caId: 'CA-2026-002',
    signatureUrl: generateScriptSignatureDataUrl('Marcus Vance'),
    programName: 'Google Student Ambassador Program 2026',
    status: 'valid',
    verificationUrl: 'https://google-student-ambassador-2026.web.app/verify/GSAP-2026-CA002-KIM94',
    issuedAt: new Date().toISOString()
  }
];
 
/**
 * Log system audit event (immutable security requirement)
 */
export async function logAuditEvent(
  actorUid: string,
  actorEmail: string,
  actorRole: 'admin' | 'ca' | 'system',
  action: string,
  details: string,
  targetId?: string
): Promise<void> {
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newLog: AuditLog = {
    id: logId,
    actorUid,
    actorEmail: actorEmail || 'system@google.com',
    actorRole,
    action,
    details,
    targetId: targetId || '',
    timestamp: new Date().toISOString()
  };
 
  // Immediate local cache save
  const cached = loadCache<AuditLog[]>(KEY_AUDIT, []);
  saveCache(KEY_AUDIT, [newLog, ...cached.slice(0, 500)]);
 
  try {
    await setDoc(doc(db, 'auditLogs', logId), newLog);
  } catch (error) {
    console.warn('Could not record audit log to firestore:', error);
  }
}
 
/**
 * Real-Time Subscriptions ("jo bhi ho vo real time data m chale")
 */
export function subscribeToStudentsForCA(
  caUid: string,
  onUpdate: (students: Student[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Emit initial cached data immediately
  const cached = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  onUpdate(cached.filter(s => s.caUid === caUid));

  try {
    const q = query(collection(db, 'students'), where('caUid', '==', caUid));
    return onSnapshot(
      q,
      (snapshot) => {
        const fromDb = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Student));
        // Merge into persistent cache
        const allCached = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
        const map = new Map<string, Student>();
        allCached.forEach(s => map.set(s.id, s));
        fromDb.forEach(s => map.set(s.id, s));
        const merged = Array.from(map.values());
        saveCache(KEY_STUDENTS, merged);
        onUpdate(fromDb);
      },
      (error) => {
        console.warn('Real-time students listener warning:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Could not attach onSnapshot for students:', err);
    return () => {};
  }
}

export function subscribeToAllCampusAmbassadors(
  onUpdate: (cas: CampusAmbassador[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Emit initial cache immediately
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  onUpdate(cached);

  try {
    const q = query(collection(db, 'campusAmbassadors'));
    return onSnapshot(
      q,
      (snapshot) => {
        const fromDb = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as CampusAmbassador));
        const allCached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
        const map = new Map<string, CampusAmbassador>();
        allCached.forEach(c => map.set(c.uid, c));
        fromDb.forEach(c => map.set(c.uid, c));
        const merged = Array.from(map.values());
        saveCache(KEY_CAS, merged);
        onUpdate(merged);

        // Whenever Super Admin is authenticated in Firebase Auth, keep all CAs & caDirectory synced to cloud
        if (auth.currentUser?.email?.toLowerCase().trim() === 'ayushinfinity98@gmail.com') {
          void syncCasToCloud(fromDb, allCached).catch(() => {});
        }
      },
      (error) => {
        console.warn('Real-time campus ambassadors listener warning:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Could not attach onSnapshot for ambassadors:', err);
    return () => {};
  }
}

export function subscribeToCertificates(
  onUpdate: (certs: Certificate[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const cached = loadCache<Certificate[]>(KEY_CERTS, INITIAL_CERTS);
  onUpdate(cached);

  try {
    const q = query(collection(db, 'certificates'));
    return onSnapshot(
      q,
      (snapshot) => {
        const fromDb = snapshot.docs.map(d => ({ ...d.data(), certificateId: d.id } as Certificate));
        const allCached = loadCache<Certificate[]>(KEY_CERTS, INITIAL_CERTS);
        const map = new Map<string, Certificate>();
        allCached.forEach(c => map.set(c.certificateId, c));
        fromDb.forEach(c => map.set(c.certificateId, c));
        const merged = Array.from(map.values());
        saveCache(KEY_CERTS, merged);
        onUpdate(merged);
      },
      (error) => {
        console.warn('Real-time certificates listener warning:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.warn('Could not attach onSnapshot for certificates:', err);
    return () => {};
  }
}

/**
 * CA Student Management
 */
export async function getStudentsForCA(caUid: string): Promise<Student[]> {
  const cached = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  let caStudents = cached.filter(s => s.caUid === caUid);
 
  try {
    const q = query(collection(db, 'students'), where('caUid', '==', caUid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const fromDb = snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
      // Merge with cache
      const map = new Map<string, Student>();
      cached.forEach(s => map.set(s.id, s));
      fromDb.forEach(s => map.set(s.id, s));
      const mergedAll = Array.from(map.values());
      saveCache(KEY_STUDENTS, mergedAll);
      return mergedAll.filter(s => s.caUid === caUid);
    }
  } catch (error) {
    console.warn('Firestore getStudentsForCA fallback to cache:', error);
  }
 
  return caStudents;
}
 
export async function addStudent(
  studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'certificateStatus'>,
  caUid: string,
  caEmail: string
): Promise<Student> {
  const currentStudents = await getStudentsForCA(caUid);
  const duplicate = currentStudents.find(
    s => s.email.toLowerCase().trim() === studentData.email.toLowerCase().trim() &&
         s.initiativeName.toLowerCase().trim() === studentData.initiativeName.toLowerCase().trim()
  );
 
  if (duplicate) {
    throw new Error(`Student with email "${studentData.email}" is already registered for "${studentData.initiativeName}".`);
  }
 
  const studentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
 
  const newStudent: Student = {
    ...studentData,
    email: studentData.email.toLowerCase().trim(),
    id: studentId,
    caUid,
    certificateStatus: 'not_issued',
    createdAt: now,
    updatedAt: now
  };
 
  // Immediate save to cache
  const cachedAll = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  saveCache(KEY_STUDENTS, [newStudent, ...cachedAll]);
 
  try {
    await setDoc(doc(db, 'students', studentId), newStudent);
  } catch (error) {
    console.warn('Firestore addStudent offline fallback:', error);
  }
 
  await logAuditEvent(caUid, caEmail, 'ca', 'STUDENT_ADDED', `Added student ${newStudent.fullName} (${newStudent.email})`, studentId);
  return newStudent;
}
 
export async function updateStudent(studentId: string, updates: Partial<Student>, caUid: string, caEmail: string): Promise<void> {
  const now = new Date().toISOString();
  const cachedAll = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  const updatedAll = cachedAll.map(s => (s.id === studentId ? { ...s, ...updates, updatedAt: now } : s));
  saveCache(KEY_STUDENTS, updatedAll);
 
  try {
    const ref = doc(db, 'students', studentId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: now
    });
  } catch (error) {
    console.warn('Firestore updateStudent offline fallback:', error);
  }
 
  await logAuditEvent(caUid, caEmail, 'ca', 'STUDENT_UPDATED', `Updated student ${studentId}`, studentId);
}
 
export async function deleteStudent(studentId: string, caUid: string, caEmail: string): Promise<void> {
  const cachedAll = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  saveCache(KEY_STUDENTS, cachedAll.filter(s => s.id !== studentId));
 
  try {
    const ref = doc(db, 'students', studentId);
    await deleteDoc(ref);
  } catch (error) {
    console.warn('Firestore deleteStudent offline fallback:', error);
  }
 
  await logAuditEvent(caUid, caEmail, 'ca', 'STUDENT_DELETED', `Deleted student record ${studentId}`, studentId);
}
 
/**
 * Bulk CSV Student Import
 */
export async function importStudentsBatch(
  studentsList: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'certificateStatus'>>,
  caUid: string,
  caEmail: string
): Promise<{ added: number; skipped: number; errors: string[] }> {
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];
 
  const currentStudents = await getStudentsForCA(caUid);
  const existingSet = new Set(currentStudents.map(s => `${s.email.toLowerCase()}_${s.initiativeName.toLowerCase()}`));
 
  for (const s of studentsList) {
    const key = `${s.email.toLowerCase().trim()}_${s.initiativeName.toLowerCase().trim()}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }
 
    try {
      await addStudent(s, caUid, caEmail);
      existingSet.add(key);
      added++;
    } catch (err: any) {
      errors.push(`${s.fullName} (${s.email}): ${err.message}`);
    }
  }
 
  return { added, skipped, errors };
}
 
/**
 * Certificate Issuance
 */
export async function issueCertificateForStudent(
  student: Student,
  ca: CampusAmbassador,
  actorEmail: string
): Promise<{ certificate: Certificate; emailResult: { success: boolean; error?: string } }> {
  // If student already has a valid certificate, retrieve it
  if (student.certificateId) {
    const cachedCerts = loadCache<Certificate[]>(KEY_CERTS, INITIAL_CERTS);
    const found = cachedCerts.find(c => c.certificateId === student.certificateId);
    if (found && found.status === 'valid') {
      const emailResult = await dispatchCertificateEmail(found, student);
      return { certificate: found, emailResult };
    }
  }
 
  const cleanCaId = (ca.caId || 'CA001').replace(/[^A-Za-z0-9]/g, '');
  const certRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
  const certificateId = `GSAP-2026-${cleanCaId}-${certRandom}`;
 
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://google-student-ambassador-2026.web.app';
  const verificationUrl = `${origin}/verify/${certificateId}`;
  const now = new Date().toISOString();
 
  const newCertificate: Certificate = {
    certificateId,
    studentId: student.id,
    studentName: student.fullName,
    initiativeName: student.initiativeName,
    semester: student.semester,
    college: student.college,
    participationDate: student.participationDate,
    caUid: ca.uid,
    caName: ca.name,
    caId: ca.caId,
    signatureUrl: ca.signatureUrl || '',
    programName: 'Google Student Ambassador Program 2026',
    status: 'valid',
    verificationUrl,
    issuedAt: now
  };
 
  // 1. Immediately cache Certificate
  const cachedCerts = loadCache<Certificate[]>(KEY_CERTS, INITIAL_CERTS);
  saveCache(KEY_CERTS, [newCertificate, ...cachedCerts]);
 
  // 2. Update Student status in cache
  const cachedStudents = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  saveCache(
    KEY_STUDENTS,
    cachedStudents.map(s => s.id === student.id ? { ...s, certificateStatus: 'issued' as const, certificateId, updatedAt: now } : s)
  );
 
  // 3. Update in Firestore
  try {
    await setDoc(doc(db, 'certificates', certificateId), newCertificate);
    await updateDoc(doc(db, 'students', student.id), {
      certificateStatus: 'issued',
      certificateId,
      updatedAt: now
    });
  } catch (err) {
    console.warn('Firestore cert issuance notice:', err);
  }
 
  // 4. Automated Email Dispatch
  const emailResult = await dispatchCertificateEmail(newCertificate, student);
 
  // 5. Audit Log
  await logAuditEvent(
    ca.uid,
    actorEmail,
    'ca',
    'CERTIFICATE_ISSUED',
    `Issued certificate ${certificateId} to ${student.fullName} (${student.email})`,
    certificateId
  );
 
  return { certificate: newCertificate, emailResult };
}
 
/**
 * Public Certificate Verification
 */
export async function getCertificateForVerification(certificateId: string): Promise<Certificate | null> {
  const cached = loadCache<Certificate[]>(KEY_CERTS, INITIAL_CERTS);
  const foundInCache = cached.find(c => c.certificateId.trim().toUpperCase() === certificateId.trim().toUpperCase());
 
  try {
    const certRef = doc(db, 'certificates', certificateId);
    const snap = await getDoc(certRef);
    if (snap.exists()) {
      const fromDb = snap.data() as Certificate;
      // Sync cache
      if (!foundInCache) {
        saveCache(KEY_CERTS, [fromDb, ...cached]);
      }
      return fromDb;
    }
  } catch (error) {
    console.warn('Error fetching verification cert from db, checking cache:', error);
  }
 
  return foundInCache || null;
}
 
function sanitizeDirectoryKey(raw: string): string {
  return raw.trim().replace(/\//g, '_');
}

async function writeCaDirectoryEntries(ca: CampusAmbassador): Promise<void> {
  const cleanCaId = ca.caId ? sanitizeDirectoryKey(ca.caId.toUpperCase()) : '';
  const cleanEmail = ca.email ? sanitizeDirectoryKey(ca.email.toLowerCase()) : '';
  const cleanGoogleEmail = ca.googleEmail ? sanitizeDirectoryKey(ca.googleEmail.toLowerCase()) : cleanEmail;

  const payload = {
    uid: ca.uid,
    caId: cleanCaId,
    email: cleanEmail,
    googleEmail: cleanGoogleEmail,
    updatedAt: new Date().toISOString()
  };

  const keys = Array.from(new Set([cleanCaId, cleanEmail, cleanGoogleEmail].filter(Boolean)));
  await Promise.all(
    keys.map(key =>
      setDoc(doc(db, 'caDirectory', key), payload, { merge: true }).catch(err => {
        console.warn(`Firestore caDirectory sync notice for ${key}:`, err);
      })
    )
  );
}

let lastCloudSyncAt = 0;

function normalizeCaRecord(ca: CampusAmbassador): { normalized: CampusAmbassador; changed: boolean } {
  const cleanEmail = (ca.email || '').toLowerCase().trim();
  const rawGoogle = (ca.googleEmail || '').toLowerCase().trim();
  // Repair truncated googleEmail caused by earlier input bug (e.g. single char without @)
  const cleanGoogleEmail = rawGoogle && rawGoogle.includes('@') ? rawGoogle : cleanEmail;
  const cleanCaId = (ca.caId || '').toUpperCase().trim();

  const changed =
    cleanEmail !== ca.email ||
    cleanGoogleEmail !== (ca.googleEmail || '') ||
    cleanCaId !== ca.caId;

  return {
    changed,
    normalized: {
      ...ca,
      email: cleanEmail,
      googleEmail: cleanGoogleEmail,
      caId: cleanCaId
    }
  };
}

async function syncCasToCloud(fromDb: CampusAmbassador[], cached: CampusAmbassador[]): Promise<{ syncedCount: number }> {
  const now = Date.now();
  if (now - lastCloudSyncAt < 3000) {
    return { syncedCount: 0 };
  }
  lastCloudSyncAt = now;

  const dbUidSet = new Set(fromDb.map(c => c.uid));
  const localOnlyCas = cached.filter(c => !dbUidSet.has(c.uid));

  const syncSingle = async (ca: CampusAmbassador, mustWriteDoc: boolean) => {
    const { normalized, changed } = normalizeCaRecord(ca);
    if (mustWriteDoc || changed) {
      await setDoc(doc(db, 'campusAmbassadors', normalized.uid), normalized, { merge: true }).catch(() => {});
    }
    await writeCaDirectoryEntries(normalized);
    await provisionCaFirebaseAuth(normalized.email, normalized.initialPassword || 'Ambassador@2026');
  };

  await Promise.all([
    ...fromDb.map(ca => syncSingle(ca, false)),
    ...localOnlyCas.map(localCa => syncSingle(localCa, true))
  ]);

  return { syncedCount: fromDb.length + localOnlyCas.length };
}

export async function syncAllCasToCloud(): Promise<{ syncedCount: number }> {
  if (!auth.currentUser || auth.currentUser.email?.toLowerCase().trim() !== 'ayushinfinity98@gmail.com') {
    throw new Error('Please connect your Super Admin Google session (ayushinfinity98@gmail.com) first so Firestore allows cloud sync.');
  }
  lastCloudSyncAt = 0;
  const snap = await getDocs(collection(db, 'campusAmbassadors'));
  const fromDb = snap.docs.map(d => ({ ...d.data(), uid: d.id } as CampusAmbassador));
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  return await syncCasToCloud(fromDb, cached);
}

async function provisionCaFirebaseAuth(email: string, password: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanPassword = password.trim();
  if (!cleanEmail || !cleanPassword || cleanPassword.length < 6) return;

  const secondaryAuth = getSecondaryAuth();
  try {
    await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
  } catch (err: any) {
    // Expected if the CA account already exists in Firebase Auth
    if (err?.code !== 'auth/email-already-in-use') {
      console.warn('Secondary Firebase Auth provisioning notice:', err?.code || err?.message);
    }
  } finally {
    try {
      await firebaseSignOut(secondaryAuth);
    } catch {
      // ignore
    }
  }
}

export async function lookupCaDirectoryByCaId(
  identifier: string
): Promise<{ uid: string; email: string; googleEmail?: string; caId?: string } | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const dirKey = sanitizeDirectoryKey(trimmed.includes('@') ? trimmed.toLowerCase() : trimmed.toUpperCase());

  try {
    const snap = await getDoc(doc(db, 'caDirectory', dirKey));
    if (snap.exists()) {
      const data = snap.data() as { uid: string; email: string; googleEmail?: string; caId?: string };
      if (data?.uid && data?.email) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Firestore lookupCaDirectoryByCaId notice:', error);
  }

  // Fallback to local cache / seed CAs
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();
  const match = cached.find(
    c =>
      c.caId?.toUpperCase().trim() === upper ||
      c.email?.toLowerCase().trim() === lower ||
      (c.googleEmail && c.googleEmail.toLowerCase().trim() === lower)
  );
  if (match) {
    return {
      uid: match.uid,
      email: match.email.toLowerCase().trim(),
      googleEmail: (match.googleEmail || match.email).toLowerCase().trim(),
      caId: match.caId.toUpperCase().trim()
    };
  }

  return null;
}

/**
 * Super Admin Management: Campus Ambassadors
 */
export async function getAllCampusAmbassadors(): Promise<CampusAmbassador[]> {
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);

  try {
    const q = query(collection(db, 'campusAmbassadors'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const fromDb = snap.docs.map(d => ({ ...d.data(), uid: d.id } as CampusAmbassador));
      const map = new Map<string, CampusAmbassador>();
      cached.forEach(c => map.set(c.uid, c));
      fromDb.forEach(c => map.set(c.uid, c));
      const merged = Array.from(map.values());
      saveCache(KEY_CAS, merged);

      // If Super Admin is signed in, lazily keep caDirectory synced for existing CAs
      if (auth.currentUser?.email?.toLowerCase().trim() === 'ayushinfinity98@gmail.com') {
        void Promise.all(fromDb.map(ca => writeCaDirectoryEntries(ca))).catch(() => {});
      }

      return merged;
    }
  } catch (error) {
    console.warn('Firestore getAllCampusAmbassadors fallback to cache:', error);
  }

  return cached;
}

/**
 * Login-time lookup: finds ONLY the CA whose Google email or primary email matches.
 * Uses where() queries + caDirectory fallback so Firestore rules allow it for a signed-in CA
 * without exposing the whole collection.
 */
export async function getCampusAmbassadorByGoogleEmail(email: string): Promise<CampusAmbassador | null> {
  const emailLower = email.toLowerCase().trim();
  if (!emailLower) return null;

  let snapGoogle;
  try {
    const qGoogle = query(collection(db, 'campusAmbassadors'), where('googleEmail', '==', emailLower));
    snapGoogle = await getDocs(qGoogle);
  } catch (err: any) {
    console.error('Firestore getCampusAmbassadorByGoogleEmail (googleEmail) error:', err?.code, err?.message, err);
    throw err;
  }

  if (!snapGoogle.empty) {
    const d = snapGoogle.docs[0];
    return { ...d.data(), uid: d.id } as CampusAmbassador;
  }

  let fallbackErr: any = null;

  try {
    const qEmail = query(collection(db, 'campusAmbassadors'), where('email', '==', emailLower));
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) {
      const d = snapEmail.docs[0];
      return { ...d.data(), uid: d.id } as CampusAmbassador;
    }
  } catch (err: any) {
    console.error('Firestore getCampusAmbassadorByGoogleEmail (email) error:', err?.code, err?.message, err);
    fallbackErr = err;
  }

  try {
    // Fallback via caDirectory exact key lookup
    const dirEntry = await lookupCaDirectoryByCaId(emailLower);
    if (dirEntry?.uid) {
      const docSnap = await getDoc(doc(db, 'campusAmbassadors', dirEntry.uid));
      if (docSnap.exists()) {
        return { ...docSnap.data(), uid: docSnap.id } as CampusAmbassador;
      }
    }
  } catch (err: any) {
    console.error('Firestore getCampusAmbassadorByGoogleEmail (caDirectory) error:', err?.code, err?.message, err);
    fallbackErr = fallbackErr || err;
  }

  if (fallbackErr) {
    throw fallbackErr;
  }

  // Fallback: local cache (only helps on the device where the CA was created)
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  const cachedMatch =
    cached.find(
      c =>
        c.email?.toLowerCase().trim() === emailLower ||
        (c.googleEmail && c.googleEmail.toLowerCase().trim() === emailLower)
    ) || null;

  if (!cachedMatch) {
    console.error('Firestore CA lookup returned 0 matching documents:', {
      queriedEmail: emailLower,
      databaseId: ACTIVE_FIRESTORE_DB_ID
    });
  }

  return cachedMatch;
}

export async function createCampusAmbassadorAccount(
  caData: Omit<CampusAmbassador, 'createdAt' | 'updatedAt' | 'totalStudents' | 'totalCertificates'>,
  adminUid: string,
  adminEmail: string
): Promise<CampusAmbassador> {
  const uid = caData.uid || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const normalizedEmail = caData.email.toLowerCase().trim();
  const normalizedGoogleEmail = (caData.googleEmail || caData.email).toLowerCase().trim();
  const normalizedCaId = caData.caId.toUpperCase().trim();

  const defaultPermissions = caData.permissions || {
    canIssueCertificates: true,
    canImportCsv: true,
    canEditStudents: true,
    canSendEmails: true
  };

  const newCA: CampusAmbassador = {
    ...caData,
    uid,
    caId: normalizedCaId,
    email: normalizedEmail,
    status: caData.status || 'active',
    allowGoogleLogin: caData.allowGoogleLogin !== false,
    googleEmail: normalizedGoogleEmail,
    permissions: defaultPermissions,
    totalStudents: 0,
    totalCertificates: 0,
    createdAt: now,
    updatedAt: now
  };

  // Immediate cache save
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  saveCache(KEY_CAS, [newCA, ...cached]);

  try {
    await setDoc(doc(db, 'campusAmbassadors', uid), newCA);
    await writeCaDirectoryEntries(newCA);
  } catch (error) {
    console.warn('Firestore createCampusAmbassadorAccount notice:', error);
  }

  // Provision Firebase Auth email/password account without affecting current Admin session
  await provisionCaFirebaseAuth(normalizedEmail, newCA.initialPassword || 'Ambassador@2026');

  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CA_ACCOUNT_CREATED',
    `Created Campus Ambassador account ${newCA.name} (${newCA.caId}, ${newCA.email})`,
    uid
  );
  return newCA;
}

export async function updateCampusAmbassador(
  caUid: string,
  updates: Partial<CampusAmbassador>,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const now = new Date().toISOString();
  const normalizedUpdates: Partial<CampusAmbassador> = { ...updates };
  if (typeof normalizedUpdates.email === 'string') {
    normalizedUpdates.email = normalizedUpdates.email.toLowerCase().trim();
  }
  if (typeof normalizedUpdates.googleEmail === 'string') {
    normalizedUpdates.googleEmail = normalizedUpdates.googleEmail.toLowerCase().trim();
  }
  if (typeof normalizedUpdates.caId === 'string') {
    normalizedUpdates.caId = normalizedUpdates.caId.toUpperCase().trim();
  }

  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  let mergedCA: CampusAmbassador | null = null;
  saveCache(
    KEY_CAS,
    cached.map(c => {
      if (c.uid === caUid) {
        mergedCA = { ...c, ...normalizedUpdates, updatedAt: now };
        return mergedCA;
      }
      return c;
    })
  );

  try {
    const ref = doc(db, 'campusAmbassadors', caUid);
    await updateDoc(ref, {
      ...normalizedUpdates,
      updatedAt: now
    });

    if (!mergedCA) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        mergedCA = { ...snap.data(), uid: snap.id } as CampusAmbassador;
      }
    }

    if (mergedCA) {
      await writeCaDirectoryEntries(mergedCA);
      if (normalizedUpdates.email || normalizedUpdates.initialPassword) {
        await provisionCaFirebaseAuth(mergedCA.email, mergedCA.initialPassword || 'Ambassador@2026');
      }
    }
  } catch (error) {
    console.warn('Firestore updateCampusAmbassador notice:', error);
  }

  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CA_ACCOUNT_UPDATED',
    `Updated CA ${caUid} details: ${Object.keys(normalizedUpdates).join(', ')}`,
    caUid
  );
}
 
export async function updateCampusAmbassadorSignature(
  caUid: string,
  signatureDataUrl: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const now = new Date().toISOString();
  const cached = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  saveCache(
    KEY_CAS,
    cached.map(c => c.uid === caUid ? { ...c, signatureUrl: signatureDataUrl, signatureUpdatedAt: now, updatedAt: now } : c)
  );
 
  try {
    const ref = doc(db, 'campusAmbassadors', caUid);
    await updateDoc(ref, {
      signatureUrl: signatureDataUrl,
      signatureUpdatedAt: now,
      updatedAt: now
    });
  } catch (error) {
    console.warn('Firestore updateCampusAmbassadorSignature notice:', error);
  }
 
  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CA_SIGNATURE_UPDATED',
    `Updated e-signature image for Campus Ambassador ${caUid}`,
    caUid
  );
}
 
/**
 * Super Admin Metrics & Audit Logs
 */
export async function getAdminSystemMetrics() {
  const cas = loadCache<CampusAmbassador[]>(KEY_CAS, INITIAL_CAS);
  const students = loadCache<Student[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  const certs = loadCache<Certificate[]>(KEY_CERTS, INITIAL_CERTS);
  const logs = loadCache<EmailLog[]>(KEY_EMAIL_LOGS, []);
 
  try {
    const [casSnap, studentsSnap, certsSnap, logsSnap] = await Promise.all([
      getDocs(collection(db, 'campusAmbassadors')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'certificates')),
      getDocs(collection(db, 'emailLogs'))
    ]);
 
    const finalCAs = Math.max(cas.length, casSnap.size);
    const finalStudents = Math.max(students.length, studentsSnap.size);
    const finalCerts = Math.max(certs.length, certsSnap.size);
    const activeCAs = cas.filter(c => c.status === 'active').length;
 
    const emailLogs = logsSnap.empty ? logs : logsSnap.docs.map(d => d.data() as EmailLog);
    const successfulEmails = emailLogs.filter(l => l.status === 'sent' || l.status === 'delivered').length;
    const failedEmails = emailLogs.filter(l => l.status === 'failed').length;
 
    return {
      totalCAs: finalCAs,
      activeCAs,
      totalStudents: finalStudents,
      totalCertificates: finalCerts,
      successfulEmails: Math.max(successfulEmails, certs.length),
      failedEmails
    };
  } catch (error) {
    console.warn('Using cache for metrics calculation:', error);
    return {
      totalCAs: cas.length,
      activeCAs: cas.filter(c => c.status === 'active').length,
      totalStudents: students.length,
      totalCertificates: certs.length,
      successfulEmails: certs.length,
      failedEmails: 0
    };
  }
}
 
export async function getAuditLogsList(maxCount = 200): Promise<AuditLog[]> {
  const cached = loadCache<AuditLog[]>(KEY_AUDIT, []);
 
  try {
    const q = query(collection(db, 'auditLogs'), limit(maxCount));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const fromDb = snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
      const map = new Map<string, AuditLog>();
      cached.forEach(l => map.set(l.id, l));
      fromDb.forEach(l => map.set(l.id, l));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      saveCache(KEY_AUDIT, merged);
      return merged.slice(0, maxCount);
    }
  } catch (error) {
    console.warn('Error fetching audit logs from firestore:', error);
  }
 
  return cached.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, maxCount);
}
 
export async function logCAStatusChange(
  caUid: string,
  caName: string,
  newStatus: 'active' | 'deactivated' | 'suspended',
  adminUid: string,
  adminEmail: string
): Promise<void> {
  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'CA_STATUS_CHANGED',
    `Updated Campus Ambassador ${caName} status to "${newStatus.toUpperCase()}"`,
    caUid
  );
}
 
export async function logEmailTemplateChange(
  subject: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  await logAuditEvent(
    adminUid,
    adminEmail,
    'admin',
    'EMAIL_TEMPLATE_UPDATED',
    `Modified central certificate email template. Subject: "${subject.substring(0, 60)}"`,
    'default_certificate'
  );
}
 
export async function getEmailLogsForCA(caUid: string): Promise<EmailLog[]> {
  const cached = loadCache<EmailLog[]>(KEY_EMAIL_LOGS, []);
  let caLogs = cached.filter(l => l.caUid === caUid);
 
  try {
    const q = query(collection(db, 'emailLogs'), where('caUid', '==', caUid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const fromDb = snap.docs.map(d => d.data() as EmailLog);
      return fromDb;
    }
  } catch (error) {
    console.warn('Error fetching CA email logs from db:', error);
  }
 
  return caLogs;
}
 
