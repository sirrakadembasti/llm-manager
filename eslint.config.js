import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  { files: ['src/**/*.js'], rules: { 'require-await': 'error' } },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    ignores: ['node_modules/**', 'data/**', '.env*', 'package-lock.json']
  }
];
