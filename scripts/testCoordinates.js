// Cursor Prompt (run in backend folder as scripts/testCoordinates.js)
// Purpose: Visually verify SignNow field coordinates using pdf-lib overlays.
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCoordinates(
  templateName = 'Labor Support Agreement for Service.docx'
) {
  try {
    // First, let's see what templates are available
    console.log('📋 Listing available templates...');
    const { data: files, error: listError } = await supabase.storage
      .from('contract-templates')
      .list();

    if (listError) {
      console.error('Error listing files:', listError);
    } else {
      console.log(
        'Available templates:',
        files?.map((f) => f.name) || 'No files found'
      );
    }

    console.log(`📥 Downloading ${templateName} from Supabase...`);
    const { data, error } = await supabase.storage
      .from('contract-templates')
      .download(templateName);
    if (error || !data)
      throw new Error(`Template not found: ${JSON.stringify(error)}`);

    const buffer = Buffer.from(await data.arrayBuffer());

    // Save the downloaded file temporarily
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    const tempDocxPath = path.join(tempDir, templateName);
    await fs.promises.writeFile(tempDocxPath, buffer);

    // Convert DOCX to PDF using LibreOffice
    console.log('🔄 Converting DOCX to PDF...');
    const pdfPath = tempDocxPath.replace('.docx', '.pdf');
    const convertCommand = `soffice --headless --convert-to pdf "${tempDocxPath}" --outdir "${tempDir}"`;

    try {
      await execAsync(convertCommand);
      console.log('✅ PDF conversion completed');
    } catch (convertError) {
      console.error('❌ PDF conversion failed:', convertError.message);
      throw new Error(`PDF conversion failed: ${convertError.message}`);
    }

    // Load the converted PDF
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const fields = [
      {
        label: 'Client Signature',
        x: 380,
        y: 223,
        page: 3,
        width: 200,
        height: 50,
        color: rgb(1, 0, 0),
      },
      {
        label: 'Client Date',
        x: 128,
        y: 274,
        page: 3,
        width: 120,
        height: 30,
        color: rgb(0, 0, 1),
      },
      {
        label: 'Initials',
        x: 253,
        y: 421,
        page: 3,
        width: 80,
        height: 30,
        color: rgb(0, 1, 0),
      },
    ];

    for (const field of fields) {
      const page = pdfDoc.getPage(field.page - 1);
      page.drawRectangle({
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        borderWidth: 2,
        borderColor: field.color,
        opacity: 0.6,
      });

      page.drawText(field.label, {
        x: field.x,
        y: field.y + field.height + 5,
        size: 10,
        color: field.color,
      });
    }

    const annotatedPdf = await pdfDoc.save();
    const outputPath = path.join(process.cwd(), `annotated-${Date.now()}.pdf`);
    await fs.promises.writeFile(outputPath, annotatedPdf);

    console.log(`✅ Annotated PDF saved to: ${outputPath}`);
    console.log('📊 Open it to verify field alignment visually.');

    // Clean up temporary files
    try {
      await fs.promises.unlink(tempDocxPath);
      await fs.promises.unlink(pdfPath);
      console.log('🧹 Cleaned up temporary files');
    } catch (cleanupError) {
      console.warn(
        '⚠️ Failed to clean up temporary files:',
        cleanupError.message
      );
    }
  } catch (err) {
    console.error('❌ Coordinate test failed:', err);
  }
}

testCoordinates();
