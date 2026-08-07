'use strict';

const noUnsanitized = require('eslint-plugin-no-unsanitized');

// ESLint flat config for the Vikunja browser extension.
//
// Run:  eslint .   (or:  npm run lint)
//
// The extension is plain ES2022 JavaScript (no modules, no build step) that
// runs in Firefox/Chrome extension contexts, so the browser and WebExtension
// globals below are provided manually.

const browserGlobals = {
  console: 'readonly',
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  screen: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  fetch: 'readonly',
  XMLHttpRequest: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  getComputedStyle: 'readonly',
  matchMedia: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  addEventListener: 'readonly',
  removeEventListener: 'readonly',
  dispatchEvent: 'readonly',
  MouseEvent: 'readonly',
  KeyboardEvent: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  WebSocket: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  crypto: 'readonly',
  structuredClone: 'readonly',
  queueMicrotask: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
};

const webextensionGlobals = {
  browser: 'readonly',
  chrome: 'readonly',
  importScripts: 'readonly',
};

const nodeGlobals = {
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  console: 'readonly',
};

const rules = {
  // Possible problems (the eslint recommended set).
  'constructor-super': 'error',
  'for-direction': 'error',
  'getter-return': 'error',
  'no-async-promise-executor': 'error',
  'no-case-declarations': 'error',
  'no-class-assign': 'error',
  'no-compare-neg-zero': 'error',
  'no-cond-assign': 'error',
  'no-const-assign': 'error',
  'no-constant-binary-expression': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-control-regex': 'error',
  'no-debugger': 'error',
  'no-delete-var': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-else-if': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-empty-character-class': 'error',
  'no-empty-pattern': 'error',
  'no-empty-static-block': 'error',
  'no-ex-assign': 'error',
  'no-extra-boolean-cast': 'error',
  'no-fallthrough': 'error',
  'no-func-assign': 'error',
  'no-global-assign': 'error',
  'no-import-assign': 'error',
  'no-invalid-regexp': 'error',
  'no-irregular-whitespace': 'error',
  'no-loss-of-precision': 'error',
  'no-misleading-character-class': 'error',
  'no-new-native-nonconstructor': 'error',
  'no-nonoctal-decimal-escape': 'error',
  'no-obj-calls': 'error',
  'no-octal': 'error',
  'no-promise-executor-return': 'error',
  'no-prototype-builtins': 'error',
  'no-redeclare': 'error',
  'no-regex-spaces': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-setter-return': 'error',
  'no-shadow-restricted-names': 'error',
  'no-sparse-arrays': 'error',
  'no-template-curly-in-string': 'error',
  'no-this-before-super': 'error',
  'no-unassigned-vars': 'error',
  'no-undef': 'error',
  'no-unexpected-multiline': 'error',
  'no-unreachable': 'error',
  'no-unreachable-loop': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unused-labels': 'error',
  'no-unused-private-class-members': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-useless-assignment': 'error',
  'no-useless-backreference': 'error',
  'no-useless-catch': 'error',
  'no-useless-escape': 'error',
  'no-with': 'error',
  'preserve-caught-error': 'error',
  'require-yield': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',

  // Security: mirrors the no-unsanitized rules web-ext lint runs.
  'no-unsanitized/method': 'error',
  'no-unsanitized/property': 'error',

  // Suggestions.
  'eqeqeq': ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',

  // Layout & formatting.
  'array-bracket-spacing': ['error', 'never'],
  'arrow-spacing': ['error', { before: true, after: true }],
  'block-spacing': ['error', 'always'],
  'brace-style': ['error', '1tbs', { allowSingleLine: true }],
  'comma-dangle': ['error', 'always-multiline'],
  'comma-spacing': ['error', { before: false, after: true }],
  'eol-last': ['error', 'always'],
  'indent': ['error', 2, { SwitchCase: 1 }],
  'key-spacing': ['error', { beforeColon: false, afterColon: true }],
  'keyword-spacing': ['error', { before: true, after: true }],
  'no-extra-semi': 'error',
  'no-mixed-spaces-and-tabs': 'error',
  'no-multi-spaces': 'error',
  'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
  'no-trailing-spaces': 'error',
  'object-curly-spacing': ['error', 'always'],
  'padded-blocks': ['error', 'never'],
  'quotes': ['error', 'single', { avoidEscape: true }],
  'semi': ['error', 'always'],
  'semi-spacing': ['error', { before: false, after: true }],
  'space-before-blocks': ['error', 'always'],
  'space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
  'space-in-parens': ['error', 'never'],
  'space-infix-ops': 'error',
  'space-unary-ops': 'error',
};

const pluginConfig = (overrides) => ({
  plugins: { 'no-unsanitized': noUnsanitized },
  ...overrides,
});

// Mirrors the eval-related checks of addons-linter (DANGEROUS_EVAL,
// NO_IMPLIED_EVAL). Scoped to extension files: the smoke tests deliberately
// eval() the sources they exercise.
const extensionRules = {
  ...rules,
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
};

module.exports = [
  pluginConfig({
    files: ['**/*.js'],
    ignores: ['vikunja.xpi'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...browserGlobals, ...webextensionGlobals },
    },
    rules: extensionRules,
  }),
  pluginConfig({
    files: ['smoketests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...nodeGlobals, ...browserGlobals },
    },
    rules: { ...rules, 'no-eval': 'off', 'no-implied-eval': 'off', 'no-new-func': 'off' },
  }),
  pluginConfig({
    files: ['eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: nodeGlobals,
    },
    rules,
  }),
];
