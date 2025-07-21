'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ContractUseCase = void 0;
class ContractUseCase {
  constructor(contractService) {
    this.contractService = contractService;
  }
  async createContract(params) {
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
  async fetchContractPDF(contractId) {
    return await this.contractService.fetchContractPDF(contractId);
  }
  async getAllTemplates() {
    return await this.contractService.getAllTemplates();
  }
  async deleteTemplate(templateName) {
    return await this.contractService.deleteTemplate(templateName);
  }
  async updateTemplate(templateName, deposit, fee, template) {
    return await this.contractService.uploadTemplate(
      template,
      templateName,
      deposit,
      fee
    );
  }
  async uploadTemplate(template, name, deposit, fee) {
    return await this.contractService.uploadTemplate(
      template,
      name,
      deposit,
      fee
    );
  }
  async generateTemplate(templateName, fields) {
    // grab the template from supabase
    const buffer = await this.contractService.getTemplate(templateName);
    return await this.contractService.generateTemplate(buffer, fields);
  }
}
exports.ContractUseCase = ContractUseCase;
