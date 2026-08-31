import { PdfTemplateField, RegisteredPdfTemplate } from '../pdf/types';
import { ContractDbClient, queryWithClient } from './db';

export interface ContractTemplateDto {
  id: string;
  identifier: string;
  version: number;
  fields: readonly PdfTemplateField[];
  objectPath: string;
  sha256: string;
  isActive: boolean;
  effectiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractTemplateRecord {
  identifier: string;
  version: number;
  fields: readonly PdfTemplateField[];
  objectPath: string;
  sha256: string;
  isActive?: boolean;
  effectiveAt: Date | string;
}

interface TemplateRow {
  id: string;
  identifier: string;
  version: number;
  field_manifest: PdfTemplateField[];
  gcs_object_path: string;
  content_hash: string;
  is_active: boolean;
  effective_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

const SELECT = `SELECT id, identifier, version, field_manifest, gcs_object_path,
                       content_hash, is_active, effective_at, created_at, updated_at
                FROM public.contract_template_versions`;

const toDto = (row: TemplateRow): ContractTemplateDto => ({
  id: row.id,
  identifier: row.identifier,
  version: row.version,
  fields: row.field_manifest,
  objectPath: row.gcs_object_path,
  sha256: row.content_hash,
  isActive: row.is_active,
  effectiveAt:
    row.effective_at instanceof Date
      ? row.effective_at.toISOString()
      : String(row.effective_at),
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  updatedAt:
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
});

export class TemplateRepository {
  async create(
    input: CreateContractTemplateRecord,
    client?: ContractDbClient
  ): Promise<ContractTemplateDto> {
    const { rows } = await queryWithClient<TemplateRow>(
      client,
      `INSERT INTO public.contract_template_versions
       (identifier, version, field_manifest, gcs_object_path, content_hash,
        is_active, effective_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
       RETURNING id, identifier, version, field_manifest, gcs_object_path,
                 content_hash, is_active, effective_at, created_at, updated_at`,
      [
        input.identifier,
        input.version,
        JSON.stringify(input.fields),
        input.objectPath,
        input.sha256,
        input.isActive ?? true,
        input.effectiveAt,
      ]
    );
    if (!rows[0]) throw new Error('Template insert did not return a row');
    return toDto(rows[0]);
  }

  async getById(
    templateId: string,
    client?: ContractDbClient
  ): Promise<ContractTemplateDto | null> {
    const { rows } = await queryWithClient<TemplateRow>(
      client,
      `${SELECT} WHERE id = $1::uuid LIMIT 1`,
      [templateId]
    );
    return rows[0] ? toDto(rows[0]) : null;
  }

  async listActive(client?: ContractDbClient): Promise<ContractTemplateDto[]> {
    const { rows } = await queryWithClient<TemplateRow>(
      client,
      `${SELECT}
       WHERE is_active = TRUE
       ORDER BY identifier, version DESC, id`,
      []
    );
    return rows.map(toDto);
  }

  async deactivate(
    templateId: string,
    client?: ContractDbClient
  ): Promise<boolean> {
    const result = await queryWithClient(
      client,
      `UPDATE public.contract_template_versions
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [templateId]
    );
    return result.rowCount === 1;
  }

  async getRegisteredTemplate(
    identifier: string,
    version?: number,
    client?: ContractDbClient
  ): Promise<RegisteredPdfTemplate | null> {
    const { rows } = await queryWithClient<TemplateRow>(
      client,
      `${SELECT}
       WHERE identifier = $1
         AND ($2::integer IS NULL OR version = $2)
         AND ($2::integer IS NOT NULL OR is_active = TRUE)
         AND effective_at <= CURRENT_TIMESTAMP
       ORDER BY version DESC
       LIMIT 1`,
      [identifier, version ?? null]
    );
    const row = rows[0];
    return row
      ? {
          identifier: row.identifier,
          version: row.version,
          objectPath: row.gcs_object_path,
          sha256: row.content_hash,
          fields: row.field_manifest,
        }
      : null;
  }
}

export const templateRepository = new TemplateRepository();
export const cloudSqlTemplateRepository = templateRepository;
