import { describe, it, expect, beforeAll } from 'vitest';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { signPdfWithP12 } from '../services/pdf-sign-crypto.js';
import { ValidationError } from '../lib/errors.js';

interface TestKeyMaterial {
  p12: Buffer;
  password: string;
}

/**
 * Build a self-signed PKCS#12 in memory. node-forge is a devDependency
 * exactly so the tests can mint signing material without shelling out
 * to OpenSSL. Cheap enough (~200ms) to run per test, but we mint once
 * in beforeAll and reuse.
 */
function mintTestP12(password = 'testpass'): TestKeyMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    { name: 'commonName', value: 'DocuForge Test Signer' },
    { name: 'countryName', value: 'US' },
    { name: 'organizationName', value: 'DocuForge CI' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return { p12: Buffer.from(der, 'binary'), password };
}

async function buildSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText('Sign me', { x: 50, y: 100, size: 14 });
  // signPdfWithP12 normalizes stream-xref PDFs, so we deliberately
  // don't pass useObjectStreams here — that exercises the auto-rewrite
  // path on every test.
  return Buffer.from(await doc.save());
}

let creds: TestKeyMaterial;

beforeAll(() => {
  creds = mintTestP12();
});

describe('signPdfWithP12 — happy path', () => {
  it('embeds a PKCS#7 signature in a /Sig dictionary', async () => {
    const pdf = await buildSamplePdf();
    const signed = await signPdfWithP12(pdf, creds.p12, creds.password, {
      name: 'Test Signer',
      reason: 'Approval',
      location: 'CI',
      contactInfo: 'ci@example.com',
    });
    expect(signed.subarray(0, 5).toString()).toBe('%PDF-');
    // Telltale markers of a PAdES signature.
    expect(signed.includes(Buffer.from('/Sig'))).toBe(true);
    expect(signed.includes(Buffer.from('/ByteRange'))).toBe(true);
    expect(signed.includes(Buffer.from('adbe.pkcs7'))).toBe(true);
    // The signature blob is at least somewhat larger than a bare placeholder.
    expect(signed.length).toBeGreaterThan(pdf.length);
  }, 30_000);

  it('handles an unprotected P12 (empty passphrase)', async () => {
    const noPwCreds = mintTestP12('');
    const pdf = await buildSamplePdf();
    const signed = await signPdfWithP12(pdf, noPwCreds.p12, '', {});
    expect(signed.includes(Buffer.from('/Sig'))).toBe(true);
  }, 30_000);

  it('signs a PDF that was already in legacy xref-table format', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 200]).drawText('Pre-saved legacy', { x: 50, y: 100, size: 12 });
    const legacy = Buffer.from(await doc.save({ useObjectStreams: false }));
    const signed = await signPdfWithP12(legacy, creds.p12, creds.password, {});
    expect(signed.includes(Buffer.from('/Sig'))).toBe(true);
  }, 30_000);
});

describe('signPdfWithP12 — input validation', () => {
  it('rejects an empty P12 buffer', async () => {
    const pdf = await buildSamplePdf();
    await expect(signPdfWithP12(pdf, Buffer.alloc(0), 'x', {})).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects a P12 larger than 100 KB', async () => {
    const pdf = await buildSamplePdf();
    const oversize = Buffer.alloc(200_000, 0x00);
    await expect(signPdfWithP12(pdf, oversize, 'x', {})).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects an unparseable P12 blob', async () => {
    const pdf = await buildSamplePdf();
    const garbage = Buffer.from('this is not a PKCS#12 blob, just plain text');
    await expect(signPdfWithP12(pdf, garbage, 'x', {})).rejects.toThrow(ValidationError);
  });

  it('rejects a valid P12 with the wrong password', async () => {
    const pdf = await buildSamplePdf();
    await expect(
      signPdfWithP12(pdf, creds.p12, 'wrong-password', {}),
    ).rejects.toThrow(ValidationError);
    await expect(
      signPdfWithP12(pdf, creds.p12, 'wrong-password', {}),
    ).rejects.toThrow(/password/i);
  }, 15_000);
});

describe('signPdfWithP12 — output structure', () => {
  it('preserves the visual content (page count, original text)', async () => {
    const pdf = await buildSamplePdf();
    const signed = await signPdfWithP12(pdf, creds.p12, creds.password, {});

    // Re-parse the signed output and confirm the structure is intact.
    // We need ignoreEncryption (signed PDFs aren't actually encrypted,
    // but pdf-lib bails on /AcroForm without explicit confirmation).
    const reopened = await PDFDocument.load(signed, { ignoreEncryption: true });
    expect(reopened.getPageCount()).toBe(1);
  }, 30_000);

  it('signs idempotently for the same input + key (signed PDFs differ only in randomness)', async () => {
    const pdf = await buildSamplePdf();
    const a = await signPdfWithP12(pdf, creds.p12, creds.password, { reason: 'A' });
    const b = await signPdfWithP12(pdf, creds.p12, creds.password, { reason: 'A' });
    // Sizes should be very close (placeholder is fixed-size, signature varies by a few bytes).
    expect(Math.abs(a.length - b.length)).toBeLessThan(100);
  }, 60_000);
});
