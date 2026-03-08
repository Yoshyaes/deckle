import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

// Mock dns/promises to avoid real DNS lookups (SSRF validation hangs under fake timers)
vi.mock('dns/promises', () => ({
  resolve: vi.fn().mockResolvedValue(['93.184.216.34']), // public IP
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocking
const { deliverWebhook } = await import('../services/webhooks.js');

describe('Webhook delivery', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('delivers successfully on first attempt', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const promise = deliverWebhook('https://example.com/hook', {
      id: 'gen_123',
      status: 'completed',
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['X-DocuForge-Signature']).toBeDefined();
    expect(opts.headers['X-DocuForge-Timestamp']).toBeDefined();
  });

  it('includes valid HMAC-SHA256 signature', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const payload = { id: 'gen_123', status: 'completed' };

    const promise = deliverWebhook('https://example.com/hook', payload);
    await vi.runAllTimersAsync();
    await promise;

    const body = JSON.stringify(payload);
    const secret = process.env.WEBHOOK_SIGNING_SECRET || 'whsec_dev_only';
    const expectedSig = createHmac('sha256', secret).update(body).digest('hex');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-DocuForge-Signature']).toBe(expectedSig);
    expect(opts.body).toBe(body);
  });

  it('retries on failure and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const promise = deliverWebhook('https://example.com/hook', {
      id: 'gen_123',
      status: 'completed',
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on network error and succeeds', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true });

    const promise = deliverWebhook('https://example.com/hook', {
      id: 'gen_123',
      status: 'completed',
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries after 4 total attempts', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const promise = deliverWebhook('https://example.com/hook', {
      id: 'gen_123',
      status: 'completed',
    });
    await vi.runAllTimersAsync();
    await promise;

    // 1 initial + 3 retries = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
