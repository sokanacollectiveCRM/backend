import globals from 'globals';

import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
  // Base configuration for all files
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  // JavaScript files
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
  },
  // Prettier integration
  prettier,
];
