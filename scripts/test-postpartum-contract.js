const axios = require('axios');

async function testPostpartumContract() {
    try {
        console.log('🤱 Testing Postpartum Contract with Original Working Coordinates');
        console.log('================================================================');
        console.log('');

        const postpartumData = {
            clientName: 'Jerry Techluminate',
            clientEmail: 'jerrybony5@gmail.com',
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

        console.log('🎯 Using Original Working Postpartum Coordinates:');
        console.log('   Signature: Math.round(pdfX + 150), 650');
        console.log('   Date: Math.round(pdfX + 410), same line as signature');
        console.log('   Total Amount Initials: x=253, y=421');
        console.log('   Deposit Amount Initials: x=397, y=108');
        console.log('');

        console.log('🔄 Generating Postpartum contract...');

        try {
            const response = await axios.post('http://localhost:5050/api/contract-signing/generate-contract', postpartumData);
            
            if (response.data.success) {
                console.log('✅ Postpartum contract generated successfully!');
                console.log('📊 Response:', JSON.stringify(response.data, null, 2));

                if (response.data.data) {
                    const docxPath = response.data.data.docxPath;
                    const pdfPath = response.data.data.pdfPath;
                    const signNowDocId = response.data.data.signNow?.documentId;
                    
                    console.log('\n📄 Generated Files:');
                    console.log(`   DOCX: ${docxPath}`);
                    console.log(`   PDF: ${pdfPath}`);
                    console.log(`   SignNow Document ID: ${signNowDocId}`);
                    console.log('');
                    console.log('📧 SignNow invitation sent to: jerrybony5@gmail.com');
                    console.log('🔍 Check the SignNow document to verify field positioning using original coordinates');
                }
            } else {
                console.log('❌ Postpartum contract generation failed');
                console.log(`📊 Error: ${response.data.message}`);
            }

        } catch (error) {
            console.log('❌ Postpartum contract generation failed');
            console.log(`📊 Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);

            if (error.response?.data) {
                console.log('📊 Full error details:');
                console.log(JSON.stringify(error.response.data, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error testing Postpartum contract:', error.response?.data || error.message);
    }
}

testPostpartumContract();

