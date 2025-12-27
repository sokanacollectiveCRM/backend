// Interactive PDF Coordinate Mapper
// This script helps you map coordinates by showing the PDF and letting you input coordinates manually

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function interactivePdfMapper() {
  try {
    console.log('🧭 Interactive PDF Coordinate Mapper\n');
    console.log('This tool helps you map coordinates for PDF templates.\n');

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

    // 2️⃣ Interactive coordinate mapping
    const coordinates = {};

    while (true) {
      const fieldName = await question('Enter field name (or "done" to finish): ');
      
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
        console.log(`❌ Invalid page number. Must be between 1 and ${numPages}`);
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
    }

    // 3️⃣ Export coordinates
    if (Object.keys(coordinates).length > 0) {
      const exportData = {
        labor_support_v1: coordinates
      };

      const json = JSON.stringify(exportData, null, 2);
      const outputPath = path.join(process.cwd(), 'generated', `pdfCoordinates-${Date.now()}.json`);
      
      // Ensure generated directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      
      await fs.promises.writeFile(outputPath, json);
      
      console.log('📋 Coordinate Mapping Complete!');
      console.log(`📄 Exported to: ${outputPath}`);
      console.log('\n📊 Mapped Coordinates:');
      console.log(JSON.stringify(coordinates, null, 2));
      console.log('\n💡 You can copy this into your pdfCoordinates.json file');
    } else {
      console.log('❌ No coordinates were mapped');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Run the interactive mapper
interactivePdfMapper().catch(console.error);






