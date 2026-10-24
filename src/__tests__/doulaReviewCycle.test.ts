import { getPool } from '../db/cloudSqlPool';
import { deliverProfileReviewEmails } from '../features/doulas/application/profileReviewEmail';
import { transitionDoulaProfile } from '../features/doulas/application/submitDoulaProfile';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../features/doulas/application/profileReviewEmail', () => ({
  deliverProfileReviewEmails: jest.fn().mockResolvedValue(undefined),
}));
const query = jest.fn(),
  release = jest.fn();
let profile: any;
let certificate: boolean;
let rejected: boolean;
beforeEach(() => {
  jest.clearAllMocks();
  certificate = true;
  rejected = false;
  profile = {
    full_name: 'Maya Rivers',
    email: 'maya@example.com',
    phone: '5555550100',
    address: '1 Fictional Way',
    city: 'Chicago',
    state: 'IL',
    zip_code: '60601',
    country: 'US',
    bio: 'Test doula',
    profile_review_status: 'draft',
    profile_review_version: 0,
    profile_submitted_at: null,
  };
  (getPool as jest.Mock).mockReturnValue({
    connect: async () => ({ query, release }),
  });
  query.mockImplementation(async (sql: string, args: any[] = []) => {
    if (sql.includes('FROM public.doulas') && sql.includes('FOR UPDATE'))
      return { rows: [{ ...profile }] };
    if (sql.includes("status='rejected'"))
      return { rowCount: rejected ? 1 : 0, rows: [] };
    if (sql.includes('FROM public.doula_documents'))
      return { rowCount: certificate ? 1 : 0, rows: [] };
    if (sql.includes('FROM public.tenant_settings'))
      return { rows: [{ email: 'admin@example.com' }] };
    if (sql.includes('UPDATE public.doulas')) {
      profile.profile_review_status = args[2];
      profile.profile_review_version = args[4];
      profile.profile_review_reason = args[3];
      if (args[2] === 'submitted')
        profile.profile_submitted_at = new Date().toISOString();
      return { rows: [{ profile_submitted_at: profile.profile_submitted_at }] };
    }
    return { rows: [], rowCount: 1 };
  });
});
const run = (
  action: 'submitted' | 'changes_requested' | 'approved',
  extra: Record<string, unknown> = {}
) =>
  transitionDoulaProfile({
    doulaId: 'doula',
    tenantId: 'tenant',
    actorId: 'actor',
    action,
    ...extra,
  });
it('completes submit, request changes, resubmit, approve and queues both recipients for each event', async () => {
  await run('submitted');
  await run('changes_requested', {
    reason: 'Please correct your bio.',
    expectedVersion: 1,
  });
  expect(profile.profile_review_status).toBe('changes_requested');
  expect(profile.profile_review_reason).toBe('Please correct your bio.');
  await run('submitted');
  expect(profile.profile_review_status).toBe('submitted');
  expect(profile.profile_review_reason).toBeNull();
  await run('approved', { expectedVersion: 3 });
  expect(profile.profile_review_status).toBe('approved');
  expect(
    query.mock.calls
      .filter(([sql]) => sql.includes('UPDATE public.doulas'))
      .every(([sql]) => !sql.includes('account_status='))
  ).toBe(true);
  const emails = query.mock.calls.filter(([sql]) =>
    sql.includes('INSERT INTO public.doula_review_emails')
  );
  expect(emails).toHaveLength(8);
  expect(emails.map(([, args]) => args[1])).toEqual([
    'maya@example.com',
    'admin@example.com',
    'maya@example.com',
    'admin@example.com',
    'maya@example.com',
    'admin@example.com',
    'maya@example.com',
    'admin@example.com',
  ]);
  expect(emails[4][1][2]).toContain('resubmitted');
  expect(emails[6][1][3]).toContain('Dashboard access remains available');
  expect(
    query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO public.doula_profile_reviews')
    )
  ).toHaveLength(4);
});
it('requires a reason and the latest review version', async () => {
  profile.profile_review_status = 'submitted';
  profile.profile_review_version = 1;
  await expect(
    run('changes_requested', { reason: ' ', expectedVersion: 1 })
  ).rejects.toThrow('reason');
  await expect(run('approved', { expectedVersion: 0 })).rejects.toThrow(
    'changed'
  );
  await expect(run('approved')).rejects.toThrow('changed');
  expect(deliverProfileReviewEmails).not.toHaveBeenCalled();
});
it('cannot approve before submission or before certificate approval', async () => {
  await expect(run('approved', { expectedVersion: 0 })).rejects.toThrow(
    'submit'
  );
  profile.profile_review_status = 'submitted';
  certificate = false;
  await expect(run('approved', { expectedVersion: 0 })).rejects.toThrow(
    'training certificate'
  );
});
it('requires complete fields and resolved rejected documents before resubmission', async () => {
  profile.profile_review_status = 'changes_requested';
  profile.bio = '';
  await expect(run('submitted')).rejects.toThrow('bio');
  profile.bio = 'Fixed';
  rejected = true;
  await expect(run('submitted')).rejects.toThrow('rejected');
});
it('does not create duplicate events for repeat submission or approval', async () => {
  await run('submitted');
  await run('submitted');
  await run('approved', { expectedVersion: 1 });
  await run('approved', { expectedVersion: 1 });
  expect(
    query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO public.doula_profile_reviews')
    )
  ).toHaveLength(2);
});
it('commits the review even if delivery is unavailable', async () => {
  (deliverProfileReviewEmails as jest.Mock).mockRejectedValueOnce(
    new Error('SMTP unavailable')
  );
  await run('submitted');
  expect(query).toHaveBeenCalledWith('COMMIT');
  expect(profile.profile_review_status).toBe('submitted');
});
it('does not access another tenant’s profile', async () => {
  query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  await expect(run('submitted')).rejects.toThrow('Profile not found');
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('tenant_id=$2::uuid'),
    ['doula', 'tenant']
  );
});

it.each(['submitted', 'changes_requested', 'approved'] as const)(
  'notifies all organization admins for %s even when an intake mailbox is configured',
  async (action) => {
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, args: any[] = []) => {
      if (sql.includes('FROM public.tenant_settings')) {
        expect(args).toEqual(['tenant']);
        expect(sql).toContain(
          'UNION SELECT lower(trim(email)) AS email FROM public.admins'
        );
        expect(sql).toContain('WHERE tenant_id=$1::uuid');
        expect(sql).not.toContain('NOT EXISTS');
        return {
          rows: [
            { email: 'hello@sokanacollective.com' },
            { email: 'admin-one@example.com' },
            { email: 'admin-two@example.com' },
            { email: ' ADMIN-ONE@example.com ' },
          ],
        };
      }
      return original(sql, args);
    });
    if (action !== 'submitted') profile.profile_review_status = 'submitted';
    await run(action, {
      expectedVersion: 0,
      reason: 'Please update your bio.',
    });
    const emails = query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO public.doula_review_emails')
    );
    expect(emails.map(([, args]) => args[1])).toEqual([
      'maya@example.com',
      'hello@sokanacollective.com',
      'admin-one@example.com',
      'admin-two@example.com',
    ]);
    for (const [, args] of emails.slice(1))
      expect(args[3]).toContain('Review in Teams');
  }
);
