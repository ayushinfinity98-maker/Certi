import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Student } from '../types';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (students: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'certificateStatus' | 'caUid'>>) => Promise<{ added: number; skipped: number; errors: string[] }>;
  defaultCollege?: string;
  defaultInitiative?: string;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  defaultCollege = '',
  defaultInitiative = 'Google Student Ambassador Tech Workshop 2026'
}) => {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadSampleCsv = () => {
    const csvContent = `fullName,email,college,semester,initiativeName,participationDate
Aarav Sharma,aarav.sharma@example.edu,${defaultCollege || 'National Institute of Technology'},Semester 6,Google Cloud & AI Workshop 2026,2026-11-10
Maya Patel,maya.patel@example.edu,${defaultCollege || 'National Institute of Technology'},Semester 4,Google Cloud & AI Workshop 2026,2026-11-10
David Kim,david.kim@example.edu,${defaultCollege || 'National Institute of Technology'},Semester 6,Google Cloud & AI Workshop 2026,2026-11-10`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'google_ambassador_students_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setParseError('The uploaded CSV file is empty.');
          return;
        }

        // Map flexible column headers
        const cleaned = results.data.map((row: any) => {
          const name = row.fullName || row.name || row['Student Name'] || row.student_name || '';
          const email = row.email || row['Email Address'] || row.student_email || '';
          const college = row.college || row['College'] || row.university || defaultCollege || 'University';
          const semester = row.semester || row['Semester'] || 'Semester 6';
          const initiative = row.initiativeName || row['Initiative'] || row.initiative || defaultInitiative;
          const date = row.participationDate || row['Date'] || row.date || new Date().toISOString().split('T')[0];

          return {
            fullName: String(name).trim(),
            email: String(email).trim().toLowerCase(),
            college: String(college).trim(),
            semester: String(semester).trim(),
            initiativeName: String(initiative).trim(),
            participationDate: String(date).trim(),
            caId: ''
          };
        }).filter(r => r.fullName && r.email && r.email.includes('@'));

        if (cleaned.length === 0) {
          setParseError('No valid student rows found. Please ensure headers include fullName and email.');
          return;
        }

        setParsedRows(cleaned);
      },
      error: (err) => {
        setParseError(`CSV Parsing error: ${err.message}`);
      }
    });
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await onImport(parsedRows);
      setResult(res);
      setParsedRows([]);
    } catch (err: any) {
      setParseError(err.message || 'Import failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Bulk Import Students via CSV / Excel
              </h3>
              <p className="text-xs text-gray-500">
                Easily register multiple participants at once with duplicate detection
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

        {/* Action helper bar */}
        <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-800">
          <span className="flex items-center">
            <Download className="w-4 h-4 mr-1.5 text-blue-600" />
            Need the right template? Download the pre-formatted CSV template.
          </span>
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="px-3 py-1 bg-white text-blue-700 font-semibold border border-blue-200 rounded-lg shadow-xs hover:bg-blue-100/50 transition"
          >
            Download Sample CSV
          </button>
        </div>

        {parseError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{parseError}</span>
          </div>
        )}

        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Import Completed Successfully!</span>
            </div>
            <p className="text-xs text-emerald-700">
              <span className="font-bold">{result.added}</span> students added.
              {result.skipped > 0 && (
                <span className="ml-2 font-semibold text-amber-700">
                  ({result.skipped} duplicate records automatically prevented from re-insertion)
                </span>
              )}
            </p>
          </div>
        )}

        {!result && (
          <>
            {parsedRows.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl p-8 text-center transition flex flex-col items-center justify-center space-y-3 bg-gray-50/60">
                <UploadCloud className="w-10 h-10 text-emerald-500" />
                <div>
                  <label className="cursor-pointer px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-sm inline-block">
                    Select CSV File
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Accepts comma-separated values (.csv)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                  <span>File: <span className="font-mono text-blue-600">{fileName}</span></span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                    {parsedRows.length} valid students ready
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs">
                  {parsedRows.slice(0, 15).map((row, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <p className="font-semibold text-gray-900">{row.fullName}</p>
                        <p className="text-[11px] text-gray-500">{row.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">{row.college}</span>
                        <span className="text-[11px] font-medium text-blue-600">{row.initiativeName}</span>
                      </div>
                    </div>
                  ))}
                  {parsedRows.length > 15 && (
                    <div className="p-2 text-center text-xs text-gray-400 bg-gray-50">
                      + {parsedRows.length - 15} more student rows
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          
          {parsedRows.length > 0 && !result && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isProcessing}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isProcessing ? 'Importing & Validating...' : `Import ${parsedRows.length} Students`}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
