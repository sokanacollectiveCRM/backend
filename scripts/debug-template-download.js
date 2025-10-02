const axios = require('axios');

async function debugTemplateDownload() {
    try {
        console.log('🔍 Debugging Template Download');
        console.log('📋 Checking what template is actually being downloaded');
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
        console.log(`   Service Type: ${contractData.serviceType}`);
        console.log(`   Total Investment: ${contractData.totalInvestment}`);
        console.log(`   Deposit Amount: ${contractData.depositAmount}`);
        console.log('');

        console.log('🔄 Generating contract to check template download...');
        console.log('📋 Expected template: Labor Support Agreement for Service.docx');
        console.log('📋 Expected variables: total_amount, deposit_amount, balance_amount, client_initials, client_name');
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
                console.log('🔍 Check the server logs above to see:');
                console.log('   1. What template filename is being downloaded');
                console.log('   2. What template variables are being used');
                console.log('   3. If there are any download errors');
                console.log('');
                console.log('💡 Look for these log messages:');
                console.log('   - "📥 Downloading template from Supabase Storage..."');
                console.log('   - "📋 Using template: [filename]"');
                console.log('   - "📋 Contract type detected: [type]"');
                console.log('   - "📋 Template data being used: [variables]"');
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
        console.error('❌ Error debugging template download:', error.response?.data || error.message);
    }
}

debugTemplateDownload();

