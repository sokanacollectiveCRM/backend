const fs = require('fs');
const path = require('path');

async function checkVariablesOnly() {
    try {
        console.log('🔍 Checking Template Variables ONLY');
        console.log('📋 Labor Support Agreement variable mapping');
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

        console.log('📝 Input Contract Data:');
        console.log(`   serviceType: "${contractData.serviceType}"`);
        console.log(`   totalInvestment: "${contractData.totalInvestment}"`);
        console.log(`   depositAmount: "${contractData.depositAmount}"`);
        console.log(`   remainingBalance: "${contractData.remainingBalance}"`);
        console.log(`   clientName: "${contractData.clientName}"`);
        console.log(`   clientEmail: "${contractData.clientEmail}"`);
        console.log('');

        // Determine contract type
        const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support') ||
                              contractData.serviceType?.toLowerCase().includes('labor') ||
                              contractData.serviceType === 'Labor Support Services';

        console.log(`📋 Contract type detection: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);

        // Template filename
        const templateFileName = isLaborSupport
            ? 'Labor Support Agreement for Service.docx'
            : 'Agreement for Postpartum Doula Services.docx';

        console.log(`📄 Template filename: ${templateFileName}`);
        console.log('');

        // Map variables for Labor Support Agreement (same logic as contractProcessor.ts)
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

        console.log('📋 Template Variables Being Sent:');
        console.log(`   total_amount: "${templateVariables.total_amount}"`);
        console.log(`   deposit_amount: "${templateVariables.deposit_amount}"`);
        console.log(`   balance_amount: "${templateVariables.balance_amount}"`);
        console.log(`   client_name: "${templateVariables.client_name}"`);
        console.log(`   client_initials: "${templateVariables.client_initials}"`);
        console.log(`   client_intials: "${templateVariables.client_intials}"`);
        console.log(`   client_signature: "${templateVariables.client_signature}"`);
        console.log(`   client_signed_date: "${templateVariables.client_signed_date}"`);
        console.log('');

        console.log('🔍 Expected Template Placeholders:');
        console.log('   - {total_amount} should show: $2,500');
        console.log('   - {deposit_amount} should show: $500');
        console.log('   - {balance_amount} should show: $2,000');
        console.log('   - {client_name} should show: Jerry Techluminate');
        console.log('   - {client_initials} should show: JT');
        console.log('');

        console.log('💡 The variables look correct, but the template shows "undefined"');
        console.log('💡 This suggests the template placeholders don\'t match our variable names');
        console.log('💡 We need to verify what placeholders the template actually has');

    } catch (error) {
        console.error('❌ Error checking variables:', error.message);
    }
}

checkVariablesOnly();

