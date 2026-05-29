import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['creature-sim/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'prefer-const': 'warn',
      'no-var': 'warn',
      eqeqeq: ['warn', 'smart'],
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    ignores: ['node_modules/', '**/*.min.js']
  },
  {
    files: ['creature-sim/src/debug-console.js'],
    rules: {
      'no-console': 'off'
    }
  },
  // Turn off all formatting rules that conflict with Prettier
  eslintConfigPrettier
];
