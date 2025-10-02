const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function testSupabaseTemplate() {
    try {
        console.log('🧪 Testing Supabase Template with Variable Substitution');
        console.log('📋 Labor Support Agreement template processing');
        console.log('❌ NO SignNow, NO invitations, NO API calls');
        console.log('');

        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.log('❌ Supabase environment variables not found');
            console.log('💡 Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set');
            return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

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

        // Map variables for Labor Support Agreement (corrected)
        const templateVariables = {
            totalAmount: contractData.totalInvestment || '$2,500',
            depositAmount: contractData.depositAmount || '$500',
            balanceAmount: contractData.remainingBalance || '$2,000',
            client_initials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT',
            clientName: contractData.clientName || 'Jerry Techluminate',
            client_signature: '', // Will be filled by SignNow later
            client_signed_date: '', // Will be filled by SignNow later
            client_intials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT', // Note: template has typo "intials"
        };

        console.log('📋 Template Variables:');
        console.log(`   totalAmount: "${templateVariables.totalAmount}"`);
        console.log(`   depositAmount: "${templateVariables.depositAmount}"`);
        console.log(`   balanceAmount: "${templateVariables.balanceAmount}"`);
        console.log(`   client_initials: "${templateVariables.client_initials}"`);
        console.log(`   clientName: "${templateVariables.clientName}"`);
        console.log('');

        // Download template from Supabase Storage
        console.log('📥 Downloading template from Supabase Storage...');
        const { data: templateBlob, error: downloadError } = await supabase.storage
            .from('contract-templates')
            .download(templateFileName);

        if (downloadError) {
            console.log(`❌ Error downloading template: ${downloadError.message}`);
            return;
        }

        if (!templateBlob) {
            console.log('❌ No template data returned from Supabase Storage');
            return;
        }

        console.log(`✅ Template downloaded successfully: ${templateBlob.size} bytes`);
        console.log('');

        // Process template with variable substitution
        console.log('🔄 Processing template with variable substitution...');
        try {
            // Convert Blob to Buffer
            const content = Buffer.from(await templateBlob.arrayBuffer());
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            doc.setData(templateVariables);
            doc.render();

            // Generate output
            const buffer = doc.getZip().generate({ type: 'nodebuffer' });
            const outputPath = path.join(process.cwd(), 'generated', 'test-supabase-template.docx');

            // Ensure generated directory exists
            const generatedDir = path.join(process.cwd(), 'generated');
            if (!fs.existsSync(generatedDir)) {
                fs.mkdirSync(generatedDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, buffer);
            console.log(`✅ Test document generated: ${outputPath}`);
            console.log('📄 Check the generated file to verify variable substitution');
            console.log('');
            console.log('🔍 Expected variable substitutions:');
            console.log('   - {totalAmount} should show: $2,500');
            console.log('   - {depositAmount} should show: $500');
            console.log('   - {balanceAmount} should show: $2,000');
            console.log('   - {clientName} should show: Jerry Techluminate');
            console.log('   - {client_initials} should show: JT');

        } catch (templateError) {
            console.log('❌ Error processing template:', templateError.message);
            console.log('This might indicate a template format issue or variable mismatch');
        }

    } catch (error) {
        console.error('❌ Error testing Supabase template:', error.message);
        console.error(error.stack);
    }
}

testSupabaseTemplate();

