const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function generateDocumentOnly() {
    try {
        console.log('🧪 Generating Document with Variable Substitution ONLY');
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

        // Check if we have a local template to test with
        const localTemplatePath = path.join(process.cwd(), 'templates', templateFileName);
        console.log(`📁 Looking for local template at: ${localTemplatePath}`);

        if (fs.existsSync(localTemplatePath)) {
            console.log('✅ Local template found! Testing variable substitution...');

            try {
                // Read and process template
                const content = fs.readFileSync(localTemplatePath);
                const zip = new PizZip(content);
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                });

                doc.setData(templateVariables);
                doc.render();

                // Generate output
                const buffer = doc.getZip().generate({ type: 'nodebuffer' });
                const outputPath = path.join(process.cwd(), 'generated', 'test-document-only.docx');

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

        } else {
            console.log('❌ Local template not found!');
            console.log('📁 Available files in templates directory:');
            const templatesDir = path.join(process.cwd(), 'templates');
            if (fs.existsSync(templatesDir)) {
                const files = fs.readdirSync(templatesDir);
                files.forEach(file => console.log(`   - ${file}`));
            } else {
                console.log('   Templates directory does not exist');
            }
            console.log('');
            console.log('💡 The template is stored in Supabase Storage, not locally.');
            console.log('💡 This test shows the variable mapping logic that would be used.');
            console.log('💡 The variables should match the template placeholders exactly.');
        }

    } catch (error) {
        console.error('❌ Error generating document:', error.message);
        console.error(error.stack);
    }
}

generateDocumentOnly();

