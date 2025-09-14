const axios = require('axios');

async function getFieldCoordinates() {
    try {
        console.log('Getting field coordinates from SignNow document...');
        
        const response = await axios.post('http://localhost:5050/api/contract-signing/get-field-coordinates', {
            documentId: '5c0fa3f41ec54ccea230a8ba8d99cd264f0e2864'
        });

        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

getFieldCoordinates();
