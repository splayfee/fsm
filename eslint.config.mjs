// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        sourceType: 'module',
        ecmaVersion: 2022,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  { ignores: ['coverage/*', 'dist/*', 'docs/*', 'eslint.config.mjs', 'vitest.config.ts'] },
  {
    rules: {
      'max-len': [
        'error',
        {
          code: 2000,
          ignoreComments: true
        }
      ],

      'arrow-body-style': ['error', 'always'],
      'arrow-parens': ['error', 'always'],
      camelcase: 'off',
      'comma-dangle': ['error', 'never'],
      'eol-last': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'no-multi-spaces': 'error',
      'no-console': 'off',
      'no-debugger': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-trailing-spaces': ['error'],
      'no-use-before-define': 'error',
      'no-unused-expressions': 'off',
      'no-underscore-dangle': 'off',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      eqeqeq: 'off',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-use-before-define': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase']
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase']
        },
        {
          selector: 'enum',
          format: ['PascalCase']
        },
        {
          selector: 'enumMember',
          format: ['PascalCase', 'camelCase', 'UPPER_CASE']
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow'
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'forbid'
        },
        {
          selector: 'property',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'require',
          modifiers: ['private']
        },
        {
          selector: 'property',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'require',
          modifiers: ['protected']
        },
        {
          selector: 'property',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          modifiers: ['public']
        },
        {
          selector: 'memberLike',
          format: ['camelCase'],
          leadingUnderscore: 'require',
          modifiers: ['private']
        },
        {
          selector: 'memberLike',
          format: ['camelCase'],
          leadingUnderscore: 'require',
          modifiers: ['protected']
        },
        {
          selector: 'typeLike',
          format: ['PascalCase']
        },
        {
          selector: 'function',
          format: ['camelCase'],
          leadingUnderscore: 'allow'
        }
      ],

      '@typescript-eslint/no-namespace': [
        'error',
        {
          allowDeclarations: true,
          allowDefinitionFiles: true
        }
      ]
    }
  }
);
