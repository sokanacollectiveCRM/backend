// Test All Coordinate Sets
// This script tests different coordinate sets and generates test PDFs for comparison
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testAllCoordinateSets() {
  try {
    console.log('🎯 Testing All Coordinate Sets\n');

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

    // 2️⃣ Define coordinate sets to test
    const coordinateSets = [
      {
        name: 'Top Left',
        coords: {
          clientName: { x: 150, y: 650, page: 1 },
          totalAmount: { x: 200, y: 520, page: 1 },
          deposit: { x: 200, y: 500, page: 1 },
          balanceAmount: { x: 200, y: 480, page: 1 },
        },
      },
      {
        name: 'Center',
        coords: {
          clientName: { x: 300, y: 650, page: 1 },
          totalAmount: { x: 400, y: 580, page: 1 },
          deposit: { x: 400, y: 560, page: 1 },
          balanceAmount: { x: 400, y: 540, page: 1 },
        },
      },
      {
        name: 'Right Side',
        coords: {
          clientName: { x: 450, y: 650, page: 1 },
          totalAmount: { x: 500, y: 580, page: 1 },
          deposit: { x: 500, y: 560, page: 1 },
          balanceAmount: { x: 500, y: 540, page: 1 },
        },
      },
      {
        name: 'Lower Left',
        coords: {
          clientName: { x: 100, y: 600, page: 1 },
          totalAmount: { x: 150, y: 450, page: 1 },
          deposit: { x: 150, y: 430, page: 1 },
          balanceAmount: { x: 150, y: 410, page: 1 },
        },
      },
      {
        name: 'Lower Center',
        coords: {
          clientName: { x: 250, y: 600, page: 1 },
          totalAmount: { x: 300, y: 450, page: 1 },
          deposit: { x: 300, y: 430, page: 1 },
          balanceAmount: { x: 300, y: 410, page: 1 },
        },
      },
    ];

    // 3️⃣ Test each coordinate set
    const testData = {
      clientName: 'John Doe',
      totalAmount: '2400.00',
      deposit: '400.00',
      balanceAmount: '2000.00',
    };

    for (const [index, set] of coordinateSets.entries()) {
      console.log(`\n🎯 Testing ${set.name} coordinates...`);

      const testPdfDoc = await PDFDocument.load(pdfBuffer);
      const font = await testPdfDoc.embedFont(StandardFonts.Helvetica);

      let fieldsFilled = 0;
      for (const [field, pos] of Object.entries(set.coords)) {
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
        `coordinate-test-${set.name.toLowerCase().replace(' ', '-')}-${timestamp}.pdf`
      );

      const pdfBytes = await testPdfDoc.save();
      await fs.promises.writeFile(outputPath, pdfBytes);

      console.log(`  📄 Test PDF saved: ${outputPath}`);
      console.log(`  📊 Filled ${fieldsFilled} fields`);
    }

    // 4️⃣ Export all coordinate sets
    const exportData = {
      labor_support_v1: coordinateSets[0].coords, // Use first set as default
    };

    const json = JSON.stringify(exportData, null, 2);
    const outputPath = path.join(
      process.cwd(),
      'generated',
      `pdfCoordinates-all-sets-${Date.now()}.json`
    );

    await fs.promises.writeFile(outputPath, json);

    console.log('\n🎉 All Coordinate Sets Tested!');
    console.log(`📄 Coordinate file saved: ${outputPath}`);
    console.log('\n📋 Next Steps:');
    console.log(
      '1. Open the generated test PDFs to see which coordinate set looks best'
    );
    console.log(
      '2. Choose the coordinate set that places fields in the correct positions'
    );
    console.log(
      '3. Update your pdfCoordinates.json file with the best coordinates'
    );
    console.log('\n📊 Generated Test PDFs:');
    coordinateSets.forEach((set, index) => {
      console.log(
        `  ${index + 1}. ${set.name} - coordinate-test-${set.name.toLowerCase().replace(' ', '-')}-*.pdf`
      );
    });
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
testAllCoordinateSets().catch(console.error);






