import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/target/**', '**/coverage/**', '**/.idea/**']),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    rules: {
      'no-unused-vars': ['error', { vars: 'all', args: 'none' }]
    }
  },
  {
    files: ['**/*.{ts,vue}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Source ports already use explicit any; formatting does not redesign their types.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { vars: 'all', args: 'none' }]
    }
  },
  {
    files: ['src/**/*.{js,ts,vue}'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['tests/**/*.{js,ts}', '*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['**/*.vue'],
    extends: [vue.configs['flat/recommended']],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] }
    },
    rules: {
      'vue/html-indent': ['error', 2],
      'vue/max-attributes-per-line': ['error', {
        singleline: 10,
        multiline: { max: 1 }
      }],
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      // Keep the existing Source template and route component naming conventions.
      'vue/no-v-html': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/space-before-function-paren': ['error', 'never'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/comma-style': ['error', 'last'],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/object-curly-spacing': ['error', 'always', { objectsInObjects: false }],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/space-unary-ops': ['error', { words: true, nonwords: false }],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/linebreak-style': ['error', 'unix']
    }
  }
])
