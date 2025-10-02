const axios = require('axios');

async function testUpdatedCoordinates() {
    try {
        console.log('🧪 Testing Updated Labor Support Contract Coordinates');
        console.log('📋 Using coordinates from SignNow template f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // Test data for Labor Support Contract
        const contractData = {
            clientName: 'Jerry Techluminate',
            clientEmail: 'jerry@techluminateacademy.com',
            totalInvestment: '$2,500',
            depositAmount: '$500',
            serviceType: 'Labor Support Services'
        };

        console.log('📝 Contract Data:');
        console.log(`   Client: ${contractData.clientName}`);
        console.log(`   Email: ${contractData.clientEmail}`);
        console.log(`   Total Investment: ${contractData.totalInvestment}`);
        console.log(`   Deposit Amount: ${contractData.depositAmount}`);
        console.log(`   Service Type: ${contractData.serviceType}`);
        console.log('');

        console.log('🎯 Updated Field Coordinates:');
        console.log('   Signature: x=323, y=226 (Page 2)');
        console.log('   Date: x=115, y=287 (Page 2)');
        console.log('   Total Amount Initials: x=239, y=583 (Page 1)');
        console.log('   Deposit Amount Initials: x=278, y=609 (Page 1)');
        console.log('');

        console.log('🔄 Generating contract with updated coordinates...');

        try {
            const generateResponse = await axios.post('http://localhost:5050/api/contract-signing/generate-contract', {
                clientName: contractData.clientName,
                clientEmail: contractData.clientEmail,
                totalInvestment: contractData.totalInvestment,
                depositAmount: contractData.depositAmount,
                serviceType: contractData.serviceType
            });

            console.log('✅ Contract generation successful!');
            console.log('📊 Response:', JSON.stringify(generateResponse.data, null, 2));

            if (generateResponse.data.success) {
                const docxPath = generateResponse.data.data.docxPath;
                const pdfPath = generateResponse.data.data.pdfPath;

                console.log('\n📄 Generated Files:');
                console.log(`   DOCX: ${docxPath}`);
                console.log(`   PDF: ${pdfPath}`);
                console.log('');
                console.log('🔍 Check the SignNow document to verify field positioning:');
                console.log('   - Signature field should be at correct position');
                console.log('   - Date field should be at correct position');
                console.log('   - Initials fields should be positioned correctly next to amounts');
                console.log('   - All fields should be properly aligned with template');
            }

        } catch (generateError) {
            console.log('❌ Contract generation failed');
            console.log(`📊 Error: ${generateError.response?.status} - ${generateError.response?.data?.message || generateError.message}`);

            if (generateError.response?.data) {
                console.log('📊 Full error details:');
                console.log(JSON.stringify(generateError.response.data, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error testing updated coordinates:', error.response?.data || error.message);
    }
}

testUpdatedCoordinates();

