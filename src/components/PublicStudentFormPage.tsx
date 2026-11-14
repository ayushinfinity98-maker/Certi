import React, { useEffect, useState } from 'react';
import { CaRegistrationForm } from '../types';
import { getPublicFormById, submitPublicStudentForm } from '../services/formService';
import { BrandLogo } from './BrandLogo';
import {
  CheckCircle2,
  AlertCircle,
  Send,
  FileText,
  School,
  UserCheck,
  Lock,
  ArrowLeft
} from 'lucide-react';

interface PublicStudentFormPageProps {
  formId: string;
  onBackToApp?: () => void;
}

export const PublicStudentFormPage: React.FC<PublicStudentFormPageProps> = ({
  formId,
  onBackToApp
}) => {
  const [form, setForm] = useState<CaRegistrationForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSubmittedSuccess(false);

    getPublicFormById(formId)
      .then((loaded) => {
        if (cancelled) return;
        setForm(loaded);
        if (loaded) {
          const initialAnswers: Record<string, string> = {};
          loaded.fields.forEach(f => {
            if (f.defaultValue) {
              initialAnswers[f.key] = f.defaultValue;
            }
          });
          setAnswers(initialAnswers);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          console.error('Error loading public form:', err);
          setError(err?.message || 'Could not load this registration form.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await submitPublicStudentForm(form, answers);
      setSubmittedSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForAnother = () => {
    if (!form) return;
    const initialAnswers: Record<string, string> = {};
    form.fields.forEach(f => {
      if (f.defaultValue) initialAnswers[f.key] = f.defaultValue;
    });
    setAnswers(initialAnswers);
    setSubmittedSuccess(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BrandLogo size="md" />
            <div className="h-5 w-[1px] bg-gray-300" />
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-bold text-gray-900">
                Campus Ambassador System
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                Student Registration & Certificate Form
              </span>
            </div>
          </div>

          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Portal
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex-1">
        {isLoading ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs space-y-3">
            <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading registration form...</p>
          </div>
        ) : !form ? (
          <div className="bg-white rounded-3xl border border-red-200 p-8 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Form Not Found</h1>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              This registration form link is invalid or may have been removed by the Campus Ambassador.
            </p>
          </div>
        ) : !form.isActive ? (
          <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">{form.title}</h1>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 inline-block">
              This form is currently closed and not accepting new responses.
            </p>
            <p className="text-[11px] text-gray-500">
              Organized by {form.caName} &bull; {form.caCollege}
            </p>
          </div>
        ) : submittedSuccess ? (
          <div className="bg-white rounded-3xl border border-emerald-200 p-8 sm:p-10 text-center shadow-lg space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Response Submitted!</h1>
            <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Thank you, <span className="font-bold text-gray-900">{answers.fullName}</span>. Your details for{' '}
              <span className="font-semibold text-blue-700">{form.title}</span> have been recorded with{' '}
              <span className="font-semibold">{form.caName}</span>.
            </p>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-left max-w-md mx-auto space-y-1">
              <div><span className="text-gray-500">Email:</span> <span className="font-mono font-semibold text-gray-800">{answers.email}</span></div>
              {answers.college && <div><span className="text-gray-500">Institution:</span> <span className="font-semibold text-gray-800">{answers.college}</span></div>}
              {answers.initiativeName && <div><span className="text-gray-500">Event:</span> <span className="font-semibold text-gray-800">{answers.initiativeName}</span></div>}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={resetForAnother}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition"
              >
                Submit Another Response
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-lg overflow-hidden">
            {/* Top Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 sm:p-8 text-white space-y-2">
              <div className="flex items-center space-x-2 text-[11px] font-semibold text-blue-100 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                <span>Campus Ambassador Registration Form</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold leading-snug">{form.title}</h1>
              {form.description && (
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                  {form.description}
                </p>
              )}
              <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-blue-100">
                <span className="inline-flex items-center bg-white/15 px-2.5 py-1 rounded-lg">
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  Host: {form.caName} ({form.caId})
                </span>
                <span className="inline-flex items-center bg-white/15 px-2.5 py-1 rounded-lg">
                  <School className="w-3.5 h-3.5 mr-1.5" />
                  {form.caCollege}
                </span>
              </div>
            </div>

            {/* Dynamic Form Fields */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {form.fields
                .filter(field => field.enabled)
                .map((field) => {
                  const val = answers[field.key] ?? '';
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-xs sm:text-sm font-bold text-gray-800">
                        {field.label}{' '}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          required={field.required}
                          value={val}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={val}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        >
                          <option value="">-- Select {field.label} --</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          required={field.required}
                          value={val}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      )}
                    </div>
                  );
                })}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <span className="text-[11px] text-gray-400">
                  No sign-in required &bull; Information is used for certificate issuance.
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition flex items-center disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  {isSubmitting ? 'Submitting...' : 'Submit Form'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        Campus Ambassador System &bull; Public Student Registration Portal
      </footer>
    </div>
  );
};
