
import { Template } from 'entities/Template'
import { Response } from 'express'

export interface ContractService{

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
    res: Response,
  ): Promise<Buffer>

  /**
   * Populate a template a generate as a buffer (not download)
   */
  // generateTemplateAsBuffer(
  //   buffer: Buffer,
  //   fields: Record<string, string>,
  // ): Promise<Buffer>
}