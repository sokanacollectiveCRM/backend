// Get Coordinates from PDF Analysis
// This script analyzes the PDF structure to suggest coordinate positions

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getCoordinatesFromPDF() {
  try {
    console.log('🔍 Analyzing PDF Structure for Coordinate Suggestions\n');

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

    // 2️⃣ Analyze page dimensions
    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();
    
    console.log(`📏 Page dimensions: ${width} x ${height} points`);
    console.log(`📄 Page size: ${(width/72).toFixed(1)}" x ${(height/72).toFixed(1)}"`);

    // 3️⃣ Suggest coordinates based on typical PDF layouts
    console.log('\n🎯 Suggested Coordinate Positions:');
    console.log('Based on typical PDF layouts and the fields you need:\n');

    const suggestions = [
      {
        name: 'clientName',
        description: 'Client name field (usually top-right or near signature)',
        suggestions: [
          { x: Math.round(width * 0.6), y: Math.round(height * 0.85), reason: 'Top-right area' },
          { x: Math.round(width * 0.1), y: Math.round(height * 0.75), reason: 'Left side, upper area' },
          { x: Math.round(width * 0.5), y: Math.round(height * 0.9), reason: 'Center-top area' }
        ]
      },
      {
        name: 'totalAmount',
        description: 'Total amount (usually in financial section)',
        suggestions: [
          { x: Math.round(width * 0.3), y: Math.round(height * 0.6), reason: 'Financial section area' },
          { x: Math.round(width * 0.4), y: Math.round(height * 0.65), reason: 'Center-left financial area' },
          { x: Math.round(width * 0.5), y: Math.round(height * 0.7), reason: 'Center financial area' }
        ]
      },
      {
        name: 'deposit',
        description: 'Deposit amount (usually near total amount)',
        suggestions: [
          { x: Math.round(width * 0.3), y: Math.round(height * 0.55), reason: 'Below total amount' },
          { x: Math.round(width * 0.4), y: Math.round(height * 0.6), reason: 'Below total amount' },
          { x: Math.round(width * 0.5), y: Math.round(height * 0.65), reason: 'Below total amount' }
        ]
      },
      {
        name: 'balanceAmount',
        description: 'Balance amount (usually below deposit)',
        suggestions: [
          { x: Math.round(width * 0.3), y: Math.round(height * 0.5), reason: 'Below deposit' },
          { x: Math.round(width * 0.4), y: Math.round(height * 0.55), reason: 'Below deposit' },
          { x: Math.round(width * 0.5), y: Math.round(height * 0.6), reason: 'Below deposit' }
        ]
      }
    ];

    suggestions.forEach(field => {
      console.log(`📍 ${field.name.toUpperCase()}:`);
      console.log(`   ${field.description}`);
      field.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. x: ${suggestion.x}, y: ${suggestion.y} (${suggestion.reason})`);
      });
      console.log('');
    });

    // 4️⃣ Generate test coordinates
    console.log('🧪 Generating test coordinates for all suggestions...\n');
    
    const testCoordinates = {
      clientName: { x: Math.round(width * 0.6), y: Math.round(height * 0.85), page: 1 },
      totalAmount: { x: Math.round(width * 0.4), y: Math.round(height * 0.65), page: 1 },
      deposit: { x: Math.round(width * 0.4), y: Math.round(height * 0.6), page: 1 },
      balanceAmount: { x: Math.round(width * 0.4), y: Math.round(height * 0.55), page: 1 },
    };

    // 5️⃣ Export coordinates
    const exportData = {
      labor_support_v1: testCoordinates
    };

    const json = JSON.stringify(exportData, null, 2);
    const outputPath = path.join(process.cwd(), 'generated', `pdfCoordinates-suggested-${Date.now()}.json`);
    
    await fs.promises.writeFile(outputPath, json);
    
    console.log('📋 Coordinate Analysis Complete!');
    console.log(`📄 Suggested coordinates saved: ${outputPath}`);
    console.log('\n📊 Suggested Coordinates:');
    console.log(JSON.stringify(testCoordinates, null, 2));
    
    console.log('\n💡 Next Steps:');
    console.log('1. Use these coordinates as a starting point');
    console.log('2. Test them with the placeholder replacement script');
    console.log('3. Adjust the coordinates if needed');
    console.log('4. Or use an online PDF coordinate tool for exact positions');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the analysis
getCoordinatesFromPDF().catch(console.error);





