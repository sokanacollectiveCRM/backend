const axios = require('axios');

async function getDocumentFields() {
    try {
        const documentId = '5c0fa3f41ec54ccea230a8ba8d99cd264f0e2864';
        
        // First, let's get the auth token (we'll need to use the same method as signNowService)
        console.log('Getting SignNow document field coordinates...');
        console.log(`Document ID: ${documentId}`);
        console.log('');
        
        // We need to make a GET request to the SignNow API to get the document details
        // This will show us the exact coordinates where you positioned the fields
        
        console.log('To get the coordinates, we need to:');
        console.log('1. Use the SignNow API to GET the document details');
        console.log('2. Extract the field coordinates from the response');
        console.log('3. Update our signNowService.ts with those exact coordinates');
        console.log('');
        
        console.log('Let me implement this API call...');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

getDocumentFields();
