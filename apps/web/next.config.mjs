/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Enable for Docker deployment
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.getdeckle.dev' }],
        destination: 'https://getdeckle.dev/:path*',
        permanent: true,
      },
      {
        source: '/docs',
        destination: 'https://docs.getdeckle.dev',
        permanent: true,
      },
      {
        source: '/docs/:path*',
        destination: 'https://docs.getdeckle.dev/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
