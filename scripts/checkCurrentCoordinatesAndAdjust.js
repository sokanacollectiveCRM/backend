require('dotenv').config();
const axios = require('axios');

async function checkCurrentCoordinatesAndAdjust() {
  try {
    console.log('🔍 Checking current coordinates and adjusting for visual alignment...');

    // Get auth token
    const authResponse = await axios.post(
      'https://api.signnow.com/oauth2/token',
      {
        grant_type: 'password',
        client_id: process.env.SIGNNOW_CLIENT_ID,
        client_secret: process.env.SIGNNOW_CLIENT_SECRET,
        username: process.env.SIGNNOW_USERNAME,
        password: process.env.SIGNNOW_PASSWORD,
      }
    );

    const token = authResponse.data.access_token;
    console.log('✅ Authenticated with SignNow');

    // Check the latest document we created
    const documentId = 'a012816462ef4190a3a441aec26ca07977eb895f';

    // Get current document info
    const response = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Current Document Information:');
    console.log(`Document Name: ${response.data.document_name}`);
    console.log(`Pages: ${response.data.page_count}`);
    console.log(`Fields: ${response.data.fields?.length || 0}`);

    if (response.data.fields && response.data.fields.length > 0) {
      console.log('\n📋 Current Field Coordinates:');
      console.log('=============================');
      
      let currentSignature = null;
      let currentDate = null;
      
      response.data.fields.forEach((field, index) => {
        const attrs = field.json_attributes;
        console.log(`Field ${index + 1}:`, {
          name: attrs.name,
          type: field.type,
          page: attrs.page_number,
          position: `(${attrs.x}, ${attrs.y})`,
          size: `${attrs.width}x${attrs.height}`,
          role: field.role,
        });

        if (field.type === 'signature') {
          currentSignature = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (field.type === 'text' && attrs.name && attrs.name.toLowerCase().includes('date')) {
          currentDate = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        }
      });

      console.log('\n📊 Current vs Target Analysis:');
      console.log('===============================');
      
      if (currentSignature) {
        console.log(`\nSignature Field:`);
        console.log(`  Current: (${currentSignature.x}, ${currentSignature.y})`);
        console.log(`  Target:  (380, 220)`);
        console.log(`  Difference: (${currentSignature.x - 380}, ${currentSignature.y - 220})`);
      }
      
      if (currentDate) {
        console.log(`\nDate Field:`);
        console.log(`  Current: (${currentDate.x}, ${currentDate.y})`);
        console.log(`  Target:  (100, 275)`);
        console.log(`  Difference: (${currentDate.x - 100}, ${currentDate.y - 275})`);
      }

      // Based on the visual analysis from the image, let's adjust the coordinates
      console.log('\n🔧 Adjusting coordinates for visual alignment...');
      
      // From the image analysis:
      // Signature field needs to move left and up to align with "Client Signature" text
      // Date field needs to move right and up to align with "Date:" text
      
      const adjustedSignature = {
        x: 310, // Move left from 380 to 310 (70 units left)
        y: 205, // Move up from 220 to 205 (15 units up)
        width: 150,
        height: 35,
        page: 2,
      };
      
      const adjustedDate = {
        x: 130, // Move right from 100 to 130 (30 units right)
        y: 250, // Move up from 275 to 250 (25 units up)
        width: 150,
        height: 25,
        page: 2,
      };

      console.log('\n📋 Proposed Adjustments:');
      console.log('========================');
      console.log('Signature Field:');
      console.log(`  From: (${currentSignature?.x}, ${currentSignature?.y})`);
      console.log(`  To:   (${adjustedSignature.x}, ${adjustedSignature.y})`);
      console.log(`  Move: (${adjustedSignature.x - (currentSignature?.x || 0)}, ${adjustedSignature.y - (currentSignature?.y || 0)})`);
      
      console.log('\nDate Field:');
      console.log(`  From: (${currentDate?.x}, ${currentDate?.y})`);
      console.log(`  To:   (${adjustedDate.x}, ${adjustedDate.y})`);
      console.log(`  Move: (${adjustedDate.x - (currentDate?.x || 0)}, ${adjustedDate.y - (currentDate?.y || 0)})`);

      // Update the document with adjusted coordinates
      const fieldData = {
        client_timestamp: Math.floor(Date.now() / 1000),
        fields: [
          {
            page_number: adjustedDate.page,
            type: 'text',
            name: 'Date',
            role: 'Signer 1',
            required: true,
            height: adjustedDate.height,
            width: adjustedDate.width,
            x: adjustedDate.x,
            y: adjustedDate.y,
            label: 'Date',
          },
          {
            page_number: adjustedSignature.page,
            type: 'signature',
            name: 'Client Signature',
            role: 'Signer 1',
            required: true,
            height: adjustedSignature.height,
            width: adjustedSignature.width,
            x: adjustedSignature.x,
            y: adjustedSignature.y,
          },
        ],
      };

      console.log('\n🔧 Updating document with adjusted coordinates...');
      const updateResponse = await axios.put(
        `https://api.signnow.com/document/${documentId}`,
        fieldData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (updateResponse.status === 200) {
        console.log('✅ Document fields updated with adjusted coordinates!');
        
        // Wait for fields to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Verify the updated fields
        const verifyResponse = await axios.get(
          `https://api.signnow.com/document/${documentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('\n📋 Final Verified Coordinates:');
        console.log('=============================');
        
        verifyResponse.data.fields.forEach((field, index) => {
          const attrs = field.json_attributes;
          console.log(`Field ${index + 1}:`, {
            name: attrs.name,
            type: field.type,
            page: attrs.page_number,
            position: `(${attrs.x}, ${attrs.y})`,
            size: `${attrs.width}x${attrs.height}`,
            role: field.role,
          });
        });

        console.log('\n🔗 Updated Document URL:');
        console.log(`https://app.signnow.com/webapp/document/${documentId}`);
        
        return {
          documentId: documentId,
          url: `https://app.signnow.com/webapp/document/${documentId}`,
          adjustedSignature: adjustedSignature,
          adjustedDate: adjustedDate,
        };
      } else {
        console.error('❌ Failed to update document fields:', updateResponse.status, updateResponse.data);
        return null;
      }
    } else {
      console.log('❌ No fields found in document');
      return null;
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
checkCurrentCoordinatesAndAdjust().then((result) => {
  if (result) {
    console.log('\n🎉 Document coordinates adjusted successfully!');
    console.log('✅ Fields repositioned for better visual alignment');
    console.log(`\n📄 Document Details:`);
    console.log(`- ID: ${result.documentId}`);
    console.log(`- URL: ${result.url}`);
    console.log(`\n📋 New Coordinates:`);
    console.log(`- Signature: (${result.adjustedSignature.x}, ${result.adjustedSignature.y})`);
    console.log(`- Date: (${result.adjustedDate.x}, ${result.adjustedDate.y})`);
    console.log('\n💡 Check the document to see if the fields now align with the text labels!');
  } else {
    console.log('\n❌ Failed to adjust document coordinates');
  }
});






