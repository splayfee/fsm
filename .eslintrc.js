module.exports = {
  root: true,
  env: {
    node: true,
    'es6': true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    '@typescript-eslint/no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'space-before-function-paren': [
      'error',
      'never'
    ],
    '@typescript-eslint/semi': [
      'error',
      'always'
    ],
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/interface-name-prefix': [2, 'always'],
    '@typescript-eslint/indent': [2, 2],
    'indent': 'off',
    'no-trailing-spaces': [2],
    'eol-last': ['error', 'always'],
    'quotes': [2, 'single']
  }
};
