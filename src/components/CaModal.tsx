import React, { useState, useEffect } from 'react';
import { CampusAmbassador, AmbassadorPermissions } from '../types';
import { X, UserCheck, Key, Shield, AlertCircle, Sparkles, CheckSquare, Square, Chrome } from 'lucide-react';
import { generateScriptSignatureDataUrl } from '../utils/signatureUtils';

interface CaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<CampusAmbassador, 'createdAt' | 'updatedAt' | 'totalStudents' | 'totalCertificates'>) => Promise<void>;
  ca?: CampusAmbassador | null;
  nextCaNumber?: number;
}

export const CaModal: React.FC<CaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ca,
  nextCaNumber = 1
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [caId, setCaId] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [status, setStatus] = useState<'active' | 'deactivated' | 'suspended'>('active');
  const [allowGoogleLogin, setAllowGoogleLogin] = useState(true);
  const [googleEmail, setGoogleEmail] = useState('');

  // Granular Permissions ("jo admin permission de co save hoti rhe")
  const [canIssueCertificates, setCanIssueCertificates] = useState(true);
  const [canImportCsv, setCanImportCsv] = useState(true);
  const [canEditStudents, setCanEditStudents] = useState(true);
  const [canSendEmails, setCanSendEmails] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ca) {
      setName(ca.name);
      setEmail(ca.email);
      setCollege(ca.college);
      setPhone(ca.phone || '');
      setCaId(ca.caId);
      setInitialPassword(ca.initialPassword || '');
      setStatus(ca.status);
      setAllowGoogleLogin(ca.allowGoogleLogin !== false);
      setGoogleEmail(ca.googleEmail || ca.email || '');

      const perms = ca.permissions || {
        canIssueCertificates: true,
        canImportCsv: true,
        canEditStudents: true,
        canSendEmails: true
      };
      setCanIssueCertificates(perms.canIssueCertificates !== false);
      setCanImportCsv(perms.canImportCsv !== false);
      setCanEditStudents(perms.canEditStudents !== false);
      setCanSendEmails(perms.canSendEmails !== false);
    } else {
      setName('');
      setEmail('');
      setCollege('');
      setPhone('');
      const padNum = String(nextCaNumber).padStart(3, '0');
      setCaId(`CA-2026-${padNum}`);
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      setInitialPassword(`Ambassador@${randStr}26`);
      setStatus('active');
      setAllowGoogleLogin(true);
      setGoogleEmail('');
      setCanIssueCertificates(true);
      setCanImportCsv(true);
      setCanEditStudents(true);
      setCanSendEmails(true);
    }
    setError(null);
  }, [ca, nextCaNumber, isOpen]);

  if (!isOpen) return null;

  const generateNewPassword = () => {
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    setInitialPassword(`Ambassador@${randStr}26`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !college.trim() || !caId.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid official email address.');
      return;
    }

    if (!initialPassword.trim()) {
      setError('Please assign an initial login password for this Campus Ambassador.');
      return;
    }

    const permissions: AmbassadorPermissions = {
      canIssueCertificates,
      canImportCsv,
      canEditStudents,
      canSendEmails
    };

    setIsSubmitting(true);
    try {
      const defaultSig = ca?.signatureUrl || generateScriptSignatureDataUrl(name.trim());
      await onSave({
        uid: ca?.uid || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        college: college.trim(),
        phone: phone.trim(),
        caId: caId.trim().toUpperCase(),
        initialPassword: initialPassword.trim(),
        allowGoogleLogin,
        googleEmail: (googleEmail.trim() || email.trim()).toLowerCase(),
        permissions,
        status,
        signatureUrl: defaultSig,
        signatureUpdatedAt: ca?.signatureUpdatedAt || new Date().toISOString()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save Campus Ambassador record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 flex flex-col space-y-5 my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {ca ? 'Edit Ambassador Account & Permissions' : 'Add Campus Ambassador Account'}
              </h3>
              <p className="text-xs text-gray-500">
                Setup login credentials, Google Auth, and operational permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              1. Basic Profile
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya Sharma"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Assigned CA ID *
                </label>
                <input
                  type="text"
                  required
                  value={caId}
                  onChange={(e) => setCaId(e.target.value.toUpperCase())}
                  placeholder="CA-2026-003"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!googleEmail) setGoogleEmail(e.target.value);
                  }}
                  placeholder="maya@university.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  College / Institution *
                </label>
                <input
                  type="text"
                  required
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. IIT Delhi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Contact Phone (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Login Credentials & Authentication Options */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block flex items-center">
              <Key className="w-3.5 h-3.5 mr-1 text-blue-600" />
              2. Authentication & Login Methods
            </span>

            {/* Email + Password Setup */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700">
                  Account Password *
                </label>
                <button
                  type="button"
                  onClick={generateNewPassword}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Generate Password
                </button>
              </div>
              <input
                type="text"
                required
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Ambassador password"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Ambassador can log in with their CA ID (<span className="font-mono text-blue-600 font-bold">{caId || 'CA-ID'}</span>) or Email and this password.
              </p>
            </div>

            {/* Direct Google Sign-In Enablement */}
            <div className="pt-2 border-t border-slate-200/80 space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowGoogleLogin}
                  onChange={(e) => setAllowGoogleLogin(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 flex items-center">
                    <Chrome className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
                    Allow Direct Google Sign-In
                  </span>
                  <p className="text-[10px] text-gray-500">
                    Ambassador can log in with 1-click via Google using their registered Google email
                  </p>
                </div>
              </label>

              {allowGoogleLogin && (
                <div className="pl-6 pt-1">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Designated Google Account Email (if different from official email)
                  </label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder={email || 'ambassador.google@gmail.com'}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Granular Permissions (Admin Control) */}
          <div className="p-4 bg-blue-50/50 border border-blue-200/70 rounded-2xl space-y-2.5">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1 text-blue-600" />
              3. Operational Permissions (Configured by Super Admin)
            </span>
            <p className="text-[11px] text-gray-600">
              Select which operational actions this Campus Ambassador is allowed to perform in their dashboard:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-blue-100 hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={canIssueCertificates}
                  onChange={(e) => setCanIssueCertificates(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Issue Certificates</span>
                  <span className="text-[10px] text-gray-500 block">Generate and grant verified certificates</span>
                </div>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-blue-100 hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={canImportCsv}
                  onChange={(e) => setCanImportCsv(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Import Students CSV</span>
                  <span className="text-[10px] text-gray-500 block">Bulk upload participant lists via Excel/CSV</span>
                </div>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-blue-100 hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={canEditStudents}
                  onChange={(e) => setCanEditStudents(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Manage Student Records</span>
                  <span className="text-[10px] text-gray-500 block">Add, edit, or delete student registrations</span>
                </div>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-blue-100 hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={canSendEmails}
                  onChange={(e) => setCanSendEmails(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Automated Email Dispatch</span>
                  <span className="text-[10px] text-gray-500 block">Deliver PDF certificates directly to student emails</span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Account Status */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e: any) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="active">Active (Full access permitted by permissions)</option>
              <option value="deactivated">Deactivated (Access temporarily paused)</option>
              <option value="suspended">Suspended (Login completely blocked)</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Ambassador...' : ca ? 'Update Ambassador & Permissions' : 'Create Ambassador Account'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
