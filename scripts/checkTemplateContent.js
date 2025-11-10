require('dotenv').config();
const fs = require('fs');
const path = require('path');

function checkTemplateContent() {
  try {
    console.log('🔍 Checking template content for Text Tags...');

    const templatePath = './Labor Support Agreement for Service.docx.pdf';

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    // Read the file as buffer
    const buffer = fs.readFileSync(templatePath);
    console.log(`📄 File size: ${buffer.length} bytes`);

    // Convert buffer to string to search for Text Tags
    const content = buffer.toString('utf8');

    // Search for Text Tags
    const textTagPattern = /\{\{t:[^}]+\}\}/g;
    const matches = content.match(textTagPattern);

    if (matches && matches.length > 0) {
      console.log('✅ Found Text Tags in template:');
      console.log('================================');
      matches.forEach((tag, index) => {
        console.log(`${index + 1}. ${tag}`);
      });
    } else {
      console.log('❌ No Text Tags found in template');
      console.log('🔍 Searching for any curly braces...');

      // Search for any curly braces
      const curlyBracesPattern = /\{[^}]*\}/g;
      const curlyMatches = content.match(curlyBracesPattern);

      if (curlyMatches && curlyMatches.length > 0) {
        console.log('Found curly braces:');
        curlyMatches.forEach((match, index) => {
          console.log(`${index + 1}. ${match}`);
        });
      } else {
        console.log('❌ No curly braces found at all');
      }
    }

    // Also search for specific text patterns
    console.log('\n🔍 Searching for specific text patterns...');
    const patterns = [
      'Total Amount',
      'Deposit Amount',
      'Balance Amount',
      'Client Name',
      'Initials',
      'Signer 1',
    ];

    patterns.forEach((pattern) => {
      if (content.includes(pattern)) {
        console.log(`✅ Found: ${pattern}`);
      } else {
        console.log(`❌ Not found: ${pattern}`);
      }
    });
  } catch (error) {
    console.error('❌ Error checking template content:', error.message);
  }
}

// Run the script
checkTemplateContent();
