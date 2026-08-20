import fs from 'fs';
import path from 'path';

describe('payment-methods mount independence', () => {
  it('mounts /api/payment-methods outside FEATURE_QUICKBOOKS gate', () => {
    const serverSrc = fs.readFileSync(
      path.join(__dirname, '../server.ts'),
      'utf8'
    );

    const qbBlockStart = serverSrc.indexOf('if (FEATURE_QUICKBOOKS)');
    const qbBlockEnd = serverSrc.indexOf(
      '// Card-on-file status is required',
      qbBlockStart
    );
    expect(qbBlockStart).toBeGreaterThan(-1);
    expect(qbBlockEnd).toBeGreaterThan(qbBlockStart);

    const qbBlock = serverSrc.slice(qbBlockStart, qbBlockEnd);
    expect(qbBlock).not.toContain("app.use('/api/payment-methods'");

    const alwaysMounted = serverSrc.slice(qbBlockEnd);
    expect(alwaysMounted).toContain("app.use('/api/payment-methods'");
  });
});
