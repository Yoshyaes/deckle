import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { makePdfA } from '../services/pdf-a.js';

async function makePdf(pageCount = 1, title?: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  if (title) doc.setTitle(title);
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

describe('makePdfA', () => {
  it('returns a valid PDF buffer', async () => {
    const pdf = await makePdf();
    const result = await makePdfA(pdf);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.slice(0, 5).toString()).toContain('%PDF');
  });

  it('preserves the page count', async () => {
    const pdf = await makePdf(7);
    const result = await makePdfA(pdf);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(7);
  });

  it('sets the supplied title in the document metadata', async () => {
    const pdf = await makePdf(1);
    const result = await makePdfA(pdf, { title: 'Archive Report' });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getTitle()).toBe('Archive Report');
  });

  it('sets the supplied author in the document metadata', async () => {
    const pdf = await makePdf();
    const result = await makePdfA(pdf, { author: 'Acme Corp' });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getAuthor()).toBe('Acme Corp');
  });

  it('keeps an existing title when no override is provided', async () => {
    const pdf = await makePdf(1, 'Original Title');
    const result = await makePdfA(pdf);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getTitle()).toBe('Original Title');
  });

  it('embeds an XMP /Metadata stream into the document catalog', async () => {
    const pdf = await makePdf();
    const result = await makePdfA(pdf, { title: 'XMP Test' });
    // The XMP packet is embedded as a stream; raw bytes should contain
    // a marker only present in the PDF/A XMP we produce.
    const text = result.toString('latin1');
    expect(text).toContain('pdfaid:part');
    expect(text).toContain('pdfaid:conformance');
  });

  it('sets the Creator to DocuForge API (Producer is set by pdf-lib on save)', async () => {
    // pdf-lib overrides the /Producer field with its own string when saving
    // (see existing pdf-tools.test.ts:438 for the same caveat). We can still
    // assert on the Creator field, which pdf-lib leaves alone, and on the
    // XMP packet, which we embed directly without pdf-lib touching it.
    const pdf = await makePdf();
    const result = await makePdfA(pdf);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getCreator()).toBe('DocuForge API');
    // The XMP packet we embed records the Producer authoritatively.
    const xmpText = result.toString('latin1');
    expect(xmpText).toContain('DocuForge PDF/A Generator');
  });

  it('XML-escapes special characters in metadata fields', async () => {
    const pdf = await makePdf();
    const result = await makePdfA(pdf, {
      title: 'A & B <C> "D" \'E\'',
    });
    const text = result.toString('latin1');
    // Inside the XMP packet, '&' must be escaped to '&amp;' etc.
    expect(text).toContain('&amp;');
    expect(text).toContain('&lt;');
    expect(text).toContain('&gt;');
  });

  it('rejects invalid PDF input', async () => {
    await expect(makePdfA(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
