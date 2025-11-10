// Enhanced PDF Layout Drift Visual Tester
// File: scripts/comparePdfLayoutsEnhanced.js
// Purpose: Compare PDFs and analyze layout drift for SignNow field coordinates

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function comparePdfs(originalPath, convertedPath, options = {}) {
  try {
    // 1️⃣ Verify files exist
    if (!fs.existsSync(originalPath)) throw new Error(`Missing file: ${originalPath}`);
    if (!fs.existsSync(convertedPath)) throw new Error(`Missing file: ${convertedPath}`);

    // 2️⃣ Define output with timestamp
    const timestamp = Date.now();
    const outputFile = path.join(process.cwd(), `layout-diff-${timestamp}.pdf`);

    console.log('🧩 Comparing PDFs...');
    console.log(`Original: ${originalPath}`);
    console.log(`Converted: ${convertedPath}`);

    // 3️⃣ Run diff-pdf command with options
    let command = `diff-pdf --output-diff="${outputFile}"`;
    
    if (options.page) {
      command += ` --page ${options.page}`;
    }
    
    if (options.verbose) {
      command += ` --verbose`;
    }
    
    command += ` "${originalPath}" "${convertedPath}"`;

    execSync(command, {
      stdio: 'inherit'
    });

    console.log(`✅ Comparison complete!`);
    console.log(`📄 Output file: ${outputFile}`);
    console.log(`👀 Open it to see differences (red = moved/removed, green = added/shifted).`);
    
    return outputFile;
  } catch (err) {
    console.error('❌ PDF comparison failed:', err.message);
    console.log('\n🔧 Make sure diff-pdf is installed on your system.');
    console.log('Install via: brew install diff-pdf  (Mac) or sudo apt install diffpdf (Linux).');
    throw err;
  }
}

// Compare specific pages (useful for signature pages)
async function compareSpecificPage(originalPath, convertedPath, pageNumber) {
  console.log(`🔍 Comparing page ${pageNumber} specifically...`);
  return await comparePdfs(originalPath, convertedPath, { page: pageNumber });
}

// Find and compare the most recent annotated PDF with a reference
async function compareRecentAnnotated() {
  try {
    // Find the most recent annotated PDF
    const files = fs.readdirSync(process.cwd()).filter(f => f.startsWith('annotated-') && f.endsWith('.pdf'));
    if (files.length === 0) {
      throw new Error('No annotated PDFs found. Run testCoordinates.js first.');
    }
    
    const mostRecent = files.sort().pop();
    console.log(`📄 Using most recent annotated PDF: ${mostRecent}`);
    
    // Look for a reference PDF (you can customize this)
    const referenceFiles = fs.readdirSync(process.cwd()).filter(f => 
      f.includes('reference') || f.includes('original') || f.includes('template')
    );
    
    if (referenceFiles.length === 0) {
      console.log('⚠️ No reference PDF found. Please place a reference PDF in the project root.');
      return;
    }
    
    const referenceFile = referenceFiles[0];
    console.log(`📄 Using reference PDF: ${referenceFile}`);
    
    // Compare all pages
    await comparePdfs(referenceFile, mostRecent);
    
    // Also compare just page 3 (signature page)
    await compareSpecificPage(referenceFile, mostRecent, 3);
    
  } catch (err) {
    console.error('❌ Failed to compare recent annotated PDF:', err.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔍 No arguments provided. Comparing recent annotated PDF...');
    await compareRecentAnnotated();
  } else if (args.length === 2) {
    const [original, converted] = args;
    await comparePdfs(original, converted);
  } else if (args.length === 3) {
    const [original, converted, page] = args;
    await compareSpecificPage(original, converted, parseInt(page));
  } else {
    console.log('Usage:');
    console.log('  node scripts/comparePdfLayoutsEnhanced.js                    # Compare recent annotated PDF');
    console.log('  node scripts/comparePdfLayoutsEnhanced.js <original> <converted>');
    console.log('  node scripts/comparePdfLayoutsEnhanced.js <original> <converted> <page>');
  }
}

main().catch(console.error);





