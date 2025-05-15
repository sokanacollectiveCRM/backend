import { Response } from 'express';
import { MulterFile as File } from 'multer';
import { Template } from '../entities/Template';
import { ContractService } from '../services/interface/contractService';

export class ContractUseCase {
  constructor(private readonly contractService: ContractService) {}

  async getAllTemplates(): Promise<Template[]> {
    return await this.contractService.getAllTemplates()
  }

  async deleteTemplate(templateName: string): Promise<boolean> {
    return await this.contractService.deleteTemplate(templateName);
  }

  async updateTemplate(templateName: string, deposit: number, fee: number, template: File) {
    return await this.contractService.uploadTemplate(template, templateName, deposit, fee);
  }

  async uploadTemplate(template: File, name: string, deposit: number, fee: number): Promise<Boolean> {
    return await this.contractService.uploadTemplate(template, name, deposit, fee);
  }

  async generateTemplate(templateName: string, fields: Record<string, string>, res: Response): Promise<Buffer> {
    // grab the template from supabase
    const buffer = await this.contractService.getTemplate(templateName);
    return await this.contractService.generateTemplate(buffer, fields, res);
  }
}