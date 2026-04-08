/** @type {import('next').NextConfig} */

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    // Prevent clickjacking
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME-type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Only send origin in Referrer header
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Limit browser features accessed by the dashboard
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    // HSTS: require HTTPS for 1 year, include subdomains
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    // CSP: allow resources from self, Clerk, and necessary CDNs.
    // Adjust the API_URL allow-list for your deployment.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js inline scripts require 'unsafe-inline' or nonce — relax for now
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.getdocuforge.dev https://clerk.accounts.dev https://*.clerk.accounts.dev",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  transpilePackages: [],
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
