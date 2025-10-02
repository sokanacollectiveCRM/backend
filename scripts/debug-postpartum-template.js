const fs = require('fs');
const path = require('path');

// Test what placeholders are in the Postpartum template
async function checkTemplatePlaceholders() {
  try {
    console.log('🔍 Checking Postpartum template placeholders...');
    
    // Read the template file
    const templatePath = path.join(__dirname, '../src/assets/templates/Agreement for Postpartum Doula Services.docx');
    
    if (!fs.existsSync(templatePath)) {
      console.log('❌ Template file not found at:', templatePath);
      return;
    }
    
    console.log('✅ Template file found');
    
    // Try to read the file and look for placeholders
    const templateBuffer = fs.readFileSync(templatePath);
    
    // Convert to string and look for placeholders
    const templateString = templateBuffer.toString();
    
    // Look for common placeholder patterns
    const placeholderPatterns = [
      /\{totalHours\}/g,
      /\{hourlyRate\}/g,
      /\{overnightFee\}/g,
      /\{totalAmount\}/g,
      /\{deposit\}/g,
      /\{clientName\}/g,
      /\{clientInitials\}/g
    ];
    
    console.log('🔍 Searching for placeholders in template...');
    
    placeholderPatterns.forEach((pattern, index) => {
      const matches = templateString.match(pattern);
      if (matches) {
        console.log(`✅ Found ${matches.length} instances of: ${pattern.source}`);
      } else {
        console.log(`❌ Not found: ${pattern.source}`);
      }
    });
    
    // Also look for any {variable} patterns
    const allPlaceholders = templateString.match(/\{[^}]+\}/g);
    if (allPlaceholders) {
      console.log('🔍 All placeholders found in template:');
      const uniquePlaceholders = [...new Set(allPlaceholders)];
      uniquePlaceholders.forEach(placeholder => {
        console.log(`  - ${placeholder}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking template:', error);
  }
}

checkTemplatePlaceholders();
