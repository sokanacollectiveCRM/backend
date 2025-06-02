import { MulterFile as File } from 'multer';
import { Contract } from '../entities/Contract';
import { Template } from '../entities/Template';
import { ContractService } from '../services/interface/contractService';

export class ContractUseCase {
  constructor(private readonly contractService: ContractService) {}

  async createContract(params: {
    templateId: string;
    clientId: string;
    fields: Record<string, string>;
    note?: string;
    fee?: string;
    deposit?: string;
    generatedBy: string;
  }): Promise<Contract> {
    return await this.contractService.createContract(
      params.templateId,
      params.clientId,
      params.fields,
      params.note,
      params.fee,
      params.deposit,
      params.generatedBy
    );
  }

  async fetchContractPDF(contractId: string): Promise<{ buffer: Buffer; filename: string }> {
    return await this.contractService.fetchContractPDF(contractId);
  }

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

  async generateTemplate(templateName: string, fields: Record<string, string>): Promise<Buffer> {
    // grab the template from supabase
    const buffer = await this.contractService.getTemplate(templateName);
    return await this.contractService.generateTemplate(buffer, fields);
  }
}