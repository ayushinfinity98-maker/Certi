import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Certificate, CertificateTemplateConfig, CertificateCustomElement } from '../types';
import {
  getActiveCertificateTemplate,
  getCertificateFieldConfig,
  getOverlayPlaceholderElements,
  isPlaceholderEnabled,
  populateCertificatePlaceholders,
  resolvePlaceholderValue,
  isSignaturePlaceholderTag,
  isQrPlaceholderTag,
  CertificatePlaceholderValues
} from '../services/certificateTemplateService';

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

  // Load active template and Main CA / Admin placeholder role config
  const [tpl, fieldConfig] = await Promise.all([
    getActiveCertificateTemplate().catch(() => null),
    getCertificateFieldConfig().catch(() => null)
  ]);
  const fieldRoles = fieldConfig?.roles;

  // Background (solid color copied from Google Slide or white default)
  ctx.fillStyle = tpl?.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 1. Draw custom/Google Slide background image if provided
  if (tpl?.backgroundUrl) {
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
  }

  const isManualMode = tpl?.elementsMode === 'manual_placed' || tpl?.type === 'blank_plain';
  const combinedManualElements = tpl
    ? [...(tpl.customElements || []), ...getOverlayPlaceholderElements(tpl, fieldRoles)]
    : [];

  // If in manual mode with placed custom elements:
  if (isManualMode && combinedManualElements.length > 0) {
    const values: CertificatePlaceholderValues = {
      student_name: cert.studentName,
      initiative_name: cert.initiativeName,
      college_name: cert.college,
      semester: cert.semester,
      participation_date: cert.participationDate,
      certificate_id: cert.certificateId,
      ca_name: cert.caName,
      ca_id: cert.caId,
      program_name: cert.programName,
      customFields: cert.customFields
    };

    for (const el of combinedManualElements) {
      if (el.type === 'placeholder' && !isPlaceholderEnabled(el.placeholderTag, fieldRoles)) {
        continue;
      }
      if (el.type === 'qr' && !isPlaceholderEnabled('qr', fieldRoles)) {
        continue;
      }
      if (el.type === 'signature' && !isPlaceholderEnabled('sign', fieldRoles)) {
        continue;
      }

      const elX = (el.x / 100) * width;
      const elY = (el.y / 100) * height;
      const scale = 2.4; // scaling factor for 2400x1696 canvas relative to preview
      const fontSize = Math.round((el.fontSize || 16) * scale);

      ctx.save();
      ctx.textAlign = el.textAlign || 'center';

      const isSigPlaceholder = el.type === 'placeholder' && isSignaturePlaceholderTag(el.placeholderTag, fieldRoles);
      const isQrPlaceholder = el.type === 'placeholder' && isQrPlaceholderTag(el.placeholderTag, fieldRoles);

      if (isSigPlaceholder) {
        if (cert.signatureUrl) {
          try {
            const sigImg = new Image();
            sigImg.crossOrigin = 'anonymous';
            sigImg.src = cert.signatureUrl;
            await new Promise(r => { sigImg.onload = r; sigImg.onerror = r; });
            const maxW = ((el.width ?? 12) / 100) * width;
            const maxH = ((el.height ?? 6) / 100) * height;
            const imgRatio = sigImg.width && sigImg.height ? sigImg.width / sigImg.height : maxW / maxH;
            let drawW = maxW;
            let drawH = drawW / imgRatio;
            if (drawH > maxH) {
              drawH = maxH;
              drawW = drawH * imgRatio;
            }
            const drawX =
              el.textAlign === 'left'
                ? elX
                : el.textAlign === 'right'
                ? elX - drawW
                : elX - drawW / 2;
            ctx.drawImage(sigImg, drawX, elY - drawH / 2, drawW, drawH);
          } catch (e) {
            console.warn('Sig placeholder render error:', e);
          }
        } else {
          ctx.font = `italic 600 ${fontSize}px Georgia, serif`;
          ctx.fillStyle = el.color || '#202124';
          ctx.fillText(cert.caName, elX, elY);
        }
      } else if ((el.type === 'placeholder' && !isQrPlaceholder) || el.type === 'text') {
        const textToDraw = el.type === 'placeholder'
          ? (resolvePlaceholderValue(el.placeholderTag, values, fieldRoles) ?? `{{${el.placeholderTag}}}`)
          : populateCertificatePlaceholders(el.customText || '', values, fieldRoles);

        const fontFam = el.customFontName
          ? `"${el.customFontName}", ${el.fontFamily === 'serif' ? 'Georgia, serif' : el.fontFamily === 'mono' ? 'monospace' : 'sans-serif'}`
          : el.fontFamily === 'serif'
          ? 'Playfair Display, Georgia, serif'
          : el.fontFamily === 'mono'
          ? 'monospace'
          : 'Google Sans, Inter, sans-serif';
        const fontW = el.fontWeight === 'bold' ? 'bold' : el.fontWeight === '600' ? '600' : 'normal';
        ctx.font = `${fontW} ${fontSize}px ${fontFam}`;
        ctx.fillStyle = el.color || '#202124';
        ctx.fillText(textToDraw, elX, elY);
      } else if (el.type === 'image' && el.customText) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = el.customText;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          const imgW = ((el.width || 12) / 100) * width;
          const imgH = ((el.height || 12) / 100) * height;
          ctx.drawImage(img, elX - imgW / 2, elY - imgH / 2, imgW, imgH);
        } catch (e) {
          console.warn('Slide image render error:', e);
        }
      } else if (el.type === 'qr' || isQrPlaceholder) {
        try {
          const qrImg = new Image();
          qrImg.src = qrDataUrl;
          await new Promise(r => { qrImg.onload = r; qrImg.onerror = r; });
          const qrW = Math.round((el.width ?? 56) * 2.85);
          ctx.drawImage(qrImg, elX - (qrW / 2), elY - (qrW / 2), qrW, qrW);

          ctx.font = 'bold 20px "Google Sans", monospace';
          ctx.fillStyle = el.color || '#1A73E8';
          ctx.fillText(`ID: ${cert.certificateId}`, elX, elY + (qrW / 2) + 26);
        } catch (e) {
          console.warn('QR render error:', e);
        }
      } else if (el.type === 'signature') {
        const maxW = ((el.width ?? 12) / 100) * width;
        const maxH = ((el.height ?? 6) / 100) * height;
        if (cert.signatureUrl) {
          try {
            const sigImg = new Image();
            sigImg.crossOrigin = 'anonymous';
            sigImg.src = cert.signatureUrl;
            await new Promise(r => { sigImg.onload = r; sigImg.onerror = r; });
            const imgRatio = sigImg.width && sigImg.height ? sigImg.width / sigImg.height : maxW / maxH;
            let drawW = maxW;
            let drawH = drawW / imgRatio;
            if (drawH > maxH) {
              drawH = maxH;
              drawW = drawH * imgRatio;
            }
            ctx.drawImage(sigImg, elX - drawW / 2, elY - drawH, drawW, drawH);
          } catch (e) {
            console.warn('Sig render error:', e);
          }
        }
        // Underline and ca name
        const lineHalfW = Math.max(120, maxW / 2);
        ctx.strokeStyle = '#9AA0A6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(elX - lineHalfW, elY + 5);
        ctx.lineTo(elX + lineHalfW, elY + 5);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 26px "Google Sans", Inter, sans-serif';
        ctx.fillStyle = el.color || '#202124';
        ctx.fillText(cert.caName, elX, elY + 36);

        ctx.font = '600 18px "Google Sans", Inter, sans-serif';
        ctx.fillStyle = '#1A73E8';
        ctx.fillText(tpl?.signatureTitle || 'Campus Ambassador', elX, elY + 62);
      }

      ctx.restore();
    }

    return canvas;
  }

  // --- STANDARD GOOGLE TEMPLATE AUTO-LAYOUT ---
  // Multi-color Google Border (Blue, Red, Yellow, Green) if enabled
  if (tpl?.showBorder !== false && tpl?.type === 'standard_google') {
    const borderWidth = 24;
    const radius = 32;
    const margin = 50;

    ctx.save();
    ctx.strokeStyle = '#4285F4';
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    ctx.moveTo(margin + radius, margin);
    ctx.lineTo(width / 2, margin);
    ctx.stroke();

    ctx.strokeStyle = '#EA4335';
    ctx.beginPath();
    ctx.moveTo(width / 2, margin);
    ctx.lineTo(width - margin - radius, margin);
    ctx.arcTo(width - margin, margin, width - margin, margin + radius, radius);
    ctx.lineTo(width - margin, height / 2);
    ctx.stroke();

    ctx.strokeStyle = '#FBBC05';
    ctx.beginPath();
    ctx.moveTo(width - margin, height / 2);
    ctx.lineTo(width - margin, height - margin - radius);
    ctx.arcTo(width - margin, height - margin, width - margin - radius, height - margin, radius);
    ctx.lineTo(width / 2, height - margin);
    ctx.stroke();

    ctx.strokeStyle = '#34A853';
    ctx.beginPath();
    ctx.moveTo(width / 2, height - margin);
    ctx.lineTo(margin + radius, height - margin);
    ctx.arcTo(margin, height - margin, margin, height - margin - radius, radius);
    ctx.lineTo(margin, margin + radius);
    ctx.arcTo(margin, margin, margin + radius, margin, radius);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.strokeRect(margin + 20, margin + 20, width - (margin * 2) - 40, height - (margin * 2) - 40);
    ctx.restore();
  }

  // TOP HEADER: Google Logo (Left) and Program Logo / Badge (Right)
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

  // Program Emblem
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

  const autoValues: CertificatePlaceholderValues = {
    student_name: cert.studentName,
    initiative_name: cert.initiativeName,
    college_name: cert.college,
    semester: cert.semester,
    participation_date: cert.participationDate,
    certificate_id: cert.certificateId,
    ca_name: cert.caName,
    ca_id: cert.caId,
    program_name: cert.programName,
    customFields: cert.customFields
  };

  // STUDENT NAME
  if (isPlaceholderEnabled('name', fieldRoles)) {
    const resolvedStudentName = resolvePlaceholderValue('name', autoValues, fieldRoles) || cert.studentName;
    ctx.font = 'bold 84px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#1A73E8';
    ctx.fillText(resolvedStudentName, width / 2, 590);

    const nameWidth = ctx.measureText(resolvedStudentName).width;
    ctx.strokeStyle = '#FBBC05';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo((width / 2) - (nameWidth / 2) - 30, 620);
    ctx.lineTo((width / 2) + (nameWidth / 2) + 30, 620);
    ctx.stroke();
  }

  // DYNAMIC BODY TEXT with placeholders
  const rawBody = tpl?.bodyText || 'for active and exemplary participation in "{{initiative_name}}" organized by the Google Student Ambassador Program 2026 at {{college_name}} ({{semester}}).';
  const populatedBody = populateCertificatePlaceholders(rawBody, autoValues, fieldRoles);

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

  ctx.save();
  ctx.textAlign = 'left';
  if (isPlaceholderEnabled('date', fieldRoles)) {
    const resolvedDate = resolvePlaceholderValue('date', autoValues, fieldRoles) || cert.participationDate;
    ctx.font = '600 24px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#5F6368';
    ctx.fillText('PARTICIPATION DATE', 140, bottomY);

    ctx.font = 'bold 34px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#202124';
    ctx.fillText(resolvedDate, 140, bottomY + 45);

    ctx.strokeStyle = '#9AA0A6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, bottomY + 65);
    ctx.lineTo(440, bottomY + 65);
    ctx.stroke();
  }

  ctx.font = '500 20px "Google Sans", Inter, sans-serif';
  ctx.fillStyle = '#5F6368';
  ctx.fillText(tpl?.footerNote || 'Official Program Issuance', 140, bottomY + 95);
  if (isPlaceholderEnabled('event', fieldRoles)) {
    const resolvedEvent = resolvePlaceholderValue('event', autoValues, fieldRoles) || cert.initiativeName;
    ctx.fillText(`Initiative: ${resolvedEvent.substring(0, 32)}`, 140, bottomY + 125);
  }
  ctx.restore();

  if (tpl?.showQrCode !== false && isPlaceholderEnabled('qr', fieldRoles)) {
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

    if (isPlaceholderEnabled('certificate_id', fieldRoles)) {
      const resolvedCertId = resolvePlaceholderValue('certificate_id', autoValues, fieldRoles) || cert.certificateId;
      ctx.font = 'bold 22px "Google Sans", monospace';
      ctx.fillStyle = '#1A73E8';
      ctx.fillText(`ID: ${resolvedCertId}`, width / 2, qrY + qrSize + 30);
    }

    ctx.font = '500 18px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#5F6368';
    ctx.fillText('Scan to verify authenticity', width / 2, qrY + qrSize + 55);
    ctx.restore();
  }

  if (tpl?.showSignature !== false && isPlaceholderEnabled('sign', fieldRoles)) {
    ctx.save();
    const sigScale = (tpl?.signatureScale ?? 100) / 100;
    const sigX = width - 560;
    const sigWidth = 420;
    const sigCenterX = sigX + sigWidth / 2;
    const maxW = Math.round(420 * sigScale);
    const maxH = Math.round(110 * sigScale);

    if (cert.signatureUrl) {
      try {
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';
        sigImg.src = cert.signatureUrl;
        await new Promise((resolve) => {
          sigImg.onload = resolve;
          sigImg.onerror = resolve;
        });
        const imgRatio = sigImg.width && sigImg.height ? sigImg.width / sigImg.height : maxW / maxH;
        let drawW = maxW;
        let drawH = drawW / imgRatio;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * imgRatio;
        }
        ctx.drawImage(sigImg, sigCenterX - drawW / 2, bottomY + 55 - drawH, drawW, drawH);
      } catch (e) {
        console.warn('Could not draw signature image onto canvas', e);
      }
    }

    ctx.strokeStyle = '#9AA0A6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sigX, bottomY + 65);
    ctx.lineTo(sigX + sigWidth, bottomY + 65);
    ctx.stroke();

    ctx.textAlign = 'center';
    if (isPlaceholderEnabled('CA Name', fieldRoles)) {
      const resolvedCaName = resolvePlaceholderValue('CA Name', autoValues, fieldRoles) || cert.caName;
      ctx.font = 'bold 30px "Google Sans", Inter, sans-serif';
      ctx.fillStyle = '#202124';
      ctx.fillText(resolvedCaName, sigCenterX, bottomY + 105);
    }

    ctx.font = '600 20px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#1A73E8';
    ctx.fillText(tpl?.signatureTitle || 'Campus Ambassador', sigCenterX, bottomY + 135);

    ctx.font = '500 18px "Google Sans", Inter, sans-serif';
    ctx.fillStyle = '#5F6368';
    ctx.fillText(`Google Student Ambassador Program 2026 (${cert.caId})`, sigCenterX, bottomY + 160);
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
