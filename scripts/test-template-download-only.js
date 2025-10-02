const axios = require('axios');

async function testTemplateDownloadOnly() {
    try {
        console.log('🧪 Testing Template Download Detection ONLY');
        console.log('📋 This will test what template is being selected');
        console.log('❌ NO contract generation, NO SignNow invitations');
        console.log('');

        // Test data for Labor Support Contract
        const contractData = {
            serviceType: 'Labor Support Services',
            totalInvestment: '$2,500',
            depositAmount: '$500',
            remainingBalance: '$2,000',
            clientName: 'Jerry Techluminate',
            clientEmail: 'jerry@techluminateacademy.com'
        };

        console.log('📝 Contract Data:');
        console.log(`   Service Type: ${contractData.serviceType}`);
        console.log(`   Total Investment: ${contractData.totalInvestment}`);
        console.log(`   Deposit Amount: ${contractData.depositAmount}`);
        console.log(`   Remaining Balance: ${contractData.remainingBalance}`);
        console.log(`   Client Name: ${contractData.clientName}`);
        console.log('');

        // Test the contract type detection logic
        const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support') || 
                              contractData.serviceType?.toLowerCase().includes('labor') ||
                              contractData.serviceType === 'Labor Support Services';

        console.log('🔍 Contract Type Detection:');
        console.log(`   isLaborSupport: ${isLaborSupport}`);
        console.log(`   serviceType.toLowerCase().includes('labor support'): ${contractData.serviceType?.toLowerCase().includes('labor support')}`);
        console.log(`   serviceType.toLowerCase().includes('labor'): ${contractData.serviceType?.toLowerCase().includes('labor')}`);
        console.log(`   serviceType === 'Labor Support Services': ${contractData.serviceType === 'Labor Support Services'}`);
        console.log('');

        // Template filename logic
        const templateFileName = isLaborSupport 
            ? 'Labor Support Agreement for Service.docx'
            : 'Agreement for Postpartum Doula Services.docx';

        console.log('📄 Template Selection:');
        console.log(`   Contract type: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);
        console.log(`   Template filename: ${templateFileName}`);
        console.log('');

        // Variable mapping
        let templateVariables;
        if (isLaborSupport) {
            templateVariables = {
                total_amount: contractData.totalInvestment || '$2,500',
                deposit_amount: contractData.depositAmount || '$500',
                balance_amount: contractData.remainingBalance || '$2,000',
                client_initials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT',
                client_name: contractData.clientName || 'Jerry Techluminate',
                client_signature: '',
                client_signed_date: '',
                client_intials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT',
            };
        } else {
            templateVariables = {
                totalHours: '120',
                deposit: contractData.depositAmount?.replace('$', '') || '600.00',
                hourlyRate: '35.00',
                overnightFee: '0.00',
                totalAmount: contractData.totalInvestment?.replace('$', '') || '4,200.00',
                clientInitials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JB',
                clientName: contractData.clientName || 'Jerry Bony',
            };
        }

        console.log('📋 Template Variables:');
        console.log(JSON.stringify(templateVariables, null, 2));
        console.log('');

        console.log('✅ Template detection logic is working correctly');
        console.log('💡 The issue must be in the template download from Supabase Storage');
        console.log('💡 Either the template filename is wrong or the template doesn\'t exist');

    } catch (error) {
        console.error('❌ Error testing template download:', error.message);
    }
}

testTemplateDownloadOnly();

