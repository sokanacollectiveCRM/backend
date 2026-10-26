import { getPool } from '../../../db/cloudSqlPool';
import { AuthRequest } from '../../../types';

export const SENSITIVE_DOCUMENT_TYPES = [
  'w9',
  'direct_deposit_form',
  'background_check',
];
export function isSensitiveDocument(type: string): boolean {
  return SENSITIVE_DOCUMENT_TYPES.includes(type);
}

// Read current grants on every request; never infer this capability from a
// generic admin/billing role or client-editable metadata.
export async function canManageHrDocuments(req: AuthRequest): Promise<boolean> {
  if (
    !['admin', 'hr'].includes(String(req.user?.role)) ||
    !req.tenant?.id ||
    !req.user?.id
  )
    return false;
  const result = await getPool().query(
    `SELECT 1 FROM public.doula_hr_permissions p JOIN public.admins a
     ON a.id::text=p.admin_id AND a.tenant_id=p.tenant_id
     WHERE p.tenant_id=$1::uuid AND p.admin_id=$2 AND p.department IN ('hr','payroll')`,
    [req.tenant.id, req.user.id]
  );
  return !!result.rowCount;
}
export async function findTenantDoula(
  req: AuthRequest,
  doulaId: string
): Promise<boolean> {
  if (!req.tenant?.id) return false;
  const result = await getPool().query(
    'SELECT id FROM public.doulas WHERE id::text=$1 AND tenant_id=$2::uuid',
    [doulaId, req.tenant.id]
  );
  return !!result.rowCount;
}
export async function readBackgroundCheck(doulaId: string, tenantId: string) {
  const { rows } = await getPool().query(
    `SELECT background_check_status AS status, background_check_set_at AS "setAt",
     background_check_set_by AS "setBy" FROM public.doulas WHERE id::text=$1 AND tenant_id=$2::uuid`,
    [doulaId, tenantId]
  );
  return rows[0] ?? { status: 'not_cleared', setAt: null, setBy: null };
}
