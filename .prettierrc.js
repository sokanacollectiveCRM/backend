module.exports = {
  trailingComma: 'es5',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  printWidth: 80,
  proseWrap: 'always',
  plugins: [require.resolve('@trivago/prettier-plugin-sort-imports')],
  importOrder: [
    '^(node:)?([a-z][a-z\\/]*){1,}$', // Node.js built-in modules
    '<THIRD_PARTY_MODULES>',
    '^(config|controllers|middleware|routes)/(.*)$',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
