import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Storage provider configuration.
 *
 * Supports: local (default), r2, s3, gcs.
 *
 * Set STORAGE_PROVIDER env to choose. Each provider reads its own env vars:
 *
 * r2:  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 * s3:  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, S3_PUBLIC_URL
 * gcs: GCS_BUCKET_NAME, GCS_PUBLIC_URL, GCS_ENDPOINT (uses S3-compatible interop)
 *      GOOGLE_ACCESS_KEY_ID, GOOGLE_SECRET_ACCESS_KEY
 */
type StorageProvider = 'local' | 'r2' | 's3' | 'gcs';

const provider: StorageProvider =
  (process.env.STORAGE_PROVIDER as StorageProvider) ||
  (process.env.R2_ACCOUNT_ID ? 'r2' : 'local');

function createS3Client(): S3Client | null {
  switch (provider) {
    case 'r2':
      return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    case 's3':
      return new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    case 'gcs':
      return new S3Client({
        region: 'auto',
        endpoint: process.env.GCS_ENDPOINT || 'https://storage.googleapis.com',
        credentials: {
          accessKeyId: process.env.GOOGLE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.GOOGLE_SECRET_ACCESS_KEY!,
        },
      });
    default:
      return null;
  }
}

const s3 = createS3Client();

function getBucket(): string {
  switch (provider) {
    case 'r2':
      return process.env.R2_BUCKET_NAME || 'docuforge-pdfs';
    case 's3':
      return process.env.S3_BUCKET_NAME || 'docuforge-pdfs';
    case 'gcs':
      return process.env.GCS_BUCKET_NAME || 'docuforge-pdfs';
    default:
      return 'docuforge-pdfs';
  }
}

function getPublicUrl(): string {
  switch (provider) {
    case 'r2':
      return process.env.R2_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}/files`;
    case 's3':
      return process.env.S3_PUBLIC_URL || `https://${getBucket()}.s3.amazonaws.com`;
    case 'gcs':
      return process.env.GCS_PUBLIC_URL || `https://storage.googleapis.com/${getBucket()}`;
    default:
      return `http://localhost:${process.env.PORT || 3000}/files`;
  }
}

const LOCAL_STORAGE_DIR = join(process.cwd(), '.storage', 'pdfs');
const BUCKET = getBucket();
const PUBLIC_URL = getPublicUrl();

export async function uploadPdf(
  generationId: string,
  buffer: Buffer,
): Promise<string> {
  const key = `pdfs/${generationId}.pdf`;

  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        CacheControl: 'public, max-age=86400',
      }),
    );
    return `${PUBLIC_URL}/${generationId}.pdf`;
  }

  // Local filesystem fallback for development
  await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
  const filePath = join(LOCAL_STORAGE_DIR, `${generationId}.pdf`);
  await writeFile(filePath, buffer);
  return `${PUBLIC_URL}/${generationId}.pdf`;
}
