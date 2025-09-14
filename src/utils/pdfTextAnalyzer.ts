import fs from 'fs-extra';

const pdf2json = require('pdf2json');

export interface TextPosition {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/**
 * Parse PDF and find text positions using pdf2json
 * @param pdfPath - Path to PDF file
 * @returns Promise with text positions
 */
export async function analyzePdfTextPositions(pdfPath: string): Promise<TextPosition[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new pdf2json();

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('PDF parsing error:', errData.parserError);
      reject(new Error(`PDF parsing failed: ${errData.parserError}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        const textPositions: TextPosition[] = [];

        // Process each page
        pdfData.Pages.forEach((page: any, pageIndex: number) => {
          // Process text elements
          if (page.Texts) {
            page.Texts.forEach((textItem: any) => {
              const text = decodeURIComponent(textItem.R[0].T);

              // Convert PDF coordinates to points
              // pdf2json uses different coordinate system, needs conversion
              const x = textItem.x * 72 / 96; // Convert to points
              const y = textItem.y * 72 / 96; // Convert to points
              const width = textItem.w * 72 / 96;
              const height = textItem.h * 72 / 96;

              textPositions.push({
                text,
                x,
                y,
                width,
                height,
                page: pageIndex
              });
            });
          }
        });

        console.log(`📋 Found ${textPositions.length} text elements in PDF`);
        resolve(textPositions);
      } catch (error) {
        reject(error);
      }
    });

    // Load and parse the PDF
    pdfParser.loadPDF(pdfPath);
  });
}

/**
 * Find the position where "Client Signature:" text appears
 * @param textPositions - Array of text positions from PDF analysis
 * @returns Position for signature field placement
 */
export function findClientSignaturePosition(textPositions: TextPosition[]): SignaturePosition | null {
  // Look for "Client Signature:" or similar text
  const signatureText = textPositions.find(pos =>
    pos.text.toLowerCase().includes('client signature') ||
    pos.text.toLowerCase().includes('signature:')
  );

  if (signatureText) {
    console.log(`📍 Found signature text at: x=${signatureText.x}, y=${signatureText.y}`);

    // Position signature field to the right of the "Client Signature:" text
    return {
      x: signatureText.x + signatureText.width + 10, // 10 points offset
      y: signatureText.y,
      width: 200,
      height: 30,
      page: signatureText.page
    };
  }

  // Fallback: look for any text containing "Jerry Bony" near signature area
  const nameText = textPositions.find(pos =>
    pos.text.includes('Jerry Bony') && pos.y > 300 // Lower half of page
  );

  if (nameText) {
    console.log(`📍 Found name text at: x=${nameText.x}, y=${nameText.y}`);
    return {
      x: nameText.x,
      y: nameText.y,
      width: 200,
      height: 30,
      page: nameText.page
    };
  }

  console.warn('⚠️ Could not find signature position in PDF');
  return null;
}

/**
 * Analyze PDF and determine signature field position
 * @param pdfPath - Path to generated PDF
 * @returns Signature position for SignNow
 */
export async function getSignatureFieldPosition(pdfPath: string): Promise<SignaturePosition | null> {
  try {
    console.log(`🔍 Analyzing PDF for signature position: ${pdfPath}`);

    if (!await fs.pathExists(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    const textPositions = await analyzePdfTextPositions(pdfPath);
    const signaturePosition = findClientSignaturePosition(textPositions);

    if (signaturePosition) {
      console.log(`✅ Signature position detected:`, signaturePosition);
    } else {
      console.warn('⚠️ Using fallback signature position');
    }

    return signaturePosition;
  } catch (error) {
    console.error('❌ PDF analysis failed:', error);
    return null;
  }
}

/**
 * Debug function to log all text positions in PDF
 * @param pdfPath - Path to PDF file
 */
export async function debugPdfTextPositions(pdfPath: string): Promise<void> {
  try {
    const textPositions = await analyzePdfTextPositions(pdfPath);

    console.log('📋 All text positions in PDF:');
    textPositions.forEach((pos, index) => {
      console.log(`${index + 1}. "${pos.text}" at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) page ${pos.page}`);
    });
  } catch (error) {
    console.error('❌ Debug analysis failed:', error);
  }
}
