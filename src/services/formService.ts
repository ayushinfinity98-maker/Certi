import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  CaFormField,
  CampusAmbassador,
  CaRegistrationForm,
  FormSubmission,
  Student
} from '../types';
import { stripUndefinedDeep } from './certificateTemplateService';
import { logAuditEvent } from './dataService';

export function buildDefaultCoreFormFields(ca?: CampusAmbassador): CaFormField[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'field_fullName',
      key: 'fullName',
      label: 'Full Name',
      type: 'text',
      required: true,
      enabled: true,
      placeholder: 'Enter your full legal name (for certificate)',
      isCore: true,
      linkedPlaceholderTag: 'name'
    },
    {
      id: 'field_email',
      key: 'email',
      label: 'Email Address',
      type: 'email',
      required: true,
      enabled: true,
      placeholder: 'you@university.edu',
      isCore: true
    },
    {
      id: 'field_college',
      key: 'college',
      label: 'College / University',
      type: 'text',
      required: true,
      enabled: true,
      placeholder: 'Enter your college or university name',
      defaultValue: ca?.college || '',
      isCore: true,
      linkedPlaceholderTag: 'university'
    },
    {
      id: 'field_semester',
      key: 'semester',
      label: 'Semester / Academic Year',
      type: 'text',
      required: false,
      enabled: true,
      placeholder: 'e.g. Semester 6 / Year 3',
      defaultValue: '2026',
      isCore: true,
      linkedPlaceholderTag: 'semester'
    },
    {
      id: 'field_initiativeName',
      key: 'initiativeName',
      label: 'Event / Workshop / Initiative Name',
      type: 'text',
      required: true,
      enabled: true,
      placeholder: 'e.g. Google Cloud & AI Workshop',
      defaultValue: 'Google Cloud & AI Campus Workshop',
      isCore: true,
      linkedPlaceholderTag: 'event'
    },
    {
      id: 'field_participationDate',
      key: 'participationDate',
      label: 'Participation Date',
      type: 'date',
      required: true,
      enabled: true,
      defaultValue: today,
      isCore: true,
      linkedPlaceholderTag: 'date'
    }
  ];
}

export const QUICK_CUSTOM_FORM_FIELD_PRESETS: Array<Omit<CaFormField, 'id'>> = [
  {
    key: 'roll_no',
    label: 'Roll Number / Student ID',
    type: 'text',
    required: false,
    enabled: true,
    placeholder: 'e.g. 22CS104',
    linkedPlaceholderTag: 'roll_no'
  },
  {
    key: 'branch',
    label: 'Department / Branch',
    type: 'text',
    required: false,
    enabled: true,
    placeholder: 'e.g. Computer Science',
    linkedPlaceholderTag: 'branch'
  },
  {
    key: 'phone',
    label: 'Phone / WhatsApp Number',
    type: 'tel',
    required: false,
    enabled: true,
    placeholder: '+91 98765 43210'
  },
  {
    key: 'track',
    label: 'Session Track / Role',
    type: 'text',
    required: false,
    enabled: true,
    placeholder: 'e.g. GenAI Track / Winner / Volunteer',
    linkedPlaceholderTag: 'track'
  },
  {
    key: 'grade',
    label: 'Performance / Achievement',
    type: 'text',
    required: false,
    enabled: true,
    placeholder: 'e.g. Top Performer / 1st Place',
    linkedPlaceholderTag: 'grade'
  }
];

export async function saveCaForm(
  form: CaRegistrationForm,
  actorUid: string,
  actorEmail: string,
  actorRole: 'admin' | 'ca' = 'ca'
): Promise<CaRegistrationForm> {
  const now = new Date().toISOString();
  const cleanId = form.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const payload: CaRegistrationForm = stripUndefinedDeep({
    ...form,
    id: cleanId,
    updatedAt: now,
    createdAt: form.createdAt || now
  });

  try {
    await setDoc(doc(db, 'caForms', cleanId), payload);
  } catch (err: any) {
    console.error('Failed saving CA form:', err);
    throw new Error(
      err?.code === 'permission-denied'
        ? 'Permission denied: only Main CA or Super Admin can create or edit registration forms.'
        : (err?.message || 'Failed to save registration form.')
    );
  }

  await logAuditEvent(
    actorUid,
    actorEmail,
    actorRole,
    'CA_FORM_SAVED',
    `Saved shareable form "${payload.title}" (${cleanId}) with ${payload.fields.filter(f => f.enabled).length} visible fields`,
    cleanId
  );

  return payload;
}

