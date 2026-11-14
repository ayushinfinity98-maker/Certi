import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { EmailTemplate, EmailLog, Certificate, Student } from '../types';
import { generateCertificatePdfBlob } from '../utils/certificatePdf';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { sendEmailViaGmailApi } from './gmailService';
import {
  MAIN_ADMIN_EMAIL,
  getWorkspaceAuthToken,
  getWorkspaceAuthorizedEmail,
  isAdminGmailAuthorized
} from './googleWorkspaceAuth';

export const DEFAULT_TEMPLATE_ID = 'default_certificate';

export const INITIAL_EMAIL_TEMPLATE: EmailTemplate = {
  id: DEFAULT_TEMPLATE_ID,
  subject: 'Google Student Ambassador Program 2026: Certificate of Participation - {{student_name}}',
  body: `Dear {{student_name}},

Congratulations! We are delighted to present you with your official Certificate of Participation for your active and successful contribution to "{{initiative_name}}" conducted at {{college_name}} ({{semester}}) under the Google Student Ambassador Program 2026.

Credential Details:
• Certificate ID: {{certificate_id}}
• Participation Date: {{participation_date}}
• Issuing Campus Ambassador: {{ca_name}}
• Recipient: {{student_name}} ({{student_email}})

Your authentic, digitally-signed PDF certificate is attached to this email. You can also verify or showcase your official certificate online at any time:
{{verification_url}}

Thank you for your passion, curiosity, and commitment to technological innovation!

Warm regards,
{{ca_name}}
Campus Ambassador, Google Student Ambassador Program 2026`,
  footer: 'This is an official communication from the Google Student Ambassador Program 2026. Certificates are cryptographically stamped with unique QR validation identifiers.',
  senderName: 'Google Student Ambassador Program 2026',
  senderEmail: MAIN_ADMIN_EMAIL
};

/**
 * Fetches the active email template from Firestore, or creates the initial template if not present
 */
export async function getActiveEmailTemplate(): Promise<EmailTemplate> {
  try {
    const templateRef = doc(db, 'emailTemplates', DEFAULT_TEMPLATE_ID);
    const snap = await getDoc(templateRef);
    if (snap.exists()) {
      const data = snap.data() as EmailTemplate;
      // Ensure legacy placeholder sender email migrates cleanly to the main admin Gmail ID
      const effectiveSenderEmail =
        !data.senderEmail || data.senderEmail === 'ambassador-certificates@google-student-ambassador.org'
          ? MAIN_ADMIN_EMAIL
          : data.senderEmail;
      return {
        ...data,
        senderEmail: effectiveSenderEmail
      };
    }

    await setDoc(templateRef, {
      ...INITIAL_EMAIL_TEMPLATE,
      updatedAt: new Date().toISOString()
    });
    return INITIAL_EMAIL_TEMPLATE;
  } catch (error) {
    console.warn('Could not read email template, using default fallback:', error);
    return INITIAL_EMAIL_TEMPLATE;
  }
}

/**
 * Saves/updates the email template in Firestore (Admin only)
 */
