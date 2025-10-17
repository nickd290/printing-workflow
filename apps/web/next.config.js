/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@printing-workflow/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
