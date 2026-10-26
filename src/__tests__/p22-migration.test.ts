import path from 'path';

import { execFileSync } from 'child_process';

it('migrates idempotently, preserves historical files, persists all new types and invalidates review', () => {
  execFileSync(
    process.execPath,
    [path.resolve(__dirname, '../../scripts/verify-p22-migration.cjs')],
    { stdio: 'pipe' }
  );
}, 60000);
