import React, { useMemo, useState } from 'react';
import {
  CampusAmbassador,
  CaRegistrationForm,
  FormSubmission,
  Student
} from '../types';
import {
  importFormSubmissionToStudent,
  rejectFormSubmission
} from '../services/formService';
import {
  FileText,
  Link2,
  Check,
  ExternalLink,
  Send,
  Users,
  CheckSquare,
  Square,
  Mail,
  MessageCircle,
  Copy,
  X,
  XCircle,
  CheckCircle2
} from 'lucide-react';

interface StandardCaSharedFormsProps {
  ca: CampusAmbassador;
  actorEmail: string;
  students: Student[];
  sharedForms: CaRegistrationForm[];
  submissions: FormSubmission[];
}

export const StandardCaSharedForms: React.FC<StandardCaSharedFormsProps> = ({
  ca,
  actorEmail,
  students,
  sharedForms,
  submissions
}) => {
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [sendModalForm, setSendModalForm] = useState<CaRegistrationForm | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getPersonalizedShareUrl = (formId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/form/${formId}?ca=${encodeURIComponent(ca.uid)}`;
  };

  const handleCopyLink = (formId: string) => {
    navigator.clipboard.writeText(getPersonalizedShareUrl(formId));
    setCopiedFormId(formId);
    setTimeout(() => setCopiedFormId(null), 2500);
  };

  const handleOpenSendModal = (form: CaRegistrationForm) => {
    setSendModalForm(form);
    setSelectedStudentIds(new Set(students.map(s => s.id)));
    setStudentSearch('');
    setCopiedMessage(false);
  };

  const filteredModalStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      s =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.initiativeName.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const toggleSelectAllModal = () => {
    if (selectedStudentIds.size === filteredModalStudents.length && filteredModalStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredModalStudents.map(s => s.id)));
    }
  };

  const toggleStudentInModal = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const selectedModalStudents = students.filter(s => selectedStudentIds.has(s.id));

  const buildShareMessage = (form: CaRegistrationForm) => {
    const url = getPersonalizedShareUrl(form.id);
    return `Hi! Please fill out "${form.title}" shared by ${ca.name} (${ca.caId}, ${ca.college}) so we can process your verified certificate:\n${url}`;
  };

  const buildMailtoHref = (form: CaRegistrationForm) => {
    const emails = selectedModalStudents.map(s => s.email).filter(Boolean).join(',');
    const subject = encodeURIComponent(`Registration Form: ${form.title}`);
    const body = encodeURIComponent(buildShareMessage(form));
    return `mailto:${emails}?subject=${subject}&body=${body}`;
  };

  const buildWhatsAppHref = (form: CaRegistrationForm) => {
    return `https://wa.me/?text=${encodeURIComponent(buildShareMessage(form))}`;
  };

  const handleCopyStudentMessage = (form: CaRegistrationForm) => {
    navigator.clipboard.writeText(buildShareMessage(form));
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleManualImport = async (sub: FormSubmission) => {
    try {
      await importFormSubmissionToStudent(sub, actorEmail);
      setStatusNotice({ type: 'success', text: `Added ${sub.fullName} to your Students list.` });
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err?.message || 'Could not import submission.' });
    }
  };

  const handleReject = async (sub: FormSubmission) => {
    try {
      await rejectFormSubmission(sub.id);
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err?.message || 'Could not reject submission.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              Forms From Main CA — Send to Your Assigned Students
            </h3>
            <p className="text-xs text-gray-500">
              Share your personalized form link below with your assigned students. Any student who submits via your link automatically appears in your responses &amp; student list.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          Your Referral ID: {ca.caId}
        </span>
      </div>

      {statusNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
            statusNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusNotice.text}</span>
          </div>
          <button type="button" onClick={() => setStatusNotice(null)} className="font-bold ml-3">✕</button>
        </div>
      )}

      {/* Active Shared Forms List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
        <h4 className="text-sm font-bold text-gray-900">
          Available Active Forms ({sharedForms.length})
        </h4>

        {sharedForms.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-gray-300 rounded-2xl">
            <p className="text-xs text-gray-500">
              No active registration forms have been published by the Main CA yet. Once the Main CA creates an active form, it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedForms.map((form) => {
              const mySubsCount = submissions.filter(s => s.formId === form.id).length;
              const myUrl = getPersonalizedShareUrl(form.id);

              return (
                <div
                  key={form.id}
                  className="p-4 rounded-2xl border border-gray-200 bg-slate-50/60 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-bold text-gray-900">{form.title}</h5>
                        <p className="text-[11px] text-gray-500">
                          Created by <span className="font-semibold text-gray-700">{form.caName}</span> &bull;{' '}
                          {form.fields.filter(f => f.enabled).length} questions &bull;{' '}
                          <span className="font-bold text-blue-700">{mySubsCount} student(s) filled via you</span>
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Active
                      </span>
                    </div>

                    {form.description && (
                      <p className="text-[11px] text-gray-600 line-clamp-2">{form.description}</p>
                    )}

                    {/* Personalized CA link box */}
                    <div className="p-2 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-blue-700 truncate">{myUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(form.id)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold flex items-center shrink-0"
                      >
                        {copiedFormId === form.id ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3 h-3 mr-1" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200/70 flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <a
                        href={myUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-semibold flex items-center text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Preview Form
                      </a>
                      <a
                        href={buildWhatsAppHref(form)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center"
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        WhatsApp
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSendModal(form)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center"
                    >
                      <Send className="w-3 h-3 mr-1.5" />
                      Send to My Students ({students.length})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submissions received via THIS Standard CA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-gray-900">
              Students Who Filled Forms Via Your Link ({submissions.length})
            </h4>
          </div>
          <span className="text-[11px] text-gray-400">
            All responses filled through your share link automatically appear here and sync to your Students &amp; Certificates tab.
          </span>
        </div>

        {submissions.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">
            No students have submitted a form via your link yet. Copy your personalized form link or click <strong>Send to My Students</strong> above.
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-2.5 px-3">Student Details</th>
                  <th className="py-2.5 px-3">Form &amp; Event</th>
                  <th className="py-2.5 px-3">Custom Form Answers</th>
                  <th className="py-2.5 px-3">Submitted At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-gray-900">{sub.fullName}</div>
                      <div className="text-[11px] font-mono text-gray-500">{sub.email}</div>
                      <div className="text-[10px] text-gray-400">
                        {sub.college} {sub.semester ? `• ${sub.semester}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-gray-800">{sub.formTitle}</div>
                      <div className="text-[11px] text-blue-600">
                        {sub.initiativeName} ({sub.participationDate})
                      </div>
                      {sub.formCreatorName && (
                        <div className="text-[10px] text-gray-400">Form by {sub.formCreatorName}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {Object.keys(sub.customFields || {}).length === 0 ? (
                        <span className="text-[10px] text-gray-400 italic">Standard fields only</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(sub.customFields || {}).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded text-[10px]"
                            >
                              <span className="font-mono font-bold">{k}:</span> {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sub.status === 'imported'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {sub.status === 'imported' ? 'Added to Your Students' : sub.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {sub.status === 'pending' && (
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleManualImport(sub)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold"
                          >
                            Add to Students
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(sub)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send to Assigned Students Modal */}
      {sendModalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Send Form to Your Assigned Students
                </h4>
                <p className="text-xs text-gray-500">
                  {sendModalForm.title} &bull; Personalized link tracks submissions back to <span className="font-bold text-blue-700">{ca.name} ({ca.caId})</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSendModalForm(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray-700">Your Shareable Form Message:</span>
                <button
                  type="button"
                  onClick={() => handleCopyStudentMessage(sendModalForm)}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-[11px] font-bold flex items-center"
                >
                  {copiedMessage ? (
                    <>
                      <Check className="w-3 h-3 mr-1 text-emerald-600" />
                      Message Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Message + Link
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-600 whitespace-pre-wrap font-mono bg-white p-2.5 rounded-xl border border-gray-200">
                {buildShareMessage(sendModalForm)}
              </p>
            </div>

            {students.length === 0 ? (
              <div className="p-6 text-center bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                You do not have pre-added students yet. Copy the message above or share via WhatsApp so any student can fill the form directly.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Filter assigned students by name or email..."
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={toggleSelectAllModal}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                  >
                    {selectedStudentIds.size === filteredModalStudents.length && filteredModalStudents.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 max-h-60">
                  {filteredModalStudents.map((stu) => {
                    const checked = selectedStudentIds.has(stu.id);
                    return (
                      <label
                        key={stu.id}
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center space-x-2.5">
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudentInModal(stu.id)}
                            className="sr-only"
                          />
                          <div>
                            <div className="font-bold text-gray-900">{stu.fullName}</div>
                            <div className="text-[11px] font-mono text-gray-500">{stu.email}</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">{stu.initiativeName}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <a
                href={buildWhatsAppHref(sendModalForm)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center"
              >
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Share via WhatsApp
              </a>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSendModalForm(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
                {selectedModalStudents.length > 0 && (
                  <a
                    href={buildMailtoHref(sendModalForm)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center"
                  >
                    <Mail className="w-4 h-4 mr-1.5" />
                    Email Selected ({selectedModalStudents.length})
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
