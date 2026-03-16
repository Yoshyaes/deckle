import { createHmac } from 'crypto';
import { resolve as dnsResolve } from 'dns/promises';
import { logger } from '../lib/logger.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff
const WEBHOOK_TIMEOUT_MS = 10_000;

interface WebhookPayload {
  id: string;
  status: string;
  url?: string;
  pages?: number;
  file_size?: number;
  generation_time_ms?: number;
  error?: string;
}

/**
 * Check if an IP address is in a private/reserved range (SSRF protection).
 */
function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
  if (/^::ffff:/i.test(ip)) {
    return isPrivateIp(ip.replace(/^::ffff:/i, ''));
  }

  // IPv4 private/reserved ranges
  if (/^127\./.test(ip)) return true;             // loopback
  if (/^10\./.test(ip)) return true;              // RFC 1918
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true; // RFC 1918
  if (/^192\.168\./.test(ip)) return true;        // RFC 1918
  if (/^169\.254\./.test(ip)) return true;        // link-local
  if (/^0\./.test(ip)) return true;               // current network
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true; // CGNAT (RFC 6598)
  if (ip === '::1' || ip === '::' || ip === '0:0:0:0:0:0:0:1') return true; // IPv6 loopback
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true; // IPv6 private
  if (/^fe80:/i.test(ip)) return true;            // IPv6 link-local
  return false;
}

/**
 * Validate that a webhook URL does not point to a private/internal address.
 */
async function validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  // Block common internal hostnames
  if (['localhost', '0.0.0.0'].includes(hostname)) {
    throw new Error('Webhook URL cannot target localhost');
  }

  // Resolve DNS and check the IP
  try {
    const addresses = await dnsResolve(hostname);
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        throw new Error('Webhook URL resolves to a private IP address');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('private IP')) throw err;
    // DNS resolution failure — let the fetch fail naturally
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

async function attemptDelivery(
  url: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DocuForge-Signature': signature,
        'X-DocuForge-Timestamp': Date.now().toString(),
      },
      body: payload,
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delivers a webhook with up to 3 retries and exponential backoff.
 * Signs the payload with HMAC-SHA256 using the WEBHOOK_SIGNING_SECRET env var.
 * Validates URL against SSRF. Runs fire-and-forget — logs errors but never throws.
 */
export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
): Promise<void> {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('WEBHOOK_SIGNING_SECRET is not set — skipping webhook delivery in production');
      return;
    }
    logger.warn('WEBHOOK_SIGNING_SECRET is not set — using insecure dev default');
  }

  // SSRF protection: validate URL does not target internal resources
  try {
    await validateWebhookUrl(url);
  } catch (err) {
    logger.error({ err, url }, 'Webhook URL rejected (SSRF protection)');
    return;
  }

  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret || 'whsec_dev_only');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ok = await attemptDelivery(url, body, signature);
      if (ok) return;
      logger.warn({ attempt: attempt + 1, url }, 'Webhook delivery got non-2xx');
    } catch (err) {
      logger.warn({ attempt: attempt + 1, url, err }, 'Webhook delivery attempt failed');
    }

    if (attempt < MAX_RETRIES) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  logger.error({ url }, 'Webhook delivery exhausted all retries');
}
