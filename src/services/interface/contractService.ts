
import { Contract } from '../../entities/Contract';
import { Template } from '../../entities/Template';

export interface ContractService{

  /**
   * Create a new contract with an established template
   */
  createContract(
    templateId: string,
    clientId: string,
    fields: Record<string, string>,
    generatedBy: string,
    note?: string,
    fee?: string,
    deposit?: string,
  ): Promise<Contract>

  /**
   * Get an existing contract from storage
   */
  fetchContractPDF(
    contractId: string
  ): Promise<{ buffer: Buffer; filename: string }>

  /**
   * Get all templates
   */
  getAllTemplates(
  ): Promise<Template[]>

  /**
   * Delete a template given its name
   */
  deleteTemplate(
    templateName: string
  ): Promise<boolean>

  /**
   * Upload a contract template to storage
   */
  uploadTemplate(
    file: File,
    name: string,
    deposit: number,
    fee: number,
  ): Promise<Boolean>

  /**
   * Download a template and store into a buffer
   */
  getTemplate(
    name: string
  ): Promise<Buffer>

  /**
   * Populate a template and generate a new Docx
   */
  generateTemplate(
    buffer: Buffer,
    fields: Record<string, string>,
  ): Promise<Buffer>
}