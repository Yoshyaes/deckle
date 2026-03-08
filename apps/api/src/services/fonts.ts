import { db } from '../lib/db.js';
import { customFonts } from '../schema/db.js';
import { eq, and } from 'drizzle-orm';
import { fontId } from '../lib/id.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

const ALLOWED_FORMATS = ['woff2', 'ttf', 'otf'] as const;
const MAX_FONT_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_FORMAT: Record<string, string> = {
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-woff2': 'woff2',
  'application/x-font-ttf': 'ttf',
  'application/x-font-opentype': 'otf',
  'application/octet-stream': '', // detect from extension
};

const FORMAT_TO_CSS: Record<string, string> = {
  woff2: 'woff2',
  ttf: 'truetype',
  otf: 'opentype',
};

function detectFormat(filename: string, mimeType: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_FORMATS.includes(ext as any)) return ext;
  const fromMime = MIME_TO_FORMAT[mimeType];
  if (fromMime) return fromMime;
  return null;
}

export async function uploadFont(
  userId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  family: string,
): Promise<{ id: string; name: string; family: string; format: string }> {
  if (fileBuffer.length > MAX_FONT_SIZE) {
    throw new Error('Font file exceeds 5MB limit');
  }

  const format = detectFormat(filename, mimeType);
  if (!format) {
    throw new Error('Unsupported font format. Use WOFF2, TTF, or OTF.');
  }

  const id = fontId();
  const storageKey = `fonts/${userId}/${id}.${format}`;

  // Store the font file
  const provider = process.env.STORAGE_PROVIDER || 'local';

  if (provider === 'local') {
    const dir = join(process.cwd(), '.storage', 'fonts', userId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${id}.${format}`), fileBuffer);
  } else {
    // Use S3-compatible storage (same pattern as storage.ts)
    const { uploadFontToS3 } = await getS3Uploader();
    await uploadFontToS3(storageKey, fileBuffer, mimeType);
  }

  // Save metadata to DB
  const [record] = await db
    .insert(customFonts)
    .values({
      id,
      userId,
      name: filename,
      family,
      format,
      storageKey,
      fileSizeBytes: fileBuffer.length,
    })
    .returning();

  return { id: record.id, name: record.name, family: record.family, format: record.format };
}

async function getS3Uploader() {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  let client: S3Client;
  let bucket: string;

  if (provider === 'r2') {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    bucket = process.env.R2_BUCKET_NAME || 'docuforge-pdfs';
  } else if (provider === 's3') {
    client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    bucket = process.env.S3_BUCKET_NAME || 'docuforge-pdfs';
  } else {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.GCS_ENDPOINT || 'https://storage.googleapis.com',
      credentials: {
        accessKeyId: process.env.GOOGLE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.GOOGLE_SECRET_ACCESS_KEY!,
      },
    });
    bucket = process.env.GCS_BUCKET_NAME || 'docuforge-pdfs';
  }

  return {
    uploadFontToS3: async (key: string, body: Buffer, contentType: string) => {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      }));
    },
    deleteFontFromS3: async (key: string) => {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

export async function getUserFonts(userId: string) {
  return db
    .select({
      id: customFonts.id,
      name: customFonts.name,
      family: customFonts.family,
      format: customFonts.format,
      fileSizeBytes: customFonts.fileSizeBytes,
      createdAt: customFonts.createdAt,
    })
    .from(customFonts)
    .where(eq(customFonts.userId, userId));
}

export async function deleteFont(userId: string, id: string): Promise<boolean> {
  const [font] = await db
    .select()
    .from(customFonts)
    .where(and(eq(customFonts.id, id), eq(customFonts.userId, userId)))
    .limit(1);

  if (!font) return false;

  const provider = process.env.STORAGE_PROVIDER || 'local';

  if (provider === 'local') {
    try {
      await unlink(join(process.cwd(), '.storage', 'fonts', userId, `${id}.${font.format}`));
    } catch { /* file may not exist */ }
  } else {
    const { deleteFontFromS3 } = await getS3Uploader();
    await deleteFontFromS3(font.storageKey);
  }

  await db.delete(customFonts).where(eq(customFonts.id, id));
  return true;
}

export async function getFontCssForUser(userId: string): Promise<string> {
  const fonts = await db
    .select()
    .from(customFonts)
    .where(eq(customFonts.userId, userId));

  if (fonts.length === 0) return '';

  const provider = process.env.STORAGE_PROVIDER || 'local';
  const baseUrl =
    provider === 'r2' ? process.env.R2_PUBLIC_URL :
    provider === 's3' ? process.env.S3_PUBLIC_URL :
    provider === 'gcs' ? process.env.GCS_PUBLIC_URL :
    `http://localhost:${process.env.PORT || 3000}/files`;

  const declarations = fonts.map((font) => {
    const cssFormat = FORMAT_TO_CSS[font.format] || font.format;
    const url = provider === 'local'
      ? `http://localhost:${process.env.PORT || 3000}/fonts/${font.userId}/${font.id}.${font.format}`
      : `${baseUrl}/${font.storageKey}`;

    return `@font-face {
  font-family: '${font.family.replace(/'/g, "\\'")}';
  src: url('${url}') format('${cssFormat}');
  font-display: swap;
}`;
  });

  return declarations.join('\n');
}
