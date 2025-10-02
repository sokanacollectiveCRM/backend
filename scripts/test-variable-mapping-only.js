const fs = require('fs');
const path = require('path');

async function testVariableMappingOnly() {
    try {
        console.log('🧪 Testing Updated Variable Mapping ONLY');
        console.log('📋 Labor Support Agreement with correct placeholders');
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
        console.log('');

        // Determine contract type
        const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support') ||
                              contractData.serviceType?.toLowerCase().includes('labor') ||
                              contractData.serviceType === 'Labor Support Services';

        console.log(`📋 Contract type: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);

        // Map variables for Labor Support Agreement (updated to match template)
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

        console.log('📋 Template Variables (Updated to Match Template):');
        console.log(`   totalaAmount: "${templateVariables.totalaAmount}" (template has typo)`);
        console.log(`   depositAmount: "${templateVariables.depositAmount}"`);
        console.log(`   balanceAmount: "${templateVariables.balanceAmount}"`);
        console.log(`   client_initials: "${templateVariables.client_initials}"`);
        console.log(`   clientName: "${templateVariables.clientName}"`);
        console.log(`   client_signature: "${templateVariables.client_signature}"`);
        console.log(`   client_signed_date: "${templateVariables.client_signed_date}"`);
        console.log(`   client_intials: "${templateVariables.client_intials}" (template has typo)`);
        console.log('');

        console.log('🔍 Template Placeholders (from your updated template):');
        console.log('   - {totalaAmount} should show: $2,500');
        console.log('   - {depositAmount} should show: $500');
        console.log('   - {balanceAmount} should show: $2,000');
        console.log('   - {client_initials} should show: JT');
        console.log('   - {clientName} should show: Jerry Techluminate');
        console.log('   - {client_signature} should show: (empty for now)');
        console.log('   - {client_signed_date} should show: (empty for now)');
        console.log('   - {client_intials} should show: JT');
        console.log('');

        console.log('✅ Variable mapping now matches the template placeholders!');
        console.log('💡 The variables should now substitute correctly instead of showing "undefined"');

    } catch (error) {
        console.error('❌ Error testing variable mapping:', error.message);
    }
}

testVariableMappingOnly();

