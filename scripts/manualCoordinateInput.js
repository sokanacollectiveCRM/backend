// Manual Coordinate Input Tool
// This script helps you input coordinates manually and test them
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

async function manualCoordinateInput() {
  try {
    console.log('🎯 Manual Coordinate Input Tool\n');
    console.log(
      'This tool helps you input coordinates manually and test them.\n'
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

    // 2️⃣ Manual coordinate input
    const coordinates = {};

    console.log(
      "🎯 Let's input coordinates manually. You can estimate based on the PDF layout.\n"
    );

    // Predefined coordinate sets to try
    const coordinateSets = [
      {
        name: 'Set 1 - Top Left',
        coords: {
          clientName: { x: 150, y: 650, page: 1 },
          totalAmount: { x: 200, y: 520, page: 1 },
          deposit: { x: 200, y: 500, page: 1 },
          balanceAmount: { x: 200, y: 480, page: 1 },
        },
      },
      {
        name: 'Set 2 - Center',
        coords: {
          clientName: { x: 300, y: 650, page: 1 },
          totalAmount: { x: 400, y: 580, page: 1 },
          deposit: { x: 400, y: 560, page: 1 },
          balanceAmount: { x: 400, y: 540, page: 1 },
        },
      },
      {
        name: 'Set 3 - Right Side',
        coords: {
          clientName: { x: 450, y: 650, page: 1 },
          totalAmount: { x: 500, y: 580, page: 1 },
          deposit: { x: 500, y: 560, page: 1 },
          balanceAmount: { x: 500, y: 540, page: 1 },
        },
      },
    ];

    console.log('Available coordinate sets to try:');
    coordinateSets.forEach((set, index) => {
      console.log(`${index + 1}. ${set.name}`);
    });

    const choice = await question(
      '\nChoose a coordinate set (1-3) or enter "custom" for manual input: '
    );

    if (choice === 'custom') {
      // Manual input
      while (true) {
        const fieldName = await question(
          'Enter field name (or "done" to finish): '
        );

        if (fieldName.toLowerCase() === 'done') {
          break;
        }

        const xStr = await question('Enter X coordinate: ');
        const x = parseInt(xStr);

        const yStr = await question('Enter Y coordinate: ');
        const y = parseInt(yStr);

        const pageNum = await question('Enter page number (1-based): ');
        const page = parseInt(pageNum);

        coordinates[fieldName] = { x, y, page };
        console.log(`✅ Added ${fieldName}: (${x}, ${y}) on page ${page}\n`);
      }
    } else {
      const setIndex = parseInt(choice) - 1;
      if (setIndex >= 0 && setIndex < coordinateSets.length) {
        Object.assign(coordinates, coordinateSets[setIndex].coords);
        console.log(`✅ Using ${coordinateSets[setIndex].name}`);
      } else {
        console.log('❌ Invalid choice, using Set 1');
        Object.assign(coordinates, coordinateSets[0].coords);
      }
    }

    // 3️⃣ Test the coordinates
    console.log('\n🧪 Testing coordinates...');
    await testCoordinates(coordinates, pdfBuffer);

    // 4️⃣ Export coordinates
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

      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, json);

      console.log('\n📋 Coordinate Input Complete!');
      console.log(`📄 Exported to: ${outputPath}`);
      console.log('\n📊 Mapped Coordinates:');
      console.log(JSON.stringify(coordinates, null, 2));
      console.log('\n💡 You can copy this into your pdfCoordinates.json file');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

async function testCoordinates(coordinates, pdfBuffer) {
  try {
    const testPdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await testPdfDoc.embedFont(StandardFonts.Helvetica);

    // Test data
    const testData = {
      clientName: 'John Doe',
      totalAmount: '2400.00',
      deposit: '400.00',
      balanceAmount: '2000.00',
      clientInitials: 'JD',
      client_signed_date: new Date().toLocaleDateString(),
    };

    let fieldsFilled = 0;
    for (const [field, pos] of Object.entries(coordinates)) {
      const value = testData[field];
      if (value && pos.page <= testPdfDoc.getPageCount()) {
        try {
          const page = testPdfDoc.getPage(pos.page - 1);

          // Draw a rectangle to show the field area
          page.drawRectangle({
            x: pos.x - 5,
            y: pos.y - 5,
            width: 100,
            height: 20,
            borderWidth: 2,
            borderColor: rgb(1, 0, 0),
            opacity: 0.5,
          });

          // Draw the text
          page.drawText(String(value), {
            x: pos.x,
            y: pos.y,
            size: 11,
            font: font,
            color: rgb(0, 0, 0),
          });

          fieldsFilled++;
          console.log(
            `  ✅ Filled ${field}: "${value}" at (${pos.x}, ${pos.y})`
          );
        } catch (fieldError) {
          console.warn(`  ⚠️ Failed to fill ${field}:`, fieldError.message);
        }
      }
    }

    // Save test PDF
    const timestamp = Date.now();
    const outputPath = path.join(
      process.cwd(),
      'generated',
      `coordinate-test-manual-${timestamp}.pdf`
    );

    const pdfBytes = await testPdfDoc.save();
    await fs.promises.writeFile(outputPath, pdfBytes);

    console.log(`\n📄 Test PDF saved: ${outputPath}`);
    console.log(`📊 Filled ${fieldsFilled} fields`);
    console.log('💡 Open this PDF to see if the coordinates are correct');
  } catch (error) {
    console.error('❌ Error testing coordinates:', error);
  }
}

// Run the manual coordinate input
manualCoordinateInput().catch(console.error);





