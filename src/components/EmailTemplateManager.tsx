import React, { useState, useEffect, useRef } from 'react';
import { EmailTemplate } from '../types';
import { getActiveEmailTemplate, subscribeToActiveEmailTemplate, updateEmailTemplate, sendTestEmailViaGmail } from '../services/emailService';
import { logEmailTemplateChange } from '../services/dataService';
import { Mail, Save, Eye, Send, CheckCircle2, AlertCircle, Sparkles, Chrome } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MAIN_ADMIN_EMAIL } from '../services/googleWorkspaceAuth';

interface EmailTemplateManagerProps {
  adminUid: string;
  adminEmail?: string;
}

export const EmailTemplateManager: React.FC<EmailTemplateManagerProps> = ({ adminUid, adminEmail }) => {
  const { isAdminGmailConnected, connectAdminGmail } = useAuth();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState(MAIN_ADMIN_EMAIL);
  const [testEmailAddress, setTestEmailAddress] = useState(MAIN_ADMIN_EMAIL);

  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [confirmTestSend, setConfirmTestSend] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const isDirtyRef = useRef(false);

  const applyTemplateToForm = (tpl: EmailTemplate) => {
    setTemplate(tpl);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setFooter(tpl.footer);
    setSenderName(tpl.senderName);
    setSenderEmail(tpl.senderEmail);
  };

  useEffect(() => {
    getActiveEmailTemplate().then(applyTemplateToForm);
    const unsub = subscribeToActiveEmailTemplate((tpl) => {
      if (!isDirtyRef.current) {
        applyTemplateToForm(tpl);
      }
    });
    return () => unsub();
  }, []);

  const placeholders = [
    { tag: '{{student_name}}', desc: 'Student Full Name' },
    { tag: '{{student_email}}', desc: 'Student Email Address' },
    { tag: '{{ca_name}}', desc: 'Campus Ambassador Name' },
    { tag: '{{initiative_name}}', desc: 'Event / Workshop Initiative' },
    { tag: '{{college_name}}', desc: 'College / University' },
    { tag: '{{semester}}', desc: 'Semester / Academic Year' },
    { tag: '{{certificate_id}}', desc: 'Unique Certificate ID' },
    { tag: '{{participation_date}}', desc: 'Date of Participation' },
    { tag: '{{verification_url}}', desc: 'Online Verification URL' }
  ];

  const handleInsertTag = (tag: string) => {
    isDirtyRef.current = true;
    setBody((prev) => prev + tag);
  };

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const updated: EmailTemplate = {
        ...template,
        subject,
        body,
        footer,
        senderName,
        senderEmail,
        updatedBy: adminUid,
        updatedAt: new Date().toISOString()
      };
      await updateEmailTemplate(updated, adminUid);
      await logEmailTemplateChange(subject, adminUid, adminEmail || 'admin@google.com');
      isDirtyRef.current = false;
      setTemplate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save email template:', err);
      setSaveError(err?.message || 'Failed saving email template to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    setTestStatus(null);
    try {
      const res = await connectAdminGmail();
      if (res.email !== MAIN_ADMIN_EMAIL.toLowerCase()) {
        setTestStatus({
          type: 'error',
          message: `Connected ${res.email}, but emails should be authorized from ${MAIN_ADMIN_EMAIL}.`
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: err.message || 'Could not authorize Google account.'
      });
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) return;
    if (!confirmTestSend) {
      setConfirmTestSend(true);
      return;
    }

    setIsSendingTest(true);
    setTestStatus(null);
    try {
      await sendTestEmailViaGmail({
        to: testEmailAddress,
        subject,
        body,
        footer,
        senderName
      });
      setConfirmTestSend(false);
      setTestStatus({
        type: 'success',
        message: `Test email genuinely sent from ${MAIN_ADMIN_EMAIL} to ${testEmailAddress}!`
      });
      setTimeout(() => setTestStatus(null), 5000);
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: err.message || 'Could not send test email.'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Preview mock substitution
  const previewSubject = subject.replace(/{{student_name}}/g, 'Alex Rivera');
  const previewBody = body
    .replace(/{{student_name}}/g, 'Alex Rivera')
    .replace(/{{student_email}}/g, 'alex.rivera@stanford.edu')
    .replace(/{{ca_name}}/g, 'Jordan Lee')
    .replace(/{{initiative_name}}/g, 'Google Cloud & AI Innovation Summit 2026')
    .replace(/{{college_name}}/g, 'Stanford University')
    .replace(/{{semester}}/g, 'Semester 6')
    .replace(/{{certificate_id}}/g, 'GSAP-2026-CA001-A9F82')
    .replace(/{{participation_date}}/g, '2026-11-10')
    .replace(/{{verification_url}}/g, 'https://google-student-ambassador-2026.web.app/verify/GSAP-2026-CA001-A9F82');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Official Email Template Manager
              </h2>
              <p className="text-xs text-gray-500">
                Centrally managed by Super Admin &bull; CAs cannot alter email wording or design
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition flex items-center"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            {showPreview ? 'Edit Template' : 'Live Email Preview'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Official central email template updated and synced across all Campus Ambassadors.</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-800">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="font-bold text-red-700 ml-3">✕</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form or Preview */}
        <div className="lg:col-span-2 space-y-6">
          {!showPreview ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => { isDirtyRef.current = true; setSenderName(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Central Official Sender Email
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => { isDirtyRef.current = true; setSenderEmail(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => { isDirtyRef.current = true; setSubject(e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700">
                    Email Body Content (Markdown / Plaintext with Placeholders)
                  </label>
                  <span className="text-[11px] text-gray-400">
                    PDF certificate automatically attached
                  </span>
                </div>
                <textarea
                  rows={12}
                  value={body}
                  onChange={(e) => { isDirtyRef.current = true; setBody(e.target.value); }}
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs sm:text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Official Email Footer Notice
                </label>
                <textarea
                  rows={2}
                  value={footer}
                  onChange={(e) => { isDirtyRef.current = true; setFooter(e.target.value); }}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

            </div>
          ) : (
            /* Live Simulated Email Client Preview */
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-500 ml-2 font-medium">
                    Student Email Inbox Preview
                  </span>
                </div>
                <span className="text-[11px] text-blue-600 font-semibold">
                  Google Workspace Client
                </span>
              </div>

              <div className="p-6 space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-base font-bold text-gray-900">
                    {previewSubject}
                  </h3>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <div>
                      <span className="font-semibold text-gray-800">{senderName}</span> &lt;{senderEmail}&gt;
                    </div>
                    <div>Today, 10:45 AM</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    To: Alex Rivera &lt;alex.rivera@stanford.edu&gt;
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-gray-800 whitespace-pre-line leading-relaxed font-sans py-2">
                  {previewBody}
                </div>

                {/* Simulated Attachment Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between max-w-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs">
                      PDF
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">
                        Google_Certificate_Alex_Rivera_GSAP-2026.pdf
                      </p>
                      <p className="text-[10px] text-gray-400">
                        1.2 MB &bull; Digitally Signed
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
                  {footer}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Placeholders & Test Email Sender */}
        <div className="space-y-6">
          
          {/* Dynamic Placeholders */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center">
              <Sparkles className="w-4 h-4 text-blue-600 mr-1.5" />
              Dynamic Placeholders
            </h3>
            <p className="text-[11px] text-gray-500">
              Click any token below to insert it directly into the email body:
            </p>

            <div className="space-y-1.5">
              {placeholders.map((p) => (
                <button
                  key={p.tag}
                  type="button"
                  onClick={() => handleInsertTag(p.tag)}
                  className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-blue-50 border border-gray-200/80 hover:border-blue-300 transition flex items-center justify-between group"
                >
                  <span className="font-mono text-xs font-bold text-blue-700 group-hover:text-blue-800">
                    {p.tag}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Test Email Dispatcher */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center">
              <Send className="w-4 h-4 text-emerald-600 mr-1.5" />
              Send Live Test Email
            </h3>
            <p className="text-[11px] text-gray-500">
              Sends a real test message directly via <span className="font-mono font-semibold text-gray-700">{MAIN_ADMIN_EMAIL}</span> Gmail:
            </p>

            {!isAdminGmailConnected ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-[11px] text-amber-900">
                <p>Authorize {MAIN_ADMIN_EMAIL} with Google first to send live emails.</p>
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={isConnectingGmail}
                  className="w-full py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-bold transition flex items-center justify-center space-x-1.5"
                >
                  <Chrome className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isConnectingGmail ? 'Connecting...' : `Connect ${MAIN_ADMIN_EMAIL}`}</span>
                </button>
              </div>
            ) : (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Connected as {MAIN_ADMIN_EMAIL}</span>
              </div>
            )}

            <div>
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => {
                  setTestEmailAddress(e.target.value);
                  setConfirmTestSend(false);
                }}
                placeholder="Enter recipient email"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {confirmTestSend && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900">
                Send real test email to <span className="font-mono font-bold">{testEmailAddress}</span> from <span className="font-mono font-bold">{MAIN_ADMIN_EMAIL}</span>? Click again to confirm.
              </div>
            )}

            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingTest || !testEmailAddress || !isAdminGmailConnected}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {isSendingTest ? 'Sending via Gmail...' : confirmTestSend ? 'Confirm & Send Test Email' : 'Send Live Test Email'}
            </button>

            {testStatus && (
              <div
                className={`text-[11px] p-2.5 rounded-lg border flex items-start space-x-1.5 ${
                  testStatus.type === 'success'
                    ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                    : 'text-red-800 bg-red-50 border-red-200'
                }`}
              >
                {testStatus.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
