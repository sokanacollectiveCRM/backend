import { join } from 'path';

import { execFileSync } from 'child_process';

it('migrates PostgreSQL JSONB idempotently while preserving years and existing expiry values', () => {
  // Run PostgreSQL WASM in a normal Node process, outside Jest's VM loader.
  execFileSync(
    process.execPath,
    [
      join(
        __dirname,
        '../../scripts/verify-certification-expiration-migration.cjs'
      ),
    ],
    { timeout: 30000, stdio: 'pipe' }
  );
}, 35000);
