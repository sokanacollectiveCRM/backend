const axios = require('axios');

async function generateContractTest() {
    try {
        console.log('🧪 Generating Contract to Test Variable Substitution');
        console.log('📋 Labor Support Agreement with corrected variable mapping');
        console.log('⚠️  This will send a SignNow invitation');
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

        console.log('🔄 Generating contract with updated variable mapping...');
        console.log('📋 Expected variable substitutions:');
        console.log('   - {totalAmount} should show: $2,500');
        console.log('   - {depositAmount} should show: $500');
        console.log('   - {balanceAmount} should show: $2,000');
        console.log('   - {clientName} should show: Jerry Techluminate');
        console.log('   - {client_initials} should show: (empty, filled by SignNow)');
        console.log('');

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
                console.log('🔍 Check these files to verify variable substitution:');
                console.log('   - Open the PDF to see if variables are substituted correctly');
                console.log('   - Look for $2,500, $500, $2,000 instead of "undefined"');
                console.log('   - Look for "Jerry Techluminate" instead of "undefined"');
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
        console.error('❌ Error generating contract test:', error.response?.data || error.message);
    }
}

generateContractTest();

