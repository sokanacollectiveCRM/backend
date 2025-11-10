// Simple Coordinate Picker for PDF Templates
// This script helps you pick exact coordinates by showing the PDF and letting you input coordinates
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function coordinatePicker() {
  try {
    console.log('🎯 PDF Coordinate Picker\n');
    console.log(
      'This tool helps you pick exact coordinates for PDF field placement.\n'
    );

    // 1️⃣ Download the PDF template
    console.log('📥 Downloading Labor Support Agreement template...');
    const templateName = 'Labor Support Agreement for Service.docx.pdf';

    const { data: file, error } = await supabase.storage
      .from('contract-templates')
      .download(templateName);

    if (error || !file) {
      throw new Error(`Template not found: ${error?.message}`);
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const numPages = pdfDoc.getPageCount();

    console.log(`✅ Template downloaded successfully (${numPages} pages)`);
    console.log('\n📋 Available fields to map:');
    console.log('  - clientName');
    console.log('  - totalAmount');
    console.log('  - deposit');
    console.log('  - balanceAmount');
    console.log('  - clientInitials');
    console.log('  - client_signature');
    console.log('  - client_signed_date\n');

    // 2️⃣ Interactive coordinate picking
    const coordinates = {};

    while (true) {
      const fieldName = await question(
        'Enter field name (or "done" to finish): '
      );

      if (fieldName.toLowerCase() === 'done') {
        break;
      }

      if (!fieldName) {
        console.log('❌ Please enter a field name');
        continue;
      }

      const pageNum = await question('Enter page number (1-based): ');
      const page = parseInt(pageNum);

      if (isNaN(page) || page < 1 || page > numPages) {
        console.log(
          `❌ Invalid page number. Must be between 1 and ${numPages}`
        );
        continue;
      }

      const xStr = await question('Enter X coordinate: ');
      const x = parseInt(xStr);

      if (isNaN(x)) {
        console.log('❌ Invalid X coordinate');
        continue;
      }

      const yStr = await question('Enter Y coordinate: ');
      const y = parseInt(yStr);

      if (isNaN(y)) {
        console.log('❌ Invalid Y coordinate');
        continue;
      }

      coordinates[fieldName] = { x, y, page };
      console.log(`✅ Added ${fieldName}: (${x}, ${y}) on page ${page}`);
      console.log('');

      // Ask if they want to test this coordinate
      const test = await question('Test this coordinate? (y/n): ');
      if (test.toLowerCase() === 'y') {
        await testCoordinate(fieldName, x, y, page, pdfBuffer);
      }
    }

    // 3️⃣ Export coordinates
    if (Object.keys(coordinates).length > 0) {
      const exportData = {
        labor_support_v1: coordinates,
      };

      const json = JSON.stringify(exportData, null, 2);
      const outputPath = path.join(
        process.cwd(),
        'generated',
        `pdfCoordinates-${Date.now()}.json`
      );

      // Ensure generated directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

      await fs.promises.writeFile(outputPath, json);

      console.log('📋 Coordinate Picking Complete!');
      console.log(`📄 Exported to: ${outputPath}`);
      console.log('\n📊 Mapped Coordinates:');
      console.log(JSON.stringify(coordinates, null, 2));
      console.log('\n💡 You can copy this into your pdfCoordinates.json file');
    } else {
      console.log('❌ No coordinates were picked');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

async function testCoordinate(fieldName, x, y, page, pdfBuffer) {
  try {
    console.log(`\n🧪 Testing coordinate for ${fieldName}...`);

    const testPdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await testPdfDoc.embedFont(StandardFonts.Helvetica);

    const testPage = testPdfDoc.getPage(page - 1);

    // Draw a rectangle to show the field area
    testPage.drawRectangle({
      x: x - 5,
      y: y - 5,
      width: 100,
      height: 20,
      borderWidth: 2,
      borderColor: rgb(1, 0, 0),
      opacity: 0.5,
    });

    // Draw test text
    testPage.drawText(`TEST: ${fieldName}`, {
      x: x,
      y: y,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Save test PDF
    const timestamp = Date.now();
    const outputPath = path.join(
      process.cwd(),
      'generated',
      `coordinate-test-${fieldName}-${timestamp}.pdf`
    );

    const pdfBytes = await testPdfDoc.save();
    await fs.promises.writeFile(outputPath, pdfBytes);

    console.log(`📄 Test PDF saved: ${outputPath}`);
    console.log('💡 Open this PDF to see if the coordinate is correct');
  } catch (error) {
    console.error('❌ Error testing coordinate:', error);
  }
}

// Run the coordinate picker
coordinatePicker().catch(console.error);





