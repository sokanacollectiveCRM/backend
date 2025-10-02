const axios = require('axios');

async function testBothContracts() {
    try {
        console.log('🧪 Testing Both Contract Types with Updated Coordinates');
        console.log('=====================================================');
        console.log('');

        // Test 1: Labor Support Contract
        console.log('🏥 Testing Labor Support Agreement');
        console.log('📋 Template: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        const laborSupportData = {
            clientName: 'Jerry Techluminate',
            clientEmail: 'jerry@techluminateacademy.com',
            totalInvestment: '$2,500',
            depositAmount: '$500',
            serviceType: 'Labor Support Services'
        };

        console.log('📝 Labor Support Contract Data:');
        console.log(`   Client: ${laborSupportData.clientName}`);
        console.log(`   Email: ${laborSupportData.clientEmail}`);
        console.log(`   Total Investment: ${laborSupportData.totalInvestment}`);
        console.log(`   Deposit Amount: ${laborSupportData.depositAmount}`);
        console.log(`   Service Type: ${laborSupportData.serviceType}`);
        console.log('');

        console.log('🎯 Expected Labor Support Field Positions:');
        console.log('   Signature: x=323, y=226 (Page 2)');
        console.log('   Date: x=115, y=287 (Page 2)');
        console.log('   Total Amount Initials: x=239, y=583 (Page 1)');
        console.log('   Deposit Amount Initials: x=278, y=609 (Page 1)');
        console.log('');

        try {
            console.log('🔄 Generating Labor Support contract...');
            const laborResponse = await axios.post('http://localhost:5050/api/contract-signing/generate-contract', laborSupportData);

            if (laborResponse.data.success) {
                console.log('✅ Labor Support contract generated successfully!');
                console.log(`📄 Files: ${laborResponse.data.data.docxPath}, ${laborResponse.data.data.pdfPath}`);
                console.log(`🔗 SignNow Document: ${laborResponse.data.data.signNow.documentId}`);
            } else {
                console.log('❌ Labor Support contract generation failed');
                console.log(`📊 Error: ${laborResponse.data.message}`);
            }
        } catch (laborError) {
            console.log('❌ Labor Support contract generation failed');
            console.log(`📊 Error: ${laborError.response?.status} - ${laborError.response?.data?.message || laborError.message}`);
        }

        console.log('');
        console.log('=====================================================');
        console.log('');

        // Test 2: Postpartum Contract
        console.log('🤱 Testing Postpartum Doula Services');
        console.log('📋 Template: 3cc4323f75af4986b9a142513185d2b13d300759');
        console.log('');

        const postpartumData = {
            clientName: 'Jerry Techluminate',
            clientEmail: 'jerry@techluminateacademy.com',
            totalInvestment: '$4,200',
            depositAmount: '$600',
            serviceType: 'Postpartum Doula Services'
        };

        console.log('📝 Postpartum Contract Data:');
        console.log(`   Client: ${postpartumData.clientName}`);
        console.log(`   Email: ${postpartumData.clientEmail}`);
        console.log(`   Total Investment: ${postpartumData.totalInvestment}`);
        console.log(`   Deposit Amount: ${postpartumData.depositAmount}`);
        console.log(`   Service Type: ${postpartumData.serviceType}`);
        console.log('');

        console.log('🎯 Expected Postpartum Field Positions:');
        console.log('   Signature: x=164, y=93 (Page 3)');
        console.log('   Date: x=347, y=97 (Page 3)');
        console.log('   Financial Amount Initials: x=155, y=639 (Page 2)');
        console.log('');

        try {
            console.log('🔄 Generating Postpartum contract...');
            const postpartumResponse = await axios.post('http://localhost:5050/api/contract-signing/generate-contract', postpartumData);

            if (postpartumResponse.data.success) {
                console.log('✅ Postpartum contract generated successfully!');
                console.log(`📄 Files: ${postpartumResponse.data.data.docxPath}, ${postpartumResponse.data.data.pdfPath}`);
                console.log(`🔗 SignNow Document: ${postpartumResponse.data.data.signNow.documentId}`);
            } else {
                console.log('❌ Postpartum contract generation failed');
                console.log(`📊 Error: ${postpartumResponse.data.message}`);
            }
        } catch (postpartumError) {
            console.log('❌ Postpartum contract generation failed');
            console.log(`📊 Error: ${postpartumError.response?.status} - ${postpartumError.response?.data?.message || postpartumError.message}`);
        }

        console.log('');
        console.log('=====================================================');
        console.log('✅ Testing Complete!');
        console.log('🔍 Check the generated SignNow documents to verify field positioning');
        console.log('📋 Both contracts should have correctly positioned signature, date, and initials fields');

    } catch (error) {
        console.error('❌ Error testing contracts:', error.response?.data || error.message);
    }
}

testBothContracts();

