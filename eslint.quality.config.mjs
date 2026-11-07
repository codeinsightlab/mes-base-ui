import stylistic from '@stylistic/eslint-plugin'
import config from './eslint.config.mjs'

// Keep full-repository correctness checks while legacy formatting is adopted
// when a file changes. Changed files still use the complete primary config.
export default [
  ...config,
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    rules: {
      ...Object.fromEntries(Object.keys(stylistic.rules).map(name => [`@stylistic/${name}`, 'off'])),
      'mes/statement-newline': 'off'
    }
  }
]
