"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseContractService = void 0;
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const pizzip_1 = __importDefault(require("pizzip"));
const uuid_1 = require("uuid");
const errors_1 = require("../domains/errors");
const Template_1 = require("../entities/Template");
const convertToPdf_1 = __importDefault(require("../utils/convertToPdf"));
class SupabaseContractService {
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }
    async createContract(templateId, clientId, fields, note, fee, deposit, generatedBy) {
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
        const contractId = (0, uuid_1.v4)();
        const filePath = `contracts/client_${clientId}/contract_${contractId}.pdf`;
        const upload = await this.supabaseClient.storage
            .from('contracts')
            .upload(filePath, pdf, { contentType: 'application/pdf' });
        if (upload.error)
            throw new Error('Contract upload failed: ' + upload.error.message);
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
        if (error || !data)
            throw new Error('Contract not found');
        const { data: file, error: downloadError } = await this.supabaseClient
            .storage
            .from('contracts')
            .download(data.document_url);
        if (downloadError || !file)
            throw new Error('Failed to fetch PDF');
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `contract_${contractId}.pdf`;
        return { buffer, filename };
    }
    async getAllTemplates() {
        const { data, error } = await this.supabaseClient
            .from('contract_templates')
            .select('*');
        if (error || !data) {
            console.error('Error fetching templates:', error);
            throw new Error('Could not fetch contract templates');
        }
        return data.map((row) => new Template_1.Template(row.id, row.title, parseFloat(row.deposit), parseFloat(row.fee), row.storagePath));
    }
    async deleteTemplate(templateName) {
        const { error: tableError } = await this.supabaseClient
            .from('contract_templates')
            .delete()
            .eq('title', templateName)
            .select()
            .single();
        if (tableError)
            throw new Error(`Failed to delete template: ${tableError.message}`);
        const { error: storageError } = await this.supabaseClient.storage
            .from('contract-templates')
            .remove([`${templateName}.docx`]);
        if (storageError)
            throw new Error(`Failed to delete template from stroage: ${storageError.message}`);
        return true;
    }
    async uploadTemplate(file, name, deposit, fee) {
        const filePath = name.endsWith('.docx') ? name : `${name}.docx`;
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
        const { error: tableError } = await this.supabaseClient
            .from('contract_templates')
            .upsert([
            {
                title: name,
                deposit: deposit,
                fee: fee,
                storage_path: filePath,
            }
        ]);
        if (tableError) {
            console.error('Table insert error:', tableError);
            throw new Error('Failed to insert template metadata');
        }
        return true;
    }
    async getTemplate(templateName) {
        const filePath = templateName.endsWith('.docx') ? templateName : `${templateName}.docx`;
        const { data } = this.supabaseClient
            .storage
            .from('contract-templates')
            .getPublicUrl(filePath);
        const publicUrl = data.publicUrl;
        if (!publicUrl)
            throw new errors_1.NotFoundError('Template public URL not generated');
        const res = await fetch(publicUrl);
        if (!res.ok)
            throw new errors_1.NotFoundError(`Failed to fetch template: ${res.statusText}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        return buffer;
    }
    async generateTemplate(buffer, fields) {
        // Fill .docx with fields
        const zip = new pizzip_1.default(buffer);
        const doc = new docxtemplater_1.default(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        doc.render(fields);
        const filled = doc.getZip().generate({
            type: 'nodebuffer',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const pdfBuffer = await (0, convertToPdf_1.default)(filled);
        return pdfBuffer;
    }
}
exports.SupabaseContractService = SupabaseContractService;
