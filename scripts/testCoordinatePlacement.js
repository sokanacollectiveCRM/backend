// Test Coordinate Placement Script
// This script helps you test and visualize coordinate placement on PDFs

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testCoordinatePlacement() {
  try {
    console.log('🧪 Testing Coordinate Placement on PDF Templates...\n');

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
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    console.log('✅ Template downloaded successfully');

    // 2️⃣ Load current coordinates
    const coordinatesPath = path.join(process.cwd(), 'src/config/pdfCoordinates.json');
    const coordinates = JSON.parse(fs.readFileSync(coordinatesPath, 'utf8'));
    const coords = coordinates.labor_support_v1;

    if (!coords) {
      throw new Error('No coordinate map found for labor_support_v1');
    }

    console.log('✅ Coordinate map loaded');

    // 3️⃣ Test different coordinate sets
    const testCoordinates = [
      // Original coordinates
      {
        name: 'Original',
        coords: {
          clientName: { x: 120, y: 720, page: 1, size: 11 },
          totalAmount: { x: 100, y: 680, page: 1, size: 11 },
          deposit: { x: 100, y: 660, page: 1, size: 11 },
          balanceAmount: { x: 100, y: 640, page: 1, size: 11 },
        }
      },
      // Updated coordinates
      {
        name: 'Updated',
        coords: {
          clientName: { x: 150, y: 580, page: 1, size: 11 },
          totalAmount: { x: 200, y: 520, page: 1, size: 11 },
          deposit: { x: 200, y: 500, page: 1, size: 11 },
          balanceAmount: { x: 200, y: 480, page: 1, size: 11 },
        }
      },
      // Alternative coordinates based on image analysis
      {
        name: 'Alternative',
        coords: {
          clientName: { x: 300, y: 650, page: 1, size: 14 },
          totalAmount: { x: 400, y: 580, page: 1, size: 11 },
          deposit: { x: 400, y: 560, page: 1, size: 11 },
          balanceAmount: { x: 400, y: 540, page: 1, size: 11 },
        }
      }
    ];

    // 4️⃣ Generate test PDFs for each coordinate set
    for (const testSet of testCoordinates) {
      console.log(`\n🎯 Testing ${testSet.name} coordinates...`);
      
      // Create a copy of the PDF for this test
      const testPdfDoc = await PDFDocument.load(pdfBuffer);
      const testFont = await testPdfDoc.embedFont(StandardFonts.Helvetica);

      // Fill fields with test data
      const testData = {
        clientName: 'John Doe',
        totalAmount: '2400.00',
        deposit: '400.00',
        balanceAmount: '2000.00',
      };

      let fieldsFilled = 0;
      for (const [field, pos] of Object.entries(testSet.coords)) {
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
              borderWidth: 1,
              borderColor: rgb(1, 0, 0),
              opacity: 0.3,
            });
            
            // Draw the text
            page.drawText(String(value), {
              x: pos.x,
              y: pos.y,
              size: pos.size || 11,
              font: testFont,
              color: rgb(0, 0, 0),
            });
            
            fieldsFilled++;
            console.log(`  ✅ Filled ${field}: "${value}" at (${pos.x}, ${pos.y})`);
          } catch (fieldError) {
            console.warn(`  ⚠️ Failed to fill ${field}:`, fieldError.message);
          }
        }
      }

      // Save the test PDF
      const timestamp = Date.now();
      const outputPath = path.join(process.cwd(), 'generated', `coordinate-test-${testSet.name.toLowerCase()}-${timestamp}.pdf`);
      
      const pdfBytes = await testPdfDoc.save();
      await fs.promises.writeFile(outputPath, pdfBytes);
      
      console.log(`  📄 Saved test PDF: ${outputPath}`);
      console.log(`  📊 Filled ${fieldsFilled} fields`);
    }

    console.log('\n🎉 Coordinate Placement Tests Completed!');
    console.log('\n📋 Next Steps:');
    console.log('  1. Open the generated test PDFs');
    console.log('  2. Check which coordinate set places fields correctly');
    console.log('  3. Update pdfCoordinates.json with the best coordinates');
    console.log('  4. Re-run the placeholder replacement test');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the coordinate placement test
testCoordinatePlacement().catch(console.error);






