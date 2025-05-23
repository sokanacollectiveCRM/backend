import { SupabaseClient } from '@supabase/supabase-js';
import Docxtemplater from 'docxtemplater';
import { Response } from 'express';
import fs from 'fs/promises';
import { MulterFile as File } from 'multer';
import PizZip from 'pizzip';
import { fileSync } from 'tmp';
import { NotFoundError } from '../domains/errors';
import { Template } from '../entities/Template';
import convertToPdf from '../utils/convertToPdf';
import { ContractService } from '././interface/contractService';

export class SupabaseContractService implements ContractService {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }
  
  async getAllTemplates(): Promise<Template[]> {
    const { data, error } = await this.supabaseClient
      .from('contract_templates')
      .select('*')

    if (error || !data) {
      console.error('Error fetching templates:', error)
      throw new Error('Could not fetch contract templates')
    }

    // Map Supabase rows to domain entities
    return data.map((row) => new Template(
      row.id,
      row.title,
      parseFloat(row.deposit),
      parseFloat(row.fee),
      row.storagePath
    ))
  }

  async deleteTemplate(templateName: string): Promise<boolean> {

    const { error: tableError } = await this.supabaseClient
      .from('contract_templates')
      .delete()
      .eq('title', templateName)
      .select()
      .single()

    if (tableError) throw new Error(`Failed to delete template: ${tableError.message}`);

    const { error: storageError } = await this.supabaseClient.storage
      .from('contract-templates')
      .remove([`${templateName}.docx`])

    if (storageError) throw new Error(`Failed to delete template from stroage: ${storageError.message}`);

    return true;
  }

  async uploadTemplate(file: File, name: string, deposit: number, fee: number): Promise<Boolean> {
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

    // Get public URL
    const { data: publicUrlData } = this.supabaseClient
      .storage
      .from('contract-templates')
      .getPublicUrl(filePath);

    const { error: tableError } = await this.supabaseClient
    .from('contract_templates')
    .upsert([
      {
        title: name,
        deposit: deposit,
        fee: fee,
        storage_path: publicUrlData.publicUrl,
      }
    ]);

    if (tableError) {
      console.error('Table insert error:', tableError);
      throw new Error('Failed to insert template metadata');
    }

    return true;
  }

  async getTemplate(templateName: string): Promise<Buffer> {
    const filePath = templateName.endsWith('.docx') ? templateName : `${templateName}.docx`;

    const { data } = this.supabaseClient
      .storage
      .from('contract-templates')
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;
    if (!publicUrl) throw new NotFoundError('Template public URL not generated');

    const res = await fetch(publicUrl);
    if (!res.ok) throw new NotFoundError(`Failed to fetch template: ${res.statusText}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer;
  }

  async generateTemplate(buffer: Buffer, fields: Record<string, string>, res: Response): Promise<Buffer> {

    // Fill .docx with fields
    const zip = new PizZip(buffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(fields);

    const filled = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // write to a temp file first
    const tmpDocx = fileSync({ postfix: '.docx' });
    await fs.writeFile(tmpDocx.name, filled);

    // Convert docx into pdf
    const tmpPdf = fileSync({ postfix: '.pdf' })
    try {
      await convertToPdf(tmpDocx.name, tmpPdf.name);
    }
    catch (error) {
      console.error('PDF conversion failed', error.message);
      throw new Error(`Failed to convert template to pdf: ${error}`);
    }

    return await fs.readFile(tmpPdf.name);
  }
}