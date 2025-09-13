const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const supabase = require('../supabase').default;
const { NodemailerService } = require('../services/emailService');

/**
 * Contract Processor Module
 * Handles contract generation, PDF conversion, signature overlay, and storage upload
 */

// Ensure directories exist
const TEMPLATE_DIR = './templates';
const GENERATED_DIR = './generated';

/**
 * Generate a contract document from template
 * @param {Object} contractData - Contract data with placeholders
 * @param {string} contractId - Unique contract identifier
 * @returns {Promise<string>} Path to generated .docx file
 */
async function generateContractDocx(contractData, contractId) {
  try {
    // Ensure directories exist
    await fs.ensureDir(TEMPLATE_DIR);
    await fs.ensureDir(GENERATED_DIR);

    const templatePath = '/Users/jerrybony/Documents/GitHub/backend/generated/Agreement for Postpartum Doula Services (2).docx';
    const outputPath = path.join(GENERATED_DIR, `contract-${contractId}.docx`);

    // Check if template exists
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template not found at ${templatePath}`);
    }

    // Read template file
    const content = await fs.readFile(templatePath);
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

    doc.setData({
      // Basic contract info
      clientName: contractData.clientName || 'Sarah Johnson',
      partnerName: contractData.partnerName || 'Michael Johnson',
      dueDate: dueDate,
      contractDate: contractDate,
      startDate: startDate,
      endDate: endDate,

      // Provider info
      providerName: contractData.providerName || 'Sokana Collective',
      providerAddress: contractData.providerAddress || '[Provider Address]',
      providerPhone: contractData.providerPhone || '[Provider Phone]',
      providerEmail: contractData.providerEmail || '[Provider Email]',

      // Client contact info
      clientPhone: contractData.clientPhone || '(555) 123-4567',
      clientEmail: contractData.clientEmail || 'jerry@techluminateacademy.com',

      // Service details
      serviceType: contractData.serviceType || 'Labor Support Doula Services',
      servicePackage: contractData.servicePackage || 'Complete Labor Support Package',
      totalInvestment: contractData.totalInvestment || '$1,200.00',
      paymentTerms: contractData.paymentTerms || '50% deposit, balance due 2 weeks before due date',

      // Payment breakdown
      depositAmount: contractData.depositAmount || '$600.00',
      remainingBalance: contractData.remainingBalance || '$600.00',
      depositDueDate: contractData.depositDueDate || 'Upon signing',
      balanceDueDate: contractData.balanceDueDate || '2024-03-01',

      // Contract ID
      contractId: contractId,

      // Additional data from contractData
      ...contractData
    });

    // Render the document
    doc.render();

    // Generate output
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    await fs.writeFile(outputPath, buffer);

    console.log(`Contract document generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating contract document:', error);
    throw error;
  }
}

/**
 * Convert .docx to .pdf using LibreOffice
 * @param {string} docxPath - Path to the .docx file
 * @param {string} contractId - Contract identifier
 * @returns {Promise<string>} Path to generated .pdf file
 */
