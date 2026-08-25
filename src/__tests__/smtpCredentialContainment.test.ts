import fs from 'fs';
import path from 'path';

import { resolveSmtpConfigFromEnv } from '../scripts/sendTestEmail';

const HARDCODED_SMTP_SECRET_PATTERN =
  /(?:EMAIL_PASSWORD|SMTP_PASS|PASS|pass|password)\s*[=:]\s*['"][^'"\s]{8,}['"]/i;

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '__tests__'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, files);
    } else if (/\.(ts|js)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('INV-11 SMTP credential containment', () => {
  const originalEmailPassword = process.env.EMAIL_PASSWORD;

  afterEach(() => {
    if (originalEmailPassword === undefined) {
      delete process.env.EMAIL_PASSWORD;
    } else {
      process.env.EMAIL_PASSWORD = originalEmailPassword;
    }
  });

  it('sendTestEmail reads SMTP password from EMAIL_PASSWORD only', () => {
    const scriptSrc = fs.readFileSync(
      path.join(__dirname, '../scripts/sendTestEmail.ts'),
      'utf8'
    );
    expect(scriptSrc).toContain('process.env.EMAIL_PASSWORD');
    expect(scriptSrc).not.toMatch(/const\s+PASS\s*=\s*['"][^'"]+['"]/);
    expect(scriptSrc).not.toMatch(/Hardcoded SMTP settings/i);
  });

  it('NodemailerService reads SMTP password from EMAIL_PASSWORD only', () => {
    const serviceSrc = fs.readFileSync(
      path.join(__dirname, '../services/emailService.ts'),
      'utf8'
    );
    expect(serviceSrc).toContain('process.env.EMAIL_PASSWORD');
    expect(serviceSrc).not.toMatch(HARDCODED_SMTP_SECRET_PATTERN);
  });

  it('has no hardcoded SMTP credential literals under src/', () => {
    const srcRoot = path.join(__dirname, '..');
    const offenders = walkSourceFiles(srcRoot).filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      if (file.endsWith('sendTestEmail.ts')) {
        return HARDCODED_SMTP_SECRET_PATTERN.test(
          content.replace(/process\.env\.EMAIL_PASSWORD/g, '')
        );
      }
      return HARDCODED_SMTP_SECRET_PATTERN.test(content);
    });
    expect(offenders).toEqual([]);
  });

  it('resolveSmtpConfigFromEnv fails closed when EMAIL_PASSWORD is missing', () => {
    delete process.env.EMAIL_PASSWORD;
    expect(() => resolveSmtpConfigFromEnv()).toThrow(/EMAIL_PASSWORD/i);
  });
});
