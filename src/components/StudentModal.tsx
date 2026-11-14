import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { X, UserPlus, Check, AlertCircle } from 'lucide-react';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'certificateStatus' | 'caUid'>) => Promise<void>;
  student?: Student | null;
  defaultCollege?: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  student,
  defaultCollege = ''
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [college, setCollege] = useState(defaultCollege);
  const [semester, setSemester] = useState('Fall 2026');
  const [initiativeName, setInitiativeName] = useState('Google Cloud & AI Campus Workshop');
  const [participationDate, setParticipationDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setFullName(student.fullName);
      setEmail(student.email);
      setCollege(student.college);
      setSemester(student.semester);
      setInitiativeName(student.initiativeName);
      setParticipationDate(student.participationDate);
    } else {
      setFullName('');
      setEmail('');
      setCollege(defaultCollege || 'National Institute of Technology');
      setSemester('Fall 2026');
      setInitiativeName('Google Cloud & AI Campus Workshop');
      setParticipationDate(new Date().toISOString().split('T')[0]);
    }
    setError(null);
  }, [student, defaultCollege, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !college.trim() || !initiativeName.trim() || !participationDate) {
      setError('Please fill in all required fields.');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        college: college.trim(),
        semester: semester.trim(),
        initiativeName: initiativeName.trim(),
        participationDate,
        caId: student?.caId || ''
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save student record.');
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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {student ? 'Edit Student Record' : 'Register New Student'}
              </h3>
              <p className="text-xs text-gray-500">
                Campus Ambassador System
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
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Student Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jordan Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Student Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. jordan.smith@university.edu"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Certificates and official verification will be sent to this email.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                College / University *
              </label>
              <input
                type="text"
                required
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="e.g. Stanford University"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Semester / Year *
              </label>
              <input
                type="text"
                required
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Semester 5 / Year 3"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Initiative Name *
            </label>
            <input
              type="text"
              required
              value={initiativeName}
              onChange={(e) => setInitiativeName(e.target.value)}
              placeholder="e.g. Google Cloud & AI Study Jam 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Participation Date *
            </label>
            <input
              type="date"
              required
              value={participationDate}
              onChange={(e) => setParticipationDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
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
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {isSubmitting ? 'Saving...' : student ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
