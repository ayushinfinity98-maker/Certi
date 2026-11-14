import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Award, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Shield, 
  Edit, 
  Key, 
  Eye, 
  FileText, 
  RefreshCw, 
  MoreVertical,
  ExternalLink,
  ChevronRight,
  School,
  Database,
  Palette,
  Copy,
  Check,
  Chrome,
  Send,
  Trash2,
  Crown,
  Sliders
} from 'lucide-react';
import { CampusAmbassador, Certificate, EmailLog, AuditLog, Student } from '../types';
import { 
  getAllCampusAmbassadors, 
  createCampusAmbassadorAccount, 
  updateCampusAmbassador, 
  updateCampusAmbassadorSignature, 
  getAdminSystemMetrics,
  getAuditLogsList,
  getStudentsForCA,
  logCAStatusChange,
  subscribeToAllCampusAmbassadors,
  subscribeToCertificates,
  syncAllCasToCloud,
  checkCaUsageForDeletion,
  deleteCampusAmbassador,
  subscribeToAllStudents,
  deleteStudentsBulkByAdmin
} from '../services/dataService';
import { CaModal } from './CaModal';
import { SignatureModal } from './SignatureModal';
import { EmailTemplateManager } from './EmailTemplateManager';
import { CertificateTemplate } from './CertificateTemplate';
import { CertificateDesigner } from './CertificateDesigner';
import { MainCaFormBuilder } from './MainCaFormBuilder';
import { PlaceholderRoleManager } from './PlaceholderRoleManager';
import { AuditLogsView } from './AuditLogsView';
import { checkAndSeedDemoDataIfEmpty } from '../services/seedData';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { retryEmailDispatch } from '../services/emailService';
import { MAIN_ADMIN_EMAIL } from '../services/googleWorkspaceAuth';

