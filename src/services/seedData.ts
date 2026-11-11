import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CampusAmbassador, Student, AuditLog } from '../types';
import { generateScriptSignatureDataUrl } from '../utils/signatureUtils';

export async function checkAndSeedDemoDataIfEmpty(): Promise<boolean> {
  try {
    const caSnap = await getDocs(collection(db, 'campusAmbassadors'));
    const auditSnap = await getDocs(collection(db, 'auditLogs'));

    // If audit logs are empty, seed historical audit events
    if (auditSnap.empty) {
      const now = Date.now();
      const historicalLogs: AuditLog[] = [
        {
          id: `audit_seed_01`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'EMAIL_TEMPLATE_UPDATED',
          details: 'Updated central official email template body with participation date and dynamic signature notice.',
          targetId: 'default_certificate',
          timestamp: new Date(now - 1000 * 60 * 60 * 36).toISOString() // 36 hours ago
        },
        {
          id: `audit_seed_02`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'CA_ACCOUNT_CREATED',
          details: 'Created Campus Ambassador account for Priya Sharma (Stanford University, Assigned ID: CA-2026-001).',
          targetId: 'ca_demo_stanford_001',
          timestamp: new Date(now - 1000 * 60 * 60 * 30).toISOString() // 30 hours ago
        },
        {
          id: `audit_seed_03`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'CA_SIGNATURE_UPDATED',
          details: 'Uploaded and verified official cursive digital e-signature image for Ambassador Priya Sharma.',
          targetId: 'ca_demo_stanford_001',
          timestamp: new Date(now - 1000 * 60 * 60 * 28).toISOString() // 28 hours ago
        },
        {
          id: `audit_seed_04`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'CA_ACCOUNT_CREATED',
          details: 'Created Campus Ambassador account for Marcus Vance (MIT, Assigned ID: CA-2026-002).',
          targetId: 'ca_demo_mit_002',
          timestamp: new Date(now - 1000 * 60 * 60 * 24).toISOString() // 24 hours ago
        },
        {
          id: `audit_seed_05`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'CA_SIGNATURE_UPDATED',
          details: 'Verified and applied authorized e-signature for Ambassador Marcus Vance.',
          targetId: 'ca_demo_mit_002',
          timestamp: new Date(now - 1000 * 60 * 60 * 22).toISOString() // 22 hours ago
        },
        {
          id: `audit_seed_06`,
          actorUid: 'ca_demo_stanford_001',
          actorEmail: 'priya.sharma@stanford.edu',
          actorRole: 'ca',
          action: 'STUDENTS_BATCH_IMPORTED',
          details: 'Imported 12 participant records via CSV for "Google Cloud & Gemini AI Study Jam 2026".',
          targetId: 'cohort_stanford_01',
          timestamp: new Date(now - 1000 * 60 * 60 * 18).toISOString() // 18 hours ago
        },
        {
          id: `audit_seed_07`,
          actorUid: 'ca_demo_stanford_001',
          actorEmail: 'priya.sharma@stanford.edu',
          actorRole: 'ca',
          action: 'CERTIFICATE_ISSUED',
          details: 'Issued official verified certificate GSAP-2026-CA001-ELN72 to Elena Rostova (elena.rostova@stanford.edu).',
          targetId: 'GSAP-2026-CA001-ELN72',
          timestamp: new Date(now - 1000 * 60 * 60 * 12).toISOString() // 12 hours ago
        },
        {
          id: `audit_seed_08`,
          actorUid: 'ca_demo_stanford_001',
          actorEmail: 'priya.sharma@stanford.edu',
          actorRole: 'ca',
          action: 'CERTIFICATE_ISSUED',
          details: 'Issued official verified certificate GSAP-2026-CA001-LM831 to Liam Chen (liam.chen@stanford.edu).',
          targetId: 'GSAP-2026-CA001-LM831',
          timestamp: new Date(now - 1000 * 60 * 60 * 10).toISOString() // 10 hours ago
        },
        {
          id: `audit_seed_09`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'EMAIL_TEMPLATE_UPDATED',
          details: 'Updated central email footer text to enforce automated cryptographic QR code validation statement.',
          targetId: 'default_certificate',
          timestamp: new Date(now - 1000 * 60 * 60 * 6).toISOString() // 6 hours ago
        },
        {
          id: `audit_seed_10`,
          actorUid: 'ca_demo_mit_002',
          actorEmail: 'marcus.vance@mit.edu',
          actorRole: 'ca',
          action: 'CERTIFICATE_ISSUED',
          details: 'Issued official verified certificate GSAP-2026-CA002-KIM94 to David Kim (david.kim@mit.edu).',
          targetId: 'GSAP-2026-CA002-KIM94',
          timestamp: new Date(now - 1000 * 60 * 60 * 3).toISOString() // 3 hours ago
        },
        {
          id: `audit_seed_11`,
          actorUid: 'admin_master_001',
          actorEmail: 'ayushinfinity98@gmail.com',
          actorRole: 'admin',
          action: 'CA_STATUS_CHANGED',
          details: 'Activated Campus Ambassador account for Priya Sharma following orientation review.',
          targetId: 'ca_demo_stanford_001',
          timestamp: new Date(now - 1000 * 60 * 30).toISOString() // 30 mins ago
        }
      ];

      for (const log of historicalLogs) {
        await setDoc(doc(db, 'auditLogs', log.id), log);
      }
    }

    if (!caSnap.empty) {
      return false; // CA data already exists
    }

    // Seed 2 initial Campus Ambassadors
    const ca1Uid = 'ca_demo_stanford_001';
    const ca1: CampusAmbassador = {
      uid: ca1Uid,
      caId: 'CA-2026-001',
      name: 'Priya Sharma',
      email: 'priya.sharma@stanford.edu',
      college: 'Stanford University',
      phone: '+1 650-723-2300',
      status: 'active',
      signatureUrl: generateScriptSignatureDataUrl('Priya Sharma'),
      signatureUpdatedAt: new Date().toISOString(),
      initialPassword: 'Ambassador@Priya26',
      totalStudents: 4,
      totalCertificates: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ca2Uid = 'ca_demo_mit_002';
    const ca2: CampusAmbassador = {
      uid: ca2Uid,
      caId: 'CA-2026-002',
      name: 'Marcus Vance',
      email: 'marcus.vance@mit.edu',
      college: 'Massachusetts Institute of Technology',
      phone: '+1 617-253-1000',
      status: 'active',
      signatureUrl: generateScriptSignatureDataUrl('Marcus Vance'),
      signatureUpdatedAt: new Date().toISOString(),
      initialPassword: 'Ambassador@Marcus26',
      totalStudents: 3,
      totalCertificates: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'campusAmbassadors', ca1Uid), ca1);
    await setDoc(doc(db, 'campusAmbassadors', ca2Uid), ca2);

    // Seed students for CA 1
    const studentsCA1: Student[] = [
      {
        id: 'stu_demo_101',
        caUid: ca1Uid,
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
        caUid: ca1Uid,
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
        caUid: ca1Uid,
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
      }
    ];

    for (const s of studentsCA1) {
      await setDoc(doc(db, 'students', s.id), s);
    }

    return true;
  } catch (error) {
    console.warn('Demo data seeding error:', error);
    return false;
  }
}
