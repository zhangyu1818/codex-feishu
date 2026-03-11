import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import globals from 'globals';

const maxLinesRule = ['error', { max: 300, skipBlankLines: true, skipComments: true }];
const maxLinesPerFunctionRule = [
  'error',
  { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }
];

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src/generated/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        projectService: true,
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'max-lines': maxLinesRule,
      'max-lines-per-function': maxLinesPerFunctionRule,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off'
    }
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off'
    }
  },
  eslintConfigPrettier
];
