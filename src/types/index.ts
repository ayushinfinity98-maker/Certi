export type UserRole = 'superadmin' | 'admin' | 'ca';

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

export interface CampusAmbassador {
  uid: string;
  caId: string; // e.g. "CA-2026-001"
  name: string;
  email: string;
  college: string;
  phone?: string;
  status: 'active' | 'deactivated' | 'suspended';
  signatureUrl?: string; // Data URL or storage URL
  signatureUpdatedAt?: string;
  totalStudents?: number;
  totalCertificates?: number;
  initialPassword?: string; // Stored securely for Admin credential hand-off
  createdAt: string;
  updatedAt: string;
}

export type CertificateStatus = 'not_issued' | 'issued' | 'revoked';

export interface Student {
  id: string;
  caUid: string;
  caId: string;
  fullName: string;
  email: string;
  college: string;
  semester: string;
  initiativeName: string;
  participationDate: string; // YYYY-MM-DD
  certificateStatus: CertificateStatus;
  certificateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  certificateId: string; // Unique, e.g. "GSAP-2026-CA001-XXXX"
  studentId: string;
  studentName: string;
  initiativeName: string;
  semester: string;
  college: string;
  participationDate: string;
  caUid: string;
  caName: string;
  caId: string;
  signatureUrl: string;
  programName: string; // "Google Student Ambassador Program 2026"
  status: 'valid' | 'revoked';
  verificationUrl: string;
  issuedAt: string;
}

export interface EmailTemplate {
  id: string;
  subject: string;
  body: string;
  footer: string;
  senderName: string;
  senderEmail: string;
  updatedBy?: string;
  updatedAt?: string;
}

export type EmailDeliveryStatus = 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';

export interface EmailLog {
  id: string;
  certificateId: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  caUid: string;
  status: EmailDeliveryStatus;
  errorMessage?: string;
  retryCount: number;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorRole: 'admin' | 'ca' | 'system';
  action: string;
  details: string;
  targetId?: string;
  timestamp: string;
}

export interface CentralEmailSettings {
  senderEmail: string;
  senderName: string;
  replyTo?: string;
  mode: 'cloud_relay' | 'smtp' | 'resend';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPasswordMasked?: boolean;
}
