import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { parseMargin, interpolatePageVars } from '../services/renderer.js';

describe('parseMargin', () => {
  it('returns 0.5in defaults when undefined', () => {
    expect(parseMargin(undefined)).toEqual({
      top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in',
    });
  });

  it('applies a single string margin to all sides', () => {
    expect(parseMargin('1in')).toEqual({
      top: '1in', right: '1in', bottom: '1in', left: '1in',
    });
  });

  it('uses provided sides and defaults the rest', () => {
    expect(parseMargin({ top: '2in' })).toEqual({
      top: '2in', right: '0.5in', bottom: '0.5in', left: '0.5in',
    });
  });

  it('fully respects an explicit four-side object', () => {
    expect(parseMargin({ top: '1in', right: '2in', bottom: '3in', left: '4in' })).toEqual({
      top: '1in', right: '2in', bottom: '3in', left: '4in',
    });
  });
});

describe('interpolatePageVars', () => {
  it('replaces {{pageNumber}} with the playwright pageNumber span', () => {
    expect(interpolatePageVars('Page {{pageNumber}}')).toBe(
      'Page <span class="pageNumber"></span>',
    );
  });

  it('replaces {{totalPages}} with the playwright totalPages span', () => {
    expect(interpolatePageVars('of {{totalPages}}')).toBe(
      'of <span class="totalPages"></span>',
    );
  });

  it('replaces all occurrences of both vars', () => {
    expect(interpolatePageVars('{{pageNumber}}/{{totalPages}} — {{pageNumber}}'))
      .toBe('<span class="pageNumber"></span>/<span class="totalPages"></span> — <span class="pageNumber"></span>');
  });

  it('returns html unchanged when no placeholders present', () => {
    expect(interpolatePageVars('<b>plain</b>')).toBe('<b>plain</b>');
  });
});

describe('PDF page counting via pdf-lib (H-6 fix)', () => {
  it('counts 1 page in a fresh single-page PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const loaded = await PDFDocument.load(bytes, { ignoreEncryption: true });
    expect(loaded.getPageCount()).toBe(1);
  });

  it('counts 5 pages in a multi-page PDF', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) doc.addPage();
    const bytes = await doc.save();
    const loaded = await PDFDocument.load(bytes, { ignoreEncryption: true });
    expect(loaded.getPageCount()).toBe(5);
  });

  it('counts pages correctly after save+reload round-trip (mimics renderer flow)', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 17; i++) doc.addPage([612, 792]);
    const bytes = await doc.save();
    // Round-trip through Buffer like renderer does
    const buf = Buffer.from(bytes);
    const loaded = await PDFDocument.load(buf, { ignoreEncryption: true });
    expect(loaded.getPageCount()).toBe(17);
  });

  it('throws on completely invalid PDF data (renderer catches and falls back to 1)', async () => {
    await expect(
      PDFDocument.load(Buffer.from('not a pdf'), { ignoreEncryption: true }),
    ).rejects.toThrow();
  });
});
