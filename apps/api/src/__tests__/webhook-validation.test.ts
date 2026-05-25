import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DNS resolver so we can simulate any address response.
const mockResolve = vi.fn();
vi.mock('dns/promises', () => ({
  resolve: (host: string) => mockResolve(host),
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

const { isPrivateIp, validateWebhookUrl } = await import('../services/webhooks.js');

describe('isPrivateIp (SSRF guard)', () => {
  it.each([
    ['127.0.0.1', true],   // loopback
    ['127.255.255.254', true],
    ['10.0.0.1', true],    // RFC 1918
    ['10.255.255.255', true],
    ['172.16.0.1', true],  // RFC 1918 (boundary)
    ['172.31.255.255', true],
    ['172.15.0.1', false], // just outside RFC 1918
    ['172.32.0.1', false], // just outside RFC 1918
    ['192.168.1.1', true], // RFC 1918
    ['192.169.0.1', false],
    ['169.254.169.254', true], // AWS metadata endpoint!
    ['169.255.0.1', false],
    ['0.0.0.0', true],
    ['100.64.0.1', true],  // CGNAT
    ['100.127.255.255', true],
    ['100.128.0.1', false], // outside CGNAT
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['93.184.216.34', false], // example.com
  ])('isPrivateIp(%s) === %s', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it('detects IPv6 loopback', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('0:0:0:0:0:0:0:1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
  });

  it('detects IPv6 unique-local (fc00::/7)', () => {
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
  });

  it('detects IPv6 link-local (fe80::/10)', () => {
    expect(isPrivateIp('fe80::1')).toBe(true);
  });

  it('treats IPv4-mapped IPv6 (::ffff:x.x.x.x) the same as IPv4', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('accepts public IPv6', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
  });
});

describe('validateWebhookUrl', () => {
  beforeEach(() => {
    mockResolve.mockReset();
  });

  it('rejects non-HTTPS URLs', async () => {
    await expect(
      validateWebhookUrl('http://example.com/hook'),
    ).rejects.toThrow(/HTTPS/);
  });

  it('rejects ftp:// URLs', async () => {
    await expect(
      validateWebhookUrl('ftp://example.com/hook'),
    ).rejects.toThrow(/HTTPS/);
  });

  it('rejects file:// URLs', async () => {
    await expect(
      validateWebhookUrl('file:///etc/passwd'),
    ).rejects.toThrow(/HTTPS/);
  });

  it('rejects localhost hostname', async () => {
    await expect(
      validateWebhookUrl('https://localhost/hook'),
    ).rejects.toThrow(/localhost/);
  });

  it('rejects 0.0.0.0 hostname', async () => {
    await expect(
      validateWebhookUrl('https://0.0.0.0/hook'),
    ).rejects.toThrow(/localhost/);
  });

  it('rejects URLs whose hostname resolves to a private IP (SSRF)', async () => {
    mockResolve.mockResolvedValueOnce(['10.0.0.5']);
    await expect(
      validateWebhookUrl('https://attacker-controlled.example/hook'),
    ).rejects.toThrow(/private IP/);
  });

  it('rejects URLs that resolve to the AWS metadata endpoint', async () => {
    mockResolve.mockResolvedValueOnce(['169.254.169.254']);
    await expect(
      validateWebhookUrl('https://aws-meta.evil/hook'),
    ).rejects.toThrow(/private IP/);
  });

  it('rejects URLs where ANY address in the DNS response is private', async () => {
    // dual-A-record poison: public addr first, private second
    mockResolve.mockResolvedValueOnce(['8.8.8.8', '127.0.0.1']);
    await expect(
      validateWebhookUrl('https://mixed.example/hook'),
    ).rejects.toThrow(/private IP/);
  });

  it('accepts URLs that resolve to public IPs', async () => {
    mockResolve.mockResolvedValueOnce(['93.184.216.34']);
    await expect(
      validateWebhookUrl('https://example.com/hook'),
    ).resolves.toBeUndefined();
  });

  it('does not throw when DNS resolution fails (lets fetch fail naturally)', async () => {
    mockResolve.mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(
      validateWebhookUrl('https://this-host-does-not-exist.example/hook'),
    ).resolves.toBeUndefined();
  });

  it('throws on invalid URL syntax', async () => {
    await expect(validateWebhookUrl('not a url')).rejects.toThrow();
  });
});
