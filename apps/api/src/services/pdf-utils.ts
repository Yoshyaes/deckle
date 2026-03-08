/**
 * PDF manipulation utilities: merge, split, and password protection.
 * Uses pdf-lib for all operations.
 */
import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF buffers into a single PDF.
 */
export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();

  for (const buf of buffers) {
    const source = await PDFDocument.load(buf);
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  const bytes = await merged.save();
  return Buffer.from(bytes);
}

/**
 * Split a PDF by page ranges.
 * Each range is [start, end] (1-indexed, inclusive).
 * A single-element array [n] extracts just page n.
 * Returns an array of PDF buffers.
 */
export async function splitPdf(
  buffer: Buffer,
  pageRanges?: number[][],
): Promise<Buffer[]> {
  const source = await PDFDocument.load(buffer);
  const totalPages = source.getPageCount();

  const ranges =
    pageRanges || Array.from({ length: totalPages }, (_, i) => [i + 1]);

  const results: Buffer[] = [];
  for (const range of ranges) {
    const doc = await PDFDocument.create();
    const start = range[0] - 1;
    const end = (range.length > 1 ? range[1] : range[0]) - 1;
    const indices = Array.from(
      { length: end - start + 1 },
      (_, i) => start + i,
    ).filter((i) => i >= 0 && i < totalPages);

    if (indices.length === 0) continue;

    const pages = await doc.copyPages(source, indices);
    for (const page of pages) {
      doc.addPage(page);
    }

    const bytes = await doc.save();
    results.push(Buffer.from(bytes));
  }

  return results;
}

/**
 * Get metadata about a PDF.
 */
export async function getPdfInfo(buffer: Buffer) {
  const doc = await PDFDocument.load(buffer);
  return {
    pages: doc.getPageCount(),
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    creator: doc.getCreator(),
  };
}
