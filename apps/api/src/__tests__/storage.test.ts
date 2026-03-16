import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';

// Mock the S3Client and fs to avoid real I/O
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

describe('Storage service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
  });

  it('uploads to local filesystem when no cloud provider configured', async () => {
    // Clear cloud env vars to force local storage
    const originalR2 = process.env.R2_ACCOUNT_ID;
    const originalProvider = process.env.STORAGE_PROVIDER;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.STORAGE_PROVIDER;

    const { uploadPdf } = await import('../services/storage.js');
    const buffer = Buffer.from('fake pdf content');
    const url = await uploadPdf('gen_test123', buffer);

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('gen_test123.pdf'),
      buffer,
    );
    expect(url).toContain('gen_test123.pdf');

    // Restore
    if (originalR2) process.env.R2_ACCOUNT_ID = originalR2;
    if (originalProvider) process.env.STORAGE_PROVIDER = originalProvider;
  });
});
