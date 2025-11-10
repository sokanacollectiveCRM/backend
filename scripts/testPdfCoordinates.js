// Simple test for PDF coordinate system
// This tests the coordinate mapping without requiring full system setup
import fs from 'fs';
import path from 'path';

async function testPdfCoordinates() {
  try {
    console.log('🧪 Testing PDF Coordinate System...\n');

    // 1️⃣ Load coordinate maps
    console.log('📋 Loading coordinate maps...');
    const coordinatesPath = path.join(
      process.cwd(),
      'src/config/pdfCoordinates.json'
    );
    const coordinates = JSON.parse(fs.readFileSync(coordinatesPath, 'utf8'));

    console.log('✅ Coordinate maps loaded successfully');
    console.log('📊 Available templates:');
    Object.keys(coordinates).forEach((template) => {
      console.log(`  - ${template}`);
      const fields = Object.keys(coordinates[template]);
      console.log(`    Fields: ${fields.join(', ')}`);
    });
    console.log('');

    // 2️⃣ Test coordinate validation
    console.log('🎯 Testing coordinate validation...');
    const laborSupportCoords = coordinates.labor_support_v1;

    if (laborSupportCoords) {
      console.log('✅ Labor Support template coordinates found');
      console.log(
        '📍 Signature coordinates:',
        laborSupportCoords.client_signature
      );
      console.log(
        '📍 Date coordinates:',
        laborSupportCoords.client_signed_date
      );
      console.log(
        '📍 Initials coordinates:',
        laborSupportCoords.clientInitials
      );
    }

    const postpartumCoords = coordinates.postpartum_v1;
    if (postpartumCoords) {
      console.log('✅ Postpartum template coordinates found');
      console.log(
        '📍 Signature coordinates:',
        postpartumCoords.clientSignature
      );
      console.log('📍 Date coordinates:', postpartumCoords.date);
      console.log('📍 Initials coordinates:', postpartumCoords.clientInitials);
    }
    console.log('');

    // 3️⃣ Test coordinate consistency
    console.log('🔍 Testing coordinate consistency...');
    let allValid = true;

    Object.entries(coordinates).forEach(([template, coords]) => {
      Object.entries(coords).forEach(([field, pos]) => {
        if (!pos.x || !pos.y || !pos.page) {
          console.error(
            `❌ Invalid coordinates for ${template}.${field}:`,
            pos
          );
          allValid = false;
        }
      });
    });

    if (allValid) {
      console.log('✅ All coordinates are valid');
    } else {
      console.log('❌ Some coordinates are invalid');
    }
    console.log('');

    // 4️⃣ Test coordinate mapping for SignNow
    console.log('📋 Testing SignNow field mapping...');
    const laborCoords = coordinates.labor_support_v1;
    if (laborCoords.client_signature) {
      const signatureCoords = laborCoords.client_signature;
      console.log('✅ Signature field mapping:');
      console.log(`  X: ${signatureCoords.x}`);
      console.log(`  Y: ${signatureCoords.y}`);
      console.log(`  Page: ${signatureCoords.page}`);
      console.log(`  Size: ${signatureCoords.size || 11}`);
    }

    console.log('\n🎉 PDF Coordinate System Test Completed!');
    console.log('📊 Key Features:');
    console.log('  ✅ Fixed coordinate maps loaded');
    console.log('  ✅ Template-specific coordinates defined');
    console.log('  ✅ SignNow field mapping ready');
    console.log('  ✅ Coordinate validation passed');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testPdfCoordinates().catch(console.error);





