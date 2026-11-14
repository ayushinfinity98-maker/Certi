import React from 'react';
import { ArrowLeft, ShieldCheck, Lock, Database, Mail, Trash2 } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface PrivacyPolicyPageProps {
  onNavigateHome: () => void;
  onNavigateTerms: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onNavigateHome,
  onNavigateTerms
}) => {
  const contactEmail = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="flex items-center space-x-2.5 text-gray-900 hover:opacity-80 transition"
          >
            <BrandLogo size="sm" />
            <span className="text-sm sm:text-base font-bold tracking-tight">
              Campus Ambassador System
            </span>
          </a>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Home
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <article className="bg-white rounded-3xl border border-gray-200/90 shadow-xs p-6 sm:p-10 space-y-6">
          <div className="border-b border-gray-100 pb-5 space-y-2">
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Legal &amp; Privacy</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-gray-500">
              Applies to <span className="font-semibold text-gray-700">Campus Ambassador System</span> &bull; Last updated: November 2026
            </p>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            Campus Ambassador System is a certificate management, issuance, and verification platform used by authorized program administrators and Campus Ambassadors. This Privacy Policy explains what information we collect, why we collect it, how it is stored, and how you can request deletion.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <Database className="w-4 h-4 text-blue-600 shrink-0" />
              <span>1. Information We Collect</span>
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Depending on your role on the platform, Campus Ambassador System collects and processes the following data:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5 leading-relaxed">
              <li>
                <span className="font-semibold text-gray-800">Campus Ambassador &amp; Administrator Profiles:</span> Full name, email address, institution/college name, phone number, assigned Campus Ambassador ID, and digital signature assets.
              </li>
              <li>
                <span className="font-semibold text-gray-800">Google Sign-In Information:</span> When you sign in with Google OAuth, we receive your Google account email address and profile display name solely to verify your authorization and authenticate your session.
              </li>
              <li>
                <span className="font-semibold text-gray-800">Student Certificate Records:</span> Participant full name, email address, college/institution, semester/year, initiative or event name, participation date, certificate identifier, and email delivery status logs.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-blue-600 shrink-0" />
              <span>2. How We Use Information</span>
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We use the collected information strictly for operating the Campus Ambassador System, including:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5 leading-relaxed">
              <li>Authenticating authorized Campus Ambassadors and program administrators.</li>
              <li>Issuing official digital certificates and maintaining public certificate verification links.</li>
              <li>Sending official certificate notification emails and PDF attachments to student recipients.</li>
              <li>Maintaining administrative audit logs for security and accountability.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>3. Data Storage, Security &amp; No Sale of Data</span>
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Application data, user records, and issued certificate metadata are stored securely using <span className="font-semibold text-gray-800">Google Firebase Authentication and Cloud Firestore</span>, protected by role-based Firestore security rules.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed font-medium">
              We do not sell, rent, or trade your personal information to third parties, and we do not use Google user data for advertising or unrelated commercial purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <Trash2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>4. Data Retention &amp; Deletion Requests</span>
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Records are retained for as long as needed to support certificate verification and program administration. Authorized users and certificate recipients may request correction or deletion of their personal data at any time. Upon verification of a valid deletion request, the program administrator will remove the applicable account or participant records from Firestore.
            </p>
          </section>

          <section className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <h2 className="text-sm font-bold text-gray-900">5. Contact</h2>
            <p className="text-sm text-gray-600">
              For privacy questions or data deletion requests, please <span className="font-semibold text-gray-800">Contact the program administrator</span>
              {contactEmail ? (
                <>
                  {' '}at{' '}
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {contactEmail}
                  </a>
                  .
                </>
              ) : (
                '.'
              )}
            </p>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-4 text-center text-xs text-gray-500 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>Campus Ambassador System</span>
        <span>&bull;</span>
        <span className="font-semibold text-gray-700">Privacy Policy</span>
        <span>&bull;</span>
        <a
          href="/terms"
          onClick={(e) => {
            e.preventDefault();
            onNavigateTerms();
          }}
          className="text-blue-600 hover:underline"
        >
          Terms of Service
        </a>
      </footer>
    </div>
  );
};
