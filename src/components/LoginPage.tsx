import React, { useState } from 'react';
import { useAuth, BOOTSTRAP_ADMIN_EMAIL } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle, Search, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LoginPageProps {
  onGoToVerify: () => void;
  onGoToPrivacy: () => void;
  onGoToTerms: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onGoToVerify,
  onGoToPrivacy,
  onGoToTerms
}) => {
  const { loginWithGoogle, loginWithCredentials, loginDirectSuperAdmin, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email or CA ID and your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(identifier.trim(), password.trim());
      if (!res.success) {
        setError(res.error || 'Authentication failed. Please check your email/CA ID and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Login error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google Sign-in failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex flex-col justify-between p-4 sm:p-6">
      
      {/* Top Brand Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center space-x-3">
          <BrandLogo size="md" />
          <div className="h-5 w-[1px] bg-gray-300" />
          <span className="text-xs sm:text-sm font-semibold text-gray-700">
            Campus Ambassador System
          </span>
        </div>

        <button
          onClick={onGoToVerify}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 mr-1 text-blue-600" />
          Verify Certificate
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xl p-8 space-y-6 relative overflow-hidden">
          
          {/* Quad color top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853]" />

          {/* Heading */}
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-2">
              <BrandLogo size="lg" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Campus Ambassador System
            </h1>
            <p className="text-xs text-gray-600 leading-relaxed">
              Manage Campus Ambassador records, issue official student certificates, and provide public verification.
            </p>
            <p className="text-[11px] text-gray-400">
              Sign in to your Campus Ambassador or Super Admin account
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-700">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
              <div className="pt-1 border-t border-red-200/60 flex items-center justify-between">
                <span className="text-[11px] text-red-600">Are you the Super Admin?</span>
                <button
                  type="button"
                  onClick={() => loginDirectSuperAdmin()}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] shadow-2xs transition"
                >
                  Direct Admin Login ({BOOTSTRAP_ADMIN_EMAIL})
                </button>
              </div>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Email Address or CA ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@university.edu or CA-2026-001"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing In...' : 'Sign In with Email & Password'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Alternative Google Sign In */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center space-x-3">
              <div className="flex-1 h-[1px] bg-gray-200" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Or continue with
              </span>
              <div className="flex-1 h-[1px] bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isSubmitting}
              className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 shadow-2xs transition flex items-center justify-center space-x-2.5 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
            <p className="text-[10px] text-gray-500 text-center leading-relaxed">
              Campus Ambassadors can sign in anytime using their <span className="font-semibold text-gray-700">Email / CA ID &amp; Password</span> above. If Google Sign-In shows an access-blocked message, the Super Admin must set OAuth Consent Screen to <span className="font-semibold text-gray-700">In Production</span> in Google Cloud Console.
            </p>
          </div>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Campus Ambassador credentials are provisioned by the Super Administrator. If you need account assistance, contact your program administrator.
          </p>

        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>Campus Ambassador System &bull; Certificate Issuance &amp; Verification Platform</span>
        <span>&bull;</span>
        <a
          href="/privacy"
          onClick={(e) => {
            e.preventDefault();
            onGoToPrivacy();
          }}
          className="text-gray-500 hover:text-blue-600 hover:underline"
        >
          Privacy Policy
        </a>
        <span>&bull;</span>
        <a
          href="/terms"
          onClick={(e) => {
            e.preventDefault();
            onGoToTerms();
          }}
          className="text-gray-500 hover:text-blue-600 hover:underline"
        >
          Terms of Service
        </a>
      </footer>

    </div>
  );
};
