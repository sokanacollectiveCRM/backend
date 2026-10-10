import { getSignedReadUrl } from '../../../services/gcs/documentStorage';
import { intakeFieldCatalog } from '../application/intakeFormEditor';
import { IntakeFormDefinition } from '../domain/validateIntakeFormDefinition';
import {
  findPublishedIntakeBySlug,
  getIntakeAsset,
} from './intakeFormRepository';

export interface PublishedIntakeFormPayload {
  version: number;
  definition: IntakeFormDefinition;
  logoUrl: string | null;
  catalog: ReturnType<typeof intakeFieldCatalog>;
}

function lookupEnabled(): boolean {
  if (process.env.INTAKE_PUBLISHED_LOOKUP === 'on') return true;
  if (process.env.INTAKE_PUBLISHED_LOOKUP === 'off') return false;
  if (process.env.JEST_WORKER_ID) return false;
  return true;
}

function isMissingSchemaError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return code === '42703' || code === '42P01';
}

export async function loadPublishedIntakeForm(
  tenantSlug: string
): Promise<PublishedIntakeFormPayload | null> {
  if (!lookupEnabled()) return null;
  try {
    const published = await findPublishedIntakeBySlug(tenantSlug);
    if (!published) return null;
    return {
      version: published.version,
      definition: published.definition,
      logoUrl: await signedLogoUrl(published.tenantId, published.definition),
      catalog: intakeFieldCatalog(),
    };
  } catch (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
}

async function signedLogoUrl(
  tenantId: string,
  definition: IntakeFormDefinition
): Promise<string | null> {
  if (!definition.logoAssetId) return null;
  const asset = await getIntakeAsset(tenantId, definition.logoAssetId);
  if (!asset) return null;
  try {
    return await getSignedReadUrl(asset.objectPath, 15 * 60);
  } catch {
    return null;
  }
}
