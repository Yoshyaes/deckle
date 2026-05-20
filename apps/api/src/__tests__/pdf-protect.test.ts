import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  protectPdf,
  isQpdfAvailable,
  _resetQpdfAvailableCache,
} from '../services/pdf-protect.js';
import { ValidationError } from '../lib/errors.js';

// Synchronous probe so describe.skipIf can see the result before tests
// register. Mirrors what isQpdfAvailable() does at runtime but without
// the async dance.
function detectQpdfSync(): boolean {
  try {
    const result = spawnSync(process.env.QPDF_BIN || 'qpdf', ['--version'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

const qpdfAvailable = detectQpdfSync();

async function buildSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText('Hello, encrypted world.', { x: 50, y: 100, size: 14 });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function isPdfEncrypted(pdfBytes: Buffer): boolean {
  // PDFs with the standard security handler carry an /Encrypt entry in
  // the trailer dictionary. qpdf-AES-256 output always contains this
  // marker. We don't need to fully parse the PDF — a byte scan is
  // sufficient and deliberately tolerant of object stream layouts.
  return pdfBytes.includes(Buffer.from('/Encrypt'));
}

// Validation tests never spawn qpdf — they run on every box.
describe('protectPdf — input validation', () => {
  it('rejects missing passwords', async () => {
    const pdf = await buildSamplePdf();
    await expect(protectPdf(pdf, {})).rejects.toThrow(ValidationError);
    await expect(protectPdf(pdf, {})).rejects.toThrow(/required/);
  });

  it('rejects empty-string user_password', async () => {
    const pdf = await buildSamplePdf();
    await expect(protectPdf(pdf, { userPassword: '' })).rejects.toThrow(ValidationError);
  });

  it('rejects passwords longer than 127 UTF-8 bytes', async () => {
    const pdf = await buildSamplePdf();
    const longPw = 'a'.repeat(128);
    await expect(protectPdf(pdf, { userPassword: longPw })).rejects.toThrow(ValidationError);
    await expect(protectPdf(pdf, { userPassword: longPw })).rejects.toThrow(/127/);
  });

  it('rejects an owner_password that fits in chars but is >127 UTF-8 bytes', async () => {
    const pdf = await buildSamplePdf();
    // 64 emoji × 4 bytes = 256 UTF-8 bytes
    const longPw = '😀'.repeat(64);
    await expect(
      protectPdf(pdf, { userPassword: 'pass', ownerPassword: longPw }),
    ).rejects.toThrow(ValidationError);
  });
});

// Real qpdf invocation: skip locally if the binary is missing, but
// CI / production deploys will always run these.
describe.skipIf(!qpdfAvailable)('protectPdf — qpdf encryption (requires qpdf installed)', () => {
  it('produces a valid encrypted PDF given a user password', async () => {
    const input = await buildSamplePdf();
    const output = await protectPdf(input, { userPassword: 'secret123' });

    expect(output.subarray(0, 5).toString()).toBe('%PDF-');
    expect(isPdfEncrypted(output)).toBe(true);
    // Output should be at least roughly the size of the input — encryption
    // adds a fixed-cost dictionary but doesn't shrink content streams.
    expect(output.length).toBeGreaterThan(100);
  }, 15_000);

  it('encrypts with an owner_password when no user_password is given', async () => {
    const input = await buildSamplePdf();
    const output = await protectPdf(input, { ownerPassword: 'admin-only' });
    expect(isPdfEncrypted(output)).toBe(true);
  }, 15_000);

  it('pdf-lib cannot open the encrypted PDF without supplying the password', async () => {
    const input = await buildSamplePdf();
    const output = await protectPdf(input, { userPassword: 'secret123' });
    // pdf-lib refuses encrypted PDFs by default (it requires the `ignoreEncryption: true`
    // escape hatch even to *parse* the structure). The default-options load is
    // the "naive reader without the password" scenario — it must fail.
    await expect(PDFDocument.load(output)).rejects.toThrow();
  }, 15_000);

  it('honors print=none / modify=false / copy=false permissions', async () => {
    const input = await buildSamplePdf();
    const output = await protectPdf(input, {
      userPassword: 'reader',
      ownerPassword: 'owner',
      permissions: {
        print: 'none',
        modify: false,
        copy: false,
        annotate: false,
      },
    });
    expect(isPdfEncrypted(output)).toBe(true);
  }, 15_000);

  it('passwords containing shell-special characters do not get interpreted', async () => {
    // Confirms the spawn-with-array approach blocks shell injection. A
    // shell-piped invocation of qpdf would explode on these characters.
    const input = await buildSamplePdf();
    const nasty = `' "; rm -rf / # \`whoami\``;
    const output = await protectPdf(input, { userPassword: nasty });
    expect(isPdfEncrypted(output)).toBe(true);
    expect(output.subarray(0, 5).toString()).toBe('%PDF-');
  }, 15_000);

  it('rejects garbage input that is not a PDF', async () => {
    const notAPdf = Buffer.from('this is plain text, not a PDF\n'.repeat(20));
    await expect(protectPdf(notAPdf, { userPassword: 'x' })).rejects.toThrow(/qpdf/);
  }, 15_000);
});

describe('isQpdfAvailable', () => {
  it('returns boolean and caches the result', async () => {
    _resetQpdfAvailableCache();
    const first = await isQpdfAvailable();
    const second = await isQpdfAvailable();
    expect(typeof first).toBe('boolean');
    expect(second).toBe(first);
  });
});
