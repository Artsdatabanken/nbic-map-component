// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'playground-dist', 'coverage', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-console': 'off'
    }
  },

  eslintConfigPrettier
];