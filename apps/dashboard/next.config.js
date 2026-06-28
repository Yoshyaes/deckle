/** @type {import('next').NextConfig} */

// Defense-in-depth response headers for the dashboard. The dashboard
// is a regulated surface (handles API keys + billing), so a strict
// baseline matters even though Next.js's defaults are already
// reasonable.

// CSP is deliberately Report-Only friendly here:
// - script-src needs 'unsafe-inline' because Next.js injects inline
//   hydration scripts without nonces by default. Migrating to nonces
//   requires opting into next.config.js `experimental.serverActions`
//   + a custom server, which is out of scope. We compensate with
//   X-Frame-Options=DENY and X-Content-Type-Options=nosniff.
// - Clerk needs its own connect-src + script-src + img-src.
// - next/font hosts subset font files from fonts.gstatic.com.
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  // Next.js needs unsafe-inline + unsafe-eval for hydration. Clerk loads
  // clerk-js from its frontend-API host: the dev instance uses
  // *.clerk.accounts.dev, the PRODUCTION instance uses our custom domain
  // clerk.getdeckle.dev — both must be allowlisted or the SignIn component
  // silently fails to mount.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.getdeckle.dev https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://challenges.cloudflare.com",
  // Tailwind + Clerk + next/font inject inline <style> tags.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // next/font subsets fonts at build time but Clerk loads from gstatic.
  "font-src 'self' data: https://fonts.gstatic.com",
  // Avatars come from img.clerk.com; *.clerk.com covers other Clerk-served images
  // (e.g. static.clerk.com for UI assets). data: kept for inline icons.
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://clerk.getdeckle.dev https://*.clerk.accounts.dev",
  // The dashboard hits its own /api/*, the public API, and Clerk's FAPI
  // (clerk.getdeckle.dev in production, *.clerk.accounts.dev in dev).
  "connect-src 'self' https://api.getdeckle.dev https://clerk.getdeckle.dev https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://challenges.cloudflare.com",
  // Workers (Clerk uses Web Workers in some flows).
  "worker-src 'self' blob:",
  // Block all <frame>/<iframe> src by default; Stripe billing portal + Clerk need exceptions.
  // accounts.google.com is required for Google OAuth: Clerk's SignIn component opens
  // Google's consent screen in a frame/popup during the social-login flow.
  "frame-src 'self' https://*.stripe.com https://clerk.getdeckle.dev https://*.clerk.accounts.dev https://challenges.cloudflare.com https://accounts.google.com",
];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), camera=(), microphone=(), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
];

const nextConfig = {
  transpilePackages: [],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Allow Clerk's SSO callback pages to be framed during OAuth handshake
        source: '/(sign-in|sign-up)/sso-callback(.*)',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ];
  },
};

module.exports = nextConfig;
