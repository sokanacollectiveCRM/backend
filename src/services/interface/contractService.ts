
import { Response } from 'express'

export interface ContractService{
  /**
   * Upload a contract template to storage
   */
  uploadTemplate(
    file: File,
    name: string
  )

  /**
   * Download a template and store into a buffer
   */
  getTemplate(
    name: string
  )

  /**
   * Populate a template and generate a new Docx
   */
  generateTemplate(
    buffer: Buffer,
    fields: Record<string, string>,
    res: Response,
  )
}