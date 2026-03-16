import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, splitPdf, getPdfInfo } from '../services/pdf-utils.js';

async function createTestPdf(pageCount: number, title?: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  if (title) doc.setTitle(title);
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe('PDF utilities', () => {
  describe('mergePdfs', () => {
    it('merges two single-page PDFs', async () => {
      const pdf1 = await createTestPdf(1);
      const pdf2 = await createTestPdf(1);
      const merged = await mergePdfs([pdf1, pdf2]);

      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(2);
    });

    it('merges PDFs with different page counts', async () => {
      const pdf1 = await createTestPdf(3);
      const pdf2 = await createTestPdf(2);
      const pdf3 = await createTestPdf(1);
      const merged = await mergePdfs([pdf1, pdf2, pdf3]);

      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(6);
    });

    it('merging a single PDF returns equivalent document', async () => {
      const pdf = await createTestPdf(3);
      const merged = await mergePdfs([pdf]);

      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(3);
    });

    it('returns valid PDF buffer', async () => {
      const pdf1 = await createTestPdf(1);
      const pdf2 = await createTestPdf(1);
      const merged = await mergePdfs([pdf1, pdf2]);

      expect(Buffer.isBuffer(merged)).toBe(true);
      // PDF magic bytes: %PDF
      expect(merged.slice(0, 5).toString()).toContain('%PDF');
    });
  });

  describe('splitPdf', () => {
    it('splits a 3-page PDF into individual pages', async () => {
      const pdf = await createTestPdf(3);
      const parts = await splitPdf(pdf);

      expect(parts).toHaveLength(3);
      for (const part of parts) {
        const doc = await PDFDocument.load(part);
        expect(doc.getPageCount()).toBe(1);
      }
    });

    it('splits by custom page ranges', async () => {
      const pdf = await createTestPdf(5);
      const parts = await splitPdf(pdf, [[1, 2], [3, 5]]);

      expect(parts).toHaveLength(2);

      const doc1 = await PDFDocument.load(parts[0]);
      expect(doc1.getPageCount()).toBe(2);

      const doc2 = await PDFDocument.load(parts[1]);
      expect(doc2.getPageCount()).toBe(3);
    });

    it('extracts a single page', async () => {
      const pdf = await createTestPdf(5);
      const parts = await splitPdf(pdf, [[3]]);

      expect(parts).toHaveLength(1);
      const doc = await PDFDocument.load(parts[0]);
      expect(doc.getPageCount()).toBe(1);
    });

    it('skips out-of-range pages', async () => {
      const pdf = await createTestPdf(2);
      const parts = await splitPdf(pdf, [[5, 10]]);

      expect(parts).toHaveLength(0);
    });
  });

  describe('getPdfInfo', () => {
    it('returns page count', async () => {
      const pdf = await createTestPdf(4);
      const info = await getPdfInfo(pdf);
      expect(info.pages).toBe(4);
    });

    it('returns title when set', async () => {
      const pdf = await createTestPdf(1, 'Test Document');
      const info = await getPdfInfo(pdf);
      expect(info.title).toBe('Test Document');
    });

    it('returns undefined for unset metadata', async () => {
      const pdf = await createTestPdf(1);
      const info = await getPdfInfo(pdf);
      expect(info.author).toBeUndefined();
      expect(info.subject).toBeUndefined();
    });
  });
});
