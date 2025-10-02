const axios = require('axios');

async function testVariableMapping() {
    try {
        console.log('🧪 Testing Variable Mapping for Labor Support Contract');
        console.log('📋 Template: Labor Support Agreement for Service.docx');
        console.log('💰 Variables: total_amount, deposit_amount, balance_amount');
        console.log('');

        // Test data for Labor Support Contract
        const contractData = {
            contractId: 'test-variable-mapping-001',
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
        console.log('🔄 Testing contract generation (without SignNow invitation)...');
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
                console.log('1. Check the generated DOCX file for variable substitution');
                console.log('2. Verify that {total_amount} shows $2,500');
                console.log('3. Verify that {deposit_amount} shows $500');
                console.log('4. Verify that {balance_amount} shows $2,000');
                console.log('5. Verify that {client_name} shows Jerry Techluminate');
                console.log('6. Verify that {client_initials} shows JT');
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
        console.error('❌ Error testing variable mapping:', error.response?.data || error.message);
    }
}

testVariableMapping();

