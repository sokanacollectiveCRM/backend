import { randomUUID } from 'crypto';

import { ValidationError } from '../../../domains/errors';
import {
  downloadObject,
  getSignedReadUrl,
  objectPath,
  uploadObject,
} from '../../../services/gcs/documentStorage';
import { RequestFormData } from '../../../types';
import { resolveIntakeEditorTenant } from '../domain/intakeEditorAccess';
import {
  INTAKE_IMAGE_MAX_BYTES,
  STANDARD_INTAKE_FIELDS,
  StandardFieldDefinition,
} from '../domain/intakeFormCatalog';
import { normalizePublishedIntakeSubmission } from '../domain/normalizePublishedSubmission';
import {
  IntakeFormDefinition,
  buildStandardIntakeTemplate,
  validateIntakeFormDefinition,
  withStandardShowWhen,
} from '../domain/validateIntakeFormDefinition';
import { getIntakeAbuseStore } from '../infrastructure/intakeAbuseProtection';
import {
  assertIntakeAnswerImages,
  findIntakeTenantById,
  getIntakeAsset,
  getIntakeDraft,
  getIntakeVersion,
  insertIntakeAsset,
  insertIntakeAudit,
  insertIntakeDraft,
  listActiveIntakeTenants,
  listIntakeVersions,
  lockedCustomTypesForTenant,
  publishIntakeDraft,
  replaceIntakeDraft,
  saveIntakeDraft,
} from '../infrastructure/intakeFormRepository';

export const TEST_SUBMIT_PERSON_LIMIT = 5;
export const TEST_SUBMIT_PERSON_WINDOW_MS = 60 * 60 * 1000;
export const TEST_SUBMIT_ORG_LIMIT = 20;
export const TEST_SUBMIT_ORG_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ANSWER_IMAGE_TYPES = LOGO_TYPES;

export class IntakeEditorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface IntakeEditorActor {
  userId: string;
  email?: string | null;
  sessionRole: string | null;
  sessionTenantId: string | null;
  platformSupport: boolean;
  requestedTenantId: string | null;
}

export function intakeFieldCatalog(): Array<{
  key: string;
  storageType: StandardFieldDefinition['storageType'];
  defaultLabel: string;
  identity: StandardFieldDefinition['identity'] | null;
  options: string[] | null;
}> {
  return STANDARD_INTAKE_FIELDS.map((field) => ({
    key: field.key,
    storageType: field.storageType,
    defaultLabel: field.defaultLabel,
    identity: field.identity ?? null,
    options: field.options ? [...field.options] : null,
  }));
}

export async function listIntakeOrganizationsForSupport(): Promise<
  Array<{ id: string; slug: string; name: string }>
> {
  return listActiveIntakeTenants();
}

async function requireTenant(actor: IntakeEditorActor): Promise<{
  tenantId: string;
  platformSupport: boolean;
}> {
  const decision = resolveIntakeEditorTenant({
    sessionRole: actor.sessionRole,
    platformSupport: actor.platformSupport,
    sessionTenantId: actor.sessionTenantId,
    requestedTenantId: actor.requestedTenantId,
  });
  if (decision.ok === false) {
    throw new IntakeEditorError(decision.error, decision.status);
  }
  const tenant = await findIntakeTenantById(decision.tenantId);
  if (!tenant) {
    throw new IntakeEditorError('Organization not found.', 404);
  }
  return { tenantId: tenant.id, platformSupport: decision.platformSupport };
}

async function ensureDraft(tenantId: string, actorId: string) {
  const existing = await getIntakeDraft(tenantId);
  if (existing) return existing;
  return insertIntakeDraft(tenantId, buildStandardIntakeTemplate(), actorId);
}

async function logoUrlFor(
  tenantId: string,
  assetId: string | null
): Promise<string | null> {
  if (!assetId) return null;
  const asset = await getIntakeAsset(tenantId, assetId);
  if (!asset) return null;
  try {
    return await getSignedReadUrl(asset.objectPath, 15 * 60);
  } catch {
    return null;
  }
}

