import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface TermsOfServicePageProps {
  onNavigateHome: () => void;
  onNavigatePrivacy: () => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({
  onNavigateHome,
  onNavigatePrivacy
}) => {
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
              <FileText className="w-3.5 h-3.5" />
              <span>Terms &amp; Conditions</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-xs text-gray-500">
              Applies to <span className="font-semibold text-gray-700">Campus Ambassador System</span> &bull; Last updated: November 2026
            </p>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            By accessing or using Campus Ambassador System, you agree to comply with these Terms of Service. If you do not agree to these terms, you must not use the platform.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">1. Authorized Users Only</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Administrative and certificate issuance dashboards are restricted strictly to pre-authorized Super Administrators and active Campus Ambassadors approved by the program administrator. Unauthorized login attempts, credential sharing, or impersonation of another Campus Ambassador or administrator are strictly prohibited. Public visitors may use the verification portal solely to verify issued certificate identifiers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">2. Acceptable Use</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              You agree to use Campus Ambassador System only for legitimate program management, student registration, and certificate issuance. You must not attempt to bypass security rules, scrape database collections, upload malicious scripts or inappropriate signature images, send unsolicited bulk emails, or interfere with the availability of the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">3. Certificate Accuracy &amp; Integrity</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Campus Ambassadors are responsible for verifying that all student names, email addresses, institution names, initiative titles, and participation dates submitted to the system are accurate and authentic. Issuing fabricated or unauthorized certificates is prohibited. The program administrator reserves the right to correct, revoke, or invalidate any certificate found to be inaccurate or improperly issued.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">4. Account Suspension &amp; Termination</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The Super Administrator may deactivate, suspend, or remove any Campus Ambassador account at any time without prior notice if these Terms are violated, if unauthorized activity is suspected, or upon completion or termination of the ambassador's role in the program.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">5. Limitation of Liability</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Campus Ambassador System is provided on an "as is" and "as available" basis without warranties of any kind, express or implied. To the maximum extent permitted by applicable law, the platform operators and program administrators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data or service interruption arising from your use of or inability to use the platform.
            </p>
          </section>

          <section className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <h2 className="text-sm font-bold text-gray-900">6. Questions</h2>
            <p className="text-sm text-gray-600">
              For questions regarding these Terms of Service or account status, please Contact the program administrator.
            </p>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-4 text-center text-xs text-gray-500 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>Campus Ambassador System</span>
        <span>&bull;</span>
        <a
          href="/privacy"
          onClick={(e) => {
            e.preventDefault();
            onNavigatePrivacy();
          }}
          className="text-blue-600 hover:underline"
        >
          Privacy Policy
        </a>
        <span>&bull;</span>
        <span className="font-semibold text-gray-700">Terms of Service</span>
      </footer>
    </div>
  );
};
