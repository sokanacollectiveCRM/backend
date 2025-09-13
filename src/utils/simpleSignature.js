const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');

/**
 * Simple Signature Processor
 * Uses a different approach to position signatures
 */

async function simpleApplySignature(pdfPath, clientName, signatureStyle, signatureDate, contractId) {
  try {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Use a different approach: position from top instead of bottom
    const signatureY = height - 150; // 150 points from top
    const signatureX = 50;

    console.log(`PDF dimensions: ${width} x ${height}`);
    console.log(`Signature position: (${signatureX}, ${signatureY})`);

    // Draw signature line first
    page.drawLine({
      start: { x: signatureX, y: signatureY + 20 },
      end: { x: signatureX + 200, y: signatureY + 20 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Draw signature
    page.drawText(clientName, {
      x: signatureX,
      y: signatureY + 25,
      size: 16,
      font: timesFont,
      color: rgb(0, 0, 0),
    });

    // Draw "Client Signature" label
    page.drawText("Client Signature:", {
      x: signatureX,
      y: signatureY + 5,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Draw name field
    page.drawText("Client Name (Printed):", {
      x: signatureX,
      y: signatureY - 20,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(clientName, {
      x: signatureX,
      y: signatureY - 35,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Draw date field
    page.drawText("Date:", {
      x: signatureX,
      y: signatureY - 50,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(signatureDate, {
      x: signatureX,
      y: signatureY - 65,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add verification text
    page.drawText(`Digitally signed by ${clientName} on ${signatureDate}`, {
      x: signatureX,
      y: signatureY - 85,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Contract ID: ${contractId}`, {
      x: signatureX,
      y: signatureY - 100,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const signedPdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join('./generated', `contract-${contractId}-simple-signed.pdf`);
    await fs.writeFile(signedPdfPath, signedPdfBytes);

    console.log(`Simple signature applied: ${signedPdfPath}`);
    return signedPdfPath;
  } catch (error) {
    console.error('Error applying simple signature:', error);
    throw error;
  }
}

module.exports = {
  simpleApplySignature
};
