import { SupabaseClient } from '@supabase/supabase-js';
import Docxtemplater from 'docxtemplater';
import { MulterFile as File } from 'multer';
import PizZip from 'pizzip';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError } from '../domains/errors';
import { Contract } from '../entities/Contract';
import { Template } from '../entities/Template';
import convertToPdf from '../utils/convertToPdf';
import { ContractService } from '././interface/contractService';

export class SupabaseContractService implements ContractService {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
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

    const { data: templateUrl, error: urlError } = await this.supabaseClient
      .from('contract_templates')
      .select('storage_path')
      .eq('id', templateId)
      .single();

    if (!templateUrl || urlError) {
      throw new Error('Failed to retrieve template metadata');
    }

    console.log(templateUrl);

    const { data: template, error } = await this.supabaseClient
      .storage
      .from('contract-templates')
      .download(templateUrl.storage_path);

    console.log('template is : ', template);

    if (!template || error) {
      throw new Error('Template download failed');
    }

    // generateTemplate expects a node.js Buffer
    const arrayBuffer = await template.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer);
    const pdf = await this.generateTemplate(nodeBuffer, fields);

    const contractId = uuidv4();
    const filePath = `contracts/client_${clientId}/contract_${contractId}.pdf`;

    const upload = await this.supabaseClient.storage
      .from('contracts')
      .upload(filePath, pdf, { contentType: 'application/pdf' });

    if (upload.error) throw new Error('Contract upload failed: ' + upload.error.message);


    const { data, error: insertError } = await this.supabaseClient
      .from('contracts')
      .insert([{
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
      }])
      .select()
      .single();

    if (insertError) throw new Error('Failed to insert contract: ' + insertError.message);

    return data as Contract;
  }

  async fetchContractPDF(contractId: string): Promise<{ buffer: Buffer; filename: string }> {

    const { data, error } = await this.supabaseClient
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (error || !data) throw new Error('Contract not found');

    const { data: file, error: downloadError } = await this.supabaseClient
      .storage
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
      (lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.pdf'))
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
   * List templates from the Supabase storage bucket (source of truth).
   * Falls back to known DOCX filenames when listing returns empty
   * (table contract_templates is not required).
   */
  async getAllTemplates(): Promise<Template[]> {
    const { data, error } = await this.supabaseClient.storage
      .from('contract-templates')
      .list('', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      console.error('Error listing contract templates from storage:', error);
      // Fall back so Contracts UI still loads known templates
      return this.templatesFromNames(
        SupabaseContractService.KNOWN_STORAGE_TEMPLATES
      );
    }

    const listed = (data ?? [])
      .filter((file) => this.isTemplateFile(file.name))
      .map(
        (file) =>
          new Template(
            file.id ?? file.name,
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
      'Storage list returned 0 templates; using known contract-templates filenames'
    );
    return this.templatesFromNames(
      SupabaseContractService.KNOWN_STORAGE_TEMPLATES
    );
  }

  async deleteTemplate(templateName: string): Promise<boolean> {
    const filePath = this.resolveStoragePath(templateName);

    const { error: storageError } = await this.supabaseClient.storage
      .from('contract-templates')
      .remove([filePath]);

    if (storageError) {
      throw new Error(`Failed to delete template from storage: ${storageError.message}`);
    }

    return true;
  }

  async uploadTemplate(file: File, name: string, deposit: number, fee: number): Promise<Boolean> {
    void deposit;
    void fee;
    const filePath = this.resolveStoragePath(name);

    if (file) {
      const { error: uploadError } = await this.supabaseClient.storage
        .from('contract-templates')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        throw new Error('failed to upload new template');
      }
    }

    return true;
  }

  async getTemplate(templateName: string): Promise<Buffer> {
    const filePath = this.resolveStoragePath(templateName);

    const { data, error } = await this.supabaseClient.storage
      .from('contract-templates')
      .download(filePath);

    if (error || !data) {
      throw new NotFoundError(`Failed to fetch template: ${error?.message ?? 'not found'}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async generateTemplate(buffer: Buffer, fields: Record<string, string>): Promise<Buffer> {

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
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const pdfBuffer = await convertToPdf(filled);
    return pdfBuffer;
  }
}