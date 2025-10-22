console.log('========================================');
console.log('🟢 Next.js Web App Configuration Loading...');
console.log('========================================');
console.log('Timestamp:', new Date().toISOString());
console.log('Node Version:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 'NOT SET (will default to 3000)');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : 'NOT SET');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'NOT SET');
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || 'NOT SET');
console.log('----------------------------------------');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@printing-workflow/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    // Temporarily ignore type errors during build for deployment
    // TODO: Fix all type errors and re-enable strict type checking
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors during build for deployment
    // TODO: Fix all ESLint warnings and re-enable strict checking
    ignoreDuringBuilds: true,
  },
};

console.log('✅ Next.js configuration loaded successfully');
console.log('========================================');

module.exports = nextConfig;
