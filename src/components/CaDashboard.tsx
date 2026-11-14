import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Award, 
  Mail, 
  Plus, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Trash2, 
  Edit, 
  Eye, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  Shield,
  School
} from 'lucide-react';
import { Student, CampusAmbassador, Certificate, EmailLog } from '../types';
import { 
  getStudentsForCA, 
  addStudent, 
  updateStudent, 
  deleteStudent, 
  importStudentsBatch, 
  issueCertificateForStudent,
  getEmailLogsForCA,
  subscribeToStudentsForCA
} from '../services/dataService';
import { StudentModal } from './StudentModal';
import { CsvImportModal } from './CsvImportModal';
import { BulkIssuanceModal } from './BulkIssuanceModal';
import { CertificateTemplate } from './CertificateTemplate';
import { SendEmailModal } from './SendEmailModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { retryEmailDispatch } from '../services/emailService';

interface CaDashboardProps {
  ca: CampusAmbassador;
  actorEmail: string;
}

export const CaDashboard: React.FC<CaDashboardProps> = ({ ca, actorEmail }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'not_issued'>('all');
  const [initiativeFilter, setInitiativeFilter] = useState<string>('all');

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [viewingCertificate, setViewingCertificate] = useState<Certificate | null>(null);
  const [issuingSingleStudent, setIssuingSingleStudent] = useState<Student | null>(null);
  const [emailingStudent, setEmailingStudent] = useState<Student | null>(null);

  const loadData = async () => {
    try {
      const logs = await getEmailLogsForCA(ca.uid);
      setEmailLogs(logs);
    } catch (err) {
      console.warn('Failed loading CA email logs:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();

    // Attach real-time Firestore listener for students
    const unsubscribe = subscribeToStudentsForCA(ca.uid, (updatedStudents) => {
      setStudents(updatedStudents);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [ca.uid]);

  const handleSaveStudent = async (data: any) => {
    if (editingStudent) {
      await updateStudent(editingStudent.id, data, ca.uid, actorEmail);
    } else {
      await addStudent(data, ca.uid, actorEmail);
    }
    await loadData();
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.fullName}?`)) return;
    try {
      await deleteStudent(student.id, ca.uid, actorEmail);
      await loadData();
    } catch (err: any) {
      alert(`Could not delete: ${err.message}`);
    }
  };

  const handleBatchImport = async (studentsList: any) => {
    const res = await importStudentsBatch(studentsList, ca.uid, actorEmail);
    await loadData();
    return res;
  };

  const handleIssueSingle = async (student: Student) => {
    setIssuingSingleStudent(student);
    try {
      const { certificate, emailResult } = await issueCertificateForStudent(student, ca, actorEmail);
      setViewingCertificate(certificate);
      await loadData();
    } catch (err: any) {
      alert(`Issuance failed: ${err.message}`);
    } finally {
      setIssuingSingleStudent(null);
    }
  };

  const handleInspectCertificate = async (certificateId: string) => {
    try {
      const snap = await getDoc(doc(db, 'certificates', certificateId));
      if (snap.exists()) {
        setViewingCertificate(snap.data() as Certificate);
      } else {
        alert('Certificate document not found.');
      }
    } catch (err: any) {
      alert(`Error loading certificate: ${err.message}`);
    }
  };

  // Selection logic for bulk issuance
  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const toggleSelectStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // Filter list
  const initiatives = Array.from(new Set(students.map(s => s.initiativeName))).filter(Boolean);

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.initiativeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.certificateStatus === statusFilter;
    const matchesInitiative = initiativeFilter === 'all' || s.initiativeName === initiativeFilter;
    return matchesSearch && matchesStatus && matchesInitiative;
  });

  const selectedStudentsList = students.filter(s => selectedStudentIds.has(s.id));

  // Compute metrics
  const totalIssued = students.filter(s => s.certificateStatus === 'issued').length;
  const totalPending = students.filter(s => s.certificateStatus === 'not_issued').length;
  const emailsDelivered = emailLogs.filter(l => l.status === 'delivered' || l.status === 'sent').length;
  const emailsFailed = emailLogs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      
      {/* CA Profile Welcome Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-lg">
            {ca.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-gray-900">{ca.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {ca.caId}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                Active Ambassador
              </span>
            </div>
            <p className="text-xs text-gray-500 flex items-center mt-0.5">
              <School className="w-3.5 h-3.5 mr-1 text-gray-400" />
              {ca.college} &bull; Campus Ambassador System
            </p>
          </div>
        </div>

        {/* Signature Snapshot & Permissions Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Official E-Signature
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end">
                <ShieldCheck className="w-3 h-3 mr-1" /> Auto-Injected in Certificates
              </span>
            </div>
            {ca.signatureUrl ? (
              <img
                src={ca.signatureUrl}
                alt="E-Signature"
                className="h-8 max-w-[120px] object-contain"
              />
            ) : (
              <span className="text-xs italic text-gray-400">Default Script</span>
            )}
          </div>
        </div>
      </div>

      {/* Permissions Bar */}
      <div className="bg-blue-50/60 border border-blue-200/60 px-4 py-2.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-gray-900">Admin-Granted Permissions:</span>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            (ca.permissions?.canIssueCertificates !== false) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500 line-through'
          }`}>
            Issue Certificates {(ca.permissions?.canIssueCertificates !== false) ? '✓' : '✗'}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            (ca.permissions?.canImportCsv !== false) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500 line-through'
          }`}>
            CSV Import {(ca.permissions?.canImportCsv !== false) ? '✓' : '✗'}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            (ca.permissions?.canEditStudents !== false) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500 line-through'
          }`}>
            Edit Students {(ca.permissions?.canEditStudents !== false) ? '✓' : '✗'}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            (ca.permissions?.canSendEmails !== false) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500 line-through'
          }`}>
            Email Dispatch {(ca.permissions?.canSendEmails !== false) ? '✓' : '✗'}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Students</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{students.length}</p>
          <span className="text-[10px] text-gray-500">Your campus cohort</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Certificates Issued</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">{totalIssued}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Verified credentials</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Issuance</span>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{totalPending}</p>
          <span className="text-[10px] text-gray-500">Ready for bulk issuance</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Automated Emails</span>
            <Mail className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{emailsDelivered}</p>
          <span className="text-[10px] text-gray-500">
            {emailsFailed > 0 ? `${emailsFailed} failed` : 'All dispatched'}
          </span>
        </div>
      </div>

      {/* Main Student Management Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs space-y-4 p-5">
        
        {/* Controls Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          
          {/* Left search & filters */}
          <div className="flex items-center space-x-2 flex-1 min-w-[280px] max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students by name, email, or initiative..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Certificates</option>
              <option value="not_issued">Not Issued</option>
              <option value="issued">Issued</option>
            </select>

            {initiatives.length > 1 && (
              <select
                value={initiativeFilter}
                onChange={(e: any) => setInitiativeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden max-w-[140px]"
              >
                <option value="all">All Initiatives</option>
                {initiatives.map(ini => (
                  <option key={ini} value={ini}>{ini}</option>
                ))}
              </select>
            )}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            
            {/* Bulk Issuance Trigger */}
            {selectedStudentIds.size > 0 && (
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                disabled={ca.permissions?.canIssueCertificates === false}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center animate-in fade-in disabled:opacity-50 disabled:cursor-not-allowed"
                title={ca.permissions?.canIssueCertificates === false ? 'Certificate issuance is disabled by Super Admin' : 'Bulk Issue Certificates'}
              >
                <Award className="w-3.5 h-3.5 mr-1.5" />
                Bulk Issue ({selectedStudentIds.size})
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              disabled={ca.permissions?.canImportCsv === false}
              className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              title={ca.permissions?.canImportCsv === false ? 'CSV Import is disabled by Super Admin' : 'Import CSV / Excel'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Import CSV / Excel
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingStudent(null);
                setIsStudentModalOpen(true);
              }}
              disabled={ca.permissions?.canEditStudents === false}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              title={ca.permissions?.canEditStudents === false ? 'Student registration is disabled by Super Admin' : 'Add Student'}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Student
            </button>

            <button
              type="button"
              onClick={loadData}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Students Table */}
        <div className="overflow-x-auto border border-gray-200/80 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-gray-700"
                    title="Select all"
                  >
                    {filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Student Full Name</th>
                <th className="py-3 px-3">Email Address</th>
                <th className="py-3 px-3">Semester & Date</th>
                <th className="py-3 px-3">Initiative</th>
                <th className="py-3 px-3">Certificate Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    No students registered yet. Click <span className="font-semibold text-blue-600">"Add Student"</span> or <span className="font-semibold text-emerald-600">"Import CSV"</span> to get started.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);
                  const isIssued = student.certificateStatus === 'issued';

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-gray-50/70 transition ${isSelected ? 'bg-blue-50/30' : ''}`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleSelectStudent(student.id)}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-gray-900">{student.fullName}</span>
                        <span className="text-[10px] text-gray-400 block">{student.college}</span>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-gray-600">
                        {student.email}
                      </td>

                      <td className="py-3 px-3 text-gray-600">
                        <div>{student.semester}</div>
                        <div className="text-[10px] text-gray-400">{student.participationDate}</div>
                      </td>

                      <td className="py-3 px-3 text-gray-700 font-medium">
                        {student.initiativeName}
                      </td>

                      <td className="py-3 px-3">
                        {isIssued ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Issued
                            </span>
                            <span className="font-mono text-[9px] text-blue-600 font-bold mt-0.5">
                              {student.certificateId}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 w-fit">
                            Not Issued
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isIssued ? (
                            <>
                              <button
                                onClick={() => setEmailingStudent(student)}
                                disabled={ca.permissions?.canSendEmails === false}
                                className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-[11px] font-bold shadow-2xs transition flex items-center disabled:opacity-40"
                                title="Send / Resend Certificate via Email"
                              >
                                <Send className="w-3 h-3 mr-1 text-purple-600" />
                                Send Email
                              </button>

                              <button
                                onClick={() => student.certificateId && handleInspectCertificate(student.certificateId)}
                                className="px-2 py-1 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg text-[11px] font-bold shadow-2xs transition flex items-center"
                                title="View Certificate & QR Code"
                              >
                                <Eye className="w-3 h-3 mr-1" /> View
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleIssueSingle(student)}
                              disabled={issuingSingleStudent?.id === student.id || ca.permissions?.canIssueCertificates === false}
                              className="px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[11px] font-bold shadow-2xs transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                              title={ca.permissions?.canIssueCertificates === false ? 'Certificate issuance restricted by Super Admin' : 'Issue Certificate and Email to Student'}
                            >
                              <Award className="w-3 h-3 mr-1" />
                              {issuingSingleStudent?.id === student.id ? 'Issuing...' : 'Issue'}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingStudent(student);
                              setIsStudentModalOpen(true);
                            }}
                            disabled={ca.permissions?.canEditStudents === false}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title={ca.permissions?.canEditStudents === false ? 'Student editing restricted by Super Admin' : 'Edit'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteStudent(student)}
                            disabled={ca.permissions?.canEditStudents === false}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title={ca.permissions?.canEditStudents === false ? 'Student deletion restricted by Super Admin' : 'Delete'}
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

      {/* Send Email Modal */}
      {emailingStudent && (
        <SendEmailModal
          isOpen={!!emailingStudent}
          onClose={() => setEmailingStudent(null)}
          student={emailingStudent}
          ca={ca}
          onSent={loadData}
        />
      )}

      {/* Student Modal */}
      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSave={handleSaveStudent}
        student={editingStudent}
        defaultCollege={ca.college}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={handleBatchImport}
        defaultCollege={ca.college}
      />

      {/* Bulk Issuance Modal */}
      <BulkIssuanceModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onCompleted={loadData}
        students={selectedStudentsList}
        ca={ca}
        actorEmail={actorEmail}
      />

      {/* Certificate Viewer Modal */}
      {viewingCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <CertificateTemplate
              certificate={viewingCertificate}
              onClose={() => setViewingCertificate(null)}
            />
          </div>
        </div>
      )}

    </div>
  );
};
