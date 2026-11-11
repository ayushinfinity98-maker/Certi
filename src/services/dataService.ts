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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Student, Certificate, CampusAmbassador, EmailLog, AuditLog } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { dispatchCertificateEmail } from './emailService';

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
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      actorUid,
      actorEmail: actorEmail || 'system@google.com',
      actorRole,
      action,
      details,
      targetId: targetId || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Could not record audit log:', error);
  }
}

/**
 * CA Student Management
 */
export async function getStudentsForCA(caUid: string): Promise<Student[]> {
  try {
    const q = query(collection(db, 'students'), where('caUid', '==', caUid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }
}

export async function addStudent(studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'certificateStatus'>, caUid: string, caEmail: string): Promise<Student> {
  // Prevent duplicate student in same initiative for this CA
  const existingQ = query(
    collection(db, 'students'),
    where('caUid', '==', caUid),
    where('email', '==', studentData.email.toLowerCase().trim())
  );
  const existingSnap = await getDocs(existingQ);
  const duplicate = existingSnap.docs.find(d => {
    const data = d.data();
    return data.initiativeName.toLowerCase() === studentData.initiativeName.toLowerCase();
  });

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

  try {
    await setDoc(doc(db, 'students', studentId), newStudent);
    await logAuditEvent(caUid, caEmail, 'ca', 'STUDENT_ADDED', `Added student ${newStudent.fullName} (${newStudent.email})`, studentId);
    return newStudent;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `students/${studentId}`);
  }
}

export async function updateStudent(studentId: string, updates: Partial<Student>, caUid: string, caEmail: string): Promise<void> {
  try {
    const ref = doc(db, 'students', studentId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await logAuditEvent(caUid, caEmail, 'ca', 'STUDENT_UPDATED', `Updated student ${studentId}`, studentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
  }
}

export async function deleteStudent(studentId: string, caUid: string, caEmail: string): Promise<void> {
  try {
    const ref = doc(db, 'students', studentId);
    await deleteDoc(ref);
    await logAuditEvent(caUid, caEmail, 'ca', 'STUDENT_DELETED', `Deleted student record ${studentId}`, studentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
  }
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

  // Fetch current students of CA to detect duplicates fast
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
    const certRef = doc(db, 'certificates', student.certificateId);
    const snap = await getDoc(certRef);
    if (snap.exists() && snap.data().status === 'valid') {
      const existingCert = snap.data() as Certificate;
      // Re-dispatch email if requested
      const emailResult = await dispatchCertificateEmail(existingCert, student);
      return { certificate: existingCert, emailResult };
    }
  }

  // Generate unique certificate ID: GSAP-2026-[CA_ID]-[RANDOM]
  const cleanCaId = (ca.caId || 'CA001').replace(/[^A-Za-z0-9]/g, '');
  const certRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
  const certificateId = `GSAP-2026-${cleanCaId}-${certRandom}`;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://google-student-ambassador-2026.web.app';
  const verificationUrl = `${origin}/verify/${certificateId}`;
  const now = new Date().toISOString();

  // Create Certificate record (SNAPSHOT of CA signature at moment of issuance)
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

  try {
    // 1. Save certificate
    await setDoc(doc(db, 'certificates', certificateId), newCertificate);

    // 2. Update student status
    await updateDoc(doc(db, 'students', student.id), {
      certificateStatus: 'issued',
      certificateId,
      updatedAt: now
    });

    // 3. Automated Email Dispatch
    const emailResult = await dispatchCertificateEmail(newCertificate, student);

    // 4. Audit Log
    await logAuditEvent(
      ca.uid,
      actorEmail,
      'ca',
      'CERTIFICATE_ISSUED',
      `Issued certificate ${certificateId} to ${student.fullName} (${student.email})`,
      certificateId
    );

    return { certificate: newCertificate, emailResult };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `certificates/${certificateId}`);
  }
}

/**
 * Public Certificate Verification
 */
export async function getCertificateForVerification(certificateId: string): Promise<Certificate | null> {
  try {
    const certRef = doc(db, 'certificates', certificateId);
    const snap = await getDoc(certRef);
    if (!snap.exists()) return null;
    return snap.data() as Certificate;
  } catch (error) {
    console.error('Error fetching verification cert:', error);
    return null;
  }
}

/**
 * Super Admin Management: Campus Ambassadors
 */
export async function getAllCampusAmbassadors(): Promise<CampusAmbassador[]> {
  try {
    const q = query(collection(db, 'campusAmbassadors'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), uid: d.id } as CampusAmbassador));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'campusAmbassadors');
  }
}

