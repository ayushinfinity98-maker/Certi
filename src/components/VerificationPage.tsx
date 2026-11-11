import React, { useEffect, useState } from 'react';
import { Certificate } from '../types';
import { getCertificateForVerification } from '../services/dataService';
import { ShieldCheck, ShieldAlert, Award, Calendar, School, User, Search, ArrowLeft, Download, CheckCircle2 } from 'lucide-react';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import { CertificateTemplate } from './CertificateTemplate';

interface VerificationPageProps {
  initialCertId?: string;
  onBackToApp?: () => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  initialCertId,
  onBackToApp
}) => {
  const [certIdQuery, setCertIdQuery] = useState(initialCertId || '');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFullCertificate, setShowFullCertificate] = useState(false);

  useEffect(() => {
    if (initialCertId) {
      handleLookup(initialCertId);
    }
  }, [initialCertId]);

  const handleLookup = async (id: string) => {
    if (!id.trim()) return;
    setIsLoading(true);
    setSearched(true);
    try {
      const found = await getCertificateForVerification(id.trim());
      setCertificate(found);
    } catch (err) {
      console.error('Verification error:', err);
      setCertificate(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(certIdQuery);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 select-none">
              <span className="text-2xl font-bold text-[#4285F4]">G</span>
              <span className="text-2xl font-bold text-[#EA4335]">o</span>
              <span className="text-2xl font-bold text-[#FBBC05]">o</span>
              <span className="text-2xl font-bold text-[#4285F4]">g</span>
              <span className="text-2xl font-bold text-[#34A853]">l</span>
              <span className="text-2xl font-bold text-[#EA4335]">e</span>
            </div>
            <div className="h-4 w-[1px] bg-gray-300" />
            <span className="text-xs sm:text-sm font-semibold text-gray-700">
              Certificate Verification Portal
            </span>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Ambassador Portal
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        
        {/* Search bar */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
            <Award className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Official Google Student Ambassador Program 2026
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Verify Certificate Authenticity
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-lg mx-auto">
            Enter the unique Certificate ID printed on the certificate or encoded in the verification QR code.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 max-w-md mx-auto flex space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={certIdQuery}
                onChange={(e) => setCertIdQuery(e.target.value.toUpperCase())}
                placeholder="e.g. GSAP-2026-CA001-A9F82"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !certIdQuery.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>

        {/* Result Area */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 mt-4 font-medium">
              Checking cryptographic certificate registry...
            </p>
          </div>
        )}

        {!isLoading && searched && !certificate && (
          <div className="p-8 bg-white rounded-2xl border border-red-200 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Certificate Not Found
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
              No official record matches the certificate ID <span className="font-mono font-semibold text-gray-800">"{certIdQuery}"</span>. Please ensure the identifier is typed correctly.
            </p>
          </div>
        )}

        {!isLoading && certificate && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden animate-in fade-in duration-300">
            {/* Status Banner */}
            <div className={`p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3 ${
              certificate.status === 'valid'
                ? 'bg-emerald-50 border-b border-emerald-100'
                : 'bg-amber-50 border-b border-amber-100'
            }`}>
              <div className="flex items-center space-x-3">
                {certificate.status === 'valid' ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900">
                      {certificate.status === 'valid' ? 'Valid & Authentic Certificate' : 'Certificate Revoked'}
                    </h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      certificate.status === 'valid'
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-amber-200 text-amber-900'
                    }`}>
                      {certificate.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-mono">
                    ID: {certificate.certificateId}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFullCertificate(!showFullCertificate)}
                  className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg border border-gray-300 shadow-2xs transition"
                >
                  {showFullCertificate ? 'Hide Visual' : 'View Visual Certificate'}
                </button>
                <button
                  onClick={() => downloadCertificatePdf(certificate)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition flex items-center"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Visual preview toggle */}
            {showFullCertificate && (
              <div className="p-6 bg-slate-100 border-b border-gray-200">
                <CertificateTemplate certificate={certificate} showActions={false} />
              </div>
            )}

            {/* Public Verified Attributes (Guaranteed ZERO Student Email or Private PII) */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Student Full Name
                  </span>
                  <p className="text-base sm:text-lg font-bold text-gray-900">
                    {certificate.studentName}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Initiative / Event
                  </span>
                  <p className="text-base sm:text-lg font-bold text-blue-600">
                    {certificate.initiativeName}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Institution & Semester
                  </span>
                  <p className="text-sm font-semibold text-gray-800 flex items-center mt-1">
                    <School className="w-4 h-4 mr-1.5 text-gray-400" />
                    {certificate.college} ({certificate.semester})
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Participation Date
                  </span>
                  <p className="text-sm font-semibold text-gray-800 flex items-center mt-1">
                    <Calendar className="w-4 h-4 mr-1.5 text-gray-400" />
                    {certificate.participationDate}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Issuing Authority & Program
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {certificate.caName}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        Campus Ambassador ({certificate.caId}), {certificate.programName}
                      </p>
                    </div>
                    {certificate.signatureUrl && (
                      <div className="h-10 border-l border-gray-200 pl-4 flex items-center">
                        <img
                          src={certificate.signatureUrl}
                          alt="Signature"
                          className="max-h-8 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Privacy disclaimer */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center space-x-2 text-xs text-blue-800">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Privacy Protected: Personal contact information and emails are redacted in compliance with security guidelines.
                </span>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
        Google Student Ambassador Program 2026 &bull; Official Digital Verification Service
      </footer>
    </div>
  );
};
