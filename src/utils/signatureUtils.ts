/**
 * Converts a text name into a realistic transparent PNG signature data URL
 */
export function generateScriptSignatureDataUrl(name: string, fontStyle = 'italic 48px "Great Vibes", "MonteCarlo", cursive'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e293b'; // Slate 800 dark ink
  ctx.font = fontStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);

  // Subtle stroke flourish
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo((canvas.width / 2) - 120, (canvas.height / 2) + 35);
  ctx.quadraticCurveTo(canvas.width / 2, (canvas.height / 2) + 45, (canvas.width / 2) + 140, (canvas.height / 2) + 25);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

/**
 * Normalizes an uploaded file into a transparent or clean base64 data URL
 */
export function processSignatureImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
