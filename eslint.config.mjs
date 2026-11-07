import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

// Stylistic detects compressed statements but does not fix them. Split only
// sibling statements; keep guards, for headers and const declarations intact.
const statementNewline = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: { newline: 'Write each statement on its own line.' }
  },
  create(context) {
    function check(node) {
      const statements = node.body ?? node.consequent
      for (let index = 1; index < statements.length; index++) {
        const previous = statements[index - 1]
        const current = statements[index]
        if (previous.loc.end.line === current.loc.start.line) {
          context.report({
            node: current,
            messageId: 'newline',
            fix: fixer => fixer.insertTextBefore(current, '\n')
          })
        }
      }
    }

    return {
      Program: check,
      BlockStatement: check,
      SwitchCase: check,
      TSModuleBlock: check,
      IfStatement(node) {
        if (!node.alternate || node.consequent.type === 'BlockStatement') return
        const elseToken = context.sourceCode.getTokenBefore(node.alternate)
        if (elseToken.value !== 'else' || node.consequent.loc.end.line !== elseToken.loc.start.line) return
        context.report({
          node: node.alternate,
          messageId: 'newline',
          fix: fixer => fixer.insertTextBefore(elseToken, '\n')
        })
      }
    }
  }
}

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/target/**', '**/coverage/**', '**/.local/**', '**/.idea/**']),
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
    files: ['src/**/*.{js,ts,vue}', 'scripts/acceptance/b1b2/b2-suite.js'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['tests/**/*.{js,ts}', 'scripts/*.mjs', '*.{js,mjs,cjs,ts}'],
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
      // JetBrains aligns wrapped attributes and interpolations as in bomExplosion.
      'vue/html-indent': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/max-attributes-per-line': 'off',
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
    plugins: { '@stylistic': stylistic, mes: { rules: { 'statement-newline': statementNewline }}},
    rules: {
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
      '@stylistic/semi': ['error', 'never'],
      // The reference allows trailing commas on wrapped lists, without requiring them.
      '@stylistic/comma-dangle': ['error', 'only-multiline'],
      '@stylistic/space-before-function-paren': ['error', {
        named: 'never', anonymous: 'never', asyncArrow: 'never', catch: 'always'
      }],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/max-statements-per-line': ['error', { max: 1 }],
      'mes/statement-newline': 'error',
      '@stylistic/padding-line-between-statements': ['error',
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' }
      ],
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
