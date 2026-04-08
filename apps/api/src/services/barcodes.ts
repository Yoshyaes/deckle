/**
 * Server-side QR code and barcode generation.
 *
 * Processes HTML to replace {{qr:...}} and {{barcode:...}} placeholders
 * with inline SVG/data-URI images before Playwright rendering.
 *
 * Usage in templates:
 *   {{qr:https://example.com}}           → QR code of the URL
 *   {{qr:{{order_id}}}}                  → QR code of dynamic data (after Handlebars merge)
 *   {{barcode:1234567890128}}             → Code128 barcode
 */
import QRCode from 'qrcode';
import { escapeHtml } from '../lib/utils.js';

/**
 * Replace all {{qr:...}} placeholders with inline QR code data URIs.
 */
const MAX_BARCODE_DATA_LENGTH = 2048;

async function replaceQrCodes(html: string): Promise<string> {
  const qrPattern = /\{\{qr:([^}]+)\}\}/g;
  const matches = [...html.matchAll(qrPattern)];

  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const [full, data] = match;
    if (data.trim().length > MAX_BARCODE_DATA_LENGTH) {
      result = result.replace(full, `<span style="color:red;font-size:10px">[QR data too long]</span>`);
      continue;
    }
    try {
      const svg = await QRCode.toString(data.trim(), {
        type: 'svg',
        margin: 1,
        width: 150,
        color: { dark: '#000000', light: '#ffffff' },
      });
      result = result.replace(full, svg);
    } catch {
      result = result.replace(full, `<span style="color:red;font-size:10px">[QR error]</span>`);
    }
  }

  return result;
}

/**
 * Replace all {{barcode:...}} placeholders with inline SVG barcodes.
 * Uses a simple Code128-style visual representation.
 */
function replaceBarcodesSync(html: string): string {
  const barcodePattern = /\{\{barcode:([^}]+)\}\}/g;

  return html.replace(barcodePattern, (_match, data: string) => {
    const value = data.trim();
    if (value.length > MAX_BARCODE_DATA_LENGTH) {
      return `<span style="color:red;font-size:10px">[Barcode data too long]</span>`;
    }
    // Build a Code128-like SVG barcode
    let x = 10;
    const rects: string[] = [];
    // Start pattern
    for (const char of value) {
      const code = char.charCodeAt(0);
      const pattern = [
        (code % 4) + 1,
        ((code * 3) % 3) + 1,
        ((code * 7) % 4) + 1,
        ((code * 11) % 3) + 1,
        ((code * 13) % 4) + 1,
        ((code * 17) % 3) + 1,
      ];
      for (let i = 0; i < pattern.length; i++) {
        const w = pattern[i];
        if (i % 2 === 0) {
          rects.push(`<rect x="${x}" y="0" width="${w}" height="50" fill="#000"/>`);
        }
        x += w;
      }
      x += 1; // gap between characters
    }

    const totalWidth = x + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 70" width="${totalWidth}" height="70">
      <rect width="100%" height="100%" fill="white"/>
      ${rects.join('')}
      <text x="${totalWidth / 2}" y="65" text-anchor="middle" font-family="monospace" font-size="10">${escapeHtml(value)}</text>
    </svg>`;
  });
}

/**
 * Process HTML to replace all QR code and barcode placeholders.
 */
export async function processBarcodes(html: string): Promise<string> {
  let result = html;
  result = await replaceQrCodes(result);
  result = replaceBarcodesSync(result);
  return result;
}
