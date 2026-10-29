import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**', 'pnpm-lock.yaml'],
  },
  { files: ['workers/api/**/*.ts'], languageOptions: { globals: { Request: 'readonly', Response: 'readonly', URL: 'readonly', crypto: 'readonly' } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-constant-condition': 'error',
      complexity: ['warn', 14],
      'max-depth': ['warn', 4],
    },
  },
);

