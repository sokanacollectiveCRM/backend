// Cursor Prompt
// File: scripts/comparePdfLayouts.js
// Purpose: Compare two PDFs (e.g., Word-exported vs. converted via LibreOffice)
// to detect layout drift that affects SignNow field coordinates.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function comparePdfs(originalPath, convertedPath) {
  try {
    // 1️⃣ Verify files exist
    if (!fs.existsSync(originalPath)) throw new Error(`Missing file: ${originalPath}`);
    if (!fs.existsSync(convertedPath)) throw new Error(`Missing file: ${convertedPath}`);

    // 2️⃣ Define output
    const outputFile = path.join(process.cwd(), 'layout-diff.pdf');

    console.log('🧩 Comparing PDFs...');
    console.log(`Original: ${originalPath}`);
    console.log(`Converted: ${convertedPath}`);

    // 3️⃣ Run diff-pdf command
    execSync(`diff-pdf --output-diff="${outputFile}" "${originalPath}" "${convertedPath}"`, {
      stdio: 'inherit'
    });

    console.log(`✅ Comparison complete!`);
    console.log(`📄 Output file: ${outputFile}`);
    console.log(`👀 Open it to see differences (red = moved/removed, green = added/shifted).`);
  } catch (err) {
    console.error('❌ PDF comparison failed:', err.message);
    console.log('\n🔧 Make sure diff-pdf is installed on your system.');
    console.log('Install via: brew install diff-pdf  (Mac) or sudo apt install diffpdf (Linux).');
  }
}

// Example usage
const ORIGINAL = 'Agreement_Template_v1_original.pdf';
const CONVERTED = 'Agreement_Template_v1_converted.pdf';
comparePdfs(ORIGINAL, CONVERTED);






