import { join } from 'path';

import { execFileSync } from 'child_process';

it('adds nullable units and the US default idempotently without modifying existing addresses or certifications', () => {
  execFileSync(
    process.execPath,
    [join(__dirname, '../../scripts/verify-doula-address-migration.cjs')],
    { timeout: 30000, stdio: 'pipe' }
  );
}, 35000);
