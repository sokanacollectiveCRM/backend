'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.SupabaseContractService = void 0;
const docxtemplater_1 = __importDefault(require('docxtemplater'));
const pizzip_1 = __importDefault(require('pizzip'));
const uuid_1 = require('uuid');
const errors_1 = require('../domains/errors');
const Template_1 = require('../entities/Template');
const convertToPdf_1 = __importDefault(require('../utils/convertToPdf'));
class SupabaseContractService {
  constructor(supabaseClient) {
    this.supabaseClient = supabaseClient;
  }
  async createContract(
    templateId,
    clientId,
    fields,
    note,
    fee,
    deposit,
    generatedBy
  ) {
    const { data: templateUrl, error: urlError } = await this.supabaseClient
      .from('contract_templates')
      .select('storage_path')
      .eq('id', templateId)
      .single();
    if (!templateUrl || urlError) {
      throw new Error('Failed to retrieve template metadata');
    }
    console.log(templateUrl);
    const { data: template, error } = await this.supabaseClient.storage
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
    const contractId = (0, uuid_1.v4)();
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
    return data;
  }
  async fetchContractPDF(contractId) {
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
  isTemplateFile(name) {
    const lower = name.toLowerCase();
    return (
      !name.startsWith('.') &&
      name !== '.emptyFolderPlaceholder' &&
      (lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.pdf'))
    );
  }
  displayNameFromStoragePath(storagePath) {
    return storagePath.replace(/\.(docx|doc|pdf)$/i, '');
  }
  resolveStoragePath(templateName) {
    if (/\.(docx|doc|pdf)$/i.test(templateName)) {
      return templateName;
    }
    return `${templateName}.docx`;
  }
  templatesFromNames(names) {
    return names.map(
      (storagePath) =>
        new Template_1.Template(
          storagePath,
          this.displayNameFromStoragePath(storagePath),
          0,
          0,
          storagePath
        )
    );
  }
  async getAllTemplates() {
    const known = [
      'Agreement for Postpartum Doula Services.docx',
      'Labor Support Agreement for Service.docx',
    ];
    const { data, error } = await this.supabaseClient.storage
      .from('contract-templates')
      .list('', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
      });
    if (error) {
      console.error('Error listing contract templates from storage:', error);
      return this.templatesFromNames(known);
    }
    const listed = (data ?? [])
      .filter((file) => this.isTemplateFile(file.name))
      .map(
        (file) =>
          new Template_1.Template(
            file.id ?? file.name,
            this.displayNameFromStoragePath(file.name),
            0,
            0,
            file.name
          )
      );
    if (listed.length > 0) return listed;
    console.warn(
      'Storage list returned 0 templates; using known contract-templates filenames'
    );
    return this.templatesFromNames(known);
  }
  async deleteTemplate(templateName) {
    const filePath = this.resolveStoragePath(templateName);
    const { error: storageError } = await this.supabaseClient.storage
      .from('contract-templates')
      .remove([filePath]);
    if (storageError)
      throw new Error(
        `Failed to delete template from storage: ${storageError.message}`
      );
    return true;
  }
  async uploadTemplate(file, name, deposit, fee) {
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
  async getTemplate(templateName) {
    const filePath = this.resolveStoragePath(templateName);
    const { data, error } = await this.supabaseClient.storage
      .from('contract-templates')
      .download(filePath);
    if (error || !data)
      throw new errors_1.NotFoundError(
        `Failed to fetch template: ${(error && error.message) || 'not found'}`
      );
    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer;
  }
  async generateTemplate(buffer, fields) {
    // Fill .docx with fields
    const zip = new pizzip_1.default(buffer);
    const doc = new docxtemplater_1.default(zip, {
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
    const pdfBuffer = await (0, convertToPdf_1.default)(filled);
    return pdfBuffer;
  }
}
exports.SupabaseContractService = SupabaseContractService;

