# Security Specification: Campus Ambassador Certificate Management System

## 1. Data Invariants
1. **Admins:** Only existing documents in `/admins/{uid}` can perform admin functions. Bootstrapped admin email is `ayushinfinity98@gmail.com`.
2. **Campus Ambassadors:** CAs cannot modify their own role, account status (`active`, `deactivated`, `suspended`), or assigned `caId`. Only Super Admins can create or update CA accounts and their uploaded signature.
3. **Student Isolation:** A Campus Ambassador can only create, read, update, and delete students where `student.caUid == request.auth.uid`. No CA can access, list, or tamper with another CA's student records.
4. **Certificate Integrity:** A Certificate can only be issued by an active Campus Ambassador for a student belonging to them (`caUid == request.auth.uid`). Once issued, certificate verification data is public (read-only) for legitimate verification by ID, but does NOT contain student email or PII.
5. **No Orphaned Records:** A student record cannot be created without a valid `caUid` matching the authenticated caller.
6. **Central Email Template Protection:** Only Super Admins can create or modify email templates in `/emailTemplates`. CAs have zero write access.
7. **Email Logs:** CAs can only view email logs where `caUid == request.auth.uid`. Admins can view all email logs.
8. **Audit Trail:** Audit logs are append-only. No deletion or editing is permitted.

## 2. The "Dirty Dozen" Payloads
1. **Spoofed CA UID on Student Creation:** A CA submits `caUid: 'other-ca-uid'` when inserting a student. Expectation: `PERMISSION_DENIED`.
2. **Unauthenticated Certificate Write:** Public client attempts to write or tamper with a certificate document. Expectation: `PERMISSION_DENIED`.
3. **CA Self-Activation:** A suspended CA attempts to update `status: 'active'` on `/campusAmbassadors/{caUid}`. Expectation: `PERMISSION_DENIED`.
4. **Cross-Tenant Student Update:** CA A attempts to update CA B's student record. Expectation: `PERMISSION_DENIED`.
5. **Cross-Tenant Student Deletion:** CA A attempts to delete CA B's student record. Expectation: `PERMISSION_DENIED`.
6. **Email Template Tampering by CA:** An authenticated CA attempts to overwrite `/emailTemplates/default`. Expectation: `PERMISSION_DENIED`.
7. **Admins Self-Provisioning by Regular User:** Regular user attempts to insert themselves into `/admins/{uid}`. Expectation: `PERMISSION_DENIED`.
8. **Tampering with Issued Certificate:** CA attempts to change the `studentName` or `status` of an already issued certificate directly without authorization. Expectation: `PERMISSION_DENIED`.
9. **Junk String ID Denial of Wallet Attack:** An attacker attempts to create a student with a 2KB junk character document ID. Expectation: `PERMISSION_DENIED`.
10. **Audit Log Deletion:** Any user attempts to delete an entry from `/auditLogs/{logId}`. Expectation: `PERMISSION_DENIED`.
11. **Shadow Field Injection:** Payload includes undocumented malicious fields like `__isAdmin: true` or `bypassed: true`. Expectation: `PERMISSION_DENIED`.
12. **PII Harvesting / Blanket Query:** An unauthenticated user attempts to list `/students`. Expectation: `PERMISSION_DENIED`.
