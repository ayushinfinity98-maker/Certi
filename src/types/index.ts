export type UserRole = 'superadmin' | 'admin' | 'ca';
export type CaTierRole = 'ca' | 'main_ca';

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

export interface AmbassadorPermissions {
  canIssueCertificates: boolean; // default true
  canImportCsv: boolean; // default true
  canEditStudents: boolean; // default true
  canSendEmails: boolean; // default true
}

export interface CampusAmbassador {
  uid: string;
  caId: string; // e.g. "CA-2026-001"
  caRole?: CaTierRole; // 'main_ca' | 'ca' (admin > main_ca > ca)
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
  allowGoogleLogin?: boolean; // Enable direct Google Sign-in with this email
  googleEmail?: string; // Optional Google account email if different from contact email
  permissions?: AmbassadorPermissions;
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
  customFields?: Record<string, string>;
  sourceFormId?: string;
  submissionId?: string;
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
  customFields?: Record<string, string>;
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

export interface CertificateCustomElement {
  id: string;
  type: 'text' | 'placeholder' | 'qr' | 'signature' | 'image';
  label?: string;
  placeholderTag?: string; // e.g. "student_name", "initiative_name", "participation_date", "certificate_id", "college_name", "ca_name", "semester"
  customText?: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  fontSize?: number; // in pixels (base 14-36)
  fontWeight?: 'normal' | 'bold' | '600';
  fontFamily?: 'serif' | 'sans' | 'mono';
  customFontName?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  width?: number; // percentage or px
  height?: number;
}

export interface CertificateTemplateConfig {
  id: string; // e.g. "tpl_gsap_participation_2026"
  title: string; // e.g. "Official GSAP 2026 Participation Certificate"
  type: 'standard_google' | 'custom_uploaded' | 'blank_plain';
  backgroundUrl?: string; // Optional custom certificate background image data URL or empty for plain white
  backgroundColor?: string; // Optional solid hex background color (e.g. from Google Slides)
  googleSlideUrl?: string; // Optional Google Slides template link or Google Sheet source
  elementsMode?: 'auto_layout' | 'manual_placed'; // When manual_placed, strictly renders manual custom elements
  customElements?: CertificateCustomElement[]; // Manually positioned text boxes & placeholders
  heading: string; // e.g. "Certificate of Participation"
  subheading: string; // e.g. "Google Student Ambassador Program 2026"
  presentationText: string; // e.g. "This certificate is proudly and honorably presented to"
  bodyText: string; // e.g. "for active and exemplary participation in \"{{initiative_name}}\" organized by the Google Student Ambassador Program 2026 at {{college_name}} ({{semester}})."
  footerNote: string; // e.g. "Official Program Issuance"
  showLogo: boolean;
  showProgramEmblem: boolean;
  showBorder: boolean;
  showQrCode: boolean;
  showSignature: boolean;
  signatureTitle: string; // e.g. "Campus Ambassador"
  primaryColor: string; // e.g. "#1A73E8"
  fontFamily: 'serif' | 'sans';
  isActive: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export type FormFieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea';

export interface CaFormField {
  id: string;
  key: string; // e.g. 'fullName', 'email', 'college', 'semester', 'initiativeName', 'participationDate', or custom key like 'roll_no'
  label: string;
  type: FormFieldType;
  required: boolean;
  enabled: boolean; // When false on a core field, uses defaultValue silently without asking student
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  isCore?: boolean;
  linkedPlaceholderTag?: string;
}

export interface CaRegistrationForm {
  id: string;
  caUid: string;
  caId: string;
  caName: string;
  caCollege: string;
  title: string;
  description?: string;
  isActive: boolean;
  autoAddStudent: boolean;
  fields: CaFormField[];
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  caUid: string;
  caId: string;
  fullName: string;
  email: string;
  college: string;
  semester: string;
  initiativeName: string;
  participationDate: string;
  customFields: Record<string, string>;
  status: 'pending' | 'imported' | 'rejected';
  importedStudentId?: string;
  submittedAt: string;
  importedAt?: string;
}

export type PlaceholderSourceType =
  | 'student_field'
  | 'custom_form_field'
  | 'ca_field'
  | 'system_field'
  | 'static_text';

export interface PlaceholderRoleConfig {
  tag: string;
  label: string;
  enabled: boolean;
  sourceType: PlaceholderSourceType;
  sourceKey: string;
  staticValue?: string;
  fallbackValue?: string;
  roleDescription: string;
  renderOnCanvas?: boolean;
  x?: number;
  y?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | '600' | 'bold';
  fontFamily?: 'serif' | 'sans' | 'mono';
}

export interface CertificateFieldConfig {
  id: string; // 'default'
  roles: PlaceholderRoleConfig[];
  updatedByUid?: string;
  updatedByCaUid?: string;
  updatedByEmail?: string;
  updatedByRole?: 'admin' | 'main_ca';
  updatedAt: string;
}

