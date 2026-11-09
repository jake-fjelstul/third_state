import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output, native copies of the bundle, Vite's dep cache and the Deno
  // edge functions are not app source.
  globalIgnores(['dist', 'admin', 'ios', 'android', '.vite', 'node_modules', 'supabase/functions/**/*.ts']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Errors are reserved for real bugs (rules-of-hooks, undefined names).
      // Dead code and React Compiler advice are warnings to clean up over time.
      // `motion` is only used as <motion.div>, which this rule can't see.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^([A-Z_]|motion$)', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
