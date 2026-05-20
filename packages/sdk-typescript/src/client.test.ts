import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocuForge, AuthenticationError, RateLimitError, DocuForgeError } from './index.js';

// Replace global fetch with a per-test stub. Real network is never
// touched.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const successResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => data,
});

const errorResponse = (status: number, body: unknown, retryAfter?: string) => ({
  ok: false,
  status,
  headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
  json: async () => body,
});

describe('DocuForge SDK', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('constructor', () => {
    it('refuses an empty API key', () => {
      expect(() => new DocuForge('')).toThrow(/required/i);
    });

    it('trims trailing slashes from custom baseUrl', () => {
      const client = new DocuForge('df_live_test', {
        baseUrl: 'https://api.example.com/',
        maxRetries: 0,
      });
      fetchMock.mockResolvedValueOnce(successResponse({ generation_count: 1 }));
      // We can't read `baseUrl` directly; fire a request and inspect
      // the URL fetch was called with.
      return client.getUsage().then(() => {
        const url = fetchMock.mock.calls[0][0];
        expect(url).toBe('https://api.example.com/v1/usage');
      });
    });
  });

  describe('request shape', () => {
    it('sends Bearer auth + JSON Content-Type on POST', async () => {
      fetchMock.mockResolvedValueOnce(
        successResponse({ id: 'gen_1', status: 'completed', url: 'https://x', pages: 1, file_size: 1, generation_time_ms: 1 }),
      );
      const client = new DocuForge('df_live_secret_key', { maxRetries: 0 });
      await client.generate({ html: '<h1>x</h1>' });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe('Bearer df_live_secret_key');
      expect(opts.headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(opts.body as string);
      expect(body.html).toBe('<h1>x</h1>');
    });

    it('encodes the path correctly for generation lookup', async () => {
      fetchMock.mockResolvedValueOnce(successResponse({ id: 'gen_42', status: 'completed' }));
      const client = new DocuForge('df_live_x', { maxRetries: 0 });
      await client.getGeneration('gen_42');
      expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/generations\/gen_42$/);
    });
  });

  describe('error handling', () => {
    it('throws AuthenticationError on 401', async () => {
      fetchMock.mockResolvedValueOnce(
        errorResponse(401, { error: { code: 'UNAUTHORIZED', message: 'no good' } }),
      );
      const client = new DocuForge('df_live_x', { maxRetries: 0 });
      await expect(client.getUsage()).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('throws RateLimitError on 429 and surfaces Retry-After', async () => {
      fetchMock.mockResolvedValueOnce(
        errorResponse(429, { error: { code: 'RATE_LIMITED', message: 'slow down' } }, '7'),
      );
      const client = new DocuForge('df_live_x', { maxRetries: 0 });
      try {
        await client.getUsage();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError);
        expect((err as RateLimitError).retryAfter).toBe(7);
      }
    });

    it('throws DocuForgeError on a non-retryable 4xx', async () => {
      fetchMock.mockResolvedValueOnce(
        errorResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'bad input' } }),
      );
      const client = new DocuForge('df_live_x', { maxRetries: 0 });
      await expect(client.generate({ html: '' })).rejects.toBeInstanceOf(DocuForgeError);
    });
  });

  describe('new namespace methods exist', () => {
    // Quick smoke that the sprint-14 additions are reachable and
    // produce the right URL/method. We don't assert on the response
    // shape — that's what the API tests cover.
    it.each([
      ['pdf.merge', '/v1/pdf/merge', 'POST'],
      ['pdf.split', '/v1/pdf/split', 'POST'],
      ['pdf.info', '/v1/pdf/info', 'POST'],
      ['marketplace.list', '/v1/marketplace', 'GET'],
      ['starterTemplates.list', '/v1/starter-templates', 'GET'],
    ])('%s -> %s %s', async (path, expectedUrl, expectedMethod) => {
      fetchMock.mockResolvedValueOnce(successResponse({ data: [] }));
      const client = new DocuForge('df_live_x', { maxRetries: 0 });
      // Tiny dispatcher so we can call methods by name.
      const dispatch: Record<string, () => Promise<unknown>> = {
        'pdf.merge': () => client.pdf.merge({ pdfs: ['a', 'b'] }),
        'pdf.split': () => client.pdf.split({ pdf: 'a' }),
        'pdf.info': () => client.pdf.info({ pdf: 'a' }),
        'marketplace.list': () => client.marketplace.list(),
        'starterTemplates.list': () => client.starterTemplates.list(),
      };
      await dispatch[path]();
      const [url, opts] = fetchMock.mock.calls[0];
      expect(String(url)).toContain(expectedUrl);
      expect(opts.method).toBe(expectedMethod);
    });
  });
});
