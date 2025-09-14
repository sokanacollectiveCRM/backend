const axios = require('axios');

// Test multiple signature field positions to understand SignNow coordinate system
async function testSignNowCoordinates() {
  const documentId = '44e82e6a9bef40c3a095338d28b4062deaafd1e4'; // Latest test document

  // SignNow auth
  const authResponse = await axios.post('https://api.signnow.com/oauth2/token', {
    grant_type: 'password',
    client_id: '323e680065f1cbee4fe1e97664407a0b',
    client_secret: '5b2cbddac384f40fa1043ed19b34c61a',
    username: 'jerry@techluminateacademy.com',
    password: '@Bony5690'
  });

  const token = authResponse.data.access_token;
  console.log('✅ Authenticated with SignNow');

  // Test different coordinate positions to understand the system
  const testFields = [
    { name: 'test_top_left', x: 50, y: 50, label: 'Top Left' },
    { name: 'test_top_right', x: 500, y: 50, label: 'Top Right' },
    { name: 'test_middle', x: 300, y: 400, label: 'Middle' },
    { name: 'test_bottom_left', x: 50, y: 700, label: 'Bottom Left' },
    { name: 'test_bottom_right', x: 500, y: 700, label: 'Bottom Right' },
    { name: 'test_signature_area', x: 150, y: 650, label: 'Signature Area Guess' }
  ];

  console.log('🧪 Testing coordinate positions...');

  for (const field of testFields) {
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 2,
          type: "text",
          name: field.name,
          role: "Signer 1",
          required: false,
          height: 20,
          width: 100,
          x: field.x,
          y: field.y,
          prefilled_text: field.label
        }
      ]
    };

    try {
      await axios.put(
        `https://api.signnow.com/document/${documentId}`,
        fieldData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`✅ Added field "${field.label}" at (${field.x}, ${field.y})`);
    } catch (error) {
      console.log(`❌ Failed to add field "${field.label}" at (${field.x}, ${field.y}):`, error.response?.data);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('🎯 Check the SignNow document to see where each field appears!');
  console.log(`📋 Document ID: ${documentId}`);
}

testSignNowCoordinates().catch(console.error);
