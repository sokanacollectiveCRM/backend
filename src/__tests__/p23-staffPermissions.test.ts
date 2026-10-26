import path from 'path';

import { execFileSync } from 'child_process';

it('enforces staff permissions, audit atomicity, last-holder guard and next-request access using real SQL', () => {
  execFileSync(
    process.execPath,
    [path.resolve(__dirname, '../../scripts/verify-p23-permissions.cjs')],
    { stdio: 'pipe' }
  );
}, 60000);
