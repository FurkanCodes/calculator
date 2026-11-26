import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Ground rule 1. Numbers stay strings, so app code may not turn one into a
// JavaScript number or compute with it.
const noArithmetic = 'The frontend does no arithmetic: keep numbers as strings (CLAUDE.md rule 1).'
const numberGlobals = ['Number', 'parseFloat', 'parseInt', 'Math', 'BigInt']
// Binary + also joins strings, so it is left out.
const arithmeticOperators = ['-', '*', '/', '%', '**']

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...numberGlobals.map((name) => ({ name, message: noArithmetic })),
      ],
      'no-restricted-syntax': [
        'error',
        ...[
          "UnaryExpression[operator='+']",
          'UpdateExpression',
          ...arithmeticOperators.map((op) => `BinaryExpression[operator='${op}']`),
          ...arithmeticOperators.map((op) => `AssignmentExpression[operator='${op}=']`),
          // globalThis.Number, window.Math and the like.
          `MemberExpression[property.name=/^(${numberGlobals.join('|')})$/]`,
        ].map((selector) => ({ selector, message: noArithmetic })),
      ],
    },
  },
])
