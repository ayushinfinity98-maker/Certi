import { getWorkspaceAuthToken, clearWorkspaceAuthToken, MAIN_ADMIN_EMAIL } from './googleWorkspaceAuth';

export interface SendGmailParams {
  to: string;
  toName?: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  textBody: string;
  attachmentFilename?: string;
  attachmentBase64DataUrl?: string;
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeaderWord(text: string): string {
  // Use RFC 2047 UTF-8 Base64 encoding for non-ASCII safety in headers
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function stripDataUrlPrefix(dataUrlOrBase64: string): string {
  const commaIdx = dataUrlOrBase64.indexOf(',');
  const raw = commaIdx >= 0 ? dataUrlOrBase64.slice(commaIdx + 1) : dataUrlOrBase64;
  return raw.replace(/\s+/g, '');
}

function chunkBase64(b64: string, lineLength = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += lineLength) {
    lines.push(b64.slice(i, i + lineLength));
  }
  return lines.join('\r\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sends an email via the Gmail API (`users/me/messages/send`) using the in-memory Google access token.
 */
export async function sendEmailViaGmailApi(params: SendGmailParams): Promise<{ messageId: string; threadId?: string }> {
  const token = getWorkspaceAuthToken();
  if (!token) {
    throw new Error(
      `Admin Gmail authorization required. Please connect ${MAIN_ADMIN_EMAIL} via Google Sign-In to send emails.`
    );
  }

  const cleanFromEmail = MAIN_ADMIN_EMAIL;
  const safeFromName = params.fromName.replace(/["\r\n]/g, '').trim() || 'Google Student Ambassador Program 2026';
  const safeToEmail = params.to.trim();
  const safeToName = (params.toName || '').replace(/["\r\n]/g, '').trim();
  const toHeader = safeToName ? `${encodeMimeHeaderWord(safeToName)} <${safeToEmail}>` : safeToEmail;

  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const htmlBody = `<div style="font-family: Arial, Helvetica, sans-serif; color: #202124; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(params.textBody)}</div>`;

  const headers = [
    `From: ${encodeMimeHeaderWord(safeFromName)} <${cleanFromEmail}>`,
    `To: ${toHeader}`,
    `Reply-To: ${cleanFromEmail}`,
    `Subject: ${encodeMimeHeaderWord(params.subject)}`,
    'MIME-Version: 1.0'
  ];

  const parts: string[] = [];

  if (params.attachmentBase64DataUrl && params.attachmentFilename) {
    const cleanFilename = params.attachmentFilename.replace(/["\r\n]/g, '');
    const cleanB64 = chunkBase64(stripDataUrlPrefix(params.attachmentBase64DataUrl));

    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.textBody,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlBody,
      '',
      `--${altBoundary}--`,
      '',
      `--${mixedBoundary}`,
      `Content-Type: application/pdf; name="${cleanFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${cleanFilename}"`,
      '',
      cleanB64,
      '',
      `--${mixedBoundary}--`
    );
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    parts.push(
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.textBody,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlBody,
      '',
      `--${altBoundary}--`
    );
  }

  const rawMimeMessage = [...headers, '', ...parts].join('\r\n');
  const encodedRaw = encodeBase64Url(rawMimeMessage);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedRaw })
  });

  if (response.status === 401 || response.status === 403) {
    clearWorkspaceAuthToken();
    const errJson = await response.json().catch(() => ({}));
    const detail = errJson?.error?.message || 'Gmail permission expired or denied.';
    throw new Error(`Gmail authorization required (${response.status}): ${detail}. Please re-connect ${MAIN_ADMIN_EMAIL} via Google.`);
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Gmail delivery failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    messageId: data.id,
    threadId: data.threadId
  };
}
