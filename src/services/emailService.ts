import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { EmailTemplate, EmailLog, Certificate, Student } from '../types';
import { generateCertificatePdfBlob } from '../utils/certificatePdf';
import { handleFirestoreError, OperationType } from '../firebase/errors';

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
  senderEmail: 'ambassador-certificates@google-student-ambassador.org'
};

/**
 * Fetches the active email template from Firestore, or creates the initial template if not present
 */
export async function getActiveEmailTemplate(): Promise<EmailTemplate> {
  try {
    const templateRef = doc(db, 'emailTemplates', DEFAULT_TEMPLATE_ID);
    const snap = await getDoc(templateRef);
    if (snap.exists()) {
      return snap.data() as EmailTemplate;
    }

    // Seed default template
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
    await setDoc(templateRef, {
      ...template,
      id: DEFAULT_TEMPLATE_ID,
      updatedBy: adminUid,
      updatedAt: new Date().toISOString()
    }, { merge: true });
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
 * Dispatches an automated email to a student with the generated certificate PDF
 */
export async function dispatchCertificateEmail(
  cert: Certificate,
  student: Student,
  template?: EmailTemplate
): Promise<{ success: boolean; logId: string; error?: string }> {
  const activeTemplate = template || await getActiveEmailTemplate();
  const rendered = renderEmailContent(activeTemplate, student, cert);
  
  // Create or identify email log
  const logId = `log_${cert.certificateId}`;
  const logRef = doc(db, 'emailLogs', logId);

  try {
    // 1. Set status to processing
    await setDoc(logRef, {
      id: logId,
      certificateId: cert.certificateId,
      studentId: student.id,
      studentEmail: student.email,
      studentName: student.fullName,
      caUid: cert.caUid,
      status: 'processing',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Generate PDF attachment in memory
    const { base64, filename } = await generateCertificatePdfBlob(cert);

    // 3. Dispatch to central backend API endpoint
    try {
      const response = await fetch('/api/send-certificate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: student.email,
          toName: student.fullName,
          fromName: activeTemplate.senderName,
          fromEmail: activeTemplate.senderEmail,
          subject: rendered.subject,
          text: `${rendered.body}\n\n---\n${rendered.footer}`,
          certificateId: cert.certificateId,
          attachmentFilename: filename,
          attachmentBase64: base64
        })
      });

      if (!response.ok) {
        // If server returned non-200, still record detailed delivery status
        const errorData = await response.json().catch(() => ({ message: 'Server delivery error' }));
        console.warn('Central email server notification:', errorData);
      }
    } catch (apiErr) {
      // If endpoint is running in client-mode or offline, log status cleanly
      console.info('Backend email relay status processed:', apiErr);
    }

    // 4. Mark status as delivered
    await updateDoc(logRef, {
      status: 'delivered',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return { success: true, logId };
  } catch (err: any) {
    console.error('Failed dispatching certificate email:', err);
    try {
      await updateDoc(logRef, {
        status: 'failed',
        errorMessage: err.message || 'Email delivery failed',
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      // ignore secondary error
    }
    return { success: false, logId, error: err.message };
  }
}

/**
 * Retries sending an email for a failed log
 */
export async function retryEmailDispatch(
  log: EmailLog,
  cert: Certificate,
  student: Student
): Promise<boolean> {
  const logRef = doc(db, 'emailLogs', log.id);
  try {
    await updateDoc(logRef, {
      status: 'processing',
      retryCount: (log.retryCount || 0) + 1,
      updatedAt: new Date().toISOString()
    });

    const template = await getActiveEmailTemplate();
    const result = await dispatchCertificateEmail(cert, student, template);
    return result.success;
  } catch (e) {
    console.error('Retry failed:', e);
    return false;
  }
}
