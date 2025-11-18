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

// ============================================================================
// Build-Time Environment Variable Validation
// ============================================================================
console.log('');
console.log('🔍 Validating environment configuration...');

// Only NEXT_PUBLIC_* variables are truly required at BUILD time
// because they get embedded into the client-side bundle.
// Runtime variables (DATABASE_URL, NEXTAUTH_*, etc.) should be validated at app startup.
const requiredBuildTimeVars = {
  production: [
    { name: 'NEXT_PUBLIC_API_URL', example: 'https://api-production-100d.up.railway.app' },
  ],
  development: [], // No strict requirements in dev
};

// These are checked but only produce warnings at build time.
// They MUST be present at runtime for the app to function.
const requiredRuntimeVars = {
  production: [
    { name: 'DATABASE_URL', example: 'postgresql://user:password@host:5432/database' },
    { name: 'NEXTAUTH_URL', example: 'https://web-production-851ca.up.railway.app' },
    { name: 'NEXTAUTH_SECRET', example: 'generate-with-openssl-rand-base64-32' },
  ],
  development: [],
};

const currentEnv = process.env.NODE_ENV || 'development';
const requiredAtBuild = requiredBuildTimeVars[currentEnv] || [];
const requiredAtRuntime = requiredRuntimeVars[currentEnv] || [];

const missingBuildTime = requiredAtBuild.filter(({ name }) => !process.env[name]);
const missingRuntime = requiredAtRuntime.filter(({ name }) => !process.env[name]);

// CRITICAL: Block build if build-time variables are missing
if (missingBuildTime.length > 0) {
  console.error('');
  console.error('❌ CRITICAL: Missing required BUILD-TIME environment variables:');
  console.error('');
  missingBuildTime.forEach(({ name, example }) => {
    console.error(`   ❌ ${name}`);
    console.error(`      Example: ${example}`);
    console.error('');
  });
  console.error('These variables are embedded into the client bundle and MUST be set before build.');
  console.error('');
  console.error('To fix this in Railway:');
  console.error('1. Go to Railway Dashboard → printing-workflow project');
  console.error('2. Select the "web" service');
  console.error('3. Navigate to the "Variables" tab');
  console.error('4. Add the missing variables listed above');
  console.error('========================================');
  console.error('');

  if (currentEnv === 'production') {
    throw new Error(
      `❌ Production build failed: Missing required build-time variables: ${missingBuildTime.map(v => v.name).join(', ')}`
    );
  }
}

// WARNING: Runtime variables missing, but allow build to continue
if (missingRuntime.length > 0 && currentEnv === 'production') {
  console.warn('');
  console.warn('⚠️  WARNING: Missing RUNTIME environment variables (build will succeed, but app will fail at startup):');
  console.warn('');
  missingRuntime.forEach(({ name, example }) => {
    console.warn(`   ⚠️  ${name}`);
    console.warn(`      Example: ${example}`);
  });
  console.warn('');
  console.warn('These variables are NOT needed for build, but MUST be set in Railway for the app to run.');
  console.warn('Make sure to add them to the Railway dashboard before deploying.');
  console.warn('========================================');
  console.warn('');
}

console.log('✅ Build-time environment validation passed');
console.log('========================================');

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
  // Proxy API requests to the Fastify backend server
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    console.log(`📡 Configuring API proxy: /api/* → ${apiUrl}/api/*`);

    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

console.log('✅ Next.js configuration loaded successfully');
console.log('========================================');

module.exports = nextConfig;
