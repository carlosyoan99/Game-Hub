// ESLint flat config (v9+)
// Reglas pensadas para un proyecto vanilla JS con Canvas 2D.
// Los juegos se ejecutan en navegador, el smoke test en Node con JSDOM.

export default [
  {
    ignores: ['node_modules/**', 'package-lock.json'],
  },
  // ── Reglas base ──
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser APIs usadas por el motor y juegos
        fetch: 'readonly',
        localStorage: 'readonly',
        clearTimeout: 'readonly',
        setTimeout: 'readonly',
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        getComputedStyle: 'readonly',
        confirm: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        OffscreenCanvas: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': 'warn',
      'no-duplicate-imports': 'error',
      'no-extra-semi': 'warn',
      'no-redeclare': 'off',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-global-assign': 'error',
      'no-shadow': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['warn', 'smart'],
      'curly': ['warn', 'multi-line'],
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'comma-dangle': 'off',
      'dot-notation': 'off',
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],
    },
  },
  // ── Reglas para el motor ──
  {
    files: ['src/engine/**/*.js'],
    rules: {
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
  // ── Reglas para juegos ──
  {
    files: ['src/games/**/*.js'],
    rules: {
      'max-lines': ['warn', { max: 1300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'off',
    },
  },
  // ── Reglas para el smoke test ──
  {
    files: ['smoke_test.mjs'],
    languageOptions: {
      globals: {
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        document: 'readonly',
        window: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        URL: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        OffscreenCanvas: 'readonly'
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'max-lines': 'off',
    },
  },
];
