/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Enable for Docker deployment
  async redirects() {
    return [
      {
        source: '/docs',
        destination: 'https://docs.getdocuforge.dev',
        permanent: true,
      },
      {
        source: '/docs/:path*',
        destination: 'https://docs.getdocuforge.dev/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
