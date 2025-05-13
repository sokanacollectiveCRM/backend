import { SupabaseClient } from '@supabase/supabase-js';
import Docxtemplater from 'docxtemplater';
import { NotFoundError } from 'domains/errors';
import { Response } from 'express';
import { MulterFile as File } from 'multer';
import PizZip from 'pizzip';
import { ContractService } from '././interface/contractService';


export class SupabaseContractService implements ContractService {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  async uploadTemplate(file: File, name: string) {
    const filePath = name.endsWith('.docx') ? name : `${name}.docx`;

    const { data, error: uploadError } = await this.supabaseClient.storage
      .from('contract-templates')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
    });

    if (uploadError) {
      console.log('Upload error', uploadError);
      throw new Error('failed to stash profile picture');
    }

    return true;
  }

  async getTemplate(templateName: string) {
    const { data, error } = await this.supabaseClient.storage
      .from('contract-templates')
      .download(templateName.endsWith('.docx') ? templateName : `${templateName}.docx`);

    if (error || !data) throw new NotFoundError('Template not downloaded');
    return Buffer.from(await data.arrayBuffer());
  }

  async generateTemplate(buffer: Buffer, fields: Record<string, string>, res: Response) {
    console.log("generating template");
    const zip = new PizZip(buffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.setData(fields);

    try {
      doc.render();
    } catch (err: any) {
      console.error('Docx render error:', err);
      throw new Error('Failed to generate document');
    }

    const filled = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    res.setHeader('Content-Disposition', 'attachment; filename=filled-template.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(filled);
  }
}