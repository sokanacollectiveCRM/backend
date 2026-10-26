// Backend is the canonical policy. Pass the frontend repository directory.
const fs = require('node:fs');
const path = require('node:path');
const target = process.argv[2];
if (!target) throw new Error('Pass the frontend repository directory.');
const source = path.join(
  __dirname,
  '../src/features/doulas/domain/documentPolicy.ts'
);
const destination = path.join(target, 'src/domain/documentPolicy.ts');
if (process.argv.includes('--check')) {
  if (
    fs.readFileSync(source, 'utf8') !== fs.readFileSync(destination, 'utf8')
  ) {
    throw new Error(
      'Frontend document policy differs from backend. Run sync-document-policy.cjs.'
    );
  }
} else fs.copyFileSync(source, destination);
