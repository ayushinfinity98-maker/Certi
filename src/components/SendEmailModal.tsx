import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, Send, Chrome } from 'lucide-react';
import { Student, CampusAmbassador, Certificate } from '../types';
import { dispatchCertificateEmail } from '../services/emailService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { MAIN_ADMIN_EMAIL } from '../services/googleWorkspaceAuth';

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
  const { role, isAdminGmailConnected, connectAdminGmail } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; queued?: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const isAdminUser = role === 'superadmin' || role === 'admin';

  const handleConnectAdminGmail = async () => {
    setIsConnectingGmail(true);
    setSendResult(null);
    try {
      const res = await connectAdminGmail();
      if (res.email !== MAIN_ADMIN_EMAIL.toLowerCase()) {
        setSendResult({
          success: false,
          message: `Signed in as ${res.email}, but emails must be sent from the main admin email (${MAIN_ADMIN_EMAIL}). Please select ${MAIN_ADMIN_EMAIL}.`
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Could not authorize Google account.'
      });
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      if (!student.certificateId) {
        throw new Error('This student does not have an issued certificate yet. Please click "Issue" first or use Bulk Issuance.');
      }

      const certRef = doc(db, 'certificates', student.certificateId);
      const snap = await getDoc(certRef);

      let cert: Certificate;
      if (snap.exists()) {
        cert = snap.data() as Certificate;
      } else {
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
          message: `Official certificate email sent from ${MAIN_ADMIN_EMAIL} to ${student.email} with verified PDF attached.`
        });
        setConfirmSend(false);
        if (onSent) onSent();
      } else if (res.queued) {
        setSendResult({
          success: false,
          queued: true,
          message: res.error || `Queued for Super Admin (${MAIN_ADMIN_EMAIL}) Gmail dispatch.`
        });
        setConfirmSend(false);
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
                Dispatched via Main Admin Gmail ({MAIN_ADMIN_EMAIL})
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
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                student.certificateStatus === 'issued'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {student.certificateStatus === 'issued' ? `Issued (${student.certificateId})` : 'Not Issued Yet'}
            </span>
          </div>
        </div>

        {/* Admin Gmail Authorization Status */}
        {!isAdminGmailConnected ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
            <p className="font-semibold">
              Main Admin Gmail Authorization Needed ({MAIN_ADMIN_EMAIL})
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {isAdminUser
                ? `Connect your Google account (${MAIN_ADMIN_EMAIL}) below so this browser can send the PDF certificate directly from your Gmail.`
                : `Direct delivery uses the Main Admin's Gmail (${MAIN_ADMIN_EMAIL}). Sending without Admin authorization queues the email in the Admin Email Dispatch Queue.`}
            </p>
            {isAdminUser && (
              <button
                type="button"
                onClick={handleConnectAdminGmail}
                disabled={isConnectingGmail}
                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition flex items-center space-x-1.5"
              >
                <Chrome className="w-3.5 h-3.5 text-blue-600" />
                <span>{isConnectingGmail ? 'Connecting...' : `Authorize Gmail (${MAIN_ADMIN_EMAIL})`}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Main Admin Gmail connected: <span className="font-mono font-bold">{MAIN_ADMIN_EMAIL}</span> ready for live PDF delivery.
            </span>
          </div>
        )}

        {/* Confirmation Box before Send */}
        {confirmSend && !isSending && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            <p className="font-bold">Confirm Email Delivery</p>
            <p className="text-[11px] mt-0.5">
              Send the official PDF certificate to <span className="font-mono font-semibold">{student.email}</span> from <span className="font-mono font-semibold">{MAIN_ADMIN_EMAIL}</span>? Click "Confirm & Send Now" below to proceed.
            </p>
          </div>
        )}

        {/* Result Message */}
        {sendResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 ${
              sendResult.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : sendResult.queued
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {sendResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${sendResult.queued ? 'text-amber-600' : 'text-red-600'}`} />
            )}
            <div>
              <p className="font-semibold">
                {sendResult.success
                  ? 'Email Sent via Gmail!'
                  : sendResult.queued
                  ? 'Queued for Super Admin Gmail'
                  : 'Dispatch Error'}
              </p>
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
            Official Sender ID: <span className="font-mono text-gray-700 font-semibold">{MAIN_ADMIN_EMAIL}</span>
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
                Sending via Gmail...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {confirmSend
                  ? isAdminGmailConnected
                    ? 'Confirm & Send Now'
                    : 'Queue for Admin Gmail'
                  : isAdminGmailConnected
                  ? 'Send via Admin Gmail'
                  : 'Queue / Send Email'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
