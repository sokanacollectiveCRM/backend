const axios = require('axios');

async function generateTestDocument() {
    try {
        console.log('🧪 Generating Test Document');
        console.log('📋 Labor Support Agreement with variable substitution');
        console.log('❌ NO SignNow invitations will be sent');
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

        console.log('🔄 Generating contract document...');

        // Generate a unique contract ID
        const contractId = `test-${Date.now()}`;

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
                console.log('   - {total_amount} should show: $2,500');
                console.log('   - {deposit_amount} should show: $500');
                console.log('   - {balance_amount} should show: $2,000');
                console.log('   - {client_name} should show: Jerry Techluminate');
                console.log('   - {client_initials} should show: JT');
                console.log('');
                console.log('💡 Open the PDF file to inspect the variable substitution');
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
        console.error('❌ Error generating test document:', error.response?.data || error.message);
    }
}

generateTestDocument();