export async function updateEmailTemplate(template: EmailTemplate, adminUid: string): Promise<void> {
  const templateRef = doc(db, 'emailTemplates', DEFAULT_TEMPLATE_ID);
  try {
    await setDoc(
      templateRef,
      {
        ...template,
        id: DEFAULT_TEMPLATE_ID,
        senderEmail: template.senderEmail || MAIN_ADMIN_EMAIL,
        updatedBy: adminUid,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `emailTemplates/${DEFAULT_TEMPLATE_ID}`);
  }
}

/**
 * Populates template placeholders with real student and certificate data
 */
export function renderEmailContent(
  template: EmailTemplate,
  student: Student,
  cert: Certificate
): { subject: string; body: string; footer: string } {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://google-student-ambassador-2026.web.app';
  const verificationUrl = `${origin}/verify/${cert.certificateId}`;

  const replaceMap: Record<string, string> = {
    '{{student_name}}': student.fullName,
    '{{student_email}}': student.email,
    '{{ca_name}}': cert.caName,
    '{{initiative_name}}': student.initiativeName,
    '{{college_name}}': student.college,
    '{{semester}}': student.semester,
    '{{certificate_id}}': cert.certificateId,
    '{{participation_date}}': student.participationDate,
    '{{verification_url}}': verificationUrl
  };

  let renderedSubject = template.subject;
  let renderedBody = template.body;
  let renderedFooter = template.footer;

  Object.entries(replaceMap).forEach(([token, val]) => {
    const reg = new RegExp(token.replace(/[{()}]/g, '\\$&'), 'g');
    renderedSubject = renderedSubject.replace(reg, val);
    renderedBody = renderedBody.replace(reg, val);
    renderedFooter = renderedFooter.replace(reg, val);
  });

  return {
    subject: renderedSubject,
    body: renderedBody,
    footer: renderedFooter
  };
}

/**
 * Dispatches an official email with PDF certificate attached strictly via the Main Admin's Gmail account.
 * Never marks an email as delivered unless Gmail API actually accepted it.
 */
export async function dispatchCertificateEmail(
  cert: Certificate,
  student: Student,
  template?: EmailTemplate
): Promise<{ success: boolean; queued?: boolean; logId: string; error?: string }> {
  const activeTemplate = template || (await getActiveEmailTemplate());
  const rendered = renderEmailContent(activeTemplate, student, cert);

  const logId = `log_${cert.certificateId}`;
  const logRef = doc(db, 'emailLogs', logId);
  const now = new Date().toISOString();

  try {
    await setDoc(logRef, {
      id: logId,
      certificateId: cert.certificateId,
      studentId: student.id,
      studentEmail: student.email,
      studentName: student.fullName,
      caUid: cert.caUid,
      status: 'processing',
      retryCount: 0,
      createdAt: now,
      updatedAt: now
    });

    const token = getWorkspaceAuthToken();
    const authorizedEmail = getWorkspaceAuthorizedEmail();

    if (!token || !isAdminGmailAuthorized()) {
      const reason = !token
        ? `Pending Super Admin Gmail (${MAIN_ADMIN_EMAIL}) authorization. Sign in as ${MAIN_ADMIN_EMAIL} via Google and dispatch from the Admin Email Queue.`
        : `Signed-in Google account (${authorizedEmail}) does not match main admin email (${MAIN_ADMIN_EMAIL}). Please authorize with ${MAIN_ADMIN_EMAIL}.`;

      await updateDoc(logRef, {
        status: 'pending',
        errorMessage: reason,
        updatedAt: new Date().toISOString()
      });

      return { success: false, queued: true, logId, error: reason };
    }

    // Generate verified PDF certificate attachment in memory
    const { base64, filename } = await generateCertificatePdfBlob(cert);

    // Send real email via Main Admin Gmail API
    await sendEmailViaGmailApi({
      to: student.email,
      toName: student.fullName,
      fromName: activeTemplate.senderName || 'Google Student Ambassador Program 2026',
      fromEmail: MAIN_ADMIN_EMAIL,
      subject: rendered.subject,
      textBody: `${rendered.body}\n\n---\n${rendered.footer}`,
      attachmentFilename: filename,
      attachmentBase64DataUrl: base64
    });

    await updateDoc(logRef, {
      status: 'delivered',
      errorMessage: '',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return { success: true, logId };
  } catch (err: any) {
    console.error('Failed dispatching certificate email via Gmail:', err);
    try {
      await updateDoc(logRef, {
        status: 'failed',
        errorMessage: err.message || 'Gmail delivery failed',
        updatedAt: new Date().toISOString()
      });
    } catch {
      // ignore secondary log update failure
    }
    return { success: false, logId, error: err.message || 'Email delivery failed' };
  }
}

/**
 * Sends a live test email directly through the Main Admin Gmail account
 */
export async function sendTestEmailViaGmail(params: {
  to: string;
  subject: string;
  body: string;
  footer: string;
  senderName: string;
}): Promise<{ messageId: string }> {
  if (!isAdminGmailAuthorized()) {
    throw new Error(
      `Please connect Main Admin Gmail (${MAIN_ADMIN_EMAIL}) with Google first before sending a test email.`
    );
  }

  return await sendEmailViaGmailApi({
    to: params.to,
    fromName: params.senderName || 'Google Student Ambassador Program 2026',
    fromEmail: MAIN_ADMIN_EMAIL,
    subject: `[TEST] ${params.subject}`,
    textBody: `${params.body}\n\n---\n${params.footer}`
  });
}

/**
 * Retries sending an email for a pending or failed log
 */
export async function retryEmailDispatch(
  log: EmailLog,
  cert: Certificate,
  student: Student
): Promise<{ success: boolean; error?: string }> {
  const logRef = doc(db, 'emailLogs', log.id);
  try {
    await updateDoc(logRef, {
      status: 'processing',
      retryCount: (log.retryCount || 0) + 1,
      updatedAt: new Date().toISOString()
    });

    const template = await getActiveEmailTemplate();
    const result = await dispatchCertificateEmail(cert, student, template);
    return { success: result.success, error: result.error };
  } catch (e: any) {
    console.error('Retry failed:', e);
    return { success: false, error: e.message || 'Retry failed' };
  }
}
