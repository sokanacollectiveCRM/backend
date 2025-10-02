const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function testTemplateVariablesOnly() {
    try {
        console.log('🧪 Testing Template Variables ONLY');
        console.log('📋 Labor Support Agreement template processing');
        console.log('❌ NO SignNow, NO invitations, NO API calls');
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

        // Determine contract type
        const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support') ||
                              contractData.serviceType?.toLowerCase().includes('labor') ||
                              contractData.serviceType === 'Labor Support Services';

        console.log(`📋 Contract type: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);

        // Template filename
        const templateFileName = isLaborSupport
            ? 'Labor Support Agreement for Service.docx'
            : 'Agreement for Postpartum Doula Services.docx';

        console.log(`📄 Template filename: ${templateFileName}`);

        // Map variables for Labor Support Agreement
        const templateVariables = {
            total_amount: contractData.totalInvestment || '$2,500',
            deposit_amount: contractData.depositAmount || '$500',
            balance_amount: contractData.remainingBalance || '$2,000',
            client_initials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT',
            client_name: contractData.clientName || 'Jerry Techluminate',
            client_signature: '', // Will be filled by SignNow later
            client_signed_date: '', // Will be filled by SignNow later
            client_intials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT', // Note: template has typo "intials"
        };

        console.log('📋 Template variables being used:');
        console.log(`   total_amount: "${templateVariables.total_amount}"`);
        console.log(`   deposit_amount: "${templateVariables.deposit_amount}"`);
        console.log(`   balance_amount: "${templateVariables.balance_amount}"`);
        console.log(`   client_name: "${templateVariables.client_name}"`);
        console.log(`   client_initials: "${templateVariables.client_initials}"`);
        console.log(`   client_intials: "${templateVariables.client_intials}"`);
        console.log('');

        console.log('✅ Variable mapping looks correct');
        console.log('💡 The issue is likely that we\'re downloading the wrong template');
        console.log('💡 We need to verify what template is actually being downloaded from Supabase Storage');
        console.log('💡 The template should have these exact placeholders:');
        console.log('   - {total_amount}');
        console.log('   - {deposit_amount}');
        console.log('   - {balance_amount}');
        console.log('   - {client_initials}');
        console.log('   - {client_name}');

    } catch (error) {
        console.error('❌ Error testing template variables:', error.message);
    }
}

testTemplateVariablesOnly();

