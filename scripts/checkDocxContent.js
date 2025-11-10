require('dotenv').config();
const fs = require('fs');

function checkDocxContent() {
  try {
    console.log('🔍 Checking DOCX content for Text Tags...');

    const docxPath = './Labor Support Agreement for Service (1).docx';

    if (!fs.existsSync(docxPath)) {
      throw new Error(`DOCX file not found: ${docxPath}`);
    }

    // Read the file as buffer
    const buffer = fs.readFileSync(docxPath);
    console.log(`📄 File size: ${buffer.length} bytes`);

    // Convert buffer to string to search for Text Tags
    const content = buffer.toString('utf8');

    // Search for Text Tags
    const textTagPattern = /\{\{t:[^}]+\}\}/g;
    const matches = content.match(textTagPattern);

    if (matches && matches.length > 0) {
      console.log('✅ Found Text Tags in DOCX:');
      console.log('==========================');
      matches.forEach((tag, index) => {
        console.log(`${index + 1}. ${tag}`);
      });
    } else {
      console.log('❌ No Text Tags found in DOCX');
    }

    // Search for any curly braces
    const curlyBracesPattern = /\{[^}]*\}/g;
    const curlyMatches = content.match(curlyBracesPattern);

    if (curlyMatches && curlyMatches.length > 0) {
      console.log('🔍 Found curly braces in content:');
      curlyMatches.slice(0, 10).forEach((match, index) => {
        console.log(`${index + 1}. ${match}`);
      });
      if (curlyMatches.length > 10) {
        console.log(`... and ${curlyMatches.length - 10} more`);
      }
    }

    // Search for specific text patterns
    const patterns = [
      'Total Amount',
      'Deposit Amount',
      'Balance Amount',
      'Client Name',
      'Initials',
      'Signer 1',
    ];

    console.log('🔍 Searching for specific text patterns...');
    patterns.forEach((pattern) => {
      if (content.includes(pattern)) {
        console.log(`✅ Found: ${pattern}`);
      } else {
        console.log(`❌ Not found: ${pattern}`);
      }
    });
  } catch (error) {
    console.error('❌ Error checking DOCX content:', error.message);
  }
}

checkDocxContent();





