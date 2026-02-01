import { Document, Packer, Paragraph, TextRun } from 'docx';
import fs from 'fs';
import mammoth from 'mammoth';
import path from 'path';
import { GENERATED_DIR, ensureDir } from './runtimePaths';

export interface ContractFields {
  total_hours: string;
  hourly_rate_fee: string;
  deposit: string;
  overnight_fee_amount: string;
  total_amount: string;
  client_name?: string;
  client_initials?: string;
  signature_date?: string;
}

export class DocumentProcessor {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'docs', 'Agreement for Postpartum Doula Services (1).docx');
  }

  async processTemplate(fields: ContractFields): Promise<Buffer> {
    try {
      console.log('📄 Reading template document...');

      // Check if template exists
      if (!fs.existsSync(this.templatePath)) {
        throw new Error(`Template not found at: ${this.templatePath}`);
      }

      // Read the template document
      const templateBuffer = fs.readFileSync(this.templatePath);
      console.log(`📄 Template loaded (${templateBuffer.length} bytes)`);

      // Extract text content from the Word document
      const result = await mammoth.extractRawText({ buffer: templateBuffer });
      const templateText = result.value;

      console.log('📝 Template text extracted, replacing placeholders...');

      // Replace placeholders with actual values
      let processedText = templateText;

      // Map of placeholders to values - using the actual template placeholders
      const replacements = {
        // Actual placeholders from your template
        '@Service Deposit 🏷️': fields.deposit,
        '@Fee Amount (Postpartum Doula) 🏷️': fields.hourly_rate_fee,
        '@Overnight Fee Amount (Postpartum Doula) 🏷️': fields.overnight_fee_amount,
        '@Balance Amount (Postpartum Doula) 🏷️': fields.total_amount,
        // Total hours - try different formats
        '___': fields.total_hours,
        'Total number of hours for care ___': `Total number of hours for care ${fields.total_hours}`,
        // Client information fields
        '@Client Name 🏷️': fields.client_name || '[CLIENT NAME]',
        '@Client\'s Initials ✍️': fields.client_initials || '[INITIALS]',
        '@Client\'s Signature ✍️': fields.client_name || '[SIGNATURE]',
        '@Client\'s Sign Date ✍️': fields.signature_date || new Date().toLocaleDateString(),
        // Try various other formats
        '[TOTAL_HOURS]': fields.total_hours,
        '[HOURLY_RATE]': fields.hourly_rate_fee,
        '[DEPOSIT]': fields.deposit,
        '[OVERNIGHT_FEE]': fields.overnight_fee_amount,
        '[TOTAL_AMOUNT]': fields.total_amount,
        // Without brackets
        'TOTAL_HOURS': fields.total_hours,
        'HOURLY_RATE': fields.hourly_rate_fee,
        'DEPOSIT': fields.deposit,
        'OVERNIGHT_FEE': fields.overnight_fee_amount,
        'TOTAL_AMOUNT': fields.total_amount,
        // Common placeholders
        '{{total_hours}}': fields.total_hours,
        '{{hourly_rate}}': fields.hourly_rate_fee,
        '{{deposit}}': fields.deposit,
        '{{overnight_fee}}': fields.overnight_fee_amount,
        '{{total_amount}}': fields.total_amount,
        // DocuSign field names
        'total_hours': fields.total_hours,
        'hourly_rate': fields.hourly_rate_fee,
        'deposit': fields.deposit,
        'overnight_fee': fields.overnight_fee_amount,
        'total_amount': fields.total_amount,
      };

      // Replace all placeholders
      for (const [placeholder, value] of Object.entries(replacements)) {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedText = processedText.replace(regex, value);
      }

      console.log('✅ Placeholders replaced with contract data');

      // Create a new Word document with the processed text
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: processedText,
                  size: 24, // 12pt font
                }),
              ],
            }),
          ],
        }],
      });

      // Generate the new document
      const buffer = await Packer.toBuffer(doc);
      console.log(`✅ New document generated with prefilled values (${buffer.length} bytes)`);

      return buffer;

    } catch (error) {
      console.error('❌ Error processing document:', error);
      throw error;
    }
  }

  async processTemplateWithHtml(fields: ContractFields): Promise<Buffer> {
    try {
      console.log('📄 Reading template document and converting to HTML...');

      // Check if template exists
      if (!fs.existsSync(this.templatePath)) {
        throw new Error(`Template not found at: ${this.templatePath}`);
      }

      // Read the template document
      const templateBuffer = fs.readFileSync(this.templatePath);
      console.log(`📄 Template loaded (${templateBuffer.length} bytes)`);

      // Convert to HTML with formatting
      const result = await mammoth.convertToHtml({ buffer: templateBuffer });
      let htmlContent = result.value;

      console.log('📝 Template converted to HTML, replacing placeholders...');

      // Replace placeholders with actual values
      const replacements = {
        '[TOTAL_HOURS]': fields.total_hours,
        '[HOURLY_RATE]': fields.hourly_rate_fee,
        '[DEPOSIT]': fields.deposit,
        '[OVERNIGHT_FEE]': fields.overnight_fee_amount,
        '[TOTAL_AMOUNT]': fields.total_amount,
        // Add more placeholders as needed
        'TOTAL_HOURS': fields.total_hours,
        'HOURLY_RATE': fields.hourly_rate_fee,
        'DEPOSIT': fields.deposit,
        'OVERNIGHT_FEE': fields.overnight_fee_amount,
        'TOTAL_AMOUNT': fields.total_amount,
      };

      // Replace all placeholders
      for (const [placeholder, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
      }

      console.log('✅ Placeholders replaced with contract data');

      // Create a new Word document from the processed HTML
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: this.stripHtml(htmlContent),
                  size: 24, // 12pt font
                }),
              ],
            }),
          ],
        }],
      });

      // Generate the new document
      const buffer = await Packer.toBuffer(doc);
      console.log(`✅ New document generated from HTML (${buffer.length} bytes)`);

      return buffer;

    } catch (error) {
      console.error('❌ Error processing document with HTML:', error);
      throw error;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  // Method to save processed document for testing
  async saveProcessedDocument(fields: ContractFields, filename: string = 'processed-contract.docx'): Promise<string> {
    try {
      const buffer = await this.processTemplate(fields);
      const outputPath = path.join(GENERATED_DIR, filename);

      // Ensure generated directory exists
      ensureDir(GENERATED_DIR);

      fs.writeFileSync(outputPath, buffer);
      console.log(`💾 Processed document saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error('❌ Error saving processed document:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();
