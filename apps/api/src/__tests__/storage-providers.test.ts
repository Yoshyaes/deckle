import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});
const mockPutCmd = vi.fn();
const mockS3Constructor = vi.fn();

class MockS3Client {
  send = mockSend;
  constructor(opts: unknown) {
    mockS3Constructor(opts);
  }
}

class MockPutObjectCommand {
  args: unknown;
  constructor(args: unknown) {
    this.args = args;
    mockPutCmd(args);
  }
}

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: MockPutObjectCommand,
}));

const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

/**
 * The storage module reads env vars at import time (provider, bucket, public URL)
 * and constructs a singleton S3 client. Each test resets the module registry and
 * sets env vars BEFORE importing.
 */
function resetEnv() {
  delete process.env.STORAGE_PROVIDER;
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.R2_PUBLIC_URL;
  delete process.env.AWS_REGION;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.S3_BUCKET_NAME;
  delete process.env.S3_PUBLIC_URL;
  delete process.env.GCS_BUCKET_NAME;
  delete process.env.GCS_PUBLIC_URL;
  delete process.env.GCS_ENDPOINT;
  delete process.env.GOOGLE_ACCESS_KEY_ID;
  delete process.env.GOOGLE_SECRET_ACCESS_KEY;
  delete process.env.PORT;
}

describe('storage providers', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    mockPutCmd.mockClear();
    mockS3Constructor.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('local provider writes to .storage/pdfs and returns a local URL', async () => {
    const { uploadPdf } = await import('../services/storage.js');
    const url = await uploadPdf('gen_local_1', Buffer.from('pdf'));

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('pdfs'),
      { recursive: true },
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('gen_local_1.pdf'),
      expect.any(Buffer),
    );
    expect(url).toContain('gen_local_1.pdf');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('R2 provider configures S3 client with cloudflarestorage endpoint', async () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'acct123';
    process.env.R2_ACCESS_KEY_ID = 'akid';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET_NAME = 'my-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';

    const { uploadPdf } = await import('../services/storage.js');
    const url = await uploadPdf('gen_r2_1', Buffer.from('pdf'));

    expect(mockS3Constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://acct123.r2.cloudflarestorage.com',
        credentials: { accessKeyId: 'akid', secretAccessKey: 'secret' },
      }),
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockPutCmd).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'my-bucket',
        Key: 'pdfs/gen_r2_1.pdf',
        ContentType: 'application/pdf',
      }),
    );
    expect(url).toBe('https://cdn.example.com/pdfs/gen_r2_1.pdf');
  });

  it('S3 provider uses AWS_REGION and constructs an AWS-style URL when no S3_PUBLIC_URL', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_REGION = 'eu-west-2';
    process.env.AWS_ACCESS_KEY_ID = 'aws-id';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.S3_BUCKET_NAME = 's3-bucket';

    const { uploadPdf } = await import('../services/storage.js');
    const url = await uploadPdf('gen_s3_1', Buffer.from('pdf'));

    expect(mockS3Constructor).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'eu-west-2' }),
    );
    expect(url).toBe('https://s3-bucket.s3.amazonaws.com/pdfs/gen_s3_1.pdf');
  });

  it('S3 provider defaults region to us-east-1 when AWS_REGION is absent', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_ACCESS_KEY_ID = 'aws-id';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.S3_BUCKET_NAME = 'b';

    await import('../services/storage.js');
    expect(mockS3Constructor).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  it('GCS provider uses storage.googleapis.com when GCS_ENDPOINT is unset', async () => {
    process.env.STORAGE_PROVIDER = 'gcs';
    process.env.GOOGLE_ACCESS_KEY_ID = 'g-id';
    process.env.GOOGLE_SECRET_ACCESS_KEY = 'g-secret';
    process.env.GCS_BUCKET_NAME = 'gcs-bucket';

    const { uploadPdf } = await import('../services/storage.js');
    const url = await uploadPdf('gen_gcs_1', Buffer.from('pdf'));

    expect(mockS3Constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://storage.googleapis.com',
      }),
    );
    expect(url).toBe('https://storage.googleapis.com/gcs-bucket/pdfs/gen_gcs_1.pdf');
  });

  it('R2 is auto-detected from R2_ACCOUNT_ID when STORAGE_PROVIDER is unset', async () => {
    process.env.R2_ACCOUNT_ID = 'auto-acct';
    process.env.R2_ACCESS_KEY_ID = 'auto-id';
    process.env.R2_SECRET_ACCESS_KEY = 'auto-secret';

    await import('../services/storage.js');
    // S3Client should have been built (=> R2 mode picked up)
    expect(mockS3Constructor).toHaveBeenCalled();
  });

  it('uploadPdf with cloud provider sets the correct ContentType and CacheControl', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_ACCESS_KEY_ID = 'id';
    process.env.AWS_SECRET_ACCESS_KEY = 'sec';
    process.env.S3_BUCKET_NAME = 'b';

    const { uploadPdf } = await import('../services/storage.js');
    await uploadPdf('gen_meta_1', Buffer.from('pdf'));

    expect(mockPutCmd).toHaveBeenCalledWith(
      expect.objectContaining({
        ContentType: 'application/pdf',
        CacheControl: 'public, max-age=86400',
      }),
    );
  });
});
