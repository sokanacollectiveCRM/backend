import { CloudSqlTeamService } from './cloudSqlTeamService';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Document rows are stored under public.doulas.id.
 * Session user ids are Firebase UIDs, so self-service calls resolve by email.
 */
export class DoulaDocumentIdResolver {
  constructor(private cloudSqlTeamService: CloudSqlTeamService) {}

  async resolveStorageDoulaId(
    authUserId: string,
    email?: string | null
  ): Promise<string> {
    if (UUID_RE.test(authUserId)) {
      const member =
        await this.cloudSqlTeamService.getTeamMemberById(authUserId);
      if (member?.role === 'doula') return member.id;
    }

    const normalized = email?.trim().toLowerCase();
    if (normalized) {
      const byEmail =
        await this.cloudSqlTeamService.getDoulaByEmail(normalized);
      if (byEmail) return byEmail.id;
    }

    return authUserId;
  }

  async getEffectiveDocumentDoulaId(cloudSqlDoulaId: string): Promise<string> {
    return cloudSqlDoulaId;
  }

  async isDocumentOwnedByDoula(
    cloudSqlDoulaId: string,
    documentDoulaId: string
  ): Promise<boolean> {
    return documentDoulaId === cloudSqlDoulaId;
  }
}
