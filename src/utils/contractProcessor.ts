import { exec } from 'child_process';
import Docxtemplater from 'docxtemplater';
import fs from 'fs-extra';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import PizZip from 'pizzip';
import { NodemailerService } from '../services/emailService';
import supabase from '../supabase';

/**
 * Contract Processor Module
 * Handles contract generation, PDF conversion, signature overlay, and storage upload
 */

// Types
export interface ContractData {
  clientName?: string;
  serviceName?: string;
  price?: string;
  date?: string;
  contractId: string;
  clientEmail?: string;
  [key: string]: any; // Allow additional properties
}

export interface ProcessingResult {
  contractId: string;
  docxPath: string;
  pdfPath: string;
  signedPdfPath: string;
  signedUrl: string;
  emailSent: boolean;
  success: boolean;
}

// Ensure directories exist - use /tmp for serverless environments
const GENERATED_DIR = process.env.NODE_ENV === 'production' && process.env.VERCEL
  ? '/tmp/generated'
  : path.join(process.cwd(), 'generated');

/**
 * Generate a contract document from template
 * @param contractData - Contract data with placeholders
 * @param contractId - Unique contract identifier
 * @returns Path to generated .docx file
 */
async function generateContractDocx(contractData: Omit<ContractData, 'contractId'>, contractId: string): Promise<string> {
  try {
    // Ensure generated directory exists
    await fs.ensureDir(GENERATED_DIR);

    const outputPath = path.join(GENERATED_DIR, `contract-${contractId}.docx`);

    // Download template from Supabase Storage
    console.log('📥 Downloading template from Supabase Storage...');
    const { data: templateBlob, error: downloadError } = await supabase.storage
      .from('contract-templates')
      .download('Agreement for Postpartum Doula Services.docx');

    if (downloadError) {
      throw new Error(`Failed to download template from Supabase Storage: ${downloadError.message}`);
    }

    if (!templateBlob) {
      throw new Error('Template data is null from Supabase Storage');
    }

    // Convert Blob to Buffer
    const content = Buffer.from(await templateBlob.arrayBuffer());
    const zip = new PizZip(content);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Set comprehensive template variables for doula contract
    const contractDate = contractData.date || new Date().toLocaleDateString();
    const dueDate = contractData.dueDate || '2024-03-15';
    const startDate = contractData.startDate || '2024-02-15';
    const endDate = contractData.endDate || '2024-04-15';

    // Map input data to template placeholders
    // Template expects: {totalHours}, {deposit}, {hourlyRate}, {overnightFee}, {totalAmount}, {clientInitials}, {clientName}
    const templateVariables = {
      // Required template variables
      totalHours: contractData.totalHours || '120', // Default to 120 hours
      deposit: contractData.depositAmount?.replace('$', '') || contractData.deposit || '600.00',
      hourlyRate: contractData.hourlyRate || '35.00',
      overnightFee: contractData.overnightFee || '0.00',
      totalAmount: contractData.totalInvestment?.replace('$', '') || contractData.totalAmount || '4,200.00',
      clientInitials: contractData.clientInitials || contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JB',
      clientName: contractData.clientName || 'Jerry Bony',

      // Additional data from contractData (in case template has more placeholders)
      ...contractData
    };

    console.log('📋 Template data being used:', templateVariables);
    doc.setData(templateVariables);

    // Render the document
    doc.render();

    // Generate output
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });

    // Check if we're in a serverless environment
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';

    if (isServerless) {
      // In serverless environments, return the buffer directly
      console.log('🚀 Serverless environment detected, returning buffer for direct upload');
      return buffer as any; // Return buffer instead of file path
    } else {
      // In non-serverless environments, write to local filesystem
      await fs.writeFile(outputPath, buffer);
      console.log(`Contract document generated: ${outputPath}`);
      return outputPath;
    }
  } catch (error) {
    console.error('Error generating contract document:', error);
    throw error;
  }
}

/**
 * Convert .docx to .pdf using LibreOffice
 * @param docxPath - Path to the .docx file
 * @param contractId - Contract identifier
 * @returns Path to generated .pdf file
 */
