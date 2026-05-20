/**
 * PDF password protection via qpdf (AES-256 encryption).
 *
 * Spawns the system `qpdf` binary with stdin/stdout pipes so the PDF
 * never touches disk. Arguments are passed as an array (no shell), so
 * passwords cannot be injected into the command line.
 *
 * qpdf must be present on the host. The Dockerfile installs it via
 * `apt-get install qpdf`. For local development on macOS use
 * `brew install qpdf`; on Windows `scoop install qpdf`. The path can
 * be overridden via `QPDF_BIN`.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ValidationError } from '../lib/errors.js';

export interface ProtectPermissions {
  /** Print quality allowed: 'none' (deny), 'low' (degraded), 'full' (high-res). */
  print?: 'none' | 'low' | 'full';
  /** Allow content edits (annotations, form fill, page assembly, etc). */
  modify?: boolean;
  /** Allow text/image extraction (copy-paste). */
  copy?: boolean;
  /** Allow adding annotations even when modify=false. */
  annotate?: boolean;
}

export interface ProtectOptions {
  userPassword?: string;
  ownerPassword?: string;
  permissions?: ProtectPermissions;
}

const QPDF_BIN = process.env.QPDF_BIN || 'qpdf';
const SPAWN_TIMEOUT_MS = 30_000;
const MAX_PASSWORD_BYTES = 127;

function validatePassword(pw: string, label: string): void {
  const bytes = Buffer.byteLength(pw, 'utf8');
  if (bytes === 0) {
    throw new ValidationError(`${label} cannot be empty`);
  }
  if (bytes > MAX_PASSWORD_BYTES) {
    throw new ValidationError(`${label} must be at most ${MAX_PASSWORD_BYTES} UTF-8 bytes`);
  }
}

export async function protectPdf(input: Buffer, opts: ProtectOptions): Promise<Buffer> {
  const userPassword = opts.userPassword ?? '';
  // If the caller only provided one password, mirror it so qpdf has both.
  // Otherwise an empty owner password means "no owner password set",
  // which would let anyone strip the restrictions.
  const ownerPassword = opts.ownerPassword ?? opts.userPassword ?? '';

  if (!userPassword && !ownerPassword) {
    throw new ValidationError(
      'Either user_password or owner_password (or both) is required to protect a PDF.',
    );
  }
  if (userPassword) validatePassword(userPassword, 'user_password');
  if (opts.ownerPassword) validatePassword(opts.ownerPassword, 'owner_password');

  const args = ['--encrypt', userPassword, ownerPassword, '256'];

  const print = opts.permissions?.print ?? 'full';
  args.push(`--print=${print}`);

  const modify = opts.permissions?.modify ?? false;
  args.push(`--modify=${modify ? 'all' : 'none'}`);

  const copy = opts.permissions?.copy ?? true;
  args.push(`--extract=${copy ? 'y' : 'n'}`);

  const annotate = opts.permissions?.annotate ?? false;
  args.push(`--annotate=${annotate ? 'y' : 'n'}`);

  // qpdf 12 does not support reading from stdin, so we write the input
  // to a unique temp file. The output goes to stdout (qpdf does support
  // "-" for that). The temp directory is removed in `finally`, even on
  // error, so a crashed render never leaks PDFs onto disk.
  const tempDir = await mkdtemp(join(tmpdir(), 'docuforge-qpdf-'));
  const inputPath = join(tempDir, 'input.pdf');
  try {
    await writeFile(inputPath, input);
    // The `--` terminates the variable-arity `--encrypt` option group;
    // qpdf 12 errors out without it.
    args.push('--', inputPath, '-');

    return await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(QPDF_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`qpdf timed out after ${SPAWN_TIMEOUT_MS}ms`));
      }, SPAWN_TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new Error(
              'qpdf binary not found. Install qpdf on the host (apt: qpdf, brew: qpdf, scoop: qpdf) or set QPDF_BIN.',
            ),
          );
        } else {
          reject(err);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        // qpdf: 0 = success, 2 = errors, 3 = warnings only (output still valid).
        if (code === 0 || code === 3) {
          resolve(Buffer.concat(stdoutChunks));
        } else {
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          reject(new Error(`qpdf encryption failed (exit ${code}): ${stderr || 'unknown error'}`));
        }
      });
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Swallow cleanup errors — they'd mask the real reject, and the
      // OS will GC the tmp dir eventually.
    });
  }
}

/**
 * Check whether qpdf is installed and runnable. Cached so /protect's
 * preflight check doesn't spawn a subprocess on every request. The
 * cache is per process; restart to re-detect after installing qpdf.
 */
let qpdfAvailableCache: boolean | null = null;

export async function isQpdfAvailable(): Promise<boolean> {
  if (qpdfAvailableCache !== null) return qpdfAvailableCache;
  qpdfAvailableCache = await new Promise<boolean>((resolve) => {
    const child = spawn(QPDF_BIN, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
  return qpdfAvailableCache;
}

/** For tests — reset the cache so the next call probes again. */
export function _resetQpdfAvailableCache(): void {
  qpdfAvailableCache = null;
}
