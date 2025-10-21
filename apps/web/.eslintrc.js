module.exports = {
  extends: [
    '../../.eslintrc.js',
    'next/core-web-vitals', // Next.js recommended config (already includes react-hooks)
    'plugin:react/recommended',
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  settings: {
    react: {
      version: '19.0', // React 19
    },
  },
  rules: {
    // React 19 specific
    'react/react-in-jsx-scope': 'off', // Not needed in Next.js
    'react/prop-types': 'off', // Using TypeScript
    'react/no-unescaped-entities': 'warn',

    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Next.js patterns
    '@next/next/no-html-link-for-pages': 'off',

    // Console warnings are okay in frontend for debugging
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
};