async function convertDocxToPdf(docxPath, contractId) {
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
 * Add signature field to PDF for user to fill out
 * @param {string} pdfPath - Path to the PDF file
 * @param {Object} contractData - Contract data containing signature info
 * @param {string} contractId - Contract identifier
 * @returns {Promise<string>} Path to PDF with signature field
 */
async function addSignatureField(pdfPath, contractData, contractId) {
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

    // Create signature field area
    const signatureField = {
      x: 100,
      y: 150,
      width: 200,
      height: 50
    };

    // Draw signature field border
    page.drawRectangle({
      x: signatureField.x,
      y: signatureField.y,
      width: signatureField.width,
      height: signatureField.height,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0),
      color: rgb(1, 1, 1), // White background
    });

    // Add signature field label
    page.drawText('Digital Signature:', {
      x: signatureField.x,
      y: signatureField.y + signatureField.height + 10,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    // Add instructions
    page.drawText('Click here to sign electronically', {
      x: signatureField.x + 5,
      y: signatureField.y + 25,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Add date field
    const dateField = {
      x: signatureField.x + signatureField.width + 20,
      y: signatureField.y,
      width: 150,
      height: 50
    };

    page.drawRectangle({
      x: dateField.x,
      y: dateField.y,
      width: dateField.width,
      height: dateField.height,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0),
      color: rgb(1, 1, 1),
    });

    page.drawText('Date:', {
      x: dateField.x,
      y: dateField.y + dateField.height + 10,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText('Click to add date', {
      x: dateField.x + 5,
      y: dateField.y + 25,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Save the modified PDF
    const signatureFieldPdfBytes = await pdfDoc.save();
    const signatureFieldPdfPath = path.join(GENERATED_DIR, `contract-${contractId}-with-signature-field.pdf`);
    await fs.writeFile(signatureFieldPdfPath, signatureFieldPdfBytes);

    console.log(`PDF with signature field generated: ${signatureFieldPdfPath}`);
    return signatureFieldPdfPath;
  } catch (error) {
    console.error('Error adding signature field:', error);
    throw error;
  }
}

/**
 * Add signature overlay to PDF
 * @param {string} pdfPath - Path to the PDF file
 * @param {Object} contractData - Contract data containing signature info
 * @param {string} contractId - Contract identifier
 * @returns {Promise<string>} Path to signed PDF file
 */
async function addSignatureOverlay(pdfPath, contractData, contractId) {
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
 * Apply digital signature to PDF using form fields
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} clientName - Client name
 * @param {string} signatureStyle - Style of signature (cursive, elegant, bold)
 * @param {string} signatureDate - Date of signature
 * @param {string} contractId - Contract identifier
 * @returns {Promise<string>} Path to signed PDF file
 */
async function applyDigitalSignature(pdfPath, clientName, signatureStyle, signatureDate, contractId) {
  try {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }
    const page = pages[0];
    const { width, height } = page.getSize();

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

    page.drawText(`Contract ID: ${contractId}`, {
      x: signatureX,
      y: signatureY - 25,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const signedPdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join(GENERATED_DIR, `contract-${contractId}-digitally-signed.pdf`);
    await fs.writeFile(signedPdfPath, signedPdfBytes);

    console.log(`Digitally signed PDF generated: ${signedPdfPath}`);
    return signedPdfPath;
  } catch (error) {
    console.error('Error applying digital signature:', error);
    throw error;
  }
}

/**
 * Complete contract signing process
 * @param {string} contractId - Contract identifier
 * @param {string} signatureName - Name of the signature file
 * @param {string} clientName - Client name
 * @param {string} signatureDate - Date of signature
 * @returns {Promise<Object>} Result object with signed contract details
 */
async function signContract(contractId, clientName, signatureStyle, signatureDate) {
  try {
    console.log(`Starting contract signing process for contract ID: ${contractId}`);

    // Find the original PDF (try both signed and unsigned versions)
    let pdfPath = path.join(GENERATED_DIR, `contract-${contractId}-signed.pdf`);

    if (!await fs.pathExists(pdfPath)) {
      pdfPath = path.join(GENERATED_DIR, `contract-${contractId}.pdf`);
    }

    if (!await fs.pathExists(pdfPath)) {
      throw new Error(`Contract PDF not found. Please generate the contract first.`);
    }

    // Apply digital signature
    const signedPdfPath = await applyDigitalSignature(
      pdfPath,
      clientName,
      signatureStyle,
      signatureDate,
      contractId
    );

    // Upload signed contract to Supabase
    const signedUrl = await uploadToSupabaseStorage(signedPdfPath, `${contractId}-signed`);

    // Send confirmation email
    const emailService = new NodemailerService();
    const subject = `Contract Signed - ${contractId}`;
    const text = `Dear ${clientName},

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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #155724; margin-top: 0;">✅ Contract Successfully Signed!</h2>
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
            📄 Download Signed Contract
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

    // Send admin notification email
    const adminEmail = 'jerrybony5@gmail.com';
    await emailService.sendEmail(adminEmail, subject, text, html);

    // Send client confirmation email (if client email is available)
    // For now, we'll send to the admin email as a placeholder
    // In a real system, you'd get the client email from the contract data
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

    const result = {
      contractId,
      signedPdfPath,
      signedUrl,
      clientName,
      signatureDate,
      success: true
    };

    console.log(`Contract signing completed successfully for contract ID: ${contractId}`);
    return result;

  } catch (error) {
    console.error('Contract signing failed:', error);
    throw error;
  }
}

/**
 * Upload PDF to Supabase Storage
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} contractId - Contract identifier
 * @returns {Promise<string>} Signed URL for the uploaded file
 */
async function uploadToSupabaseStorage(pdfPath, contractId) {
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
 * Main function to process and upload contract
 * @param {Object} contractData - Contract data object
 * @param {string} contractData.clientName - Client name
 * @param {string} contractData.serviceName - Service name
 * @param {string} contractData.price - Service price
 * @param {string} contractData.date - Contract date
 * @param {string} contractData.contractId - Contract identifier
 * @param {string} contractData.clientEmail - Client email address (optional)
 * @returns {Promise<Object>} Object containing file paths and signed URL
 */
async function processAndUploadContract(contractData) {
  try {
    const { contractId, ...data } = contractData;

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

    // Step 5: Send email if client email is provided
    if (contractData.clientEmail) {
      try {
        await sendContractEmail(contractData.clientEmail, data, signedUrl, contractId);
      } catch (emailError) {
        console.warn('Email sending failed, but contract processing completed:', emailError.message);
      }
    }

    // Return all relevant information
    const result = {
      contractId,
      docxPath,
      pdfPath,
      signedPdfPath,
      signedUrl,
      emailSent: !!contractData.clientEmail,
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
 * Send contract email with secure link
 * @param {string} to - Recipient email address
 * @param {Object} contractData - Contract data
 * @param {string} signedUrl - Secure signed URL for the contract
 * @param {string} contractId - Contract identifier
 * @returns {Promise<void>}
 */
async function sendContractEmail(to, contractData, signedUrl, contractId) {
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
 * Clean up generated files
 * @param {string} contractId - Contract identifier
 */
async function cleanupGeneratedFiles(contractId) {
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
 * Debug function to detect signature block coordinates
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<Object>} Coordinates of signature blocks
 */
async function detectSignatureCoordinates(pdfPath) {
  try {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    console.log(`PDF Dimensions: ${width} x ${height}`);
    console.log(`A4 standard: 595 x 842 points`);

    // Common signature block positions (from bottom of page)
    const signaturePositions = {
      clientSignature: { y: 80, label: "Client Signature" },
      clientName: { y: 60, label: "Client Name (Printed)" },
      clientDate: { y: 40, label: "Client Date" },
      partnerSignature: { y: 120, label: "Partner Signature" },
      partnerName: { y: 100, label: "Partner Name" },
      partnerDate: { y: 80, label: "Partner Date" },
      doulaSignature: { y: 160, label: "Doula Signature" },
      doulaName: { y: 140, label: "Doula Name" },
      doulaDate: { y: 120, label: "Doula Date" }
    };

    console.log("Suggested signature block coordinates:");
    Object.entries(signaturePositions).forEach(([key, pos]) => {
      console.log(`${pos.label}: Y = ${pos.y} (${height - pos.y} pts from bottom)`);
    });

    return {
      pageWidth: width,
      pageHeight: height,
      signaturePositions
    };
  } catch (error) {
    console.error('Error detecting coordinates:', error);
    throw error;
  }
}

module.exports = {
  processAndUploadContract,
  generateContractDocx,
  convertDocxToPdf,
  addSignatureOverlay,
  addSignatureField,
  applyDigitalSignature,
  detectSignatureCoordinates,
  signContract,
  uploadToSupabaseStorage,
  sendContractEmail,
  cleanupGeneratedFiles
};
