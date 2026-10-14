import { getPool } from '../db/cloudSqlPool';
import {
  familyAutoInviteEnabled,
  maybeAutoInviteFamily,
} from '../features/portal/application/maybeAutoInviteFamily';
import type { PortalEligibilitySnapshot } from '../features/portal/domain/eligibility';
import { PortalInviteService } from '../services/portalInviteService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/portalInviteService', () => ({
  PortalInviteService: jest.fn(),
}));
const eligible = {
  is_eligible: true,
  contract_signed: true,
  deposit_paid: true,
} as PortalEligibilitySnapshot;
describe('family automatic invite', () => {
  const query = jest.fn();
  const invite = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FAMILY_AUTO_INVITE_ENABLED = 'true';
    (getPool as jest.Mock).mockReturnValue({ query });
    (PortalInviteService as jest.Mock).mockImplementation(() => ({
      inviteClientToPortal: invite,
    }));
    query.mockReset();
    invite.mockReset();
  });
  afterEach(() => {
    delete process.env.FAMILY_AUTO_INVITE_ENABLED;
  });
  it.each([
    { ...eligible, contract_signed: false },
    { ...eligible, deposit_paid: false },
    { ...eligible, is_eligible: false },
  ])('does not send when a requirement is missing', async (snapshot) => {
    await maybeAutoInviteFamily('fictional', snapshot);
    expect(query).not.toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
  });
  it('claims once across concurrent ticks and repeats', async () => {
    let claimed = false;
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT')) {
        if (claimed) return { rows: [] };
        claimed = true;
        return { rows: [{ tenant_id: 'tenant' }] };
      }
      return { rows: [] };
    });
    await Promise.all([
      maybeAutoInviteFamily('fictional', eligible),
      maybeAutoInviteFamily('fictional', eligible),
    ]);
    await maybeAutoInviteFamily('fictional', eligible);
    expect(invite).toHaveBeenCalledTimes(1);
    expect(invite).toHaveBeenCalledWith('fictional', 'system:auto');
  });
  it('does not send when the persisted status is already invited', async () => {
    query.mockResolvedValue({ rows: [] });
    await maybeAutoInviteFamily('fictional', eligible);
    expect(invite).not.toHaveBeenCalled();
  });
  it('does not fail eligibility processing on delivery failure', async () => {
    query.mockResolvedValue({ rows: [{ tenant_id: 'tenant' }] });
    invite.mockRejectedValue(new Error('SMTP unavailable'));
    await expect(
      maybeAutoInviteFamily('fictional', eligible)
    ).resolves.toBeUndefined();
  });
  it('defaults on only for the exact dev service and database and honors kill switch', () => {
    expect(
      familyAutoInviteEnabled({
        K_SERVICE: 'sokana-private-api-dev',
        CLOUD_SQL_DATABASE: 'sokana_private_dev',
      })
    ).toBe(true);
    expect(familyAutoInviteEnabled({ K_SERVICE: 'sokana-private-api' })).toBe(
      false
    );
    expect(
      familyAutoInviteEnabled({
        K_SERVICE: 'sokana-private-api-dev',
        CLOUD_SQL_DATABASE: 'sokana_private_dev',
        FAMILY_AUTO_INVITE_ENABLED: 'false',
      })
    ).toBe(false);
  });
});
