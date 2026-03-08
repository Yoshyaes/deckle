/**
 * Digital signature support for PDFs.
 *
 * Adds visual signature annotations to PDFs using pdf-lib.
 * For cryptographic signatures (PKCS#7), a production deployment
 * would use a signing service or HSM.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface SignatureOptions {
  /** Signer name */
  name: string;
  /** Reason for signing */
  reason?: string;
  /** Location of signing */
  location?: string;
  /** Contact info */
  contact?: string;
  /** Page to place signature (0-indexed, default: last page) */
  page?: number;
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
  /** Width of signature box */
  width?: number;
  /** Height of signature box */
  height?: number;
}

/**
 * Add a visual signature annotation to a PDF.
 */
export async function addSignature(
  buffer: Buffer,
  options: SignatureOptions,
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();
  const pageIndex = options.page ?? pages.length - 1;

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(`Invalid page index: ${pageIndex}`);
  }

  const page = pages[pageIndex];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const x = options.x ?? 50;
  const y = options.y ?? 50;
  const width = options.width ?? 250;
  const height = options.height ?? 80;

  // Draw signature box
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  // Draw "Digitally signed by" label
  page.drawText('Digitally signed by:', {
    x: x + 8,
    y: y + height - 18,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Draw signer name
  page.drawText(options.name, {
    x: x + 8,
    y: y + height - 34,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Draw date
  const dateStr = new Date().toISOString().split('T')[0];
  page.drawText(`Date: ${dateStr}`, {
    x: x + 8,
    y: y + height - 50,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Draw reason if provided
  if (options.reason) {
    page.drawText(`Reason: ${options.reason}`, {
      x: x + 8,
      y: y + height - 64,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Draw location if provided
  if (options.location) {
    page.drawText(`Location: ${options.location}`, {
      x: x + 8,
      y: y + 8,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
