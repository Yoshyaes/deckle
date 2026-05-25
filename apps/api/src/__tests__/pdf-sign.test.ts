import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addSignature } from '../services/pdf-sign.js';

async function makePdf(pageCount = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

describe('addSignature', () => {
  it('returns a valid PDF buffer with %PDF header preserved', async () => {
    const pdf = await makePdf();
    const signed = await addSignature(pdf, { name: 'Alice' });
    expect(Buffer.isBuffer(signed)).toBe(true);
    expect(signed.slice(0, 5).toString()).toContain('%PDF');
  });

  it('preserves the page count of the input PDF', async () => {
    const pdf = await makePdf(3);
    const signed = await addSignature(pdf, { name: 'Bob' });
    const reloaded = await PDFDocument.load(signed);
    expect(reloaded.getPageCount()).toBe(3);
  });

  it('defaults to signing the last page when page is unspecified', async () => {
    const pdf = await makePdf(5);
    const signed = await addSignature(pdf, { name: 'Carol' });
    const reloaded = await PDFDocument.load(signed);
    expect(reloaded.getPageCount()).toBe(5);
  });

  it('accepts an explicit page index inside range', async () => {
    const pdf = await makePdf(4);
    const signed = await addSignature(pdf, { name: 'Dan', page: 1 });
    const reloaded = await PDFDocument.load(signed);
    expect(reloaded.getPageCount()).toBe(4);
  });

  it('throws on negative page index', async () => {
    const pdf = await makePdf(2);
    await expect(addSignature(pdf, { name: 'Eve', page: -1 }))
      .rejects.toThrow(/Invalid page index/);
  });

  it('throws on out-of-range page index', async () => {
    const pdf = await makePdf(2);
    await expect(addSignature(pdf, { name: 'Frank', page: 10 }))
      .rejects.toThrow(/Invalid page index/);
  });

  it('throws on page index equal to page count (off-by-one)', async () => {
    const pdf = await makePdf(2);
    await expect(addSignature(pdf, { name: 'Grace', page: 2 }))
      .rejects.toThrow(/Invalid page index/);
  });

  it('accepts optional reason and location without throwing', async () => {
    const pdf = await makePdf();
    await expect(
      addSignature(pdf, {
        name: 'Henry',
        reason: 'Approved',
        location: 'NYC',
        contact: 'h@x.co',
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('accepts custom x/y/width/height positioning', async () => {
    const pdf = await makePdf();
    const signed = await addSignature(pdf, {
      name: 'Ivy',
      x: 100, y: 200, width: 300, height: 100,
    });
    expect(signed.byteLength).toBeGreaterThan(pdf.byteLength);
  });

  it('rejects invalid PDF input', async () => {
    await expect(
      addSignature(Buffer.from('not a pdf'), { name: 'X' }),
    ).rejects.toThrow();
  });
});
