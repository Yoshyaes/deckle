import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dns/promises for controlled DNS resolution
const dnsResolveMock = vi.fn();
vi.mock('dns/promises', () => ({
  resolve: (...args: unknown[]) => dnsResolveMock(...args),
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

const { isPrivateIp, validateWebhookUrl, deliverWebhook } = await import(
  '../services/webhooks.js'
);

describe('isPrivateIp (SSRF allow/deny list)', () => {
  // -- IPv4 private/reserved --
  it.each([
    ['127.0.0.1', true, 'loopback'],
    ['127.255.255.255', true, 'loopback range'],
    ['10.0.0.1', true, 'RFC 1918 /8'],
    ['10.255.255.255', true, 'RFC 1918 /8 top'],
    ['172.16.0.1', true, 'RFC 1918 /12 bottom'],
    ['172.31.255.255', true, 'RFC 1918 /12 top'],
    ['172.32.0.1', false, 'just outside RFC 1918 /12'],
    ['172.15.0.1', false, 'just outside RFC 1918 /12 (bottom)'],
    ['192.168.0.1', true, 'RFC 1918 /16'],
    ['192.169.0.1', false, 'just outside RFC 1918 /16'],
    ['169.254.0.1', true, 'link-local'],
    ['0.0.0.0', true, 'current network 0/8'],
    ['100.64.0.1', true, 'CGNAT bottom'],
    ['100.127.255.255', true, 'CGNAT top'],
    ['100.128.0.1', false, 'just outside CGNAT'],
    ['100.63.255.255', false, 'just below CGNAT'],
    ['8.8.8.8', false, 'public Google DNS'],
    ['1.1.1.1', false, 'public Cloudflare DNS'],
    ['93.184.216.34', false, 'example.com'],
  ])('isPrivateIp(%s) === %s (%s)', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  // -- IPv6 --
  it.each([
    ['::1', true, 'loopback'],
    ['::', true, 'unspecified'],
    ['0:0:0:0:0:0:0:1', true, 'long loopback'],
    ['fe80::1', true, 'link-local'],
    ['fc00::1', true, 'unique local'],
    ['fd00::1', true, 'unique local'],
    ['2001:db8::1', false, 'documentation prefix is not private'],
    ['2606:4700:4700::1111', false, 'Cloudflare public'],
  ])('isPrivateIp(%s) === %s (%s)', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  // -- IPv4-mapped IPv6 --
  it('IPv4-mapped IPv6 loopback (::ffff:127.0.0.1) is private', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('IPv4-mapped IPv6 public (::ffff:8.8.8.8) is NOT private', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('validateWebhookUrl', () => {
  beforeEach(() => {
    dnsResolveMock.mockReset();
  });

  it('accepts HTTPS URL resolving to a public IP', async () => {
    dnsResolveMock.mockResolvedValue(['93.184.216.34']);
    await expect(validateWebhookUrl('https://example.com/hook')).resolves.toBeUndefined();
  });

  it('rejects HTTP (non-TLS) URLs', async () => {
    await expect(validateWebhookUrl('http://example.com/hook')).rejects.toThrow(/HTTPS/);
  });

  it('rejects localhost by hostname even without DNS lookup', async () => {
    await expect(validateWebhookUrl('https://localhost/hook')).rejects.toThrow(/localhost/);
  });

  it('rejects 0.0.0.0 by hostname', async () => {
    await expect(validateWebhookUrl('https://0.0.0.0/hook')).rejects.toThrow(/localhost/);
  });

  it('rejects URL whose DNS resolves to a private IP', async () => {
    dnsResolveMock.mockResolvedValue(['10.0.0.5']);
    await expect(validateWebhookUrl('https://internal.evil/hook')).rejects.toThrow(/private IP/);
  });

  it('rejects when any of multiple resolved IPs is private (mixed answer)', async () => {
    dnsResolveMock.mockResolvedValue(['93.184.216.34', '127.0.0.1']);
    await expect(validateWebhookUrl('https://mixed.evil/hook')).rejects.toThrow(/private IP/);
  });

  it('does not throw when DNS lookup itself fails (lets fetch fail naturally)', async () => {
    dnsResolveMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(validateWebhookUrl('https://nonexistent.example/hook')).resolves.toBeUndefined();
  });
});

describe('deliverWebhook SSRF integration', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    dnsResolveMock.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT call fetch when URL fails SSRF validation', async () => {
    dnsResolveMock.mockResolvedValue(['10.0.0.5']);
    await deliverWebhook('https://internal.evil/hook', { id: 'g1', status: 'completed' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does NOT call fetch for non-HTTPS URLs', async () => {
    await deliverWebhook('http://example.com/hook', { id: 'g1', status: 'completed' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
