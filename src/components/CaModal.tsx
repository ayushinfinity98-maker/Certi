import React, { useState, useEffect } from 'react';
import { CampusAmbassador } from '../types';
import { X, UserCheck, Key, Shield, AlertCircle } from 'lucide-react';
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
    } else {
      setName('');
      setEmail('');
      setCollege('');
      setPhone('');
      const padNum = String(nextCaNumber).padStart(3, '0');
      setCaId(`CA-2026-${padNum}`);
      // Generate a strong, friendly initial password
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      setInitialPassword(`Ambassador@${randStr}26`);
      setStatus('active');
    }
    setError(null);
  }, [ca, nextCaNumber, isOpen]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {ca ? 'Edit Campus Ambassador' : 'Create Campus Ambassador Account'}
              </h3>
              <p className="text-xs text-gray-500">
                Google Student Ambassador Program 2026
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya Sharma"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Assigned CA ID *
              </label>
              <input
                type="text"
                required
                value={caId}
                onChange={(e) => setCaId(e.target.value.toUpperCase())}
                placeholder="CA-2026-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Official Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. maya.ambassador@university.edu"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                College / Institution *
              </label>
              <input
                type="text"
                required
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="e.g. IIT Delhi"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0192"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Credentials box */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-900">
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <span>CA Login Credentials (Provided by Admin)</span>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-blue-800 mb-1">
                Initial Account Password
              </label>
              <input
                type="text"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-blue-600 mt-1">
                Provide these credentials to the Ambassador. They can log in via CA ID or Email.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e: any) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="active">Active (Can issue certificates & manage students)</option>
              <option value="deactivated">Deactivated (Access temporarily disabled)</option>
              <option value="suspended">Suspended (Blocked from logging in)</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : ca ? 'Save Changes' : 'Create CA Account'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
