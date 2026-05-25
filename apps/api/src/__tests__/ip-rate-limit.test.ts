import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { extractClientIp } from '../middleware/ipRateLimit.js';

function ctxWithHeaders(headers: Record<string, string>): Context {
  const lookup = new Map<string, string>(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    req: {
      header(name: string) {
        return lookup.get(name.toLowerCase());
      },
    },
  } as unknown as Context;
}

describe('extractClientIp', () => {
  const originalProxyCount = process.env.TRUSTED_PROXY_COUNT;

  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_COUNT;
  });

  afterEach(() => {
    if (originalProxyCount === undefined) {
      delete process.env.TRUSTED_PROXY_COUNT;
    } else {
      process.env.TRUSTED_PROXY_COUNT = originalProxyCount;
    }
  });

  it('prefers x-real-ip over x-forwarded-for', () => {
    const c = ctxWithHeaders({
      'x-real-ip': '203.0.113.5',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('trims whitespace from x-real-ip', () => {
    const c = ctxWithHeaders({ 'x-real-ip': '  203.0.113.5  ' });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('falls back to x-forwarded-for when x-real-ip is absent', () => {
    // With default TRUSTED_PROXY_COUNT=1, peels rightmost hop. Two-entry chain
    // "client, lb" → client is index 0 (length 2 - 1 - 1 = 0)
    const c = ctxWithHeaders({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('rejects spoofed leading entries when only one proxy hop is trusted', () => {
    // Header: "attacker_spoof, real_client, lb"
    // TRUSTED_PROXY_COUNT=1 → index = max(0, 3 - 1 - 1) = 1 → real_client
    const c = ctxWithHeaders({
      'x-forwarded-for': '1.2.3.4, 203.0.113.5, 10.0.0.1',
    });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('respects TRUSTED_PROXY_COUNT for multi-hop chains', () => {
    // Two trusted proxies; header: "client, hop1, hop2"
    // index = max(0, 3 - 2 - 1) = 0 → client
    process.env.TRUSTED_PROXY_COUNT = '2';
    const c = ctxWithHeaders({
      'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2',
    });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('clamps to index 0 when chain is shorter than the trusted proxy count', () => {
    // TRUSTED_PROXY_COUNT=5 but only 2 entries → index Math.max(0, -4) = 0
    process.env.TRUSTED_PROXY_COUNT = '5';
    const c = ctxWithHeaders({
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('trims whitespace from x-forwarded-for entries', () => {
    const c = ctxWithHeaders({
      'x-forwarded-for': '   203.0.113.5  ,  10.0.0.1  ',
    });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });

  it('returns "unknown" when no headers are present', () => {
    const c = ctxWithHeaders({});
    expect(extractClientIp(c)).toBe('unknown');
  });

  it('returns the only entry when x-forwarded-for has one IP', () => {
    // Single-entry header — index = max(0, 1 - 1 - 1) = 0
    const c = ctxWithHeaders({ 'x-forwarded-for': '203.0.113.5' });
    expect(extractClientIp(c)).toBe('203.0.113.5');
  });
});
