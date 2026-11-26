import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Ground rule 1: the frontend does no arithmetic. Numbers stay strings, so
// nothing may turn one into a JavaScript number or compute with it.
const noArithmetic = 'The frontend does no arithmetic: keep numbers as strings (CLAUDE.md rule 1).'

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
    rules: {
      'no-restricted-globals': [
        'error',
        ...['Number', 'parseFloat', 'parseInt', 'Math', 'BigInt'].map((name) => ({
          name,
          message: noArithmetic,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "UnaryExpression[operator='+']", message: noArithmetic },
      ],
    },
  },
])
