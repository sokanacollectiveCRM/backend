import { Response } from 'express';
import { ContractService } from '../services/interface/contractService';

export class ContractUseCase {
  constructor(private readonly contractService: ContractService) {}

  async uploadTemplate(template: File, name: string): Promise<void> {
    return await this.contractService.uploadTemplate(template, name);
  }

  async generateTemplate(templateName: string, fields: Record<string, string>, res: Response): Promise<void> {
    // grab the template from supabase
    const buffer = await this.contractService.getTemplate(templateName);
    await this.contractService.generateTemplate(buffer, fields, res);
  }
}