const axios = require('axios');

async function testLaborSupportContractFlow() {
    try {
        console.log('🧪 Testing Labor Support Contract Generation Flow');
        console.log('📋 Template: Labor Support Contract (already in Supabase)');
        console.log('💰 Variables: totalInvestment, depositAmount');
        console.log('');

        // Test data for Labor Support Contract
        const contractData = {
            contractId: 'test-labor-support-001',
            clientName: 'Jerry Techluminate',
            clientEmail: 'jerry@techluminateacademy.com',
            totalInvestment: '$2,500',
            depositAmount: '$500',
            remainingBalance: '$2,000',
            serviceType: 'Labor Support Services',
            contractDate: new Date().toLocaleDateString(),
            dueDate: '2024-03-15',
            startDate: '2024-02-15',
            endDate: '2024-04-15'
        };

        console.log('📝 Contract Data:');
        console.log(`   Client: ${contractData.clientName}`);
        console.log(`   Email: ${contractData.clientEmail}`);
        console.log(`   Total Investment: ${contractData.totalInvestment}`);
        console.log(`   Deposit Amount: ${contractData.depositAmount}`);
        console.log(`   Remaining Balance: ${contractData.remainingBalance}`);
        console.log(`   Service Type: ${contractData.serviceType}`);
        console.log('');

        // Test the contract generation endpoint
        console.log('🔄 Testing contract generation...');
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
                console.log('\n🎯 Next Steps:');
                console.log('1. Contract generated with variables filled');
                console.log('2. PDF created and uploaded to SignNow');
                console.log('3. Signature fields added with coordinates:');
                console.log('   - client_initials: (111, 448) on page 2');
                console.log('   - signature_date: (115, 287) on page 2');
                console.log('   - client_signature: (323, 226) on page 2');
                console.log('4. Client will receive SignNow invitation');
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
        console.error('❌ Error testing contract flow:', error.response?.data || error.message);
    }
}

testLaborSupportContractFlow();
