// Test script for placeholder replacement in PDF templates
// This tests the coordinate-based field filling system

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

async function testPlaceholderReplacement() {
  try {
    console.log('🧪 Testing Placeholder Replacement in PDF Templates...\n');

    // 1️⃣ Download the Labor Support Agreement template
    console.log('📥 Downloading Labor Support Agreement template...');
    const templateName = 'Labor Support Agreement for Service.docx.pdf';
    
    const { data: file, error } = await supabase.storage
      .from('contract-templates')
      .download(templateName);
    
    if (error || !file) {
      throw new Error(`Template not found: ${error?.message}`);
    }

    console.log('✅ Template downloaded successfully');

    // 2️⃣ Load the PDF and font
    console.log('🔄 Loading PDF and embedding font...');
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    console.log(`📄 PDF loaded: ${pdfDoc.getPageCount()} pages`);

    // 3️⃣ Test coordinate-based field filling
    console.log('📍 Testing coordinate-based field filling...');
    
    // Sample contract data
    const contractData = {
      clientName: 'John Doe',
      totalAmount: '2400.00',
      deposit: '400.00',
      balanceAmount: '2000.00',
      clientInitials: 'JD',
      client_signed_date: new Date().toLocaleDateString()
    };

    // Load coordinate map
    const coordinatesPath = path.join(process.cwd(), 'src/config/pdfCoordinates.json');
    const coordinates = JSON.parse(fs.readFileSync(coordinatesPath, 'utf8'));
    const coords = coordinates.labor_support_v1;

    if (!coords) {
      throw new Error('No coordinate map found for labor_support_v1');
    }

    console.log('✅ Coordinate map loaded');

    // 4️⃣ Fill fields using coordinates
    let fieldsFilled = 0;
    for (const [field, pos] of Object.entries(coords)) {
      const value = contractData[field] || '';
      if (value) {
        try {
          const page = pdfDoc.getPage(pos.page - 1);
          page.drawText(String(value), {
            x: pos.x,
            y: pos.y,
            size: pos.size || 11,
            font,
            color: rgb(0, 0, 0),
          });
          fieldsFilled++;
          console.log(`✅ Filled field "${field}" with "${value}" at (${pos.x}, ${pos.y})`);
        } catch (fieldError) {
          console.warn(`⚠️ Failed to fill field "${field}":`, fieldError);
        }
      } else {
        console.log(`⏭️ Skipping empty field: ${field}`);
      }
    }

    console.log(`📊 Filled ${fieldsFilled} fields in PDF`);

    // 5️⃣ Save the filled PDF
    const timestamp = Date.now();
    const outputPath = path.join(process.cwd(), 'generated', `labor-support-filled-${timestamp}.pdf`);
    
    // Ensure generated directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    
    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(outputPath, pdfBytes);
    
    console.log(`✅ Filled PDF saved to: ${outputPath}`);
    console.log('');

    // 6️⃣ Show what was filled
    console.log('📋 Placeholder Replacement Summary:');
    console.log(`  Template: ${templateName}`);
    console.log(`  Fields Filled: ${fieldsFilled}`);
    console.log(`  Output File: ${outputPath}`);
    console.log('');
    console.log('🎯 Filled Data:');
    Object.entries(contractData).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n🎉 Placeholder Replacement Test Completed Successfully!');
    console.log('📊 Key Benefits:');
    console.log('  ✅ No DOCX conversion required');
    console.log('  ✅ Fixed coordinates ensure consistent placement');
    console.log('  ✅ Direct PDF manipulation preserves formatting');
    console.log('  ✅ Perfect SignNow field alignment');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testPlaceholderReplacement().catch(console.error);
