"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentProcessor = exports.DocumentProcessor = void 0;
const docx_1 = require("docx");
const fs_1 = __importDefault(require("fs"));
const mammoth_1 = __importDefault(require("mammoth"));
const path_1 = __importDefault(require("path"));
class DocumentProcessor {
    constructor() {
        this.templatePath = path_1.default.join(process.cwd(), 'docs', 'Agreement for Postpartum Doula Services (1).docx');
    }
    async processTemplate(fields) {
        try {
            console.log('📄 Reading template document...');
            // Check if template exists
            if (!fs_1.default.existsSync(this.templatePath)) {
                throw new Error(`Template not found at: ${this.templatePath}`);
            }
            // Read the template document
            const templateBuffer = fs_1.default.readFileSync(this.templatePath);
            console.log(`📄 Template loaded (${templateBuffer.length} bytes)`);
            // Extract text content from the Word document
            const result = await mammoth_1.default.extractRawText({ buffer: templateBuffer });
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
            const doc = new docx_1.Document({
                sections: [{
                        properties: {},
                        children: [
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: processedText,
                                        size: 24, // 12pt font
                                    }),
                                ],
                            }),
                        ],
                    }],
            });
            // Generate the new document
            const buffer = await docx_1.Packer.toBuffer(doc);
            console.log(`✅ New document generated with prefilled values (${buffer.length} bytes)`);
            return buffer;
        }
        catch (error) {
            console.error('❌ Error processing document:', error);
            throw error;
        }
    }
    async processTemplateWithHtml(fields) {
        try {
            console.log('📄 Reading template document and converting to HTML...');
            // Check if template exists
            if (!fs_1.default.existsSync(this.templatePath)) {
                throw new Error(`Template not found at: ${this.templatePath}`);
            }
            // Read the template document
            const templateBuffer = fs_1.default.readFileSync(this.templatePath);
            console.log(`📄 Template loaded (${templateBuffer.length} bytes)`);
            // Convert to HTML with formatting
            const result = await mammoth_1.default.convertToHtml({ buffer: templateBuffer });
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
            const doc = new docx_1.Document({
                sections: [{
                        properties: {},
                        children: [
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: this.stripHtml(htmlContent),
                                        size: 24, // 12pt font
                                    }),
                                ],
                            }),
                        ],
                    }],
            });
            // Generate the new document
            const buffer = await docx_1.Packer.toBuffer(doc);
            console.log(`✅ New document generated from HTML (${buffer.length} bytes)`);
            return buffer;
        }
        catch (error) {
            console.error('❌ Error processing document with HTML:', error);
            throw error;
        }
    }
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }
    // Method to save processed document for testing
    async saveProcessedDocument(fields, filename = 'processed-contract.docx') {
        try {
            const buffer = await this.processTemplate(fields);
            const outputPath = path_1.default.join(process.cwd(), 'generated', filename);
            // Ensure generated directory exists
            const generatedDir = path_1.default.join(process.cwd(), 'generated');
            if (!fs_1.default.existsSync(generatedDir)) {
                fs_1.default.mkdirSync(generatedDir, { recursive: true });
            }
            fs_1.default.writeFileSync(outputPath, buffer);
            console.log(`💾 Processed document saved to: ${outputPath}`);
            return outputPath;
        }
        catch (error) {
            console.error('❌ Error saving processed document:', error);
            throw error;
        }
    }
}
exports.DocumentProcessor = DocumentProcessor;
// Export singleton instance
exports.documentProcessor = new DocumentProcessor();
