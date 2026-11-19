import { getPool } from '../../../db/cloudSqlPool';
import { ValidationError } from '../../../domains/errors';
import { readTenantRequestState } from '../../tenancy/application/tenantRequestStore';

/** Remove only the selected tenant's invitation or staff account. */
export async function removeTeamMember(id: string): Promise<boolean> {
  const { tenantId } = readTenantRequestState();
  if (!tenantId)
    throw new ValidationError('A tenant is required to remove a team member.');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const invitation = await client.query(
      `SELECT id FROM public.staff_invitations
       WHERE id = $1::uuid AND tenant_id = $2::uuid AND status = 'pending'
       FOR UPDATE`,
      [id, tenantId]
    );
    if (invitation.rowCount) {
      await client.query(
        'DELETE FROM public.staff_invitation_events WHERE invitation_id = $1::uuid AND tenant_id = $2::uuid',
        [id, tenantId]
      );
      await client.query(
        'DELETE FROM public.staff_invitations WHERE id = $1::uuid AND tenant_id = $2::uuid',
        [id, tenantId]
      );
      await client.query('COMMIT');
      return true;
    }

    let role: 'doula' | 'admin' = 'doula';
    let member = await client.query(
      'SELECT id, email, identity_platform_uid FROM public.doulas WHERE id = $1::uuid AND tenant_id = $2::uuid FOR UPDATE',
      [id, tenantId]
    );
    if (!member.rowCount) {
      role = 'admin';
      member = await client.query(
        'SELECT id, email, identity_platform_uid FROM public.admins WHERE id = $1::uuid AND tenant_id = $2::uuid FOR UPDATE',
        [id, tenantId]
      );
    }
    if (!member.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    const account = member.rows[0];
    // The Firebase login is global; removing organization access must preserve it.
    await client.query(
      `DELETE FROM public.${role === 'doula' ? 'doulas' : 'admins'} WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [id, tenantId]
    );
    await client.query(
      'DELETE FROM public.memberships WHERE principal_id = $1::uuid AND tenant_id = $2::uuid AND principal_type = $3',
      [id, tenantId, role]
    );
    await client.query(
      `DELETE FROM public.staff_invitation_events WHERE tenant_id = $1::uuid AND invitation_id IN
       (SELECT id FROM public.staff_invitations WHERE tenant_id = $1::uuid AND lower(email) = lower($2) AND role = $3)`,
      [tenantId, account.email, role]
    );
    await client.query(
      'DELETE FROM public.staff_invitations WHERE tenant_id = $1::uuid AND lower(email) = lower($2) AND role = $3',
      [tenantId, account.email, role]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
