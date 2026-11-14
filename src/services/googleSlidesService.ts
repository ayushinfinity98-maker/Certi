import { CertificateCustomElement } from '../types';
import { clearWorkspaceAuthToken } from './googleWorkspaceAuth';

export interface ImportedGoogleSlideResult {
  presentationTitle?: string;
  backgroundUrl?: string;
  backgroundColor?: string;
  customElements: CertificateCustomElement[];
  elementCount: number;
  hasBackground: boolean;
}

export class SlideAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlideAuthError';
  }
}

export function parseGoogleSlidesUrl(url: string): { presentationId: string; slideObjectId?: string } | null {
  if (!url) return null;
  const idMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch || !idMatch[1]) return null;

  const slideMatch = url.match(/slide=id\.([a-zA-Z0-9_-]+)/);
  return {
    presentationId: idMatch[1],
    slideObjectId: slideMatch?.[1]
  };
}

function rgbColorToHex(rgb?: { red?: number; green?: number; blue?: number }): string | undefined {
  if (!rgb) return undefined;
  const r = Math.max(0, Math.min(255, Math.round((rgb.red ?? 0) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((rgb.green ?? 0) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((rgb.blue ?? 0) * 255)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

function resolveOpaqueColorHex(
  opaqueColor: any,
  colorScheme?: { colors?: Array<{ type?: string; color?: { rgbColor?: { red?: number; green?: number; blue?: number } } }> }
): string | undefined {
  if (!opaqueColor) return undefined;
  if (opaqueColor.rgbColor) {
    return rgbColorToHex(opaqueColor.rgbColor);
  }
  if (opaqueColor.themeColor && colorScheme?.colors) {
    const match = colorScheme.colors.find(c => c.type === opaqueColor.themeColor);
    if (match?.color?.rgbColor) {
      return rgbColorToHex(match.color.rgbColor);
    }
  }
  // Fallback defaults for standard Google Slides theme color names
  if (opaqueColor.themeColor) {
    const themeFallbacks: Record<string, string> = {
      DARK1: '#000000',
      TEXT1: '#202124',
      LIGHT1: '#FFFFFF',
      BACKGROUND1: '#FFFFFF',
      DARK2: '#5F6368',
      TEXT2: '#5F6368',
      LIGHT2: '#F8F9FA',
      BACKGROUND2: '#F8F9FA',
      ACCENT1: '#4285F4',
      ACCENT2: '#EA4335',
      ACCENT3: '#FBBC05',
      ACCENT4: '#34A853',
      ACCENT5: '#FF6D01',
      ACCENT6: '#46BDC6'
    };
    return themeFallbacks[opaqueColor.themeColor];
  }
  return undefined;
}

function toEmu(dimension?: { magnitude?: number; unit?: string }, fallback = 9144000): number {
  if (!dimension || typeof dimension.magnitude !== 'number') return fallback;
  if (dimension.unit === 'PT') {
    return dimension.magnitude * 12700;
  }
  return dimension.magnitude;
}

function mapSlideFontFamily(rawFontName?: string): { fontFamily: 'serif' | 'sans' | 'mono'; customFontName?: string } {
  if (!rawFontName) return { fontFamily: 'sans' };
  const lower = rawFontName.toLowerCase();
  if (
    lower.includes('serif') ||
    lower.includes('georgia') ||
    lower.includes('times') ||
    lower.includes('playfair') ||
    lower.includes('garamond') ||
    lower.includes('merriweather') ||
    lower.includes('lora') ||
    lower.includes('cinzel') ||
    lower.includes('libre baskerville') ||
    lower.includes('cambria')
  ) {
    return { fontFamily: 'serif', customFontName: rawFontName };
  }
  if (
    lower.includes('mono') ||
    lower.includes('courier') ||
    lower.includes('consolas') ||
    lower.includes('code')
  ) {
    return { fontFamily: 'mono', customFontName: rawFontName };
  }
  return { fontFamily: 'sans', customFontName: rawFontName };
}

function mapSlideAlignment(align?: string): 'left' | 'center' | 'right' {
  if (align === 'CENTER' || align === 'JUSTIFIED') return 'center';
  if (align === 'END' || align === 'RIGHT') return 'right';
  if (align === 'START' || align === 'LEFT') return 'left';
  return 'center';
}

/**
 * Downloads an image URL and compresses/converts it to a persistent Data URL
 * so Google Slides temporary signed URLs never expire and canvas export never hits CORS.
 */
async function fetchImageUrlAsDataUrl(url: string, maxWidth = 1600): Promise<string | undefined> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const blob = await resp.blob();

    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Resize if oversized so it fits cleanly in Firestore (< 1MB doc limit)
    return await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const isPng = blob.type.includes('png');
        const out = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.88);
        // If PNG is huge (> 450KB), re-encode as JPEG
        if (out.length > 480000) {
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } else {
          resolve(out);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });
  } catch (err) {
    console.warn('Could not convert Slide image URL to Data URL:', err);
    return undefined;
  }
}

function getEffectiveBackgroundFill(slide: any, presentation: any): any {
  const candidates = [
    slide?.pageProperties?.pageBackgroundFill,
    presentation?.layouts?.find((l: any) => l.objectId === slide?.slideProperties?.layoutObjectId)?.pageProperties?.pageBackgroundFill,
    presentation?.masters?.find((m: any) => m.objectId === slide?.slideProperties?.masterObjectId)?.pageProperties?.pageBackgroundFill,
    presentation?.masters?.[0]?.pageProperties?.pageBackgroundFill
  ];

  for (const bg of candidates) {
    if (!bg) continue;
    if (bg.propertyState === 'NOT_RENDERED') return null;
    if (bg.stretchedPictureFill?.contentUrl || bg.solidFill?.color) {
      return bg;
    }
  }
  return null;
}

/**
 * Reads a Google Slides presentation using the Slides REST API and extracts:
 * - Slide background (picture fill, full-bleed background image, or solid RGB/theme color)
 * - Text boxes & {{placeholder}} tags with X/Y coordinates, font family, font size, font weight, alignment, and hex color
 * - Secondary image elements (logos/seals)
 */
export async function importFromGoogleSlide(
  slideUrl: string,
  accessToken: string
): Promise<ImportedGoogleSlideResult> {
  const parsed = parseGoogleSlidesUrl(slideUrl);
  if (!parsed) {
    throw new Error('Invalid Google Slides URL. Please paste a link like https://docs.google.com/presentation/d/YOUR_ID/edit');
  }

  const res = await fetch(`https://slides.googleapis.com/v1/presentations/${parsed.presentationId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (res.status === 401 || res.status === 403) {
    clearWorkspaceAuthToken();
    const errJson = await res.json().catch(() => ({}));
    throw new SlideAuthError(
      errJson?.error?.message || 'Google Slides authorization expired or access was denied. Please sign in with Google to grant Slides permission.'
    );
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `Failed to load Google Slide (HTTP ${res.status}). Verify the URL and sharing permissions.`);
  }

  const presentation = await res.json();
  const slides: any[] = presentation.slides || [];
  if (slides.length === 0) {
    throw new Error('This Google Slides presentation contains no slides.');
  }

  const targetSlide =
    (parsed.slideObjectId && slides.find(s => s.objectId === parsed.slideObjectId)) || slides[0];

  const pageWidthEmu = toEmu(presentation.pageSize?.width, 9144000);
  const pageHeightEmu = toEmu(presentation.pageSize?.height, 5143500);

  // Preview canvas maps width -> ~650px (in 72pt = 1in, 9144000 EMU = 720pt)
  const slideWidthPt = pageWidthEmu / 12700;
  const ptScaleFactor = 660 / slideWidthPt;

  const master =
    presentation.masters?.find((m: any) => m.objectId === targetSlide?.slideProperties?.masterObjectId) ||
    presentation.masters?.[0];
  const colorScheme = targetSlide?.pageProperties?.colorScheme || master?.pageProperties?.colorScheme;

  // 1. Extract Background (Picture or Solid Fill)
  let backgroundUrl: string | undefined;
  let backgroundColor: string | undefined;

  const bgFill = getEffectiveBackgroundFill(targetSlide, presentation);
  if (bgFill?.stretchedPictureFill?.contentUrl) {
    backgroundUrl = await fetchImageUrlAsDataUrl(bgFill.stretchedPictureFill.contentUrl, 1600);
  }
  if (bgFill?.solidFill?.color) {
    backgroundColor = resolveOpaqueColorHex(bgFill.solidFill.color, colorScheme);
  }

  // 2. Inspect Page Elements
  const pageElements: any[] = targetSlide.pageElements || [];
  const customElements: CertificateCustomElement[] = [];

  for (let idx = 0; idx < pageElements.length; idx++) {
    const el = pageElements[idx];
    const transform = el.transform || {};
    const size = el.size || {};

    const rawW = toEmu(size.width, 0);
    const rawH = toEmu(size.height, 0);
    const scaleX = typeof transform.scaleX === 'number' ? transform.scaleX : 1;
    const scaleY = typeof transform.scaleY === 'number' ? transform.scaleY : 1;

    const renderedW = rawW * Math.abs(scaleX);
    const renderedH = rawH * Math.abs(scaleY);

    let translateX = typeof transform.translateX === 'number' ? transform.translateX : 0;
    let translateY = typeof transform.translateY === 'number' ? transform.translateY : 0;
    if (transform.unit === 'PT') {
      translateX *= 12700;
      translateY *= 12700;
    }

    const leftEmu = scaleX < 0 ? translateX - renderedW : translateX;
    const topEmu = scaleY < 0 ? translateY - renderedH : translateY;

    // Handle Image Elements (Full-bleed background OR smaller logo/emblem)
    if (el.image?.contentUrl) {
      const widthRatio = renderedW / pageWidthEmu;
      const heightRatio = renderedH / pageHeightEmu;

      if (!backgroundUrl && widthRatio >= 0.72 && heightRatio >= 0.72) {
        const bgData = await fetchImageUrlAsDataUrl(el.image.contentUrl, 1600);
        if (bgData) {
          backgroundUrl = bgData;
        }
        continue;
      }

      // Smaller decorative image / logo / emblem
      const imgData = await fetchImageUrlAsDataUrl(el.image.contentUrl, 600);
      if (imgData) {
        const centerX = Math.max(0, Math.min(100, Math.round(((leftEmu + renderedW / 2) / pageWidthEmu) * 1000) / 10));
        const centerY = Math.max(0, Math.min(100, Math.round(((topEmu + renderedH / 2) / pageHeightEmu) * 1000) / 10));
        const widthPct = Math.max(4, Math.min(80, Math.round(widthRatio * 100)));
        const heightPct = Math.max(4, Math.min(80, Math.round(heightRatio * 100)));

        customElements.push({
          id: `el_slide_img_${idx}_${Date.now()}`,
          type: 'image',
          label: `Slide Image ${idx + 1}`,
          customText: imgData,
          x: centerX,
          y: centerY,
          width: widthPct,
          height: heightPct,
          textAlign: 'center'
        });
      }
      continue;
    }

    // Handle Shape / Text Box Elements
    const textElements: any[] = el.shape?.text?.textElements || [];
    if (textElements.length === 0) continue;

    let combinedText = '';
    let firstAlign: string | undefined;
    let primaryStyle: any = null;

    for (const te of textElements) {
      if (te.paragraphMarker?.style?.alignment && !firstAlign) {
        firstAlign = te.paragraphMarker.style.alignment;
      }
      if (te.textRun?.content) {
        combinedText += te.textRun.content;
        if (!primaryStyle && te.textRun.content.trim().length > 0 && te.textRun.style) {
          primaryStyle = te.textRun.style;
        }
      }
    }

    const trimmedText = combinedText.replace(/\r/g, '').trim();
    if (!trimmedText) continue;

    // Extract font, weight, size, color
    const rawFontPt = primaryStyle?.fontSize?.magnitude || 14;
    const mappedFontSize = Math.max(9, Math.min(72, Math.round(rawFontPt * ptScaleFactor)));
    const rawFontFamily =
      primaryStyle?.weightedFontFamily?.fontFamily ||
      primaryStyle?.fontFamily;
    const { fontFamily, customFontName } = mapSlideFontFamily(rawFontFamily);

    const weightNum = primaryStyle?.weightedFontFamily?.weight || 400;
    const fontWeight: 'normal' | 'bold' | '600' =
      primaryStyle?.bold || weightNum >= 700
        ? 'bold'
        : weightNum >= 600
        ? '600'
        : 'normal';

    const resolvedColor =
      resolveOpaqueColorHex(primaryStyle?.foregroundColor?.opaqueColor, colorScheme) || '#202124';

    const textAlign = mapSlideAlignment(firstAlign);

    // Position relative to alignment anchor
    let anchorXEmu = leftEmu + renderedW / 2;
    if (textAlign === 'left') anchorXEmu = leftEmu;
    if (textAlign === 'right') anchorXEmu = leftEmu + renderedW;
    const anchorYEmu = topEmu + renderedH / 2;

    const xPct = Math.max(0, Math.min(100, Math.round((anchorXEmu / pageWidthEmu) * 1000) / 10));
    const yPct = Math.max(0, Math.min(100, Math.round((anchorYEmu / pageHeightEmu) * 1000) / 10));

    // Also inspect shape fill color if it's a decorative colored banner behind no-text or text? (keep clean text color)
    const exactPlaceholderMatch = trimmedText.match(/^{{\s*([a-zA-Z0-9_\s-]+)\s*}}$/);
    const anyPlaceholderMatch = trimmedText.match(/{{\s*([a-zA-Z0-9_\s-]+)\s*}}/);

    if (exactPlaceholderMatch) {
      const rawTag = exactPlaceholderMatch[1].trim();
      const tag = rawTag.toLowerCase().replace(/[\s-]+/g, '_');
      if (tag === 'qr_code' || tag === 'qr' || tag === 'qrcode') {
        customElements.push({
          id: `el_slide_qr_${idx}_${Date.now()}`,
          type: 'qr',
          label: `{{${rawTag}}} (Slide)`,
          x: xPct,
          y: yPct,
          fontSize: mappedFontSize,
          color: resolvedColor,
          textAlign: 'center'
        });
      } else if (tag === 'ca_signature' || tag === 'signature') {
        customElements.push({
          id: `el_slide_sig_${idx}_${Date.now()}`,
          type: 'signature',
          label: `{{${rawTag}}} (Slide)`,
          x: xPct,
          y: yPct,
          fontSize: mappedFontSize,
          fontWeight,
          fontFamily,
          customFontName,
          color: resolvedColor,
          textAlign
        });
      } else {
        customElements.push({
          id: `el_slide_ph_${idx}_${Date.now()}`,
          type: 'placeholder',
          placeholderTag: rawTag,
          label: `{{${rawTag}}} (Slide)`,
          x: xPct,
          y: yPct,
          fontSize: mappedFontSize,
          fontWeight,
          fontFamily,
          customFontName,
          color: resolvedColor,
          textAlign
        });
      }
    } else if (anyPlaceholderMatch) {
      // Mixed static text + {{placeholder}} tags
      customElements.push({
        id: `el_slide_mixed_${idx}_${Date.now()}`,
        type: 'text',
        customText: trimmedText,
        label: `Slide Text (${anyPlaceholderMatch[1]})`,
        x: xPct,
        y: yPct,
        fontSize: mappedFontSize,
        fontWeight,
        fontFamily,
        customFontName,
        color: resolvedColor,
        textAlign
      });
    } else {
      // Static label/heading from Google Slide preserving exact font, color & position
      customElements.push({
        id: `el_slide_txt_${idx}_${Date.now()}`,
        type: 'text',
        customText: trimmedText,
        label: trimmedText.slice(0, 22) + (trimmedText.length > 22 ? '…' : ''),
        x: xPct,
        y: yPct,
        fontSize: mappedFontSize,
        fontWeight,
        fontFamily,
        customFontName,
        color: resolvedColor,
        textAlign
      });
    }
  }

  return {
    presentationTitle: presentation.title,
    backgroundUrl,
    backgroundColor: backgroundColor || '#FFFFFF',
    customElements,
    elementCount: customElements.length,
    hasBackground: Boolean(backgroundUrl || (backgroundColor && backgroundColor !== '#FFFFFF'))
  };
}
