import React, { useEffect, useState } from 'react';
import { Certificate, CertificateTemplateConfig } from '../types';
import { generateVerificationQr, downloadCertificatePdf } from '../utils/certificatePdf';
import { Download, Share2, CheckCircle2, ShieldCheck, ExternalLink, Printer } from 'lucide-react';
import {
  getActiveCertificateTemplate,
  subscribeToActiveCertificateTemplate,
  populateCertificatePlaceholders,
  resolvePlaceholderValue,
  isSignaturePlaceholderTag,
  isQrPlaceholderTag,
  DEFAULT_TEMPLATES
} from '../services/certificateTemplateService';

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
  const [template, setTemplate] = useState<CertificateTemplateConfig>(DEFAULT_TEMPLATES[0]);

  useEffect(() => {
    generateVerificationQr(certificate.certificateId).then(setQrCodeUrl);
    getActiveCertificateTemplate().then(setTemplate).catch(() => setTemplate(DEFAULT_TEMPLATES[0]));
    const unsub = subscribeToActiveCertificateTemplate((latest) => {
      setTemplate(latest);
    });
    return () => unsub();
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

  const sampleValues = {
    student_name: certificate.studentName,
    initiative_name: certificate.initiativeName,
    college_name: certificate.college,
    semester: certificate.semester,
    participation_date: certificate.participationDate,
    certificate_id: certificate.certificateId,
    ca_name: certificate.caName
  };

  const isManualMode = template.elementsMode === 'manual_placed' || template.type === 'blank_plain';

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
        className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200 transition-all aspect-[1.414/1] p-6 sm:p-10 select-none"
        style={{
          backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : undefined,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundColor: template.backgroundColor || '#FFFFFF',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), 0 0 1px 1px rgba(0,0,0,0.04)'
        }}
      >
        {/* Quad Google Multi-Color Border ONLY if enabled in template and standard type */}
        {template.showBorder && template.type === 'standard_google' && (
          <div className="absolute inset-2 sm:inset-4 rounded-xl pointer-events-none p-[3px] bg-gradient-to-tr from-[#34A853] via-[#FBBC05] via-[#EA4335] to-[#4285F4]">
            <div className="w-full h-full bg-white rounded-[10px] relative">
              <div className="absolute inset-2 border border-slate-200/80 rounded-lg" />
            </div>
          </div>
        )}

        {/* If AUTO-LAYOUT MODE is enabled */}
        {!isManualMode ? (
          <div className="relative z-10 flex flex-col justify-between h-full">
            
            {/* Top Header */}
            <div className="flex items-start justify-between">
              {template.showLogo ? (
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
              ) : <div />}

              {template.showProgramEmblem && (
                <div className="flex items-center space-x-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-blue-500 bg-blue-50/50 flex flex-col items-center justify-center text-center p-1 shadow-inner">
                    <span className="text-[11px] font-bold text-blue-700 tracking-tight">2026</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-gray-600">OFFICIAL</span>
                    <span className="text-[7px] font-medium text-gray-500 uppercase">PROGRAM</span>
                  </div>
                </div>
              )}
            </div>

            {/* Central Body */}
            <div className="text-center my-4 sm:my-6 space-y-2 sm:space-y-3">
              <p className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-blue-600 uppercase">
                {template.subheading || 'Google Student Ambassador Program 2026'}
              </p>

              <h1 className="text-3xl sm:text-5xl font-serif font-bold text-gray-900 tracking-tight">
                {template.heading || 'Certificate of Participation'}
              </h1>

              <p className="text-xs sm:text-sm italic text-gray-500 font-sans">
                {template.presentationText || 'This certificate is proudly and honorably presented to'}
              </p>

              <div className="py-2">
                <h2 className="text-2xl sm:text-4xl font-serif font-bold text-blue-700 tracking-tight">
                  {certificate.studentName}
                </h2>
                <div className="w-32 sm:w-48 h-0.5 bg-yellow-400 mx-auto mt-2 rounded-full" />
              </div>

              <p className="text-xs sm:text-sm text-gray-700 max-w-xl mx-auto leading-relaxed">
                {populateCertificatePlaceholders(template.bodyText || '', sampleValues)}
              </p>
            </div>

            {/* Bottom Footer Section */}
            <div className="grid grid-cols-3 items-end pt-4 border-t border-gray-100 mt-2">
              <div className="text-left space-y-1">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                  Participation Date
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800">
                  {certificate.participationDate}
                </p>
                <div className="w-24 sm:w-32 h-[1px] bg-gray-300 mt-1" />
                <p className="text-[8px] sm:text-[9px] text-gray-500">
                  {template.footerNote || 'Official Program Issuance'}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                {template.showQrCode && (
                  <>
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
                  </>
                )}
              </div>

              <div className="text-right flex flex-col items-end space-y-1">
                {template.showSignature && (
                  <>
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
                      {template.signatureTitle || 'Campus Ambassador'} ({certificate.caId})
                    </p>
                  </>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* MANUAL PLACED ELEMENTS ONLY - Pure clean design with exact coordinates */
          <div className="relative z-10 w-full h-full">
            {(template.customElements || []).map(el => {
              let content: React.ReactNode = null;

              const resolvedFont = el.customFontName
                ? `"${el.customFontName}", ${el.fontFamily === 'serif' ? 'Georgia, serif' : el.fontFamily === 'mono' ? 'monospace' : 'sans-serif'}`
                : el.fontFamily === 'serif'
                ? 'Playfair Display, Georgia, serif'
                : el.fontFamily === 'mono'
                ? 'monospace'
                : 'sans-serif';

              if (el.type === 'placeholder' && isSignaturePlaceholderTag(el.placeholderTag)) {
                content = (
                  <div className="flex flex-col items-center">
                    {certificate.signatureUrl ? (
                      <img
                        src={certificate.signatureUrl}
                        alt="Signature"
                        className="max-h-12 object-contain"
                      />
                    ) : (
                      <span
                        className="italic font-serif"
                        style={{
                          fontSize: `${el.fontSize || 16}px`,
                          color: el.color || '#202124'
                        }}
                      >
                        {certificate.caName}
                      </span>
                    )}
                  </div>
                );
              } else if (el.type === 'placeholder' && !isQrPlaceholderTag(el.placeholderTag)) {
                const val = resolvePlaceholderValue(el.placeholderTag, sampleValues) ?? `{{${el.placeholderTag}}}`;
                content = (
                  <span
                    style={{
                      fontSize: `${el.fontSize || 16}px`,
                      fontWeight: el.fontWeight || 'normal',
                      color: el.color || '#202124',
                      fontFamily: resolvedFont
                    }}
                  >
                    {val}
                  </span>
                );
              } else if (el.type === 'text') {
                content = (
                  <span
                    style={{
                      fontSize: `${el.fontSize || 16}px`,
                      fontWeight: el.fontWeight || 'normal',
                      color: el.color || '#202124',
                      fontFamily: resolvedFont
                    }}
                  >
                    {populateCertificatePlaceholders(el.customText || '', sampleValues)}
                  </span>
                );
              } else if (el.type === 'image' && el.customText) {
                content = (
                  <img
                    src={el.customText}
                    alt={el.label || 'Certificate graphic'}
                    style={{
                      width: el.width ? `${el.width * 6}px` : '80px',
                      height: el.height ? `${el.height * 4}px` : 'auto',
                      objectFit: 'contain'
                    }}
                  />
                );
              } else if (el.type === 'qr' || (el.type === 'placeholder' && isQrPlaceholderTag(el.placeholderTag))) {
                content = (
                  <div className="flex flex-col items-center">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="QR Code"
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded bg-white p-0.5 border border-gray-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gray-100 rounded" />
                    )}
                    <span className="text-[8px] font-mono font-bold text-blue-600 mt-0.5">
                      {certificate.certificateId}
                    </span>
                  </div>
                );
              } else if (el.type === 'signature') {
                content = (
                  <div className="flex flex-col items-center">
                    {certificate.signatureUrl ? (
                      <img
                        src={certificate.signatureUrl}
                        alt="Signature"
                        className="max-h-10 object-contain"
                      />
                    ) : (
                      <span className="font-serif italic text-xs text-gray-700">{certificate.caName}</span>
                    )}
                    <div className="w-24 h-[1px] bg-gray-400 mt-1" />
                    <span className="text-[9px] font-bold text-gray-800 mt-0.5">{certificate.caName}</span>
                    <span className="text-[8px] text-blue-600 font-semibold">{template.signatureTitle || 'Campus Ambassador'}</span>
                  </div>
                );
              }

              return (
                <div
                  key={el.id}
                  className="absolute"
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    transform: el.textAlign === 'center' ? 'translate(-50%, -50%)' : el.textAlign === 'right' ? 'translate(-100%, -50%)' : 'translate(0%, -50%)'
                  }}
                >
                  {content}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
