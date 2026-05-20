import { createMiddleware } from 'hono/factory';

/**
 * Defense-in-depth response headers. The API only returns JSON so most
 * of these are belt-and-braces, but a misconfigured response or future
 * HTML response should still be safe.
 */
export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  // HSTS is only useful over TLS. Setting it on plaintext responses is
  // ignored by spec-compliant browsers, but emit it anyway so prod
  // (which is always TLS) gets the upgrade. Two-year max age, include
  // subdomains, and preload-ready.
  c.header(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
});