export async function deleteCaForm(
  formId: string,
  actorUid: string,
  actorEmail: string,
  actorRole: 'admin' | 'ca' = 'ca'
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'caForms', formId));
  } catch (err: any) {
    console.error('Failed deleting CA form:', err);
    throw new Error(
      err?.code === 'permission-denied'
        ? 'Permission denied: only Main CA or Super Admin can delete forms.'
        : (err?.message || 'Failed deleting registration form.')
    );
  }

  await logAuditEvent(
    actorUid,
    actorEmail,
    actorRole,
    'CA_FORM_DELETED',
    `Deleted shareable registration form ${formId}`,
    formId
  );
}

export async function getPublicFormById(formId: string): Promise<CaRegistrationForm | null> {
  const cleanId = formId.trim();
  if (!cleanId) return null;
  const snap = await getDoc(doc(db, 'caForms', cleanId));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as CaRegistrationForm;
}

export function subscribeToFormsForCA(
  caUid: string,
  onUpdate: (forms: CaRegistrationForm[]) => void
): Unsubscribe {
  try {
    const q = query(collection(db, 'caForms'), where('caUid', '==', caUid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as CaRegistrationForm))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn('subscribeToFormsForCA warning:', err);
      }
    );
  } catch (err) {
    console.warn('Could not attach caForms listener:', err);
    return () => {};
  }
}

export function subscribeToAllCaForms(
  onUpdate: (forms: CaRegistrationForm[]) => void
): Unsubscribe {
  try {
    return onSnapshot(
      collection(db, 'caForms'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as CaRegistrationForm))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn('subscribeToAllCaForms warning:', err);
      }
    );
  } catch (err) {
    console.warn('Could not attach all caForms listener:', err);
    return () => {};
  }
}

export async function submitPublicStudentForm(
  form: CaRegistrationForm,
  answers: Record<string, string>
): Promise<FormSubmission> {
  if (!form.isActive) {
    throw new Error('This registration form is currently closed by the organizer.');
  }

  const getFieldAnswer = (key: string, fallback = '') => {
    const field = form.fields.find(f => f.key === key);
    if (field && !field.enabled) {
      return (field.defaultValue || fallback).trim();
    }
    return (answers[key] ?? field?.defaultValue ?? fallback).trim();
  };

  for (const field of form.fields) {
    if (field.enabled && field.required) {
      const val = (answers[field.key] || '').trim();
      if (!val) {
        throw new Error(`Please fill in "${field.label}".`);
      }
    }
  }

  const fullName = getFieldAnswer('fullName');
  const email = getFieldAnswer('email').toLowerCase();
  const college = getFieldAnswer('college', form.caCollege || 'Campus Participant');
  const semester = getFieldAnswer('semester', '2026');
  const initiativeName = getFieldAnswer('initiativeName', form.title);
  const participationDate = getFieldAnswer('participationDate', new Date().toISOString().split('T')[0]);

  if (!fullName) {
    throw new Error('Full Name is required.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const coreKeys = new Set(['fullName', 'email', 'college', 'semester', 'initiativeName', 'participationDate']);
  const customFields: Record<string, string> = {};
  for (const field of form.fields) {
    const val = field.enabled ? (answers[field.key] ?? '').trim() : (field.defaultValue ?? '').trim();
    if (!coreKeys.has(field.key) && val !== '') {
      customFields[field.key] = val;
    }
  }
  // Preserve any extra keys passed directly
  Object.entries(answers).forEach(([k, v]) => {
    if (!coreKeys.has(k) && v && v.trim() && customFields[k] === undefined) {
      customFields[k] = v.trim();
    }
  });

  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const submission: FormSubmission = stripUndefinedDeep({
    id: submissionId,
    formId: form.id,
    formTitle: form.title,
    caUid: form.caUid,
    caId: form.caId,
    fullName,
    email,
    college,
    semester: semester || '2026',
    initiativeName: initiativeName || form.title,
    participationDate: participationDate || now.split('T')[0],
    customFields,
    status: 'pending',
    submittedAt: now
  });

  await setDoc(doc(db, 'formSubmissions', submissionId), submission);
  return submission;
}

export function subscribeToFormSubmissionsForCA(
  caUid: string,
  onUpdate: (submissions: FormSubmission[]) => void
): Unsubscribe {
  try {
    const q = query(collection(db, 'formSubmissions'), where('caUid', '==', caUid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as FormSubmission))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn('subscribeToFormSubmissionsForCA warning:', err);
      }
    );
  } catch (err) {
    console.warn('Could not attach formSubmissions listener:', err);
    return () => {};
  }
}

