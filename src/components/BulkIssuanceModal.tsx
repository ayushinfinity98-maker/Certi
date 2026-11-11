import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Award, Mail, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { Student, CampusAmbassador, Certificate } from '../types';
import { issueCertificateForStudent } from '../services/dataService';

interface BulkIssuanceModalProps {
  students: Student[];
  ca: CampusAmbassador;
  actorEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export const BulkIssuanceModal: React.FC<BulkIssuanceModalProps> = ({
  students,
  ca,
  actorEmail,
  isOpen,
  onClose,
  onCompleted
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Array<{
    student: Student;
    success: boolean;
    certId?: string;
    emailSuccess?: boolean;
    error?: string;
  }>>([]);
  const [isFinished, setIsFinished] = useState(false);

  if (!isOpen) return null;

  const handleStartIssuance = async () => {
    setIsProcessing(true);
    setIsFinished(false);
    setResults([]);
    setCurrentIndex(0);

    const accumulated: Array<{
      student: Student;
      success: boolean;
      certId?: string;
      emailSuccess?: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      setCurrentIndex(i + 1);

      try {
        const { certificate, emailResult } = await issueCertificateForStudent(student, ca, actorEmail);
        accumulated.push({
          student,
          success: true,
          certId: certificate.certificateId,
          emailSuccess: emailResult.success,
          error: emailResult.error
        });
      } catch (err: any) {
        accumulated.push({
          student,
          success: false,
          error: err.message || 'Issuance failed'
        });
      }

      setResults([...accumulated]);
      // Small delay for rate-limiting and visual feedback
      await new Promise(r => setTimeout(r, 400));
    }

    setIsProcessing(false);
    setIsFinished(true);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }

    onCompleted();
  };

  const progressPercent = students.length > 0 ? Math.round((currentIndex / students.length) * 100) : 0;
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success || !r.emailSuccess).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Bulk Certificate Issuance & Email Dispatch
              </h3>
              <p className="text-xs text-gray-500">
                Google Student Ambassador Program 2026
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* CA Signature Notice */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-gray-700">
              Certificates will bear Ambassador <span className="font-semibold text-gray-900">{ca.name}</span>'s verified signature.
            </span>
          </div>
          {ca.signatureUrl ? (
            <img src={ca.signatureUrl} alt="CA Signature" className="h-6 max-w-[90px] object-contain" />
          ) : (
            <span className="text-[10px] text-amber-600 font-semibold">(Default script signature)</span>
          )}
        </div>

        {/* Initial Step */}
        {!isProcessing && !isFinished && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              You have selected <span className="font-bold text-blue-600">{students.length}</span> students. Each participant will:
            </p>
            <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
              <li>Receive a uniquely generated certificate ID & QR verification code</li>
              <li>Have their certificate stamped with your authorized signature</li>
              <li>Receive an automated official email with the verified PDF certificate attached</li>
            </ul>
          </div>
        )}

        {/* Progress Step */}
        {isProcessing && (
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-700">Processing {currentIndex} of {students.length}...</span>
              <span className="text-blue-600">{progressPercent}%</span>
            </div>
            
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-xs text-gray-500 text-center animate-pulse">
              Generating high-resolution PDF certificate & dispatching central email...
            </p>
          </div>
        )}

        {/* Finished / Results Step */}
        {isFinished && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <span className="font-semibold">Issuance Batch Completed</span>
              <span>{successCount} Success / {failedCount} Attention Needed</span>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl text-xs">
              {results.map((r, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{r.student.fullName}</p>
                    <p className="text-[11px] text-gray-500">{r.student.email}</p>
                  </div>
                  <div className="text-right">
                    {r.success ? (
                      <span className="inline-flex items-center text-emerald-600 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {r.certId}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 font-semibold text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
          {!isProcessing && !isFinished && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartIssuance}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition flex items-center"
              >
                <Award className="w-4 h-4 mr-1.5" />
                Start Bulk Issuance ({students.length})
              </button>
            </>
          )}

          {isFinished && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
            >
              Done & Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