async function convertDocxToPdf(docxPath: string, contractId: string): Promise<string> {
  // Check if we're in a serverless environment
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';

  if (isServerless || docxPath.startsWith('supabase://')) {
    // In serverless environments, we'll skip PDF conversion for now
    // and work directly with the DOCX file
    console.log('🚀 Serverless environment detected, skipping PDF conversion');
    console.log('📄 Using DOCX file directly for SignNow');
    return docxPath; // Return the original DOCX path
  }

  return new Promise((resolve, reject) => {
    const outputDir = path.join(GENERATED_DIR);
    const command = `soffice --headless --convert-to pdf "${docxPath}" --outdir "${outputDir}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('LibreOffice conversion error:', error);
        reject(new Error(`PDF conversion failed: ${error.message}`));
        return;
      }

      if (stderr) {
        console.warn('LibreOffice warnings:', stderr);
      }

      const pdfPath = path.join(outputDir, `contract-${contractId}.pdf`);

      // Check if PDF was created
      if (fs.existsSync(pdfPath)) {
        console.log(`PDF generated: ${pdfPath}`);
        resolve(pdfPath);
      } else {
        reject(new Error('PDF file was not created'));
      }
    });
  });
}

/**
 * Add signature overlay to PDF
 * @param pdfPath - Path to the PDF file
 * @param contractData - Contract data containing signature info
 * @param contractId - Contract identifier
 * @returns Path to signed PDF file
 */
async function addSignatureOverlay(pdfPath: string, contractData: Omit<ContractData, 'contractId'>, contractId: string): Promise<string> {
  try {
    // Read the PDF
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get the first page
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const page = pages[0];
    const { width, height } = page.getSize();

    // Embed standard font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Create signature text
    const signatureText = `SIGNED by ${contractData.clientName || 'Client'} on ${contractData.date || new Date().toLocaleDateString()}`;

    // Calculate text size and position
    const fontSize = 12;
    const textWidth = font.widthOfTextAtSize(signatureText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Position signature at bottom right with some margin
    const margin = 50;
    const x = width - textWidth - margin;
    const y = margin + textHeight;

    // Draw signature text
    page.drawText(signatureText, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    // Save the modified PDF
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join(GENERATED_DIR, `contract-${contractId}-signed.pdf`);
    await fs.writeFile(signedPdfPath, signedPdfBytes);

    console.log(`Signed PDF generated: ${signedPdfPath}`);
    return signedPdfPath;
  } catch (error) {
    console.error('Error adding signature overlay:', error);
    throw error;
  }
}

/**
 * Upload PDF to Supabase Storage
 * @param pdfPath - Path to the PDF file
 * @param contractId - Contract identifier
 * @returns Signed URL for the uploaded file
 */
async function uploadToSupabaseStorage(pdfPath: string, contractId: string): Promise<string> {
  try {
    // Read the file
    const fileBuffer = await fs.readFile(pdfPath);
    const fileName = `contract-${contractId}-signed.pdf`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('contracts')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    console.log(`File uploaded to Supabase: ${fileName}`);

    // Generate signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('contracts')
      .createSignedUrl(fileName, 3600); // 1 hour in seconds

    if (urlError) {
      throw new Error(`Signed URL generation error: ${urlError.message}`);
    }

    console.log(`Signed URL generated: ${urlData.signedUrl}`);
    return urlData.signedUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
}

/**
 * Send contract email with secure link
 * @param to - Recipient email address
 * @param contractData - Contract data
 * @param signedUrl - Secure signed URL for the contract
 * @param contractId - Contract identifier
 * @returns Promise<void>
 */
async function sendContractEmail(to: string, contractData: Omit<ContractData, 'contractId'>, signedUrl: string, contractId: string): Promise<void> {
  try {
    const emailService = new NodemailerService();

    const subject = `Your Contract - ${contractData.serviceName || 'Service Contract'}`;

    const text = `Dear ${contractData.clientName || 'Valued Client'},

Your contract has been prepared and is ready for review.

Contract Details:
- Contract ID: ${contractId}
- Service: ${contractData.serviceName || 'Service'}
- Price: ${contractData.price || 'TBD'}
- Date: ${contractData.date || new Date().toLocaleDateString()}

You can access your contract using the secure link below:
${signedUrl}

This link is valid for 1 hour. If you need a new link, please contact us.

Please review the contract and let us know if you have any questions or need any modifications.

Best regards,
The Sokana Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Your Contract is Ready!</h2>
          <p style="color: #666; font-size: 16px;">Dear ${contractData.clientName || 'Valued Client'},</p>
        </div>

        <p>Your contract has been prepared and is ready for review.</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Contract Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <strong>Contract ID:</strong> ${contractId}
            </li>
            <li style="margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <strong>Service:</strong> ${contractData.serviceName || 'Service'}
            </li>
            <li style="margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <strong>Price:</strong> ${contractData.price || 'TBD'}
            </li>
            <li style="margin: 10px 0; padding: 8px 0;">
              <strong>Date:</strong> ${contractData.date || new Date().toLocaleDateString()}
            </li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${signedUrl}"
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none;
                    border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            📄 View Your Contract
          </a>
        </div>

        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>⚠️ Important:</strong> This link is valid for 1 hour. If you need a new link, please contact us.
          </p>
        </div>

        <p>Please review the contract and let us know if you have any questions or need any modifications.</p>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #666;">
            Best regards,<br>
            <strong>The Sokana Team</strong>
          </p>
        </div>
      </div>
    `;

    await emailService.sendEmail(to, subject, text, html);
    console.log(`Contract email sent successfully to: ${to}`);
  } catch (error) {
    console.error('Error sending contract email:', error);
    throw error;
  }
}

/**
 * Main function to process and upload contract
 * @param contractData - Contract data object
 * @returns Object containing file paths and signed URL
 */
async function processAndUploadContract(contractData: ContractData): Promise<ProcessingResult> {
  try {
    const { contractId, clientEmail, ...data } = contractData;

    if (!contractId) {
      throw new Error('contractId is required');
    }

    console.log(`Starting contract processing for contract ID: ${contractId}`);

    // Step 1: Generate Contract (.docx)
    const docxPath = await generateContractDocx(data, contractId);

    // Step 2: Convert .docx to .pdf
    const pdfPath = await convertDocxToPdf(docxPath, contractId);

    // Step 3: Add Signature Overlay
    const signedPdfPath = await addSignatureOverlay(pdfPath, data, contractId);

    // Step 4: Upload to Supabase Storage
    const signedUrl = await uploadToSupabaseStorage(signedPdfPath, contractId);

    // Step 5: Skip email sending - SignNow will handle this
    console.log('📧 Skipping email - SignNow will send signature invitation');
    const emailSent = false;

    // Return all relevant information
    const result: ProcessingResult = {
      contractId,
      docxPath,
      pdfPath,
      signedPdfPath,
      signedUrl,
      emailSent,
      success: true
    };

    console.log(`Contract processing completed successfully for contract ID: ${contractId}`);
    return result;

  } catch (error) {
    console.error('Contract processing failed:', error);
    throw error;
  }
}

/**
 * Clean up generated files
 * @param contractId - Contract identifier
 */
async function cleanupGeneratedFiles(contractId: string): Promise<void> {
  try {
    const files = [
      path.join(GENERATED_DIR, `contract-${contractId}.docx`),
      path.join(GENERATED_DIR, `contract-${contractId}.pdf`),
      path.join(GENERATED_DIR, `contract-${contractId}-signed.pdf`)
    ];

    for (const file of files) {
      if (await fs.pathExists(file)) {
        await fs.remove(file);
        console.log(`Cleaned up: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up files:', error);
  }
}

/**
 * Apply digital signature to a contract
 * @param contractId - Contract identifier
 * @param clientName - Client's name (used to generate signature)
 * @param signatureStyle - Style of signature (cursive, elegant, bold)
 * @param signatureDate - Date of signature
 * @returns Object containing signed PDF path and URL
 */
async function signContract(contractId: string, clientName: string, signatureStyle: string, signatureDate: string): Promise<any> {
  try {
    console.log(`Applying digital signature to contract: ${contractId}`);

    // Find the existing PDF file (try both signed and unsigned versions)
    let pdfPath = path.join(GENERATED_DIR, `contract-${contractId}-signed.pdf`);

    if (!await fs.pathExists(pdfPath)) {
      pdfPath = path.join(GENERATED_DIR, `contract-${contractId}.pdf`);
    }

    if (!await fs.pathExists(pdfPath)) {
      throw new Error(`Contract PDF not found. Please generate the contract first.`);
    }

    // Apply the signature
    const signedPdfPath = await applyDigitalSignature(pdfPath, clientName, signatureStyle, signatureDate, contractId);

    // Upload to Supabase
    const signedUrl = await uploadToSupabaseStorage(signedPdfPath, contractId);

    // Send admin notification email
    try {
      const emailService = new NodemailerService();
      const adminEmail = 'jerrybony5@gmail.com';

      // Admin notification email
      await emailService.sendEmail(
        adminEmail,
        `Contract Signed: ${contractId}`,
        `Contract ${contractId} has been signed by ${clientName} on ${signatureDate}`,
        `
        <h2>Contract Signed Successfully</h2>
        <p><strong>Contract ID:</strong> ${contractId}</p>
        <p><strong>Client Name:</strong> ${clientName}</p>
        <p><strong>Signature Date:</strong> ${signatureDate}</p>
        <p><strong>Signed PDF:</strong> <a href="${signedUrl}">View Contract</a></p>
        `
      );

      // Client confirmation email (sending to admin as placeholder)
      const clientEmail = adminEmail; // Placeholder - in real system, get from contract data
      const clientSubject = `Your Contract Has Been Signed - ${contractId}`;
      const clientText = `Dear ${clientName},

Your contract has been successfully signed and is now legally binding.

Contract Details:
- Contract ID: ${contractId}
- Signed by: ${clientName}
- Signed on: ${signatureDate}

You can download your signed contract using the secure link below:
${signedUrl}

This link is valid for 1 hour.

Best regards,
The Sokana Team`;

      const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #155724; margin-top: 0;">✅ Your Contract Has Been Signed!</h2>
            <p style="color: #155724;">Dear ${clientName},</p>
          </div>

          <p>Your contract has been successfully signed and is now legally binding.</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Contract Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #ddd;">
                <strong>Contract ID:</strong> ${contractId}
              </li>
              <li style="margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #ddd;">
                <strong>Signed by:</strong> ${clientName}
              </li>
              <li style="margin: 10px 0; padding: 8px 0;">
                <strong>Signed on:</strong> ${signatureDate}
              </li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${signedUrl}"
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none;
                      border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              📄 Download Your Signed Contract
            </a>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Important:</strong> This link is valid for 1 hour. Please download and save your signed contract.
            </p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #666;">
              Best regards,<br>
              <strong>The Sokana Team</strong>
            </p>
          </div>
        </div>
      `;

      await emailService.sendEmail(clientEmail, clientSubject, clientText, clientHtml);
    } catch (emailError) {
      console.warn('Email sending failed:', emailError);
    }

    return {
      contractId,
      signedPdfPath,
      signedUrl,
      clientName,
      signatureDate,
      success: true
    };
  } catch (error) {
    console.error('Error signing contract:', error);
    throw error;
  }
}

/**
 * Apply digital signature to PDF
 * @param pdfPath - Path to PDF file
 * @param clientName - Client name (used to generate signature)
 * @param signatureStyle - Style of signature (cursive, elegant, bold)
 * @param signatureDate - Signature date
 * @param contractId - Contract identifier
 * @returns Path to signed PDF file
 */
async function applyDigitalSignature(pdfPath: string, clientName: string, signatureStyle: string, signatureDate: string, contractId: string): Promise<string> {
  try {
    // Read the PDF
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get the first page
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const page = pages[0];
    const { width, height } = page.getSize();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Calculate precise signature position based on PDF dimensions
    // For a standard A4 page, the signature blocks are typically at the bottom
    const pageHeight = height;
    const pageWidth = width;

        // Position signature in the Client Signature block area
    // Client Signature block is at the very bottom of the page
    const signatureX = 50; // Left margin for Client Signature block
    const signatureY = 10; // 10 pts from the bottom (very low, should be in signature block area)

    // Log for debugging
    console.log(`PDF height: ${pageHeight}`);
    console.log(`Signature Y: ${signatureY}`);
    console.log(`Distance from bottom: ${pageHeight - signatureY} pts`);

    // Add coordinate markers to help find signature block positions
    // This will help us see exactly where the signature blocks are
    for (let y = 10; y <= 200; y += 10) {
      page.drawText(`Y=${y}`, {
        x: width - 100,
        y: y,
        size: 8,
        font: helveticaFont,
        color: rgb(1, 0, 0), // Red color for visibility
      });
    }

    // Generate signature text based on style
    let signatureFont = helveticaFont;
    let signatureSize = 16;
    let signatureColor = rgb(0, 0, 0);

    switch (signatureStyle) {
      case 'elegant':
        signatureFont = timesFont;
        signatureSize = 18;
        signatureColor = rgb(0.2, 0.2, 0.2);
        break;
      case 'bold':
        signatureFont = helveticaFont;
        signatureSize = 20;
        signatureColor = rgb(0, 0, 0);
        break;
      default: // cursive
        signatureFont = timesFont; // Use Times for better cursive look
        signatureSize = 16;
        signatureColor = rgb(0.1, 0.1, 0.1);
        break;
    }

        // Create a more signature-like appearance
    const signatureText = clientName;
    const letters = signatureText.split('');
    let currentX = signatureX;
    const letterSpacing = signatureSize * 0.5; // Even tighter spacing for signature look

        // Draw each letter with more pronounced variations to simulate handwriting
    letters.forEach((letter, index) => {
      const yOffset = Math.sin(index * 0.4) * 3; // More pronounced wave pattern
      const xOffset = Math.cos(index * 0.3) * 2; // More horizontal variation

      // Add some letters with different sizes for more natural look
      const letterSize = signatureSize + (Math.sin(index * 0.7) * 2);

      page.drawText(letter, {
        x: currentX + xOffset,
        y: signatureY + 30 + yOffset,
        size: letterSize,
        font: signatureFont,
        color: signatureColor,
      });

      currentX += letterSpacing + (Math.sin(index * 0.2) * 1); // Variable spacing
    });

    // Also add a signature in the Client Name (Printed) field
    page.drawText(clientName, {
      x: signatureX,
      y: signatureY - 20,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add the date in the Date field
    page.drawText(signatureDate, {
      x: signatureX,
      y: signatureY - 40,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Draw signature line under the signature
    page.drawLine({
      start: { x: signatureX, y: signatureY + 10 },
      end: { x: signatureX + 200, y: signatureY + 10 },
      thickness: 1,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Add verification text below the signature line
    page.drawText(`Digitally signed by ${clientName} on ${signatureDate}`, {
      x: signatureX,
      y: signatureY - 10,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Add contract ID
    page.drawText(`Contract ID: ${contractId}`, {
      x: signatureX,
      y: signatureY - 25,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join(GENERATED_DIR, `contract-${contractId}-signed.pdf`);
    await fs.writeFile(signedPdfPath, signedPdfBytes);

    console.log(`Signed PDF generated: ${signedPdfPath}`);
    return signedPdfPath;
  } catch (error) {
    console.error('Error applying digital signature:', error);
    throw error;
  }
}

export {
    addSignatureOverlay, applyDigitalSignature, cleanupGeneratedFiles, convertDocxToPdf, generateContractDocx, processAndUploadContract, sendContractEmail, signContract, uploadToSupabaseStorage
};
