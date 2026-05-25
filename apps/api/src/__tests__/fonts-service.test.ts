import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Module-level mocks
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockS3Send = vi.fn().mockResolvedValue({});
const mockS3Constructor = vi.fn();
const mockPutCmd = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);

class MockS3Client {
  send = mockS3Send;
  constructor(opts: unknown) {
    mockS3Constructor(opts);
  }
}

class MockPutObjectCommand {
  constructor(args: unknown) {
    mockPutCmd(args);
  }
}

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: MockPutObjectCommand,
  DeleteObjectCommand: class { constructor(_args: unknown) {} },
}));

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

vi.mock('../schema/db.js', () => ({
  customFonts: {
    id: 'id', userId: 'userId', name: 'name', family: 'family',
    format: 'format', storageKey: 'storageKey', fileSizeBytes: 'fileSizeBytes',
    createdAt: 'createdAt',
  },
}));

vi.mock('../lib/id.js', () => ({
  fontId: vi.fn(() => 'font_test123'),
}));

const { uploadFont, getFontCssForUser, getUserFonts, deleteFont } =
  await import('../services/fonts.js');

describe('uploadFont', () => {
  const originalProvider = process.env.STORAGE_PROVIDER;

  beforeEach(() => {
    mockInsert.mockReset();
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    delete process.env.STORAGE_PROVIDER;
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = originalProvider;
  });

  function arrangeInsert(returned: Record<string, unknown> = {
    id: 'font_test123',
    name: 'arial.woff2',
    family: 'Arial',
    format: 'woff2',
  }) {
    mockInsert.mockReturnValueOnce({
      values: () => ({ returning: () => Promise.resolve([returned]) }),
    });
  }

  it('rejects files larger than 5MB', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(
      uploadFont('usr_1', big, 'big.woff2', 'font/woff2', 'Arial'),
    ).rejects.toThrow(/5MB/);
  });

  it('rejects unknown formats (mime not in map, extension not allowed)', async () => {
    const buf = Buffer.from('x');
    await expect(
      uploadFont('usr_1', buf, 'font.xyz', 'application/x-unknown', 'Arial'),
    ).rejects.toThrow(/Unsupported font format/);
  });

  it.each(['woff2', 'ttf', 'otf'])('accepts %s by extension', async (ext) => {
    arrangeInsert({ id: 'font_x', name: `f.${ext}`, family: 'X', format: ext });
    const result = await uploadFont('usr_1', Buffer.from('x'), `f.${ext}`, 'application/octet-stream', 'X');
    expect(result.format).toBe(ext);
  });

  it('uses local filesystem when STORAGE_PROVIDER unset', async () => {
    arrangeInsert();
    await uploadFont('usr_1', Buffer.from('x'), 'arial.woff2', 'font/woff2', 'Arial');
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('font_test123.woff2'),
      expect.any(Buffer),
    );
  });

  it('uses S3 when STORAGE_PROVIDER is r2', async () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'sec';

    arrangeInsert();
    await uploadFont('usr_1', Buffer.from('x'), 'arial.woff2', 'font/woff2', 'Arial');
    expect(mockS3Send).toHaveBeenCalled();
    expect(mockPutCmd).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'fonts/usr_1/font_test123.woff2',
        CacheControl: 'public, max-age=31536000',
      }),
    );
  });
});

describe('getUserFonts', () => {
  beforeEach(() => mockSelect.mockReset());

  it('returns the supplied row shape', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([
          { id: 'f1', name: 'a.woff2', family: 'A', format: 'woff2', fileSizeBytes: 100, createdAt: new Date() },
        ]),
      }),
    });

    const fonts = await getUserFonts('usr_1');
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({
      id: 'f1', name: 'a.woff2', family: 'A', format: 'woff2',
    });
  });
});

describe('deleteFont', () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockDelete.mockReset();
    mockUnlink.mockClear();
  });

  it('returns false when font does not exist', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    expect(await deleteFont('usr_1', 'missing')).toBe(false);
  });

  it('removes local file + DB row when font is found', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{
            id: 'f1', userId: 'usr_1', format: 'woff2', storageKey: 'fonts/usr_1/f1.woff2',
          }]),
        }),
      }),
    });
    mockDelete.mockReturnValueOnce({
      where: () => Promise.resolve(),
    });

    expect(await deleteFont('usr_1', 'f1')).toBe(true);
    expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('f1.woff2'));
  });
});

describe('getFontCssForUser', () => {
  beforeEach(() => mockSelect.mockReset());

  it('returns empty string when user has no fonts', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) }),
    });
    expect(await getFontCssForUser('usr_new')).toBe('');
  });

  it('generates @font-face declarations for each font (local provider)', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([
          { id: 'f1', userId: 'usr_1', family: 'Inter', format: 'woff2', storageKey: 'fonts/usr_1/f1.woff2' },
          { id: 'f2', userId: 'usr_1', family: 'Roboto', format: 'ttf', storageKey: 'fonts/usr_1/f2.ttf' },
        ]),
      }),
    });

    const css = await getFontCssForUser('usr_1');
    expect(css).toContain("font-family: 'Inter'");
    expect(css).toContain("format('woff2')");
    expect(css).toContain("font-family: 'Roboto'");
    expect(css).toContain("format('truetype')");
    expect(css).toContain('font-display: swap');
  });

  it("escapes single quotes in the font family name", async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([
          { id: 'f1', userId: 'usr_1', family: "Sneaky' Font", format: 'woff2', storageKey: 'k' },
        ]),
      }),
    });

    const css = await getFontCssForUser('usr_1');
    // Family with quote must be escaped — should never see a bare quote inside the value
    expect(css).toContain("Sneaky\\' Font");
  });
});