function definitionsDiffer(
  draft: IntakeFormDefinition,
  live: IntakeFormDefinition | null
): boolean {
  const baseline = live ?? buildStandardIntakeTemplate();
  return JSON.stringify(draft) !== JSON.stringify(baseline);
}

export async function getIntakeEditorState(actor: IntakeEditorActor) {
  const { tenantId, platformSupport } = await requireTenant(actor);
  const tenant = await findIntakeTenantById(tenantId);
  if (!tenant) throw new IntakeEditorError('Organization not found.', 404);
  const draft = await ensureDraft(tenantId, actor.userId);
  const live = tenant.publishedVersion
    ? await getIntakeVersion(tenantId, tenant.publishedVersion)
    : null;
  const locks = await lockedCustomTypesForTenant(tenantId);
  return {
    platformSupport,
    needsTenant: false,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      intakeEnabled: tenant.intakeEnabled,
    },
    draft: withStandardShowWhen(draft.definition),
    baseVersion: draft.baseVersion,
    liveVersion: tenant.publishedVersion,
    draftDiffersFromLive: definitionsDiffer(
      draft.definition,
      live?.definition ?? null
    ),
    updatedAt: draft.updatedAt,
    logoUrl: await logoUrlFor(tenantId, draft.definition.logoAssetId),
    liveLogoUrl: await logoUrlFor(
      tenantId,
      live?.definition.logoAssetId ?? null
    ),
    lockedCustomKeys: [...locks.keys()],
    catalog: intakeFieldCatalog(),
  };
}

export async function saveIntakeEditorDraft(
  actor: IntakeEditorActor,
  definitionInput: unknown
) {
  const { tenantId } = await requireTenant(actor);
  await ensureDraft(tenantId, actor.userId);
  const current = await getIntakeDraft(tenantId);
  const locks = await lockedCustomTypesForTenant(tenantId);
  const validated = validateIntakeFormDefinition(definitionInput, {
    lockedCustomTypes: locks,
  });
  if (validated.ok === false) throw new IntakeEditorError(validated.error, 400);
  const next = validated.definition;
  next.logoAssetId = current?.definition.logoAssetId ?? null;
  if (next.logoAssetId) {
    const asset = await getIntakeAsset(tenantId, next.logoAssetId);
    if (!asset) next.logoAssetId = null;
  }
  await saveIntakeDraft(tenantId, next, actor.userId);
  return getIntakeEditorState(actor);
}

export async function publishIntakeEditorDraft(actor: IntakeEditorActor) {
  const { tenantId } = await requireTenant(actor);
  const draft = await ensureDraft(tenantId, actor.userId);
  const locks = await lockedCustomTypesForTenant(tenantId);
  const validated = validateIntakeFormDefinition(draft.definition, {
    lockedCustomTypes: locks,
  });
  if (validated.ok === false) throw new IntakeEditorError(validated.error, 400);
  const version = await publishIntakeDraft(
    tenantId,
    validated.definition,
    actor.userId
  );
  const state = await getIntakeEditorState(actor);
  return { ...state, publishedVersion: version };
}

export async function listIntakeEditorVersions(actor: IntakeEditorActor) {
  const { tenantId } = await requireTenant(actor);
  const versions = await listIntakeVersions(tenantId);
  return { versions };
}

export async function getIntakeEditorVersion(
  actor: IntakeEditorActor,
  version: number
) {
  const { tenantId } = await requireTenant(actor);
  const row = await getIntakeVersion(tenantId, version);
  if (!row) throw new IntakeEditorError('That version was not found.', 404);
  return {
    version: row.version,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    definition: row.definition,
    logoUrl: await logoUrlFor(tenantId, row.definition.logoAssetId),
  };
}

export async function restoreIntakeEditorVersion(
  actor: IntakeEditorActor,
  version: number
) {
  const { tenantId } = await requireTenant(actor);
  const row = await getIntakeVersion(tenantId, version);
  if (!row) throw new IntakeEditorError('That version was not found.', 404);
  await ensureDraft(tenantId, actor.userId);
  await replaceIntakeDraft(tenantId, row.definition, row.version, actor.userId);
  return getIntakeEditorState(actor);
}

