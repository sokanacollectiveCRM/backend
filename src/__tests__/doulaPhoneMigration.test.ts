import { join } from 'path';

import { execFileSync } from 'child_process';

it('normalizes legacy phone storage idempotently and preserves certifications', () => {
  execFileSync(
    process.execPath,
    [join(__dirname, '../../scripts/verify-doula-phone-migration.cjs')],
    { timeout: 30000, stdio: 'pipe' }
  );
}, 35000);
