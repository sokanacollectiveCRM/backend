const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkTemplatePlaceholders() {
  try {
    console.log('🔍 Downloading Postpartum template from Supabase Storage...');
    
    // Download the template
    const { data: templateBlob, error: downloadError } = await supabase.storage
      .from('contract-templates')
      .download('Agreement for Postpartum Doula Services.docx');
    
    if (downloadError) {
      console.error('❌ Error downloading template:', downloadError);
      return;
    }
    
    console.log('✅ Template downloaded successfully');
    
    // Convert blob to buffer
    const templateBuffer = await templateBlob.arrayBuffer();
    const templateString = Buffer.from(templateBuffer).toString();
    
    console.log('🔍 Searching for placeholders in template...');
    
    // Look for common placeholder patterns
    const placeholderPatterns = [
      /\{totalHours\}/g,
      /\{hours\}/g,
      /\{hourlyRate\}/g,
      /\{rate\}/g,
      /\{overnightFee\}/g,
      /\{overnight\}/g,
      /\{totalAmount\}/g,
      /\{deposit\}/g,
      /\{clientName\}/g,
      /\{clientInitials\}/g
    ];
    
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