export async function discardIntakeEditorDraft(
  actor: IntakeEditorActor,
  confirm: unknown
) {
  if (confirm !== true) {
    throw new IntakeEditorError(
      'Confirm that you want to discard unpublished edits.',
      400
    );
  }
  const { tenantId } = await requireTenant(actor);
  const tenant = await findIntakeTenantById(tenantId);
  if (!tenant) throw new IntakeEditorError('Organization not found.', 404);
  await ensureDraft(tenantId, actor.userId);
  const live = tenant.publishedVersion
    ? await getIntakeVersion(tenantId, tenant.publishedVersion)
    : null;
  const definition = live?.definition ?? buildStandardIntakeTemplate();
  await replaceIntakeDraft(
    tenantId,
    definition,
    live?.version ?? null,
    actor.userId
  );
  await insertIntakeAudit({
    tenantId,
    actorId: actor.userId,
    action: 'draft_discarded',
    detail: { liveVersion: live?.version ?? null },
  });
  return getIntakeEditorState(actor);
}

export async function setIntakeDraftLogo(
  actor: IntakeEditorActor,
  file: { buffer: Buffer; mimetype: string; size: number } | undefined
) {
  if (!file) throw new IntakeEditorError('Choose an image to upload.', 400);
  if (!LOGO_TYPES.has(file.mimetype)) {
    throw new IntakeEditorError('Upload a PNG, JPEG, or WebP image.', 400);
  }
  if (file.size <= 0 || file.size > LOGO_MAX_BYTES) {
    throw new IntakeEditorError('The logo must be 2 MB or smaller.', 400);
  }
  const { tenantId } = await requireTenant(actor);
  const draft = await ensureDraft(tenantId, actor.userId);
  const assetId = randomUUID();
  const extension =
    file.mimetype === 'image/png'
      ? 'png'
      : file.mimetype === 'image/webp'
        ? 'webp'
        : 'jpg';
  const storedPath = objectPath(
    'intake-logos',
    `${tenantId}/${assetId}.${extension}`
  );
  await uploadObject(storedPath, file.buffer, file.mimetype, false);
  const savedId = await insertIntakeAsset({
    tenantId,
    objectPath: storedPath,
    contentType: file.mimetype,
    byteSize: file.size,
    createdBy: actor.userId,
  });
  const next: IntakeFormDefinition = {
    ...draft.definition,
    logoAssetId: savedId,
  };
  await saveIntakeDraft(tenantId, next, actor.userId);
  return getIntakeEditorState(actor);
}

export async function clearIntakeDraftLogo(actor: IntakeEditorActor) {
  const { tenantId } = await requireTenant(actor);
  const draft = await ensureDraft(tenantId, actor.userId);
  const next: IntakeFormDefinition = {
    ...draft.definition,
    logoAssetId: null,
  };
  await saveIntakeDraft(tenantId, next, actor.userId);
  return getIntakeEditorState(actor);
}

export async function prepareIntakeTestSubmission(
  actor: IntakeEditorActor,
  input: { answers: unknown; version?: number }
): Promise<{
  tenantId: string;
  data: RequestFormData;
  customAnswers: Record<string, unknown>;
  intakeFormVersion: number | null;
}> {
  const { tenantId } = await requireTenant(actor);
  await consumeTestSubmitRateLimit(actor.userId, tenantId);
  let definition: IntakeFormDefinition;
  let intakeFormVersion: number | null = null;
  if (input.version != null) {
    const row = await getIntakeVersion(tenantId, input.version);
    if (!row) throw new IntakeEditorError('That version was not found.', 404);
    definition = row.definition;
    intakeFormVersion = row.version;
  } else {
    definition = (await ensureDraft(tenantId, actor.userId)).definition;
  }
  try {
    const prepared = normalizePublishedIntakeSubmission(
      input.answers,
      definition
    );
    await confirmIntakeAnswerImages(
      tenantId,
      prepared.customAnswers,
      definition
    );
    return {
      tenantId,
      data: prepared.data,
      customAnswers: prepared.customAnswers,
      intakeFormVersion,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new IntakeEditorError(error.message, 400);
    }
    throw error;
  }
}

