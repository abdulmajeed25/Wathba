// @ts-check
/**
 * ESLint flat config for the Wathba API (Nest 11 + TypeScript 5 + ESLint 9).
 * Audit Tier 3.7 — first proper lint setup. Conservative: extends
 * @typescript-eslint/recommended without type-aware rules, runs over src/
 * only. Failing rules can be loosened here as the codebase grows.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // Nest decorators + constructor injection use unused params on purpose.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` in tests + DTO-payload helpers is sometimes the right call.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Many Nest controllers return Promise<Record<…>>; allow it.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Spec files relax strictness — mocks need looser types.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
