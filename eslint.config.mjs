// eslint.config.mjs – works with ESLint 9+
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';

export default [
  /* ─── files & globs ESLint must ignore ─────────────────────────── */
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'scripts/**',
    ]
  },

  /* ---------- every other JS/JSON file ---------- */
  eslint.configs.recommended,

  /* ---------- TypeScript (syntax + type-aware) ---------- */
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        // Timer globals
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        sessionStorage: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        // Web API globals
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        // Event globals
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        DragEvent: 'readonly',
        ClipboardEvent: 'readonly',
        // DOM globals
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDivElement: 'readonly',
        Element: 'readonly',
        NodeList: 'readonly',
        // React (for JSX)
        React: 'readonly',
        // Build-time constants
        __COMMIT_SHA__: 'readonly',
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      sonarjs,
      'import-x': importPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs.recommendedTypeChecked.rules,
      ...sonarjs.configs.recommended.rules,

      // Use TypeScript's noUnused* diagnostics instead of duplicating in ESLint
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Disallow trailing whitespace
      'no-trailing-spaces': ['error', {
        skipBlankLines: false,
        ignoreComments: false
      }],

      // ─── Complexity rules ───
      'complexity': ['warn', { max: 15 }],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-alphabetical-sort': 'off',
      'sonarjs/no-nested-template-literals': 'error',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/no-inverted-boolean-check': 'error',

      // ─── Stricter TypeScript rules ───
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // ─── Import rules ───
      'import-x/no-duplicates': 'error',
      'import-x/order': ['warn', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always'
      }],
      'import-x/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import-x/max-dependencies': ['warn', { max: 15 }],

      // ─── Consistent type imports ───
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      }],

      // ─── Type safety rules (warnings for gradual adoption) ───
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // ─── Complexity and readability rules ───
      'no-nested-ternary': 'error',
      'max-params': ['warn', { max: 10 }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // ─── Ban wildcard re-exports ───
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Use named re-exports instead of "export * from"'
        }
      ],
    },
  },

  /* ---------- Ban re-exports outside index.ts ---------- */
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['**/index.ts', '**/index.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportNamedDeclaration[source]',
          message: 'Re-exports only allowed in index.ts files'
        },
        {
          selector: 'ExportAllDeclaration',
          message: 'Use named re-exports instead of "export * from"'
        }
      ]
    }
  },

  /* ---------- Components: max-lines limit ---------- */
  {
    files: ['src/components/**/*.ts', 'src/components/**/*.tsx'],
    rules: {
      'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }]
    }
  },

  /* ---------- React & Hooks rules ---------- */
  {
    files: ['**/*.tsx'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',  // Not needed in React 17+
      'react/prop-types': 'off',          // Using TypeScript
    }
  },

  /* ---------- Filename conventions: React components (PascalCase) ---------- */
  {
    files: ['src/components/**/*.tsx'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': ['error', {
        case: 'pascalCase',
        ignore: ['^index\\.tsx?$'],
      }],
    }
  },

  /* ---------- Test files: relax type safety rules ---------- */
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
    }
  }
];
