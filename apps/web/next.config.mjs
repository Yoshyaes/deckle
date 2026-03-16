/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Enable for Docker deployment
  async rewrites() {
    return [
      {
        source: '/docs',
        destination: 'https://fred-7da601c6.mintlify.app',
      },
      {
        source: '/docs/:path*',
        destination: 'https://fred-7da601c6.mintlify.app/:path*',
      },
    ];
  },
};

export default nextConfig;
