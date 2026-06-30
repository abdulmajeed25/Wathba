// @ts-check
/**
 * ESLint flat config for the Wathba web app (Next 15 + React 19 +
 * TypeScript 5 + ESLint 9). Audit Tier 3.7.
 *
 * eslint-config-next is published in the legacy "extends" format; we wrap
 * it in @eslint/compat to make it work with the new flat config.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...fixupConfigRules(compat.extends('next/core-web-vitals')),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
