import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const FORBIDDEN_TAILWIND_CLASS_REGEX =
  /(?<![a-zA-Z0-9_=\[-])(mr|ml|pl|pr|left|right)-(0|0\.5|px|auto|\[[^\]]+\]|[0-9]+(\.5)?)\b/;

const LOGICAL_PROPERTIES_MESSAGE =
  'Tailwind logical properties enforcement (AR22): utiliser me-*/ms-*/pe-*/ps-*/start-*/end-* au lieu de mr-*/ml-*/pl-*/pr-*/left-*/right-* pour preserver RTL (FR/AR).';

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '_bmad/**',
      '_bmad-output/**',
      '.claude/**',
      'design-artifacts/**',
      'docs/**',
      'supabase/functions/**',
      'public/sw.js',
      'public/sw.js.map',
      'public/swe-worker-*.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${FORBIDDEN_TAILWIND_CLASS_REGEX.source}/]`,
          message: LOGICAL_PROPERTIES_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${FORBIDDEN_TAILWIND_CLASS_REGEX.source}/]`,
          message: LOGICAL_PROPERTIES_MESSAGE,
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];

export default eslintConfig;
