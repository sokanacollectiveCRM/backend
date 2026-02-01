const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');
const { GENERATED_DIR, ensureDir } = require('./runtimePaths');

/**
 * Smart Signature Processor
 * Uses multiple methods to find and position signatures correctly
 */

async function smartApplySignature(pdfPath, clientName, signatureStyle, signatureDate, contractId) {
  try {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Method 1: Try to find signature blocks by looking for common patterns
    const signaturePositions = findSignatureBlocks(page, width, height);

    // Method 2: Use predefined positions based on common contract layouts
    const fallbackPositions = {
      clientSignature: { x: 50, y: 100 },
      clientName: { x: 50, y: 80 },
      clientDate: { x: 50, y: 60 }
    };

    // Use found positions or fallback
    const positions = signaturePositions.clientSignature ? signaturePositions : fallbackPositions;

    // Apply signature with proper styling
    const signatureText = generateStyledSignature(clientName, signatureStyle);

    // Draw signature in the correct position
    page.drawText(signatureText, {
      x: positions.clientSignature.x,
      y: positions.clientSignature.y,
      size: 16,
      font: timesFont,
      color: rgb(0, 0, 0),
    });

    // Add name and date
    page.drawText(clientName, {
      x: positions.clientName.x,
      y: positions.clientName.y,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(signatureDate, {
      x: positions.clientDate.x,
      y: positions.clientDate.y,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add verification text
    page.drawText(`Digitally signed by ${clientName} on ${signatureDate}`, {
      x: 50,
      y: 40,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Contract ID: ${contractId}`, {
      x: 50,
      y: 25,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const signedPdfBytes = await pdfDoc.save();
    ensureDir(GENERATED_DIR);
    const signedPdfPath = path.join(GENERATED_DIR, `contract-${contractId}-smart-signed.pdf`);
    await fs.writeFile(signedPdfPath, signedPdfBytes);

    console.log(`Smart signature applied: ${signedPdfPath}`);
    return signedPdfPath;
  } catch (error) {
    console.error('Error applying smart signature:', error);
    throw error;
  }
}

function findSignatureBlocks(page, width, height) {
  // This would ideally use PDF text extraction to find signature blocks
  // For now, return null to use fallback positions
  return null;
}

function generateStyledSignature(name, style) {
  // Generate a styled signature based on the style parameter
  switch (style) {
    case 'cursive':
      return name.split('').map((letter, index) => {
        const offset = Math.sin(index * 0.3) * 2;
        return letter + (offset > 0 ? ' ' : '');
      }).join('');
    case 'elegant':
      return name.toUpperCase();
    case 'bold':
      return name;
    default:
      return name;
  }
}

module.exports = {
  smartApplySignature
};