export function subscribeToAllFormSubmissions(
  onUpdate: (submissions: FormSubmission[]) => void
): Unsubscribe {
  try {
    return onSnapshot(
      collection(db, 'formSubmissions'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as FormSubmission))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn('subscribeToAllFormSubmissions warning:', err);
      }
    );
  } catch (err) {
    console.warn('Could not attach all formSubmissions listener:', err);
    return () => {};
  }
}

export async function importFormSubmissionToStudent(
  submission: FormSubmission,
  actorEmail: string
): Promise<Student> {
  const now = new Date().toISOString();
  const cleanEmail = submission.email.toLowerCase().trim();
  const cleanInitiative = submission.initiativeName.toLowerCase().trim();

  // Check if student with same email + initiative already exists under this CA
  const existingSnap = await getDocs(query(collection(db, 'students'), where('caUid', '==', submission.caUid)));
  const existingDoc = existingSnap.docs.find(d => {
    const data = d.data() as Student;
    return (
      data.email?.toLowerCase().trim() === cleanEmail &&
      data.initiativeName?.toLowerCase().trim() === cleanInitiative
    );
  });

  let studentRecord: Student;
  if (existingDoc) {
    const current = { ...existingDoc.data(), id: existingDoc.id } as Student;
    const mergedCustom = { ...(current.customFields || {}), ...(submission.customFields || {}) };
    studentRecord = stripUndefinedDeep({
      ...current,
      fullName: submission.fullName || current.fullName,
      college: submission.college || current.college,
      semester: submission.semester || current.semester,
      participationDate: submission.participationDate || current.participationDate,
      customFields: mergedCustom,
      sourceFormId: submission.formId,
      submissionId: submission.id,
      updatedAt: now
    });
    await setDoc(doc(db, 'students', current.id), studentRecord);
  } else {
    const studentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    studentRecord = stripUndefinedDeep({
      id: studentId,
      caUid: submission.caUid,
      caId: submission.caId,
      fullName: submission.fullName,
      email: cleanEmail,
      college: submission.college,
      semester: submission.semester || '2026',
      initiativeName: submission.initiativeName,
      participationDate: submission.participationDate,
      certificateStatus: 'not_issued',
      customFields: submission.customFields || {},
      sourceFormId: submission.formId,
      submissionId: submission.id,
      createdAt: now,
      updatedAt: now
    });
    await setDoc(doc(db, 'students', studentId), studentRecord);
  }

  await updateDoc(doc(db, 'formSubmissions', submission.id), {
    status: 'imported',
    importedStudentId: studentRecord.id,
    importedAt: now
  });

  await logAuditEvent(
    submission.caUid,
    actorEmail,
    'ca',
    'FORM_SUBMISSION_IMPORTED',
    `Imported student ${studentRecord.fullName} (${cleanEmail}) from form "${submission.formTitle}"`,
    studentRecord.id
  );

  return studentRecord;
}

export async function rejectFormSubmission(submissionId: string): Promise<void> {
  await updateDoc(doc(db, 'formSubmissions', submissionId), {
    status: 'rejected'
  });
}