async function consumeTestSubmitRateLimit(
  userId: string,
  tenantId: string
): Promise<void> {
  const store = getIntakeAbuseStore();
  const person = await store.hitRateLimit(
    `test-person:${userId}`,
    TEST_SUBMIT_PERSON_LIMIT,
    TEST_SUBMIT_PERSON_WINDOW_MS
  );
  if (person.allowed === false) {
    throw new IntakeEditorError(
      'Too many test submissions. Try again later.',
      429,
      { retryAfterSec: person.retryAfterSec, code: 'RATE_LIMITED' }
    );
  }
  const org = await store.hitRateLimit(
    `test-org:${tenantId}`,
    TEST_SUBMIT_ORG_LIMIT,
    TEST_SUBMIT_ORG_WINDOW_MS
  );
  if (org.allowed === false) {
    throw new IntakeEditorError(
      'This organization has reached the daily test submission limit.',
      429,
      { retryAfterSec: org.retryAfterSec, code: 'RATE_LIMITED' }
    );
  }
}

export async function readLiveLogoBytes(
  tenantId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const tenant = await findIntakeTenantById(tenantId);
  if (!tenant?.publishedVersion) return null;
  const live = await getIntakeVersion(tenantId, tenant.publishedVersion);
  const assetId = live?.definition.logoAssetId;
  if (!assetId) return null;
  const asset = await getIntakeAsset(tenantId, assetId);
  if (!asset) return null;
  const bytes = await downloadObject(asset.objectPath);
  return { bytes, contentType: asset.contentType };
}

export async function storeIntakeAnswerImage(input: {
  tenantId: string;
  file: { buffer: Buffer; mimetype: string; size: number } | undefined;
  createdBy: string;
}): Promise<string> {
  const file = input.file;
  if (!file) throw new IntakeEditorError('Choose an image to upload.', 400);
  if (!ANSWER_IMAGE_TYPES.has(file.mimetype)) {
    throw new IntakeEditorError('Upload a PNG, JPEG, or WebP image.', 400);
  }
  if (file.size <= 0 || file.size > INTAKE_IMAGE_MAX_BYTES) {
    throw new IntakeEditorError('Each image must be 5 MB or smaller.', 400);
  }
  const assetId = randomUUID();
  const extension =
    file.mimetype === 'image/png'
      ? 'png'
      : file.mimetype === 'image/webp'
        ? 'webp'
        : 'jpg';
  const storedPath = objectPath(
    'intake-answers',
    `${input.tenantId}/${assetId}.${extension}`
  );
  await uploadObject(storedPath, file.buffer, file.mimetype, false);
  return insertIntakeAsset({
    tenantId: input.tenantId,
    objectPath: storedPath,
    contentType: file.mimetype,
    byteSize: file.size,
    createdBy: input.createdBy,
  });
}

export async function confirmIntakeAnswerImages(
  tenantId: string,
  customAnswers: Record<string, unknown>,
  definition: IntakeFormDefinition
): Promise<void> {
  const ids: string[] = [];
  for (const step of definition.steps) {
    for (const question of step.questions) {
      if (
        question.hidden === true ||
        question.kind !== 'custom' ||
        question.type !== 'image'
      ) {
        continue;
      }
      const value = customAnswers[question.key];
      if (typeof value === 'string' && value) ids.push(value);
    }
  }
  try {
    await assertIntakeAnswerImages(tenantId, ids);
  } catch (error) {
    if (error instanceof Error && error.message === 'INTAKE_IMAGE_NOT_FOUND') {
      throw new IntakeEditorError(
        'Upload the image again before submitting.',
        400
      );
    }
    throw error;
  }
}