interface AdminDashboardProps {
  adminUid: string;
  adminEmail: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUid, adminEmail }) => {
  const { isAdminGmailConnected, connectAdminGmail, isCloudAuthenticated, connectCloudAdminSession } = useAuth();
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncNotice, setCloudSyncNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cas' | 'students' | 'designer' | 'forms_roles' | 'templates' | 'certificates' | 'audit'>('cas');
  const [cas, setCas] = useState<CampusAmbassador[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [metrics, setMetrics] = useState({
    totalCAs: 0,
    activeCAs: 0,
    totalStudents: 0,
    totalCertificates: 0,
    successfulEmails: 0,
    failedEmails: 0
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allCertificates, setAllCertificates] = useState<Certificate[]>([]);
  const [allEmailLogs, setAllEmailLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter (CAs)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated' | 'suspended'>('all');

  // Search, Filter & Selection (All Students)
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentCaFilter, setStudentCaFilter] = useState<string>('all');
  const [studentCertFilter, setStudentCertFilter] = useState<'all' | 'issued' | 'not_issued'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Modals state
  const [isCaModalOpen, setIsCaModalOpen] = useState(false);
  const [editingCa, setEditingCa] = useState<CampusAmbassador | null>(null);
  const [selectedCaForSig, setSelectedCaForSig] = useState<CampusAmbassador | null>(null);
  const [credentialsModalCa, setCredentialsModalCa] = useState<CampusAmbassador | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [inspectingCert, setInspectingCert] = useState<Certificate | null>(null);
  const [inspectingCaStudents, setInspectingCaStudents] = useState<{ ca: CampusAmbassador; students: Student[] } | null>(null);
  const [dispatchingLogId, setDispatchingLogId] = useState<string | null>(null);
  const [isDispatchingAll, setIsDispatchingAll] = useState(false);
  const [dispatchNotice, setDispatchNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [deletingCaState, setDeletingCaState] = useState<{
    ca: CampusAmbassador;
    checking: boolean;
    studentCount: number;
    certCount: number;
    deleteAssociatedRecords: boolean;
    error: string | null;
    isDeleting: boolean;
  } | null>(null);
  const [deletingStudentsState, setDeletingStudentsState] = useState<{
    students: Student[];
    deleteCertificate: boolean;
    error: string | null;
    isDeleting: boolean;
  } | null>(null);

  const loadData = async () => {
    try {
      await checkAndSeedDemoDataIfEmpty();

      const [loadedMetrics, logs, emailLogsSnap] = await Promise.all([
        getAdminSystemMetrics(),
        getAuditLogsList(40),
        getDocs(collection(db, 'emailLogs'))
      ]);

      setMetrics(loadedMetrics);
      setAuditLogs(logs);
      setAllEmailLogs(emailLogsSnap.docs.map(d => d.data() as EmailLog));
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();

    // Real-time listener for Campus Ambassadors
    const unsubCas = subscribeToAllCampusAmbassadors((updatedCas) => {
      setCas(updatedCas);
      setIsLoading(false);
    });

    // Real-time listener for Certificates
    const unsubCerts = subscribeToCertificates((updatedCerts) => {
      setAllCertificates(updatedCerts);
    });

    // Real-time listener for all Students across all CAs
    const unsubStudents = subscribeToAllStudents((updatedStudents) => {
      setAllStudents(updatedStudents);
      setStudentsLoaded(true);
    });

    return () => {
      unsubCas();
      unsubCerts();
      unsubStudents();
    };
  }, []);

  const handleSaveCa = async (data: any) => {
    if (editingCa) {
      await updateCampusAmbassador(editingCa.uid, data, adminUid, adminEmail);
    } else {
      await createCampusAmbassadorAccount(data, adminUid, adminEmail);
    }
    if (!isCloudAuthenticated) {
      setCloudSyncNotice(
        `Saved ${data.name} locally, but Cloud Sync is inactive. Click "Connect Cloud Admin & Sync CAs" above so this Ambassador can log in from other devices.`
      );
    } else {
      setCloudSyncNotice(`Synced ${data.name} (${data.caId}) to Firebase Cloud & Auth.`);
    }
    await loadData();
  };

  const handleSaveSignature = async (sigUrl: string) => {
    if (!selectedCaForSig) return;
    await updateCampusAmbassadorSignature(selectedCaForSig.uid, sigUrl, adminUid, adminEmail);
    setSelectedCaForSig(null);
    await loadData();
  };

  const handleToggleStatus = async (ca: CampusAmbassador) => {
    const nextStatus = ca.status === 'active' ? 'suspended' : 'active';
    await updateCampusAmbassador(ca.uid, { status: nextStatus }, adminUid, adminEmail);
    await logCAStatusChange(ca.uid, ca.name, nextStatus, adminUid, adminEmail);
    await loadData();
  };

  const handleToggleCaTier = async (ca: CampusAmbassador) => {
    const nextRole = ca.caRole === 'main_ca' ? 'ca' : 'main_ca';
    await updateCampusAmbassador(ca.uid, { caRole: nextRole }, adminUid, adminEmail);
    setCloudSyncNotice(
      `Updated ${ca.name} (${ca.caId}) tier to ${nextRole === 'main_ca' ? 'Main CA (Lead)' : 'Standard CA'}.`
    );
    await loadData();
  };

  const handleViewCaStudents = async (ca: CampusAmbassador) => {
    const students = await getStudentsForCA(ca.uid);
    setInspectingCaStudents({ ca, students });
  };

  const handleOpenDeleteCa = async (ca: CampusAmbassador) => {
    setDeletingCaState({
      ca,
      checking: true,
      studentCount: 0,
      certCount: 0,
      deleteAssociatedRecords: false,
      error: null,
      isDeleting: false
    });
    try {
      const usage = await checkCaUsageForDeletion(ca.uid);
      setDeletingCaState(prev =>
        prev && prev.ca.uid === ca.uid
          ? { ...prev, checking: false, studentCount: usage.studentCount, certCount: usage.certCount }
          : prev
      );
    } catch (err: any) {
      setDeletingCaState(prev =>
        prev && prev.ca.uid === ca.uid
          ? { ...prev, checking: false, error: err?.message || 'Could not verify CA usage.' }
          : prev
      );
    }
  };

  const handleConfirmDeleteCa = async () => {
    if (!deletingCaState) return;
    const targetCa = deletingCaState.ca;
    const deleteAssociatedRecords = deletingCaState.deleteAssociatedRecords;
    setDeletingCaState(prev => (prev ? { ...prev, isDeleting: true, error: null } : null));
    try {
      await deleteCampusAmbassador(targetCa, adminUid, adminEmail, { deleteAssociatedRecords });
      setCas(prev => prev.filter(c => c.uid !== targetCa.uid));
      setDeletingCaState(null);
      setCloudSyncNotice(
        `Deleted Campus Ambassador account ${targetCa.name} (${targetCa.caId})${
          deleteAssociatedRecords ? ' and its associated records' : ''
        }.`
      );
      await loadData();
    } catch (err: any) {
      setDeletingCaState(prev =>
        prev ? { ...prev, isDeleting: false, error: err?.message || 'Failed to delete CA account.' } : null
      );
    }
  };

  const handleOpenDeleteStudents = (studentsToDelete: Student[]) => {
    if (studentsToDelete.length === 0) return;
    setDeletingStudentsState({
      students: studentsToDelete,
      deleteCertificate: false,
      error: null,
      isDeleting: false
    });
  };

  const handleConfirmDeleteStudents = async () => {
    if (!deletingStudentsState) return;
    const targets = deletingStudentsState.students;
    const deleteCertificate = deletingStudentsState.deleteCertificate;
    setDeletingStudentsState(prev => (prev ? { ...prev, isDeleting: true, error: null } : null));
    try {
      await deleteStudentsBulkByAdmin(targets, adminUid, adminEmail, { deleteCertificate });
      const deletedSet = new Set(targets.map(s => s.id));
      setAllStudents(prev => prev.filter(s => !deletedSet.has(s.id)));
      setSelectedStudentIds(prev => {
        const next = new Set(prev);
        deletedSet.forEach(id => next.delete(id));
        return next;
      });
      setInspectingCaStudents(prev =>
        prev ? { ...prev, students: prev.students.filter(s => !deletedSet.has(s.id)) } : null
      );
      setDeletingStudentsState(null);
      setCloudSyncNotice(
        targets.length === 1
          ? `Deleted student ${targets[0].fullName} (${targets[0].email})${deleteCertificate && targets[0].certificateId ? ' and their issued certificate' : ''}.`
          : `Deleted ${targets.length} student records${deleteCertificate ? ' along with associated certificates' : ''}.`
      );
      await loadData();
    } catch (err: any) {
      setDeletingStudentsState(prev =>
        prev ? { ...prev, isDeleting: false, error: err?.message || 'Failed to delete student record(s).' } : null
      );
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleConnectAdminGmail = async () => {
    setIsConnectingGmail(true);
    setDispatchNotice(null);
    try {
      const res = await connectAdminGmail();
      if (res.email === MAIN_ADMIN_EMAIL.toLowerCase()) {
        setDispatchNotice({
          type: 'success',
          message: `Gmail (${MAIN_ADMIN_EMAIL}) connected! You can now send or retry certificate emails.`
        });
      } else {
        setDispatchNotice({
          type: 'error',
          message: `Signed in as ${res.email}. Please connect with ${MAIN_ADMIN_EMAIL} to send official emails.`
        });
      }
    } catch (err: any) {
      setDispatchNotice({
        type: 'error',
        message: err.message || 'Could not authorize Google account.'
      });
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleDispatchLog = async (log: EmailLog) => {
    setDispatchingLogId(log.id);
    setDispatchNotice(null);
    try {
      const certSnap = await getDoc(doc(db, 'certificates', log.certificateId));
      const studentSnap = await getDoc(doc(db, 'students', log.studentId));
      if (!certSnap.exists()) throw new Error(`Certificate ${log.certificateId} not found.`);
      const cert = certSnap.data() as Certificate;
      const student: Student = studentSnap.exists()
        ? (studentSnap.data() as Student)
        : {
            id: log.studentId,
            caUid: cert.caUid,
            caId: cert.caId,
            fullName: log.studentName || cert.studentName,
            email: log.studentEmail,
            college: cert.college,
            semester: cert.semester,
            initiativeName: cert.initiativeName,
            participationDate: cert.participationDate,
            certificateStatus: 'issued',
            certificateId: cert.certificateId,
            createdAt: cert.issuedAt,
            updatedAt: cert.issuedAt
          };

      const res = await retryEmailDispatch(log, cert, student);
      if (res.success) {
        setDispatchNotice({
          type: 'success',
          message: `Sent PDF certificate email to ${log.studentEmail} via ${MAIN_ADMIN_EMAIL}!`
        });
      } else {
        setDispatchNotice({
          type: 'error',
          message: res.error || `Failed sending email to ${log.studentEmail}.`
        });
      }
      await loadData();
    } catch (err: any) {
      setDispatchNotice({
        type: 'error',
        message: err.message || 'Email dispatch failed.'
      });
    } finally {
      setDispatchingLogId(null);
    }
  };

  const handleDispatchAllPending = async () => {
    const queue = allEmailLogs.filter(l => l.status === 'pending' || l.status === 'failed');
    if (queue.length === 0) return;
    if (!window.confirm(`Send ${queue.length} queued/failed certificate email(s) right now from ${MAIN_ADMIN_EMAIL}?`)) {
      return;
    }

    setIsDispatchingAll(true);
    setDispatchNotice(null);
    let sent = 0;
    let failed = 0;
    for (const log of queue) {
      try {
        const certSnap = await getDoc(doc(db, 'certificates', log.certificateId));
        if (!certSnap.exists()) {
          failed++;
          continue;
        }
        const cert = certSnap.data() as Certificate;
        const studentSnap = await getDoc(doc(db, 'students', log.studentId));
        const student: Student = studentSnap.exists()
          ? (studentSnap.data() as Student)
          : {
              id: log.studentId,
              caUid: cert.caUid,
              caId: cert.caId,
              fullName: log.studentName || cert.studentName,
              email: log.studentEmail,
              college: cert.college,
              semester: cert.semester,
              initiativeName: cert.initiativeName,
              participationDate: cert.participationDate,
              certificateStatus: 'issued',
              certificateId: cert.certificateId,
              createdAt: cert.issuedAt,
              updatedAt: cert.issuedAt
            };
        const res = await retryEmailDispatch(log, cert, student);
        if (res.success) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }
    await loadData();
    setIsDispatchingAll(false);
    setDispatchNotice({
      type: sent > 0 && failed === 0 ? 'success' : 'error',
      message: `Batch dispatch complete: ${sent} sent via ${MAIN_ADMIN_EMAIL}, ${failed} failed.`
    });
  };

  const pendingOrFailedLogs = allEmailLogs.filter(l => l.status === 'pending' || l.status === 'failed');

  const filteredCas = cas.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.college.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const caByUid = new Map<string, CampusAmbassador>(cas.map(c => [c.uid, c]));
  const certById = new Map<string, Certificate>(allCertificates.map(c => [c.certificateId, c]));

  const filteredAllStudents = allStudents.filter(s => {
    const q = studentSearchQuery.trim().toLowerCase();
    const caMatch = caByUid.get(s.caUid);
    const matchesSearch =
      !q ||
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.college || '').toLowerCase().includes(q) ||
      (s.initiativeName || '').toLowerCase().includes(q) ||
      (s.certificateId || '').toLowerCase().includes(q) ||
      (s.caId || '').toLowerCase().includes(q) ||
      (caMatch?.name || '').toLowerCase().includes(q);
    const matchesCa = studentCaFilter === 'all' || s.caUid === studentCaFilter || s.caId === studentCaFilter;
    const matchesCert =
      studentCertFilter === 'all' ||
      (studentCertFilter === 'issued' ? s.certificateStatus === 'issued' : s.certificateStatus !== 'issued');
    return matchesSearch && matchesCa && matchesCert;
  });

  const allFilteredSelected =
    filteredAllStudents.length > 0 && filteredAllStudents.every(s => selectedStudentIds.has(s.id));

  const toggleSelectAllFilteredStudents = () => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredAllStudents.forEach(s => next.delete(s.id));
      } else {
        filteredAllStudents.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const handleSyncCasToCloud = async () => {
    setIsSyncingCloud(true);
    setCloudSyncNotice(null);
    try {
      if (!isCloudAuthenticated) {
        await connectCloudAdminSession();
      }
      const res = await syncAllCasToCloud();
      setCloudSyncNotice(`Synced ${res.syncedCount} Campus Ambassador account(s) & login indexes to Firebase Cloud.`);
    } catch (err: any) {
      setCloudSyncNotice(err.message || 'Could not sync CAs to Firebase Cloud.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Firebase Cloud Auth Sync Warning (when Admin used Direct Login instead of Google) */}
      {!isCloudAuthenticated && (
        <div className="p-3.5 rounded-2xl border bg-red-50 border-red-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <div>
              <span className="font-bold text-red-900">Cloud Database Write Session Not Active:</span>{' '}
              <span className="text-red-800">
                New CA accounts cannot sync across browsers/devices until you authenticate once with Google ({MAIN_ADMIN_EMAIL}).
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncCasToCloud}
            disabled={isSyncingCloud}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Chrome className="w-3.5 h-3.5" />
            <span>{isSyncingCloud ? 'Connecting & Syncing...' : 'Connect Cloud Admin & Sync CAs'}</span>
          </button>
        </div>
      )}

      {cloudSyncNotice && (
        <div className="p-3 rounded-xl border bg-blue-50 border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <span>{cloudSyncNotice}</span>
          <button type="button" onClick={() => setCloudSyncNotice(null)} className="font-bold text-blue-700 ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Main Admin Gmail Connection Bar */}
      <div className={`p-3.5 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${
        isAdminGmailConnected
          ? 'bg-emerald-50/70 border-emerald-200'
          : 'bg-amber-50/80 border-amber-200'
      }`}>
        <div className="flex items-center space-x-2.5 text-xs">
          <Mail className={`w-4 h-4 shrink-0 ${isAdminGmailConnected ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div>
            <span className="font-bold text-gray-900">
              Official Gmail Dispatch ({MAIN_ADMIN_EMAIL}):
            </span>{' '}
            <span className={isAdminGmailConnected ? 'text-emerald-800 font-medium' : 'text-amber-900 font-medium'}>
              {isAdminGmailConnected
                ? 'Authorized & ready to send certificates and copy Google Slides'
                : 'Not yet authorized in this browser session'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isCloudAuthenticated && (
            <button
              type="button"
              onClick={handleSyncCasToCloud}
              disabled={isSyncingCloud}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-[11px] font-bold hover:bg-gray-50 transition flex items-center space-x-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingCloud ? 'Syncing...' : 'Sync CA Logins'}</span>
            </button>
          )}
          {pendingOrFailedLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('certificates')}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-[11px] font-bold hover:bg-amber-100 transition"
            >
              {pendingOrFailedLogs.length} Queued / Failed Email(s)
            </button>
          )}
          {!isAdminGmailConnected && (
            <button
              type="button"
              onClick={handleConnectAdminGmail}
              disabled={isConnectingGmail}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Chrome className="w-3.5 h-3.5" />
              <span>{isConnectingGmail ? 'Connecting...' : 'Authorize Admin Gmail & Slides'}</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total CAs</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.totalCAs}</p>
          <span className="text-[10px] text-emerald-600 font-medium">All registered campus ambassadors</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active CAs</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700">{metrics.activeCAs}</p>
          <span className="text-[10px] text-gray-500">Authorized to issue certs</span>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className="text-left bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs transition cursor-pointer"
          title="View all students across all campuses"
        >
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Students</span>
            <School className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {studentsLoaded ? allStudents.length : metrics.totalStudents}
          </p>
          <span className="text-[10px] text-purple-600 font-medium">View &amp; manage all &rarr;</span>
        </button>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Certificates</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{metrics.totalCertificates}</p>
          <span className="text-[10px] text-gray-500">Issued & verifiable</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Emails Sent</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700">{metrics.successfulEmails}</p>
          <span className="text-[10px] text-emerald-600">Delivered with PDF</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Failed Emails</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{metrics.failedEmails}</p>
          <span className="text-[10px] text-gray-500">Retry available</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('cas')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'cas'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Campus Ambassadors Management</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <School className="w-4 h-4" />
          <span>All Students</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === 'students' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {studentsLoaded ? allStudents.length : metrics.totalStudents}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('designer')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'designer'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Certificate Templates & Designer</span>
        </button>

        <button
          onClick={() => setActiveTab('forms_roles')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'forms_roles'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Forms &amp; Placeholder Roles</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'templates'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Template Manager</span>
        </button>

        <button
          onClick={() => setActiveTab('certificates')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'certificates'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Global Certificates & Delivery Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Audit Logs</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === 'audit' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Campus Ambassadors Management */}
      {activeTab === 'cas' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, college, email, or CA ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={loadData}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
                title="Refresh CA list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingCa(null);
                  setIsCaModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create CA Account
              </button>
            </div>
          </div>

          {/* CA Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3 px-4">Ambassador & ID</th>
                    <th className="py-3 px-4">Institution / College</th>
                    <th className="py-3 px-4">Login & Access</th>
                    <th className="py-3 px-4">Permissions</th>
                    <th className="py-3 px-4">E-Signature</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredCas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        No Campus Ambassadors found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCas.map((ca) => (
                      <tr key={ca.uid} className="hover:bg-gray-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900 flex items-center flex-wrap gap-1.5">
                            <span>{ca.name}</span>
                            {ca.caRole === 'main_ca' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <Crown className="w-2.5 h-2.5 mr-0.5" />
                                MAIN CA
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                CA
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">{ca.email}</div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {ca.caId}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          <div className="font-medium">{ca.college}</div>
                          {ca.phone && <div className="text-[11px] text-gray-400">{ca.phone}</div>}
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              Email & Pass
                            </span>
                            {ca.allowGoogleLogin !== false ? (
                              <div className="text-[10px] font-semibold text-emerald-700 flex items-center">
                                <Chrome className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                                <span>Google Sign-In</span>
                              </div>
                            ) : (
                              <span className="text-[9px] text-gray-400 block italic">Google Disabled</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ca.permissions?.canIssueCertificates !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'
                            }`} title="Issue Certificates">
                              Certs {ca.permissions?.canIssueCertificates !== false ? '✓' : '✗'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ca.permissions?.canImportCsv !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'
                            }`} title="CSV Import">
                              CSV {ca.permissions?.canImportCsv !== false ? '✓' : '✗'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ca.permissions?.canEditStudents !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'
                            }`} title="Edit Students">
                              Edit {ca.permissions?.canEditStudents !== false ? '✓' : '✗'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ca.permissions?.canSendEmails !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'
                            }`} title="Send Emails">
                              Mail {ca.permissions?.canSendEmails !== false ? '✓' : '✗'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div
                            onClick={() => setSelectedCaForSig(ca)}
                            className="cursor-pointer group flex items-center space-x-2 p-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg max-w-[150px] transition"
                            title="Click to preview or replace uploaded signature"
                          >
                            {ca.signatureUrl ? (
                              <img
                                src={ca.signatureUrl}
                                alt="Signature"
                                className="h-6 max-w-[100px] object-contain"
                              />
                            ) : (
                              <span className="text-[10px] italic text-amber-600">No signature</span>
                            )}
                            <Edit className="w-3 h-3 text-gray-400 group-hover:text-blue-600 ml-auto shrink-0" />
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ca.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              ca.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} />
                            {ca.status}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleViewCaStudents(ca)}
                            className="text-left group"
                          >
                            <span className="font-semibold text-blue-600 group-hover:underline">
                              View Records &rarr;
                            </span>
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => setCredentialsModalCa(ca)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition"
                              title="View / Reset CA Credentials"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingCa(ca);
                                setIsCaModalOpen(true);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                              title="Edit CA Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCaTier(ca)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center ${
                                ca.caRole === 'main_ca'
                                  ? 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                                  : 'border-slate-200 text-slate-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
                              }`}
                              title={ca.caRole === 'main_ca' ? 'Demote to Standard CA' : 'Promote to Main CA'}
                            >
                              <Crown className="w-3 h-3 mr-1" />
                              {ca.caRole === 'main_ca' ? 'Main CA' : 'Set Main CA'}
                            </button>
                            <button
                              onClick={() => handleToggleStatus(ca)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                ca.status === 'active'
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {ca.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteCa(ca)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete CA account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: All Students Across All CAs */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center flex-wrap gap-2.5 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Search student name, email, college, event, cert ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <select
                value={studentCaFilter}
                onChange={(e) => setStudentCaFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden max-w-[210px]"
              >
                <option value="all">All Campus Ambassadors</option>
                {cas.map(ca => (
                  <option key={ca.uid} value={ca.uid}>
                    {ca.name} ({ca.caId})
                  </option>
                ))}
              </select>

              <select
                value={studentCertFilter}
                onChange={(e: any) => setStudentCertFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">All Cert Status</option>
                <option value="issued">Issued Only</option>
                <option value="not_issued">Not Issued</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {selectedStudentIds.size > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenDeleteStudents(
                      allStudents.filter(s => selectedStudentIds.has(s.id))
                    )
                  }
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedStudentIds.size})</span>
                </button>
              )}

              <button
                type="button"
                onClick={loadData}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
                title="Refresh student records"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFilteredStudents}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        title="Select all visible students"
                      />
                    </th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">College &amp; Semester</th>
                    <th className="py-3 px-4">Initiative / Event</th>
                    <th className="py-3 px-4">Campus Ambassador</th>
                    <th className="py-3 px-4">Certificate</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredAllStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        {allStudents.length === 0
                          ? 'No students registered across the system yet.'
                          : 'No students found matching your search or filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAllStudents.map((student) => {
                      const ca = caByUid.get(student.caUid);
                      const issuedCert = student.certificateId ? certById.get(student.certificateId) : undefined;
                      const customEntries = Object.entries(student.customFields || {}).filter(([, val]) => String(val || '').trim() !== '');

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50/60 transition ${
                            selectedStudentIds.has(student.id) ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900">{student.fullName}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{student.email}</div>
                            {customEntries.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {customEntries.slice(0, 3).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-gray-700">
                            <div className="font-medium">{student.college || '—'}</div>
                            {student.semester && (
                              <div className="text-[11px] text-gray-400">{student.semester}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-gray-700">
                            <div className="font-medium max-w-[220px] truncate" title={student.initiativeName}>
                              {student.initiativeName || '—'}
                            </div>
                            {student.participationDate && (
                              <div className="text-[11px] text-gray-400">{student.participationDate}</div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-800">{ca?.name || 'Assigned CA'}</div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {student.caId || ca?.caId || student.caUid}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {student.certificateStatus === 'issued' ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Issued
                                </span>
                                {student.certificateId && (
                                  <div className="text-[10px] font-mono text-blue-600 font-semibold">
                                    {student.certificateId}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                {student.certificateStatus || 'not_issued'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {issuedCert && (
                                <button
                                  type="button"
                                  onClick={() => setInspectingCert(issuedCert)}
                                  className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                                  title="Inspect Issued Certificate"
                                >
                                  Inspect
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteStudents([student])}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete student permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Certificate Designer & Custom Templates */}
      {activeTab === 'designer' && (
        <CertificateDesigner adminUid={adminUid} adminEmail={adminEmail} />
      )}

      {/* TAB: Forms & Placeholder Roles (Admin > Main CA > CA) */}
      {activeTab === 'forms_roles' && (
        <div className="space-y-8">
          <PlaceholderRoleManager
            actorUid={adminUid}
            actorEmail={adminEmail}
            actorRole="admin"
          />
          <MainCaFormBuilder
            ca={
              cas.find(c => c.caRole === 'main_ca') ||
              cas[0] || {
                uid: adminUid,
                caId: 'ADMIN',
                caRole: 'main_ca',
                name: 'Super Admin',
                email: adminEmail,
                college: 'Campus Ambassador System',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }
            actorUid={adminUid}
            actorEmail={adminEmail}
            actorRole="admin"
            isAdminMode
          />
        </div>
      )}

      {/* TAB 2: Email Template Manager */}
      {activeTab === 'templates' && (
        <EmailTemplateManager adminUid={adminUid} adminEmail={adminEmail} />
      )}

      {/* TAB 3: Global Certificates & Delivery Logs */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          {/* Email Dispatch Queue Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center">
                  <Send className="w-4 h-4 text-blue-600 mr-2" />
                  Official Email Dispatch Logs ({allEmailLogs.length})
                </h3>
                <p className="text-xs text-gray-500">
                  All emails are sent with PDF attachment strictly from <span className="font-mono font-semibold text-gray-700">{MAIN_ADMIN_EMAIL}</span>.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {pendingOrFailedLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDispatchAllPending}
                    disabled={isDispatchingAll || !isAdminGmailConnected}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isDispatchingAll ? 'Sending Queue...' : `Send All Queued/Failed (${pendingOrFailedLogs.length})`}</span>
                  </button>
                )}
              </div>
            </div>

            {dispatchNotice && (
              <div
                className={`p-3 rounded-xl text-xs border ${
                  dispatchNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {dispatchNotice.message}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Certificate ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allEmailLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-gray-400">
                        No email dispatch logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    allEmailLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-gray-900 block">{log.studentName}</span>
                          <span className="font-mono text-[11px] text-gray-500">{log.studentEmail}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{log.certificateId}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'delivered' || log.status === 'sent'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : log.status === 'pending' || log.status === 'processing'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-gray-500 max-w-xs truncate">
                          {log.errorMessage || (log.sentAt ? `Sent at ${new Date(log.sentAt).toLocaleString()}` : 'Ready')}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDispatchLog(log)}
                            disabled={dispatchingLogId === log.id || !isAdminGmailConnected}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition disabled:opacity-40"
                          >
                            {dispatchingLogId === log.id ? 'Sending...' : log.status === 'delivered' ? 'Resend' : 'Send Now'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              System-Wide Issued Certificates ({allCertificates.length})
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              All officially issued Campus Ambassador System certificates across all institutions.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-2.5 px-3">Certificate ID</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Initiative</th>
                    <th className="py-2.5 px-3">Campus Ambassador</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allCertificates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">
                        No certificates issued yet.
                      </td>
                    </tr>
                  ) : (
                    allCertificates.map(cert => (
                      <tr key={cert.certificateId} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                          {cert.certificateId}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          {cert.studentName}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {cert.initiativeName}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {cert.caName} ({cert.caId})
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {cert.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setInspectingCert(cert)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Inspect Certificate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <AuditLogsView
          logs={auditLogs}
          onRefresh={loadData}
          isLoading={isLoading}
        />
      )}

      {/* CA Modal (Create/Edit) */}
      <CaModal
        isOpen={isCaModalOpen}
        onClose={() => setIsCaModalOpen(false)}
        onSave={handleSaveCa}
        ca={editingCa}
        nextCaNumber={cas.length + 1}
      />

      {/* Signature Modal */}
      {selectedCaForSig && (
        <SignatureModal
          ca={selectedCaForSig}
          isOpen={!!selectedCaForSig}
          onClose={() => setSelectedCaForSig(null)}
          onSave={handleSaveSignature}
        />
      )}

      {/* Credentials Modal */}
      {credentialsModalCa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <Key className="w-5 h-5 text-blue-600 mr-2" />
              Ambassador Credentials
            </h3>
            <p className="text-xs text-gray-500">
              Provide these credentials to Ambassador <span className="font-semibold text-gray-800">{credentialsModalCa.name}</span> for logging in:
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs font-mono">
              <div>
                <span className="text-gray-400 block text-[10px]">CA Identifier:</span>
                <span className="text-blue-600 font-bold">{credentialsModalCa.caId}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Login Email:</span>
                <span className="text-gray-800">{credentialsModalCa.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Initial Password:</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {credentialsModalCa.initialPassword || 'Ambassador@2026'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-gray-400 block text-[10px]">Google Sign-In Access:</span>
                {credentialsModalCa.allowGoogleLogin !== false ? (
                  <span className="text-emerald-700 font-semibold flex items-center mt-0.5">
                    <Chrome className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Enabled for ({credentialsModalCa.googleEmail || credentialsModalCa.email})
                  </span>
                ) : (
                  <span className="text-gray-500 italic text-[11px]">Disabled</span>
                )}
              </div>
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-gray-400 block text-[10px] mb-1">Active Operational Permissions:</span>
                <div className="grid grid-cols-2 gap-1 font-sans text-[11px]">
                  <span className={credentialsModalCa.permissions?.canIssueCertificates !== false ? 'text-emerald-700' : 'text-gray-400'}>
                    {credentialsModalCa.permissions?.canIssueCertificates !== false ? '✓' : '✗'} Issue Certificates
                  </span>
                  <span className={credentialsModalCa.permissions?.canImportCsv !== false ? 'text-emerald-700' : 'text-gray-400'}>
                    {credentialsModalCa.permissions?.canImportCsv !== false ? '✓' : '✗'} CSV Import
                  </span>
                  <span className={credentialsModalCa.permissions?.canEditStudents !== false ? 'text-emerald-700' : 'text-gray-400'}>
                    {credentialsModalCa.permissions?.canEditStudents !== false ? '✓' : '✗'} Edit Students
                  </span>
                  <span className={credentialsModalCa.permissions?.canSendEmails !== false ? 'text-emerald-700' : 'text-gray-400'}>
                    {credentialsModalCa.permissions?.canSendEmails !== false ? '✓' : '✗'} Email Dispatch
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : '';
                  const msg = `Campus Ambassador System Portal Login:\n- CA ID: ${credentialsModalCa.caId}\n- Email: ${credentialsModalCa.email}\n- Password: ${credentialsModalCa.initialPassword || 'Ambassador@2026'}\n- Direct Google Sign-In: ${credentialsModalCa.allowGoogleLogin !== false ? 'Enabled (' + (credentialsModalCa.googleEmail || credentialsModalCa.email) + ')' : 'Disabled'}\n- Login URL: ${origin}`;
                  navigator.clipboard.writeText(msg);
                  setCopiedCredentials(true);
                  setTimeout(() => setCopiedCredentials(false), 2500);
                }}
                className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-800 rounded-xl text-xs font-semibold transition"
              >
                {copiedCredentials ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                    <span>Copied Credentials!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-600 mr-1.5" />
                    <span>Copy Credentials</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setCredentialsModalCa(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Certificate Modal */}
      {inspectingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <CertificateTemplate certificate={inspectingCert} onClose={() => setInspectingCert(null)} />
          </div>
        </div>
      )}

      {/* Inspect CA Students Modal */}
      {inspectingCaStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Students for {inspectingCaStudents.ca.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {inspectingCaStudents.ca.college} &bull; {inspectingCaStudents.ca.caId}
                </p>
              </div>
              <button
                onClick={() => setInspectingCaStudents(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 text-xs">
              {inspectingCaStudents.students.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  This Ambassador has not registered any students yet.
                </div>
              ) : (
                inspectingCaStudents.students.map(s => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{s.fullName}</p>
                      <p className="text-[11px] text-gray-500">{s.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.certificateStatus === 'issued' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.certificateStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteStudents([s])}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete student"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectingCaStudents(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete CA Confirmation Modal */}
      {deletingCaState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Delete CA Account
                </h3>
                <p className="text-xs text-gray-500">
                  {deletingCaState.ca.name} &bull; <span className="font-mono">{deletingCaState.ca.caId}</span>
                </p>
              </div>
            </div>

            {deletingCaState.checking ? (
              <p className="text-xs text-gray-600 py-2">
                Checking this Campus Ambassador&apos;s students and issued certificates...
              </p>
            ) : deletingCaState.studentCount > 0 || deletingCaState.certCount > 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2.5">
                <p className="font-bold">This CA account has active records</p>
                <p>
                  Found <span className="font-bold">{deletingCaState.studentCount}</span> student(s) and{' '}
                  <span className="font-bold">{deletingCaState.certCount}</span> issued certificate(s). Deleting this
                  CA permanently removes their profile and revokes Google and password login access.
                </p>
                <label className="flex items-start space-x-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deletingCaState.deleteAssociatedRecords}
                    onChange={(e) =>
                      setDeletingCaState(prev =>
                        prev ? { ...prev, deleteAssociatedRecords: e.target.checked } : null
                      )
                    }
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span className="text-[11px] font-semibold text-amber-950">
                    Also permanently delete this CA&apos;s students, certificates, and email logs
                    <span className="block font-normal text-amber-800">
                      Leave unchecked to keep existing public certificate verification links working.
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-gray-700 space-y-1">
                <p>
                  This CA (<span className="font-mono font-semibold">{deletingCaState.ca.email}</span>) has{' '}
                  <span className="font-bold text-emerald-700">0 students</span> and{' '}
                  <span className="font-bold text-emerald-700">0 certificates</span>.
                </p>
                <p className="text-gray-500">
                  Deleting permanently removes the CA profile and revokes Google and password login access.
                </p>
              </div>
            )}

            {!isCloudAuthenticated && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2">
                <span>
                  Cloud Admin session is not active. Connect your Super Admin Google session so Firestore allows deleting this account.
                </span>
                <button
                  type="button"
                  onClick={() => connectCloudAdminSession()}
                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shrink-0"
                >
                  Connect
                </button>
              </div>
            )}

            {deletingCaState.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {deletingCaState.error}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCaState(null)}
                disabled={deletingCaState.isDeleting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>

              {!deletingCaState.checking && (
                <button
                  type="button"
                  onClick={handleConfirmDeleteCa}
                  disabled={deletingCaState.isDeleting || !isCloudAuthenticated}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {deletingCaState.isDeleting ? 'Deleting...' : 'Delete CA'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Student(s) Confirmation Modal */}
      {deletingStudentsState && (() => {
        const count = deletingStudentsState.students.length;
        const issuedCount = deletingStudentsState.students.filter(
          s => s.certificateStatus === 'issued' && s.certificateId
        ).length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {count === 1 ? 'Delete Student Record' : `Delete ${count} Student Records`}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {count === 1
                      ? `${deletingStudentsState.students[0].fullName} • ${deletingStudentsState.students[0].email}`
                      : 'Permanent removal from Campus Ambassador System'}
                  </p>
                </div>
              </div>

              {count > 1 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-gray-700 space-y-1 max-h-36 overflow-y-auto">
                  {deletingStudentsState.students.slice(0, 6).map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900 truncate">{s.fullName}</span>
                      <span className="font-mono text-[11px] text-gray-500 truncate">{s.email}</span>
                    </div>
                  ))}
                  {count > 6 && (
                    <p className="text-[11px] text-gray-500 pt-1">
                      ...and {count - 6} more student(s)
                    </p>
                  )}
                </div>
              )}

              {issuedCount > 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2.5">
                  <p className="font-bold">Issued Certificate(s) Found</p>
                  <p>
                    <span className="font-bold">{issuedCount}</span> selected student(s) already have an issued
                    certificate.
                  </p>
                  <label className="flex items-start space-x-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deletingStudentsState.deleteCertificate}
                      onChange={(e) =>
                        setDeletingStudentsState(prev =>
                          prev ? { ...prev, deleteCertificate: e.target.checked } : null
                        )
                      }
                      className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <span className="text-[11px] font-semibold text-amber-950">
                      Also permanently delete {issuedCount} issued certificate(s) and email logs
                      <span className="block font-normal text-amber-800">
                        Leave unchecked to keep existing public certificate verification links working.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-gray-700">
                  This permanently deletes the selected student record(s) from the system database.
                </div>
              )}

              {!isCloudAuthenticated && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2">
                  <span>
                    Cloud Admin session is not active. Connect your Super Admin Google session so Firestore allows deleting student records.
                  </span>
                  <button
                    type="button"
                    onClick={() => connectCloudAdminSession()}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shrink-0"
                  >
                    Connect
                  </button>
                </div>
              )}

              {deletingStudentsState.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {deletingStudentsState.error}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingStudentsState(null)}
                  disabled={deletingStudentsState.isDeleting}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDeleteStudents}
                  disabled={deletingStudentsState.isDeleting || !isCloudAuthenticated}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {deletingStudentsState.isDeleting
                    ? 'Deleting...'
                    : count === 1
                    ? 'Delete Student'
                    : `Delete ${count} Students`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
