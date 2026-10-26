import path from 'path';

import { execFileSync } from 'child_process';

it('preserves organization-specific documents and platform identity through removal, return and another organization', () => {
  execFileSync(
    process.execPath,
    [
      path.resolve(
        __dirname,
        '../../scripts/verify-organization-memberships.cjs'
      ),
    ],
    { stdio: 'pipe' }
  );
}, 60000);
