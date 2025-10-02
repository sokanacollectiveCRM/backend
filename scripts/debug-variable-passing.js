const fs = require('fs');
const path = require('path');

async function debugVariablePassing() {
    try {
        console.log('🔍 Debugging Variable Passing');
        console.log('📋 Checking what variables are being sent to the template');
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
        console.log('');

        // Determine contract type
        const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support') ||
                              contractData.serviceType?.toLowerCase().includes('labor') ||
                              contractData.serviceType === 'Labor Support Services';

        console.log(`📋 Contract type: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);

        // Map variables for Labor Support Agreement (current code)
        const templateVariables = {
            totalaAmount: contractData.totalInvestment || '$2,500', // Note: template has typo "totalaAmount"
            depositAmount: contractData.depositAmount || '$500',
            balanceAmount: contractData.remainingBalance || '$2,000',
            client_initials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT',
            clientName: contractData.clientName || 'Jerry Techluminate',
            client_signature: '', // Will be filled by SignNow
            client_signed_date: '', // Will be filled by SignNow
            client_intials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT', // Note: template has typo "intials"
        };

        console.log('📋 Template Variables Being Sent:');
        console.log(`   totalaAmount: "${templateVariables.totalaAmount}"`);
        console.log(`   depositAmount: "${templateVariables.depositAmount}"`);
        console.log(`   balanceAmount: "${templateVariables.balanceAmount}"`);
        console.log(`   client_initials: "${templateVariables.client_initials}"`);
        console.log(`   clientName: "${templateVariables.clientName}"`);
        console.log(`   client_signature: "${templateVariables.client_signature}"`);
        console.log(`   client_signed_date: "${templateVariables.client_signed_date}"`);
        console.log(`   client_intials: "${templateVariables.client_intials}"`);
        console.log('');

        console.log('🔍 Expected Template Placeholders (from your template):');
        console.log('   - {totalaAmount} should show: $2,500');
        console.log('   - {depositAmount} should show: $500');
        console.log('   - {balanceAmount} should show: $2,000');
        console.log('   - {client_initials} should show: JT');
        console.log('   - {clientName} should show: Jerry Techluminate');
        console.log('');

        console.log('💡 The variables are being passed correctly');
        console.log('💡 The issue is that the template placeholders don\'t match our variable names');
        console.log('💡 We need to verify what placeholders the template actually has');

    } catch (error) {
        console.error('❌ Error debugging variable passing:', error.message);
    }
}

debugVariablePassing();

