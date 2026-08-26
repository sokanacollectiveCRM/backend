import Docxtemplater from 'docxtemplater';
import { MulterFile as File } from 'multer';
import PizZip from 'pizzip';
import { v4 as uuidv4 } from 'uuid';

import { SupabaseClient } from '@supabase/supabase-js';

import { NotFoundError } from '../domains/errors';
import { Contract } from '../entities/Contract';
import { Template } from '../entities/Template';
import convertToPdf from '../utils/convertToPdf';
import { ContractService } from '././interface/contractService';
import {
  GCS_PREFIX,
  deleteObject,
  downloadObject,
  getSignedReadUrl,
  listObjects,
  objectPath,
  uploadObject,
} from './gcs/documentStorage';

export class SupabaseContractService implements ContractService {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  private templateObjectPath(templateName: string): string {
    return objectPath(
      GCS_PREFIX.contractTemplates,
      this.resolveStoragePath(templateName)
    );
  }

  async createContract(
    templateId: string,
    clientId: string,
    fields: Record<string, string>,
    note?: string,
    fee?: string,
    deposit?: string,
    generatedBy?: string
  ): Promise<Contract> {
    const { data: templateUrl } = await this.supabaseClient
      .from('contract_templates')
      .select('storage_path')
      .eq('id', templateId)
      .maybeSingle();

    const storagePath =
      templateUrl?.storage_path || this.resolveStoragePath(templateId);

    let nodeBuffer: Buffer;
    try {
      nodeBuffer = await downloadObject(this.templateObjectPath(storagePath));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Template download failed: ${message}`);
    }

    const pdf = await this.generateTemplate(nodeBuffer, fields);

    const contractId = uuidv4();
    const filePath = `contracts/client_${clientId}/contract_${contractId}.pdf`;

    const upload = await this.supabaseClient.storage
      .from('contracts')
      .upload(filePath, pdf, { contentType: 'application/pdf' });

    if (upload.error)
      throw new Error('Contract upload failed: ' + upload.error.message);

    const { data, error: insertError } = await this.supabaseClient
      .from('contracts')
      .insert([
        {
          id: contractId,
          template_id: templateId,
          template_name: fields.templateName || 'Untitled',
          client_id: clientId,
          note,
          fee,
          deposit,
          status: 'created',
          document_url: filePath,
          generated_by: generatedBy,
        },
      ])
      .select()
      .single();

    if (insertError)
      throw new Error('Failed to insert contract: ' + insertError.message);

    return data as Contract;
  }

  async fetchContractPDF(
    contractId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { data, error } = await this.supabaseClient
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (error || !data) throw new Error('Contract not found');

    const { data: file, error: downloadError } =
      await this.supabaseClient.storage
        .from('contracts')
        .download(data.document_url);

    if (downloadError || !file) throw new Error('Failed to fetch PDF');

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `contract_${contractId}.pdf`;

    return { buffer, filename };
  }

  private static readonly KNOWN_STORAGE_TEMPLATES = [
    'Agreement for Postpartum Doula Services.docx',
    'Labor Support Agreement for Service.docx',
  ];

  private isTemplateFile(name: string): boolean {
    const lower = name.toLowerCase();
    return (
      !name.startsWith('.') &&
      name !== '.emptyFolderPlaceholder' &&
      (lower.endsWith('.docx') ||
        lower.endsWith('.doc') ||
        lower.endsWith('.pdf'))
    );
  }

  private displayNameFromStoragePath(storagePath: string): string {
    return storagePath.replace(/\.(docx|doc|pdf)$/i, '');
  }

  private resolveStoragePath(templateName: string): string {
    if (/\.(docx|doc|pdf)$/i.test(templateName)) {
      return templateName;
    }
    return `${templateName}.docx`;
  }

  private templatesFromNames(names: string[]): Template[] {
    return names.map(
      (storagePath, index) =>
        new Template(
          storagePath,
          this.displayNameFromStoragePath(storagePath),
          0,
          0,
          storagePath
        )
    );
  }

  /**
   * List templates from private GCS (source of truth).
   * Falls back to known DOCX filenames when listing returns empty.
   */
  async getAllTemplates(): Promise<Template[]> {
    try {
      const files = await listObjects(GCS_PREFIX.contractTemplates);
      const listed = files
        .filter((file) => this.isTemplateFile(file.name))
        .map(
          (file) =>
            new Template(
              file.name,
              this.displayNameFromStoragePath(file.name),
              0,
              0,
              file.name
            )
        );

      if (listed.length > 0) {
        return listed;
      }

      console.warn(
        'GCS contract-templates list returned 0 templates; using known filenames'
      );
      return this.templatesFromNames(
        SupabaseContractService.KNOWN_STORAGE_TEMPLATES
      );
    } catch (err) {
      console.error('Error listing contract templates from GCS:', err);
      return this.templatesFromNames(
        SupabaseContractService.KNOWN_STORAGE_TEMPLATES
      );
    }
  }

  async deleteTemplate(templateName: string): Promise<boolean> {
    await deleteObject(this.templateObjectPath(templateName));
    return true;
  }

  async uploadTemplate(
    file: File,
    name: string,
    deposit: number,
    fee: number
  ): Promise<Boolean> {
    void deposit;
    void fee;
    if (!file) {
      throw new Error('No file uploaded');
    }

    await uploadObject(
      this.templateObjectPath(name),
      file.buffer,
      file.mimetype ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      true
    );

    return true;
  }

  async getTemplate(templateName: string): Promise<Buffer> {
    try {
      return await downloadObject(this.templateObjectPath(templateName));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new NotFoundError(`Failed to fetch template: ${message}`);
    }
  }

  /** Short-lived signed URL for admin preview / open-in-tab. */
  async getTemplateSignedUrl(
    templateName: string,
    expiresInSeconds = 15 * 60
  ): Promise<string> {
    return getSignedReadUrl(
      this.templateObjectPath(templateName),
      expiresInSeconds
    );
  }

  async generateTemplate(
    buffer: Buffer,
    fields: Record<string, string>
  ): Promise<Buffer> {
    // Fill .docx with fields
    const zip = new PizZip(buffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    doc.render(fields ?? {});

    const filled = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const pdfBuffer = await convertToPdf(filled);
    return pdfBuffer;
  }
}
