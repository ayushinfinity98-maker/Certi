import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Certificate } from '../types';
import { getActiveCertificateTemplate, populateCertificatePlaceholders } from '../services/certificateTemplateService';

/**
 * Generates a data URL for the verification QR code
 */
export async function generateVerificationQr(certificateId: string, customBaseUrl?: string): Promise<string> {
  const origin = customBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://google-student-ambassador-2026.web.app');
  const verifyUrl = `${origin}/verify/${certificateId}`;
  
  return QRCode.toDataURL(verifyUrl, {
    width: 250,
    margin: 1,
    color: {
      dark: '#1A73E8',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Creates high resolution canvas of the certificate
 */
export async function renderCertificateToCanvas(
  cert: Certificate,
  qrDataUrl: string
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  // High resolution landscape A4 ratio (1200 x 848 at 2x = 2400 x 1696)
  const width = 2400;
  const height = 1696;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  // Load active template
  const tpl = await getActiveCertificateTemplate().catch(() => null);

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Check if custom uploaded background is provided
  if (tpl?.type === 'custom_uploaded' && tpl.backgroundUrl) {
    try {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = tpl.backgroundUrl;
      await new Promise((resolve) => {
        bgImg.onload = resolve;
        bgImg.onerror = resolve;
      });
      ctx.drawImage(bgImg, 0, 0, width, height);
    } catch (e) {
      console.warn('Could not draw custom certificate background onto canvas', e);
    }
  } else {
    // Subtle watermark background grid/geometry
    ctx.save();
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1.5;
    for (let i = 80; i < width; i += 120) {
      ctx.beginPath();
      ctx.moveTo(i, 80);
      ctx.lineTo(i, height - 80);
      ctx.stroke();
    }
    for (let j = 80; j < height; j += 120) {
      ctx.beginPath();
      ctx.moveTo(80, j);
      ctx.lineTo(width - 80, j);
      ctx.stroke();
    }
    ctx.restore();

    // Multi-color Google Border (Blue, Red, Yellow, Green) if enabled
    if (tpl?.showBorder !== false) {
      const borderWidth = 24;
      const radius = 32;
      const margin = 50;

      ctx.save();
      // Top border: Google Blue (#4285F4)
      ctx.strokeStyle = '#4285F4';
      ctx.lineWidth = borderWidth;
      ctx.beginPath();
      ctx.moveTo(margin + radius, margin);
      ctx.lineTo(width / 2, margin);
      ctx.stroke();

      // Top right & Right top: Google Red (#EA4335)
      ctx.strokeStyle = '#EA4335';
      ctx.beginPath();
      ctx.moveTo(width / 2, margin);
      ctx.lineTo(width - margin - radius, margin);
      ctx.arcTo(width - margin, margin, width - margin, margin + radius, radius);
      ctx.lineTo(width - margin, height / 2);
      ctx.stroke();

      // Right bottom & Bottom right: Google Yellow (#FBBC05)
      ctx.strokeStyle = '#FBBC05';
      ctx.beginPath();
      ctx.moveTo(width - margin, height / 2);
      ctx.lineTo(width - margin, height - margin - radius);
      ctx.arcTo(width - margin, height - margin, width - margin - radius, height - margin, radius);
      ctx.lineTo(width / 2, height - margin);
      ctx.stroke();

      // Bottom left & Left: Google Green (#34A853)
      ctx.strokeStyle = '#34A853';
      ctx.beginPath();
      ctx.moveTo(width / 2, height - margin);
      ctx.lineTo(margin + radius, height - margin);
      ctx.arcTo(margin, height - margin, margin, height - margin - radius, radius);
      ctx.lineTo(margin, margin + radius);
      ctx.arcTo(margin, margin, margin + radius, margin, radius);
      ctx.stroke();
      ctx.restore();

      // Inner subtle gold/navy border line
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 3;
      ctx.strokeRect(margin + 20, margin + 20, width - (margin * 2) - 40, height - (margin * 2) - 40);
      ctx.restore();
    }
  }

  // TOP HEADER: Google Logo (Left) and Program Logo / Badge (Right)
  // 1. Google Brand text (Left)
  if (tpl?.showLogo !== false) {
    ctx.save();
    ctx.font = 'bold 54px "Google Sans", Inter, sans-serif';
    const gx = 130;
    const gy = 150;
    ctx.fillStyle = '#4285F4'; ctx.fillText('G', gx, gy);
    ctx.fillStyle = '#EA4335'; ctx.fillText('o', gx + 42, gy);
    ctx.fillStyle = '#FBBC05'; ctx.fillText('o', gx + 77, gy);
    ctx.fillStyle = '#4285F4'; ctx.fillText('g', gx + 112, gy);
    ctx.fillStyle = '#34A853'; ctx.fillText('l', gx + 147, gy);
    ctx.fillStyle = '#EA4335'; ctx.fillText('e', gx + 162, gy);

    ctx.font = '500 24px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#5F6368';
    ctx.fillText('STUDENT AMBASSADOR PROGRAM', gx, gy + 38);
    ctx.restore();
  }

  // 2. Program Emblem / Badge (Right)
  if (tpl?.showProgramEmblem !== false) {
    ctx.save();
    const badgeX = width - 260;
    const badgeY = 145;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 55, 0, Math.PI * 2);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4285F4';
    ctx.stroke();
    
    ctx.fillStyle = '#1A73E8';
    ctx.font = 'bold 28px "Google Sans", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2026', badgeX, badgeY - 5);
    ctx.fillStyle = '#5F6368';
    ctx.font = '600 16px "Google Sans", Inter, sans-serif';
    ctx.fillText('OFFICIAL', badgeX, badgeY + 18);
    ctx.fillText('PROGRAM', badgeX, badgeY + 36);
    ctx.restore();
  }

  // CENTER TITLE & HEADINGS
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#1A73E8';
  ctx.letterSpacing = '8px';
  ctx.fillText((tpl?.subheading || 'Google Student Ambassador Program 2026').toUpperCase(), width / 2, 310);

  ctx.font = 'bold 74px "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#202124';
  ctx.fillText(tpl?.heading || 'Certificate of Participation', width / 2, 400);

  ctx.font = 'italic 500 32px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#5F6368';
  ctx.fillText(tpl?.presentationText || 'This certificate is proudly and honorably presented to', width / 2, 480);

  // STUDENT NAME
  ctx.font = 'bold 84px "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#1A73E8';
  ctx.fillText(cert.studentName, width / 2, 590);

  // Decorative underline under name
  const nameWidth = ctx.measureText(cert.studentName).width;
  ctx.strokeStyle = '#FBBC05';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo((width / 2) - (nameWidth / 2) - 30, 620);
  ctx.lineTo((width / 2) + (nameWidth / 2) + 30, 620);
  ctx.stroke();

  // DYNAMIC BODY TEXT with placeholders
  const rawBody = tpl?.bodyText || 'for active and exemplary participation in "{{initiative_name}}" organized by the Google Student Ambassador Program 2026 at {{college_name}} ({{semester}}).';
  const populatedBody = populateCertificatePlaceholders(rawBody, {
    student_name: cert.studentName,
    initiative_name: cert.initiativeName,
    college_name: cert.college,
    semester: cert.semester,
    participation_date: cert.participationDate,
    certificate_id: cert.certificateId,
    ca_name: cert.caName
  });

  // Multiline wrapping
  ctx.font = '400 34px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#3C4043';
  
  const words = populatedBody.split(' ');
  const maxLineLength = 80;
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxLineLength) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + ' ' + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  let lineY = 705;
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, width / 2, lineY);
    lineY += 56;
  }
  ctx.restore();

  // BOTTOM SECTION: Date, QR Code, Authorized Signature
  const bottomY = 1250;

  // 1. Left: Date of Participation & Program Verification Seal
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '600 24px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#5F6368';
  ctx.fillText('PARTICIPATION DATE', 140, bottomY);

  ctx.font = 'bold 34px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#202124';
  ctx.fillText(cert.participationDate, 140, bottomY + 45);

  ctx.strokeStyle = '#9AA0A6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, bottomY + 65);
  ctx.lineTo(440, bottomY + 65);
  ctx.stroke();

  ctx.font = '500 20px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#5F6368';
  ctx.fillText(tpl?.footerNote || 'Official Program Issuance', 140, bottomY + 95);
  ctx.fillText(`Initiative: ${cert.initiativeName.substring(0, 32)}`, 140, bottomY + 125);
  ctx.restore();

  // 2. Center: QR Code & Unique Certificate ID
  if (tpl?.showQrCode !== false) {
    ctx.save();
    ctx.textAlign = 'center';
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise((resolve) => {
      qrImg.onload = resolve;
      qrImg.onerror = resolve;
    });

    const qrSize = 190;
    const qrX = (width / 2) - (qrSize / 2);
    const qrY = bottomY - 60;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    ctx.font = 'bold 22px "Google Sans", monospace';
    ctx.fillStyle = '#1A73E8';
    ctx.fillText(`ID: ${cert.certificateId}`, width / 2, qrY + qrSize + 30);

    ctx.font = '500 18px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#5F6368';
    ctx.fillText('Scan to verify authenticity', width / 2, qrY + qrSize + 55);
    ctx.restore();
  }

  // 3. Right: Authorized Signature of the specific Campus Ambassador
  if (tpl?.showSignature !== false) {
    ctx.save();
    const sigX = width - 560;
    const sigWidth = 420;
    const sigHeight = 110;

    if (cert.signatureUrl) {
      try {
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';
        sigImg.src = cert.signatureUrl;
        await new Promise((resolve) => {
          sigImg.onload = resolve;
          sigImg.onerror = resolve;
        });
        ctx.drawImage(sigImg, sigX, bottomY - 70, sigWidth, sigHeight);
      } catch (e) {
        console.warn('Could not draw signature image onto canvas', e);
      }
    }

    // Signature line
    ctx.strokeStyle = '#9AA0A6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sigX, bottomY + 65);
    ctx.lineTo(sigX + sigWidth, bottomY + 65);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#202124';
    ctx.fillText(cert.caName, sigX + (sigWidth / 2), bottomY + 105);

    ctx.font = '600 20px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#1A73E8';
    ctx.fillText(tpl?.signatureTitle || 'Campus Ambassador', sigX + (sigWidth / 2), bottomY + 135);

    ctx.font = '500 18px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#5F6368';
    ctx.fillText(`Google Student Ambassador Program 2026 (${cert.caId})`, sigX + (sigWidth / 2), bottomY + 160);
    ctx.restore();
  }

  return canvas;
}

/**
 * Generates and downloads the PDF certificate using jsPDF
 */
export async function downloadCertificatePdf(cert: Certificate): Promise<void> {
  const qrDataUrl = await generateVerificationQr(cert.certificateId);
  const canvas = await renderCertificateToCanvas(cert, qrDataUrl);
  
  // A4 Landscape dimensions in mm: 297 x 210
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
  
  const cleanName = cert.studentName.replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`Google_Ambassador_Certificate_${cleanName}_${cert.certificateId}.pdf`);
}

/**
 * Returns a Base64 PDF data string for automated email attachment
 */
export async function generateCertificatePdfBlob(cert: Certificate): Promise<{ blob: Blob; base64: string; filename: string }> {
  const qrDataUrl = await generateVerificationQr(cert.certificateId);
  const canvas = await renderCertificateToCanvas(cert, qrDataUrl);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);

  const cleanName = cert.studentName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Google_Certificate_${cleanName}_${cert.certificateId}.pdf`;
  const blob = pdf.output('blob');
  const base64 = pdf.output('datauristring');

  return { blob, base64, filename };
}
