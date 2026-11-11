// Adapted from Lombard eslint.config.js (11 November 2026)
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'shots/', 'node_modules/', 'public/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', '*.config.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The sim and its data tables are pure logic: no three, no DOM, no Math.random, no Date.now.
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'The sim must not import three.' },
            {
              group: ['**/render/**', '**/ui/**', '**/audio/**', '**/persist/**'],
              message: 'The sim must stay pure.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'The sim runs on its own fixed time step.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'performance'],
    },
  },
)