export async function createCampusAmbassadorAccount(
  caData: Omit<CampusAmbassador, 'createdAt' | 'updatedAt' | 'totalStudents' | 'totalCertificates'>,
  adminUid: string,
  adminEmail: string
): Promise<CampusAmbassador> {
  const uid = caData.uid || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newCA: CampusAmbassador = {
    ...caData,
    uid,
    status: caData.status || 'active',
    totalStudents: 0,
    totalCertificates: 0,
    createdAt: now,
    updatedAt: now
  };

  try {
    await setDoc(doc(db, 'campusAmbassadors', uid), newCA);
    await logAuditEvent(
      adminUid,
      adminEmail,
      'admin',
      'CA_ACCOUNT_CREATED',
      `Created Campus Ambassador account ${newCA.name} (${newCA.caId}, ${newCA.email})`,
      uid
    );
    return newCA;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `campusAmbassadors/${uid}`);
  }
}

export async function updateCampusAmbassador(
  caUid: string,
  updates: Partial<CampusAmbassador>,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  try {
    const ref = doc(db, 'campusAmbassadors', caUid);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await logAuditEvent(
      adminUid,
      adminEmail,
      'admin',
      'CA_ACCOUNT_UPDATED',
      `Updated CA ${caUid} details: ${Object.keys(updates).join(', ')}`,
      caUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campusAmbassadors/${caUid}`);
  }
}

export async function updateCampusAmbassadorSignature(
  caUid: string,
  signatureDataUrl: string,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  try {
    const ref = doc(db, 'campusAmbassadors', caUid);
    const now = new Date().toISOString();
    await updateDoc(ref, {
      signatureUrl: signatureDataUrl,
      signatureUpdatedAt: now,
      updatedAt: now
    });
    await logAuditEvent(
      adminUid,
      adminEmail,
      'admin',
      'CA_SIGNATURE_UPDATED',
      `Updated e-signature image for Campus Ambassador ${caUid}`,
      caUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campusAmbassadors/${caUid}`);
  }
}

/**
 * Super Admin Metrics & Audit Logs
 */
export async function getAdminSystemMetrics() {
  try {
    const [casSnap, studentsSnap, certsSnap, logsSnap] = await Promise.all([
      getDocs(collection(db, 'campusAmbassadors')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'certificates')),
      getDocs(collection(db, 'emailLogs'))
    ]);

    const cas = casSnap.docs.map(d => d.data() as CampusAmbassador);
    const activeCAs = cas.filter(c => c.status === 'active').length;
    
    const logs = logsSnap.docs.map(d => d.data() as EmailLog);
    const successfulEmails = logs.filter(l => l.status === 'sent' || l.status === 'delivered').length;
    const failedEmails = logs.filter(l => l.status === 'failed').length;

    return {
      totalCAs: cas.length,
      activeCAs,
      totalStudents: studentsSnap.size,
      totalCertificates: certsSnap.size,
      successfulEmails,
      failedEmails
    };
  } catch (error) {
    console.error('Error getting admin metrics:', error);
    return {
      totalCAs: 0,
      activeCAs: 0,
      totalStudents: 0,
      totalCertificates: 0,
      successfulEmails: 0,
      failedEmails: 0
    };
  }
}

export async function getAuditLogsList(maxCount = 200): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'auditLogs'), limit(maxCount));
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
    // Sort descending by timestamp
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
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
  try {
    const q = query(collection(db, 'emailLogs'), where('caUid', '==', caUid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as EmailLog);
  } catch (error) {
    console.error('Error fetching CA email logs:', error);
    return [];
  }
}
