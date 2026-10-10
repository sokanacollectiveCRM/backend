import { getPool } from '../../../db/cloudSqlPool';
import { IntakeFormDefinition } from '../domain/validateIntakeFormDefinition';

export interface IntakeDraftRow {
  tenantId: string;
  definition: IntakeFormDefinition;
  baseVersion: number | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface IntakeVersionRow {
  version: number;
  definition: IntakeFormDefinition;
  publishedBy: string | null;
  publishedAt: string;
}

export interface IntakeTenantRow {
  id: string;
  slug: string;
  name: string;
  intakeEnabled: boolean;
  publishedVersion: number | null;
}

export interface IntakeAssetRow {
  id: string;
  tenantId: string;
  objectPath: string;
  contentType: string;
}

type DraftSql = {
  tenant_id: string;
  definition: IntakeFormDefinition;
  base_version: number | null;
  updated_by: string | null;
  updated_at: Date;
};

function mapDraft(row: DraftSql): IntakeDraftRow {
  return {
    tenantId: row.tenant_id,
    definition: row.definition,
    baseVersion: row.base_version,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findIntakeTenantById(
  tenantId: string
): Promise<IntakeTenantRow | null> {
  const { rows } = await getPool().query<{
    id: string;
    slug: string;
    name: string;
    intake_enabled: boolean | null;
    published_intake_form_version: number | null;
  }>(
    `SELECT t.id, t.slug, t.name, s.intake_enabled, t.published_intake_form_version
     FROM public.tenants t
     JOIN public.tenant_settings s ON s.tenant_id = t.id
     WHERE t.id = $1 AND t.status = 'active'
     LIMIT 1`,
    [tenantId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    intakeEnabled: row.intake_enabled !== false,
    publishedVersion: row.published_intake_form_version,
  };
}

export async function listActiveIntakeTenants(): Promise<
  Array<{ id: string; slug: string; name: string }>
> {
  const { rows } = await getPool().query<{
    id: string;
    slug: string;
    name: string;
  }>(
    `SELECT id, slug, name
     FROM public.tenants
     WHERE status = 'active'
     ORDER BY name ASC`
  );
  return rows;
}

export async function getIntakeDraft(
  tenantId: string
): Promise<IntakeDraftRow | null> {
  const { rows } = await getPool().query<DraftSql>(
    `SELECT tenant_id, definition, base_version, updated_by, updated_at
     FROM public.intake_form_drafts
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0] ? mapDraft(rows[0]) : null;
}

export async function insertIntakeDraft(
  tenantId: string,
  definition: IntakeFormDefinition,
  updatedBy: string | null
): Promise<IntakeDraftRow> {
  const { rows } = await getPool().query<DraftSql>(
    `INSERT INTO public.intake_form_drafts
       (tenant_id, definition, base_version, updated_by)
     VALUES ($1, $2::jsonb, NULL, $3)
     ON CONFLICT (tenant_id) DO UPDATE
       SET tenant_id = public.intake_form_drafts.tenant_id
     RETURNING tenant_id, definition, base_version, updated_by, updated_at`,
    [tenantId, JSON.stringify(definition), updatedBy]
  );
  return mapDraft(rows[0]);
}

export async function saveIntakeDraft(
  tenantId: string,
  definition: IntakeFormDefinition,
  updatedBy: string
): Promise<IntakeDraftRow> {
  const { rows } = await getPool().query<DraftSql>(
    `UPDATE public.intake_form_drafts
     SET definition = $2::jsonb, updated_by = $3, updated_at = now()
     WHERE tenant_id = $1
     RETURNING tenant_id, definition, base_version, updated_by, updated_at`,
    [tenantId, JSON.stringify(definition), updatedBy]
  );
  if (!rows[0]) {
    throw new Error('Intake draft was not found.');
  }
  return mapDraft(rows[0]);
}

export async function replaceIntakeDraft(
  tenantId: string,
  definition: IntakeFormDefinition,
  baseVersion: number | null,
  updatedBy: string
): Promise<IntakeDraftRow> {
  const { rows } = await getPool().query<DraftSql>(
    `UPDATE public.intake_form_drafts
     SET definition = $2::jsonb,
         base_version = $3,
         updated_by = $4,
         updated_at = now()
     WHERE tenant_id = $1
     RETURNING tenant_id, definition, base_version, updated_by, updated_at`,
    [tenantId, JSON.stringify(definition), baseVersion, updatedBy]
  );
  if (!rows[0]) throw new Error('Intake draft was not found.');
  return mapDraft(rows[0]);
}

export async function listIntakeVersions(
  tenantId: string
): Promise<Array<Omit<IntakeVersionRow, 'definition'>>> {
  const { rows } = await getPool().query<{
    version: number;
    published_by: string | null;
    published_at: Date;
  }>(
    `SELECT version, published_by, published_at
     FROM public.intake_form_versions
     WHERE tenant_id = $1
     ORDER BY version DESC`,
    [tenantId]
  );
  return rows.map((row) => ({
    version: row.version,
    publishedBy: row.published_by,
    publishedAt: row.published_at.toISOString(),
  }));
}

export async function getIntakeVersion(
  tenantId: string,
  version: number
): Promise<IntakeVersionRow | null> {
  const { rows } = await getPool().query<{
    version: number;
    definition: IntakeFormDefinition;
    published_by: string | null;
    published_at: Date;
  }>(
    `SELECT version, definition, published_by, published_at
     FROM public.intake_form_versions
     WHERE tenant_id = $1 AND version = $2`,
    [tenantId, version]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    version: row.version,
    definition: row.definition,
    publishedBy: row.published_by,
    publishedAt: row.published_at.toISOString(),
  };
}

export async function publishIntakeDraft(
  tenantId: string,
  definition: IntakeFormDefinition,
  publishedBy: string
): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT id FROM public.tenants WHERE id = $1 FOR UPDATE`,
      [tenantId]
    );
    const next = await client.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS version
       FROM public.intake_form_versions
       WHERE tenant_id = $1`,
      [tenantId]
    );
    const version = next.rows[0]?.version ?? 1;
    await client.query(
      `INSERT INTO public.intake_form_versions
         (tenant_id, version, definition, published_by)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [tenantId, version, JSON.stringify(definition), publishedBy]
    );
    await client.query(
      `UPDATE public.tenants
       SET published_intake_form_version = $2, updated_at = now()
       WHERE id = $1`,
      [tenantId, version]
    );
    await client.query(
      `UPDATE public.intake_form_drafts
       SET definition = $2::jsonb,
           base_version = $3,
           updated_by = $4,
           updated_at = now()
       WHERE tenant_id = $1`,
      [tenantId, JSON.stringify(definition), version, publishedBy]
    );
    await client.query('COMMIT');
    return version;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function insertIntakeAudit(input: {
  tenantId: string;
  actorId: string;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO public.intake_form_audit_events
       (tenant_id, actor_id, action, detail)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      input.tenantId,
      input.actorId,
      input.action,
      JSON.stringify(input.detail ?? {}),
    ]
  );
}

export async function insertIntakeAsset(input: {
  tenantId: string;
  objectPath: string;
  contentType: string;
  byteSize: number;
  createdBy: string;
}): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO public.intake_form_assets
       (tenant_id, object_path, content_type, byte_size, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.tenantId,
      input.objectPath,
      input.contentType,
      input.byteSize,
      input.createdBy,
    ]
  );
  return rows[0].id;
}

export async function assertIntakeAnswerImages(
  tenantId: string,
  assetIds: string[]
): Promise<void> {
  const unique = [...new Set(assetIds)];
  if (unique.length === 0) return;
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT id
     FROM public.intake_form_assets
     WHERE tenant_id = $1
       AND id = ANY($2::uuid[])
       AND object_path LIKE 'intake-answers/%'`,
    [tenantId, unique]
  );
  if (rows.length !== unique.length) {
    throw new Error('INTAKE_IMAGE_NOT_FOUND');
  }
}

export async function getIntakeAsset(
  tenantId: string,
  assetId: string
): Promise<IntakeAssetRow | null> {
  const { rows } = await getPool().query<{
    id: string;
    tenant_id: string;
    object_path: string;
    content_type: string;
  }>(
    `SELECT id, tenant_id, object_path, content_type
     FROM public.intake_form_assets
     WHERE id = $1 AND tenant_id = $2`,
    [assetId, tenantId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    objectPath: row.object_path,
    contentType: row.content_type,
  };
}

export async function lockedCustomTypesForTenant(
  tenantId: string
): Promise<Map<string, string>> {
  const { rows } = await getPool().query<{
    version: number | null;
    key: string;
  }>(
    `SELECT c.intake_form_version AS version, keys.key
     FROM public.phi_clients c
     CROSS JOIN LATERAL jsonb_object_keys(c.custom_answers) AS keys(key)
     WHERE c.tenant_id = $1
       AND c.custom_answers IS NOT NULL
       AND c.custom_answers <> '{}'::jsonb`,
    [tenantId]
  );
  if (rows.length === 0) return new Map();

  const versions = await getPool().query<{
    version: number;
    definition: IntakeFormDefinition;
  }>(
    `SELECT version, definition
     FROM public.intake_form_versions
     WHERE tenant_id = $1`,
    [tenantId]
  );
  const draft = await getIntakeDraft(tenantId);
  const byVersion = new Map(
    versions.rows.map((row) => [row.version, row.definition])
  );
  const typesByKey = new Map<string, Set<string>>();
  for (const row of rows) {
    const definition =
      row.version != null ? byVersion.get(row.version) : draft?.definition;
    const type = customTypeOnDefinition(definition, row.key);
    if (!type) continue;
    const set = typesByKey.get(row.key) ?? new Set<string>();
    set.add(type);
    typesByKey.set(row.key, set);
  }
  const locked = new Map<string, string>();
  for (const [key, types] of typesByKey) {
    locked.set(key, types.size === 1 ? [...types][0] : '__locked__');
  }
  return locked;
}

function customTypeOnDefinition(
  definition: IntakeFormDefinition | undefined,
  key: string
): string | null {
  if (!definition) return null;
  for (const step of definition.steps ?? []) {
    for (const question of step.questions ?? []) {
      if (question.kind === 'custom' && question.key === key)
        return question.type;
    }
  }
  return null;
}

export async function findPublishedIntakeBySlug(slug: string): Promise<{
  tenantId: string;
  version: number;
  definition: IntakeFormDefinition;
} | null> {
  const { rows } = await getPool().query<{
    tenant_id: string;
    version: number;
    definition: IntakeFormDefinition;
  }>(
    `SELECT v.tenant_id, v.version, v.definition
     FROM public.tenants t
     JOIN public.intake_form_versions v
       ON v.tenant_id = t.id
      AND v.version = t.published_intake_form_version
     WHERE lower(t.slug) = lower($1)
       AND t.status = 'active'
     LIMIT 1`,
    [slug]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    version: row.version,
    definition: row.definition,
  };
}
