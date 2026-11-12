import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, FileText, Send, User } from 'lucide-react';
import { Student, CampusAmbassador, Certificate } from '../types';
import { dispatchCertificateEmail } from '../services/emailService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  ca: CampusAmbassador;
  onSent?: () => void;
}

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  student,
  ca,
  onSent
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [customNote, setCustomNote] = useState('');

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setIsSending(true);
    setSendResult(null);

    try {
      if (!student.certificateId) {
        throw new Error('This student does not have an issued certificate yet. Please click "Issue" first or use Bulk Issuance.');
      }

      // Fetch certificate document
      const certRef = doc(db, 'certificates', student.certificateId);
      const snap = await getDoc(certRef);

      let cert: Certificate;
      if (snap.exists()) {
        cert = snap.data() as Certificate;
      } else {
        // Construct fallback certificate
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://google-student-ambassador-2026.web.app';
        cert = {
          certificateId: student.certificateId,
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
          verificationUrl: `${origin}/verify/${student.certificateId}`,
          issuedAt: new Date().toISOString()
        };
      }

      const res = await dispatchCertificateEmail(cert, student);
      if (res.success) {
        setSendResult({
          success: true,
          message: `Official certificate email successfully delivered to ${student.email} with verified PDF certificate attachment.`
        });
        if (onSent) onSent();
      } else {
        setSendResult({
          success: false,
          message: res.error || 'Failed to dispatch email.'
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Error occurred while sending email.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Send Certificate Email
              </h3>
              <p className="text-xs text-gray-500">
                Official Google Student Ambassador Program 2026 delivery
              </p>
            </div>
          </div>
          {!isSending && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Student & Certificate Information Preview */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Recipient Student:</span>
            <span className="font-bold text-gray-900">{student.fullName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Student Email:</span>
            <span className="font-mono text-blue-600 font-semibold">{student.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Event / Initiative:</span>
            <span className="text-gray-800 font-medium">{student.initiativeName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Certificate Status:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              student.certificateStatus === 'issued'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {student.certificateStatus === 'issued' ? `Issued (${student.certificateId})` : 'Not Issued Yet'}
            </span>
          </div>
        </div>

        {/* Result Message */}
        {sendResult && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 ${
            sendResult.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {sendResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{sendResult.success ? 'Email Dispatched!' : 'Dispatch Error'}</p>
              <p className="text-[11px] mt-0.5">{sendResult.message}</p>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p className="flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            PDF certificate is dynamically rendered with QR validation code and Ambassador signature.
          </p>
          <p>
            Sent via Central Email Dispatch: <span className="font-mono text-gray-700 font-semibold">ambassador-certificates@google-student-ambassador.org</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
          >
            {sendResult?.success ? 'Close' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            disabled={isSending || student.certificateStatus !== 'issued'}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Dispatching Email...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Send Official Email Now
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
