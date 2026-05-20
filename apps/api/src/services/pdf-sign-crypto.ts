/**
 * Cryptographic PDF signing (PAdES baseline) via @signpdf.
 *
 * Accepts a PDF buffer plus a PKCS#12 (P12) blob containing the signer's
 * certificate and private key, and returns a PDF with an embedded
 * detached PKCS#7 signature in a /Sig dictionary. The signature covers
 * the entire PDF except the signature placeholder bytes themselves
 * (standard PAdES /ByteRange convention).
 *
 * Key material is used ephemerally and never written to disk. The
 * P12 password is read from the request, used once, then discarded
 * by the GC once this function returns.
 *
 * Security notes:
 *  - This is PAdES-B-B (basic). It does not embed an RFC 3161
 *    timestamp (PAdES-B-T) or revocation info (PAdES-B-LT/LTA).
 *    Adding those is a follow-up; the current shape is honest about
 *    being a baseline signature.
 *  - We don't trust any cert in the P12 — we use whatever the caller
 *    supplied. Whether a downstream verifier trusts it is the caller's
 *    business (self-signed certs will produce a "signature is valid
 *    but signer is unknown" status in Acrobat).
 */
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { PDFDocument } from 'pdf-lib';
import { ValidationError } from '../lib/errors.js';

const MAX_P12_BYTES = 100 * 1024; // 100 KB — real P12s are typically 2–20 KB.
const SIGNATURE_PLACEHOLDER_LENGTH = 16384; // Enough for a typical PKCS#7 with chain.

export interface CryptoSignOptions {
  /** Signer name embedded in the signature dictionary. */
  name?: string;
  /** Reason for signing (free text, shown in Acrobat's signature panel). */
  reason?: string;
  /** Location of signing (free text). */
  location?: string;
  /** Contact info (free text). */
  contactInfo?: string;
}

/**
 * Add a signature placeholder to a PDF and produce a detached PKCS#7
 * signature using the supplied P12 credential.
 *
 * The input PDF MUST be in legacy xref-table format. If you're producing
 * the PDF with pdf-lib, save it with `{ useObjectStreams: false }`. The
 * `signCryptographically` wrapper below handles re-saving callers' PDFs
 * automatically when they were originally produced by us.
 */
export async function signPdfWithP12(
  pdf: Buffer,
  p12: Buffer,
  passphrase: string,
  opts: CryptoSignOptions = {},
): Promise<Buffer> {
  if (p12.length === 0) {
    throw new ValidationError('Signing certificate (signature.p12) is empty.');
  }
  if (p12.length > MAX_P12_BYTES) {
    throw new ValidationError(
      `Signing certificate (signature.p12) exceeds ${MAX_P12_BYTES / 1024} KB`,
    );
  }

  // pdf-lib defaults to PDF 1.7 with cross-reference *streams*, which the
  // @signpdf placeholder-plain helper can't patch. If the input PDF uses
  // a stream xref, re-save it through pdf-lib in legacy xref-table form
  // first. PDFs already in legacy format pass through unchanged here.
  const normalized = await ensureLegacyXref(pdf);

  let placeheld: Buffer;
  try {
    placeheld = plainAddPlaceholder({
      pdfBuffer: normalized,
      reason: opts.reason ?? 'Signed',
      name: opts.name ?? '',
      location: opts.location ?? '',
      contactInfo: opts.contactInfo ?? '',
      signatureLength: SIGNATURE_PLACEHOLDER_LENGTH,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ValidationError(
      `Could not add signature placeholder to PDF: ${msg}. The PDF may already be signed, encrypted, or malformed.`,
    );
  }

  let signer: P12Signer;
  try {
    signer = new P12Signer(p12, { passphrase });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ValidationError(
      `Could not load P12 certificate: ${msg}. Check that signature.p12 is a valid PKCS#12 blob and the password is correct.`,
    );
  }

  const signpdf = new SignPdf();
  try {
    return await signpdf.sign(placeheld, signer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // node-forge surfaces wrong-password as "PKCS#12 MAC could not be verified"
    if (/MAC.+verif/i.test(msg)) {
      throw new ValidationError('PKCS#12 password is incorrect.');
    }
    throw new ValidationError(`Signature generation failed: ${msg}`);
  }
}

async function ensureLegacyXref(pdf: Buffer): Promise<Buffer> {
  // Heuristic: if the file contains the text "xref" near the end, it's
  // already in legacy format. Otherwise we round-trip through pdf-lib
  // with useObjectStreams=false to normalize. We only inspect the last
  // ~1 KB to avoid scanning the whole document.
  const tail = pdf.subarray(Math.max(0, pdf.length - 1024));
  if (tail.includes(Buffer.from('\nxref\n')) || tail.includes(Buffer.from('\r\nxref\r\n'))) {
    return pdf;
  }
  const doc = await PDFDocument.load(pdf);
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
