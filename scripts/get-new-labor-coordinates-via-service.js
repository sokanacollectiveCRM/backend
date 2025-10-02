const { signNowService } = require('../src/services/signNowService');

async function getNewLaborSupportCoordinates() {
  console.log('🔍 Getting New Labor Support Contract Field Coordinates');
  console.log('📋 Document: https://app.signnow.com/webapp/document/f882b50d3ac84415b9e91f5c40dd709b3fbe7b17');
  console.log('');

  try {
    console.log('🔐 Testing SignNow authentication...');
    await signNowService.authenticate();
    console.log('✅ SignNow authentication successful');

    console.log('📋 Getting document fields...');
    const documentId = 'f882b50d3ac84415b9e91f5c40dd709b3fbe7b17';

    const response = await signNowService.getDocumentFields(documentId);

    console.log('✅ Document fields retrieved successfully');
    console.log('📊 Response:', JSON.stringify(response, null, 2));

    if (response.success && response.fields) {
      console.log('');
      console.log('🎯 Field Coordinates for Labor Support Contract:');
      console.log('💡 Use these coordinates to update the SignNow field positioning in the code');
      console.log('');

      response.fields.forEach((field, index) => {
        console.log(`${index + 1}. ${field.type.toUpperCase()} - ${field.name || 'Unnamed'}:`);
        console.log(`   Page: ${field.page_number}`);
        console.log(`   Position: x=${field.x}, y=${field.y}`);
        console.log(`   Size: width=${field.width}, height=${field.height}`);
        console.log(`   Required: ${field.required}`);
        console.log('');
      });

      // Summary of key coordinates
      const signatureFields = response.fields.filter(f => f.type === 'signature');
      const dateFields = response.fields.filter(f => f.type === 'text' && f.name?.toLowerCase().includes('date'));
      const initialsFields = response.fields.filter(f => f.type === 'initials');

      console.log('📊 Summary of Key Fields:');
      console.log('========================');

      if (signatureFields.length > 0) {
        const sig = signatureFields[0];
        console.log(`🔏 Signature: Page ${sig.page_number}, x=${sig.x}, y=${sig.y}`);
      }

      if (dateFields.length > 0) {
        const date = dateFields[0];
        console.log(`📅 Date: Page ${date.page_number}, x=${date.x}, y=${date.y}`);
      }

      if (initialsFields.length > 0) {
        console.log('✍️ Initials Fields:');
        initialsFields.forEach((field, i) => {
          console.log(`   ${i + 1}. Page ${field.page_number}, x=${field.x}, y=${field.y} (${field.name})`);
        });
      }
    }

  } catch (error) {
    console.log('❌ Error getting document fields:', error.message);
    console.log('📊 Full Error:', error);
  }
}

getNewLaborSupportCoordinates();
