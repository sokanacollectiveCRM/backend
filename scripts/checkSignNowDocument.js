require('dotenv').config();
const axios = require('axios');

async function checkSignNowDocument(documentId) {
  try {
    console.log('🔍 Checking SignNow document content...');
    
    // Get auth token
    const authResponse = await axios.post('https://api.signnow.com/oauth2/token', {
      grant_type: 'password',
      client_id: process.env.SIGNNOW_CLIENT_ID,
      client_secret: process.env.SIGNNOW_CLIENT_SECRET,
      username: process.env.SIGNNOW_USERNAME,
      password: process.env.SIGNNOW_PASSWORD
    });
    
    const token = authResponse.data.access_token;
    console.log('✅ Authenticated with SignNow');
    
    // Get document content
    const response = await axios.get(`https://api.signnow.com/document/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📄 Document details:');
    console.log('Document ID:', response.data.id);
    console.log('Document name:', response.data.document_name);
    console.log('Pages:', response.data.page_count);
    
    // Check for fields
    if (response.data.fields && response.data.fields.length > 0) {
      console.log('✅ Fields found:');
      response.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
          name: field.name,
          type: field.type,
          page: field.page_number,
          position: `(${field.x}, ${field.y})`,
          role: field.role
        });
      });
    } else {
      console.log('❌ No fields found in document');
    }
    
    // Check document text content if available
    if (response.data.text) {
      console.log('📝 Document text content (first 500 chars):');
      console.log(response.data.text.substring(0, 500));
      
      // Search for Text Tags in the text
      const textTagPattern = /\{\{t:[^}]+\}\}/g;
      const matches = response.data.text.match(textTagPattern);
      
      if (matches && matches.length > 0) {
        console.log('✅ Found Text Tags in document text:');
        matches.forEach((tag, index) => {
          console.log(`Tag ${index + 1}: ${tag}`);
        });
      } else {
        console.log('❌ No Text Tags found in document text');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking document:', error.response?.data || error.message);
  }
}

// Use the document ID from the last upload
const documentId = '8685071a4c06437ea540a4c4dc408e9bda1c59d2';
checkSignNowDocument(documentId);





