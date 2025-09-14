const pdf2json = require('pdf2json');
const axios = require('axios');

async function detectSignatureCoordinates() {
  // First, generate a fresh contract to analyze
  console.log('🔄 Generating fresh contract for coordinate detection...');

  const contractResponse = await fetch('http://localhost:5050/api/contract-signing/test-send', {
    method: 'POST'
  });

  const contractResult = await contractResponse.json();

  if (!contractResult.success) {
    console.error('❌ Failed to generate contract:', contractResult.message);
    return;
  }

  const documentId = contractResult.data.signNow.documentId;
  const pdfPath = contractResult.data.pdfPath;

  console.log('✅ Contract generated successfully');
  console.log('📄 PDF Path:', pdfPath);
  console.log('📋 SignNow Document ID:', documentId);

  // Parse the PDF to find "Client Signature:" position
  console.log('\n🔍 Analyzing PDF for "Client Signature:" position...');

  const pdfParser = new pdf2json();

  const pdfAnalysis = new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', reject);
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      let signaturePosition = null;

      // Check all pages for signature text
      pdfData.Pages.forEach((page, pageIndex) => {
        if (page.Texts) {
          page.Texts.forEach((textItem) => {
            const text = decodeURIComponent(textItem.R[0].T);

            if (text.includes('Client Signature:')) {
              const pdfX = textItem.x;
              const pdfY = textItem.y;

              signaturePosition = {
                pdfX,
                pdfY,
                pageIndex,
                text,
                // Convert to different coordinate systems to test
                signNowTopLeft: {
                  x: Math.round(pdfX * 72 / 96),
                  y: Math.round((792 - pdfY * 72 / 96))
                },
                signNowBottomLeft: {
                  x: Math.round(pdfX * 72 / 96),
                  y: Math.round(pdfY * 72 / 96)
                },
                signNowDirect: {
                  x: Math.round(pdfX),
                  y: Math.round(pdfY)
                }
              };

              console.log('📍 Found "Client Signature:" text:');
              console.log('   PDF coordinates:', pdfX, pdfY);
              console.log('   Page:', pageIndex);
              console.log('   Text:', text);
            }
          });
        }
      });

      resolve(signaturePosition);
    });

    pdfParser.loadPDF('./' + pdfPath);
  });

  const position = await pdfAnalysis;

  if (!position) {
    console.log('❌ Could not find "Client Signature:" text in PDF');
    return;
  }

  console.log('\n🧮 Coordinate conversion attempts:');
  console.log('1. Top-left origin (792-y):', position.signNowTopLeft);
  console.log('2. Bottom-left origin:', position.signNowBottomLeft);
  console.log('3. Direct PDF coords:', position.signNowDirect);

  // Now test these coordinates in SignNow
  console.log('\n🧪 Testing coordinates in SignNow...');

  // SignNow auth
  const authResponse = await axios.post('https://api.signnow.com/oauth2/token', {
    grant_type: 'password',
    client_id: '323e680065f1cbee4fe1e97664407a0b',
    client_secret: '5b2cbddac384f40fa1043ed19b34c61a',
    username: 'jerry@techluminateacademy.com',
    password: '@Bony5690'
  });

  const token = authResponse.data.access_token;

  // Test different coordinate interpretations
  const testCoordinates = [
    { name: 'ChatGPT coords', x: 150, y: 143 },
    { name: 'Top-left conversion', ...position.signNowTopLeft },
    { name: 'Bottom-left conversion', ...position.signNowBottomLeft },
    { name: 'Direct PDF coords', ...position.signNowDirect },
    { name: 'After signature text', x: position.signNowTopLeft.x + 100, y: position.signNowTopLeft.y },
    { name: 'Page bottom area', x: 150, y: 650 },
    { name: 'Page bottom-right', x: 400, y: 650 }
  ];

  for (let i = 0; i < testCoordinates.length; i++) {
    const coords = testCoordinates[i];

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: position.pageIndex,
          type: "text",
          name: `test_field_${i}`,
          role: "Signer 1",
          required: false,
          height: 20,
          width: 80,
          x: coords.x,
          y: coords.y,
          prefilled_text: coords.name
        }
      ]
    };

    try {
      await axios.put(
        \`https://api.signnow.com/document/\${documentId}\`,
        fieldData,
        { headers: { Authorization: \`Bearer \${token}\` } }
      );
      console.log(\`✅ \${coords.name}: (\${coords.x}, \${coords.y})\`);
    } catch (error) {
      console.log(\`❌ \${coords.name}: (\${coords.x}, \${coords.y}) - \${error.response?.data?.errors?.[0]?.message || error.message}\`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(\`\n🎯 Check the SignNow document to see where each test field appears!\`);
  console.log(\`📋 Document URL: https://app.signnow.com/document/\${documentId}\`);
  console.log(\`📋 Document ID: \${documentId}\`);
}

detectSignatureCoordinates().catch(console.error);
