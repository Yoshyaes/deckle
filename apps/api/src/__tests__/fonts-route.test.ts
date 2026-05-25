import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const uploadFontMock = vi.fn();
const getUserFontsMock = vi.fn();
const deleteFontMock = vi.fn();

vi.mock('../services/fonts.js', () => ({
  uploadFont: (...args: unknown[]) => uploadFontMock(...args),
  getUserFonts: (...args: unknown[]) => getUserFontsMock(...args),
  deleteFont: (...args: unknown[]) => deleteFontMock(...args),
}));

const { default: fontsRoute } = await import('../routes/fonts.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'free' });
    await next();
  });
  app.route('/fonts', fontsRoute);
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('POST /fonts', () => {
  beforeEach(() => {
    uploadFontMock.mockReset();
  });

  it('returns 400 for non-multipart content-type', async () => {
    const res = await createApp().request('/fonts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/multipart/);
  });

  it('returns 400 when "file" is missing from form data', async () => {
    const form = new FormData();
    form.set('family', 'Inter');
    const res = await createApp().request('/fonts', {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when "family" is missing', async () => {
    const form = new FormData();
    form.set('file', new Blob(['x']), 'font.woff2');
    const res = await createApp().request('/fonts', {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('uploads font and returns the service result', async () => {
    uploadFontMock.mockResolvedValue({
      id: 'font_1',
      name: 'font.woff2',
      family: 'Inter',
      format: 'woff2',
    });
    const form = new FormData();
    form.set('file', new Blob(['x']), 'font.woff2');
    form.set('family', 'Inter');
    const res = await createApp().request('/fonts', {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.family).toBe('Inter');
    expect(uploadFontMock).toHaveBeenCalled();
    const args = uploadFontMock.mock.calls[0];
    expect(args[0]).toBe('usr_1');
    expect(Buffer.isBuffer(args[1])).toBe(true);
    expect(args[2]).toBe('font.woff2');
    expect(args[4]).toBe('Inter');
  });
});

describe('GET /fonts', () => {
  beforeEach(() => {
    getUserFontsMock.mockReset();
  });

  it('returns fonts wrapped in { fonts: [...] }', async () => {
    getUserFontsMock.mockResolvedValue([
      { id: 'font_1', name: 'a.woff2', family: 'A', format: 'woff2' },
    ]);
    const res = await createApp().request('/fonts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fonts).toHaveLength(1);
  });

  it('scopes lookup to current user', async () => {
    getUserFontsMock.mockResolvedValue([]);
    await createApp().request('/fonts');
    expect(getUserFontsMock).toHaveBeenCalledWith('usr_1');
  });
});

describe('DELETE /fonts/:id', () => {
  beforeEach(() => {
    deleteFontMock.mockReset();
  });

  it('returns 200 when font is deleted', async () => {
    deleteFontMock.mockResolvedValue(true);
    const res = await createApp().request('/fonts/font_1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  it('returns 404 when font is missing', async () => {
    deleteFontMock.mockResolvedValue(false);
    const res = await createApp().request('/fonts/font_missing', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
