module.exports = {
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Allow console in backend
    'no-console': 'off',

    // Fastify-specific patterns
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false, // Fastify handlers are async but return void
      },
    ],

    // Backend often needs looser rules for dynamic data
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
