# ESLint Setup and Usage

## Overview

ESLint is configured in this project to enforce code quality and consistency. The configuration supports both JavaScript and TypeScript files with Prettier integration for automatic formatting.

## Configuration

### ESLint Configuration File
- **File:** `eslint.config.mjs`
- **Format:** Flat config (ESLint 9.x)
- **Features:**
  - JavaScript and TypeScript support
  - Node.js globals
  - Prettier integration
  - Recommended rules

### Key Features

#### 1. Language Support
- **JavaScript:** `.js`, `.mjs`, `.cjs` files
- **TypeScript:** `.ts`, `.tsx` files (basic support)
- **Node.js:** Built-in globals and environment

#### 2. Code Formatting
- **Prettier Integration:** Automatic code formatting
- **Consistent Style:** Enforced code style across the project
- **Auto-fix:** Many issues can be automatically fixed

#### 3. Code Quality Rules
- **Unused Variables:** Detect unused variables and parameters
- **Unnecessary Escapes:** Flag unnecessary escape characters
- **Empty Blocks:** Detect empty block statements
- **Import/Export:** Validate import and export statements

## Available Scripts

### Basic Linting
```bash
# Check for linting issues
npm run lint

# Fix automatically fixable issues
npm run lint:fix

# Check with zero tolerance for warnings
npm run lint:check
```

### Code Formatting
```bash
# Format all files with Prettier
npm run format

# Check formatting without making changes
npm run format:check
```

## Common Issues and Solutions

### 1. Unused Variables
**Issue:** Variables declared but never used
```javascript
// ❌ Bad
const unusedVar = 'value';

// ✅ Good
const usedVar = 'value';
console.log(usedVar);
```

**Fix:** Remove unused variables or prefix with underscore
```javascript
// ✅ Alternative
const _unusedVar = 'value'; // ESLint will ignore
```

### 2. Unnecessary Escape Characters
**Issue:** Escaping characters that don't need escaping
```javascript
// ❌ Bad
const regex = /\+/; // Unnecessary escape

// ✅ Good
const regex = /\+/; // Or use string
const regex = new RegExp('\\+');
```

### 3. Empty Block Statements
**Issue:** Empty catch blocks or if statements
```javascript
// ❌ Bad
try {
  doSomething();
} catch (error) {
  // Empty block
}

// ✅ Good
try {
  doSomething();
} catch (error) {
  console.error('Error:', error);
}
```

## IDE Integration

### VS Code Setup
1. Install ESLint extension
2. Install Prettier extension
3. Configure auto-fix on save:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Other IDEs
- **WebStorm:** Built-in ESLint support
- **Atom:** Install `linter-eslint` package
- **Sublime Text:** Install `SublimeLinter-eslint` package

## Configuration Details

### Current Rules
```javascript
// Base configuration
{
  languageOptions: {
    globals: {
      ...globals.node, // console, process, Buffer, etc.
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
}

// JavaScript files
{
  files: ['**/*.{js,mjs,cjs}'],
  ...js.configs.recommended,
}

// Prettier integration
prettier,
```

### Ignored Files
- `node_modules/`
- `dist/`
- `coverage/`
- `.git/`

## Best Practices

### 1. Run Linting Regularly
```bash
# Before committing
npm run lint:check

# During development
npm run lint:fix
```

### 2. Fix Issues Promptly
- Address linting errors immediately
- Use `npm run lint:fix` for automatic fixes
- Manually fix issues that can't be auto-fixed

### 3. Maintain Consistency
- Follow the established code style
- Use Prettier for formatting
- Keep ESLint configuration up to date

## Troubleshooting

### Common Problems

#### 1. Configuration Errors
```bash
# Error: Cannot find package 'globals'
npm install --save-dev globals
```

#### 2. TypeScript Issues
```bash
# Install TypeScript ESLint
npm install --save-dev typescript-eslint
```

#### 3. Prettier Conflicts
```bash
# Ensure Prettier and ESLint are compatible
npm install --save-dev eslint-config-prettier
```

### Debugging
```bash
# Check ESLint version
npx eslint --version

# Check configuration
npx eslint --print-config src/index.js

# Debug specific file
npx eslint --debug src/your-file.js
```

## Future Enhancements

### Planned Improvements
1. **Full TypeScript Support:** Complete TypeScript configuration
2. **Custom Rules:** Project-specific linting rules
3. **Import Sorting:** Automatic import organization
4. **Security Rules:** Security-focused linting rules

### Configuration Evolution
- Monitor ESLint updates
- Update rules as needed
- Add project-specific customizations
- Maintain compatibility with team preferences

## Resources

- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [Node.js ESLint](https://github.com/eslint/eslint-plugin-node) 