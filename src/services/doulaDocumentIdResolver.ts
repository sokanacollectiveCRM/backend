import { getSupabaseAdmin } from '../supabase';
import { CloudSqlTeamService } from './cloudSqlTeamService';

/**
 * Resolves ID mismatch between Cloud SQL doula id and Supabase auth user id.
 * Documents in doula_documents are stored with Supabase auth user id (doula_id).
 * Admin UI uses Cloud SQL doula id. For some doulas these IDs differ.
 */
export class DoulaDocumentIdResolver {
  constructor(private cloudSqlTeamService: CloudSqlTeamService) {}

  /**
   * Get Supabase auth user id by email (for fallback lookups).
   */
  async getSupabaseAuthUserIdByEmail(email: string): Promise<string | null> {
    if (!email?.trim()) return null;
    const normalized = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();
    let page = 1;
    const perPage = 500;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.warn('[DoulaDocumentIdResolver] listUsers failed:', error.message);
        return null;
      }
      const users = data?.users ?? [];
      const match = users.find((u) => (u.email ?? '').toLowerCase() === normalized);
      if (match) return match.id;
      if (users.length < perPage) break;
      page += 1;
    }
    return null;
  }

  /**
   * Returns the id to use for doula_documents lookups.
   * Tries Cloud SQL doula id first; if no documents, falls back to Supabase auth user id by email.
   */
  async getEffectiveDocumentDoulaId(cloudSqlDoulaId: string): Promise<string> {
    const member = await this.cloudSqlTeamService.getTeamMemberById(cloudSqlDoulaId);
    if (!member || member.role !== 'doula' || !member.email) {
      return cloudSqlDoulaId;
    }
    const authUserId = await this.getSupabaseAuthUserIdByEmail(member.email);
    return authUserId ?? cloudSqlDoulaId;
  }

  /**
   * Check if a document (with Supabase doula_id) belongs to the given Cloud SQL doula.
   */
  async isDocumentOwnedByDoula(
    cloudSqlDoulaId: string,
    documentDoulaId: string
  ): Promise<boolean> {
    if (documentDoulaId === cloudSqlDoulaId) return true;
    const authUserId = await this.getEffectiveDocumentDoulaId(cloudSqlDoulaId);
    return documentDoulaId === authUserId;
  }
}
