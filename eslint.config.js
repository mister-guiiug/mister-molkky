import baseConfig from '@mister-guiiug/dev-wpa-config/eslint-react';

export default [
  ...baseConfig,
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
