import React, { useEffect, useState } from 'react';
import { Certificate } from '../types';
import { generateVerificationQr, downloadCertificatePdf } from '../utils/certificatePdf';
import { Download, Share2, CheckCircle2, ShieldCheck, ExternalLink, Printer } from 'lucide-react';

interface CertificateTemplateProps {
  certificate: Certificate;
  onClose?: () => void;
  showActions?: boolean;
}

export const CertificateTemplate: React.FC<CertificateTemplateProps> = ({
  certificate,
  onClose,
  showActions = true
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateVerificationQr(certificate.certificateId).then(setQrCodeUrl);
  }, [certificate.certificateId]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadCertificatePdf(certificate);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verifyUrl = `${origin}/verify/${certificate.certificateId}`;
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center">
      {showActions && (
        <div className="w-full max-w-4xl flex items-center justify-between pb-4 border-b border-gray-200 mb-6 flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Verified Authenticity
            </span>
            <span className="text-xs text-gray-500 font-mono">
              ID: {certificate.certificateId}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              title="Copy verification link"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              {copied ? 'Link Copied!' : 'Share Link'}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              title="Print Certificate"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Print
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {isDownloading ? 'Generating PDF...' : 'Download PDF (A4)'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Certificate Viewport Container */}
      <div 
        id="printable-certificate"
        className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200 transition-all aspect-[1.414/1] flex flex-col justify-between p-8 sm:p-12"
        style={{
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), 0 0 1px 1px rgba(0,0,0,0.04)'
        }}
      >
        {/* Quad Google Multi-Color Border */}
        <div className="absolute inset-2 sm:inset-4 rounded-xl pointer-events-none p-[3px] bg-gradient-to-tr from-[#34A853] via-[#FBBC05] via-[#EA4335] to-[#4285F4]">
          <div className="w-full h-full bg-white rounded-[10px] relative">
            {/* Subtle inner pinstripe */}
            <div className="absolute inset-2 border border-slate-200/80 rounded-lg" />
          </div>
        </div>

        {/* Certificate Content (Above borders) */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          
          {/* Top Header */}
          <div className="flex items-start justify-between">
            {/* Google Logo & Program Subtitle */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-1 select-none">
                <span className="text-3xl sm:text-4xl font-bold text-[#4285F4]">G</span>
                <span className="text-3xl sm:text-4xl font-bold text-[#EA4335]">o</span>
                <span className="text-3xl sm:text-4xl font-bold text-[#FBBC05]">o</span>
                <span className="text-3xl sm:text-4xl font-bold text-[#4285F4]">g</span>
                <span className="text-3xl sm:text-4xl font-bold text-[#34A853]">l</span>
                <span className="text-3xl sm:text-4xl font-bold text-[#EA4335]">e</span>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold tracking-wider text-gray-500 uppercase mt-1">
                Student Ambassador Program
              </p>
            </div>

            {/* Official 2026 Program Emblem */}
            <div className="flex items-center space-x-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-blue-500 bg-blue-50/50 flex flex-col items-center justify-center text-center p-1 shadow-inner">
                <span className="text-[11px] font-bold text-blue-700 tracking-tight">2026</span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-gray-600">OFFICIAL</span>
                <span className="text-[7px] font-medium text-gray-500 uppercase">PROGRAM</span>
              </div>
            </div>
          </div>

          {/* Certificate Central Body */}
          <div className="text-center my-4 sm:my-6 space-y-2 sm:space-y-3">
            <p className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-blue-600 uppercase">
              Google Student Ambassador Program 2026
            </p>

            <h1 className="text-3xl sm:text-5xl font-serif font-bold text-gray-900 tracking-tight">
              Certificate of Participation
            </h1>

            <p className="text-xs sm:text-sm italic text-gray-500 font-sans">
              This certificate is proudly and honorably presented to
            </p>

            {/* Student Name */}
            <div className="py-2">
              <h2 className="text-2xl sm:text-4xl font-serif font-bold text-blue-700 tracking-tight">
                {certificate.studentName}
              </h2>
              <div className="w-32 sm:w-48 h-0.5 bg-yellow-400 mx-auto mt-2 rounded-full" />
            </div>

            {/* Description text */}
            <p className="text-xs sm:text-sm text-gray-700 max-w-xl mx-auto leading-relaxed">
              for active and exemplary participation in <span className="font-semibold text-gray-900">"{certificate.initiativeName}"</span> organized by the Google Student Ambassador Program 2026 at <span className="font-semibold text-gray-900">{certificate.college}</span> ({certificate.semester}).
            </p>
          </div>

          {/* Bottom Footer Section: Date, QR Code, Signature */}
          <div className="grid grid-cols-3 items-end pt-4 border-t border-gray-100 mt-2">
            
            {/* Left: Date */}
            <div className="text-left space-y-1">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Participation Date
              </span>
              <p className="text-xs sm:text-sm font-semibold text-gray-800">
                {certificate.participationDate}
              </p>
              <div className="w-24 sm:w-32 h-[1px] bg-gray-300 mt-1" />
              <p className="text-[8px] sm:text-[9px] text-gray-500">
                Official Program Issuance
              </p>
            </div>

            {/* Center: QR Code & Verification ID */}
            <div className="flex flex-col items-center text-center">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="QR Verification"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded bg-white p-0.5 border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 animate-pulse rounded" />
              )}
              <span className="text-[8px] sm:text-[10px] font-mono font-bold text-blue-600 mt-1">
                {certificate.certificateId}
              </span>
              <span className="text-[7px] sm:text-[8px] text-gray-400 uppercase tracking-wider">
                Scan to verify
              </span>
            </div>

            {/* Right: CA Authorized Signature */}
            <div className="text-right flex flex-col items-end space-y-1">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Authorized Signature
              </span>
              
              <div className="h-10 sm:h-12 flex items-center justify-end">
                {certificate.signatureUrl ? (
                  <img
                    src={certificate.signatureUrl}
                    alt="Authorized Signature"
                    className="max-h-10 sm:max-h-12 object-contain"
                  />
                ) : (
                  <span className="text-xs font-serif italic text-gray-400">
                    {certificate.caName}
                  </span>
                )}
              </div>

              <div className="w-28 sm:w-40 h-[1px] bg-gray-300" />
              
              <p className="text-xs sm:text-sm font-bold text-gray-800">
                {certificate.caName}
              </p>
              <p className="text-[8px] sm:text-[10px] font-semibold text-blue-600">
                Campus Ambassador ({certificate.caId})
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
