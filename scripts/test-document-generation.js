const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

// Mock the contract processor logic
async function testDocumentGeneration() {
    try {
        console.log('🧪 Testing Document Generation Logic');
        console.log('📋 This will test the variable mapping logic without Supabase');
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

        // Determine contract type (same logic as contractProcessor.ts)
        const isLaborSupport = contractData.serviceType?.toLowerCase().includes('labor support') || 
                              contractData.serviceType?.toLowerCase().includes('labor') ||
                              contractData.serviceType === 'Labor Support Services';

        console.log(`📋 Contract type: ${isLaborSupport ? 'Labor Support Agreement' : 'Postpartum Doula Services'}`);

        // Template filename logic (same as contractProcessor.ts)
        const templateFileName = isLaborSupport 
            ? 'Labor Support Agreement for Service.docx'
            : 'Agreement for Postpartum Doula Services.docx';

        console.log(`📄 Template filename: ${templateFileName}`);

        // Variable mapping logic (same as contractProcessor.ts)
        let templateVariables;
        if (isLaborSupport) {
            // Labor Support Agreement template variables
            templateVariables = {
                total_amount: contractData.totalInvestment || '$2,500',
                deposit_amount: contractData.depositAmount || '$500',
                balance_amount: contractData.remainingBalance || '$2,000',
                client_initials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT',
                client_name: contractData.clientName || 'Jerry Techluminate',
                client_signature: '', // Will be filled by SignNow
                client_signed_date: '', // Will be filled by SignNow
                client_intials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JT', // Note: template has typo "intials"
                ...contractData
            };
        } else {
            // Postpartum Doula Services template variables
            templateVariables = {
                totalHours: '120',
                deposit: contractData.depositAmount?.replace('$', '') || '600.00',
                hourlyRate: '35.00',
                overnightFee: '0.00',
                totalAmount: contractData.totalInvestment?.replace('$', '') || '4,200.00',
                clientInitials: contractData.clientName?.split(' ').map(n => n[0]).join('') || 'JB',
                clientName: contractData.clientName || 'Jerry Bony',
                ...contractData
            };
        }

        console.log('📋 Template variables being used:');
        console.log(JSON.stringify(templateVariables, null, 2));
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
                const outputPath = path.join(process.cwd(), 'generated', 'test-variable-mapping.docx');
                
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
                console.log('   - {total_amount} should show: $2,500');
                console.log('   - {deposit_amount} should show: $500');
                console.log('   - {balance_amount} should show: $2,000');
                console.log('   - {client_name} should show: Jerry Techluminate');
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
            console.log('💡 The variable mapping logic above shows what would be used.');
            console.log('💡 If variables show as "undefined" in the generated contract,');
            console.log('💡 it means the template placeholders don\'t match these variable names.');
        }

    } catch (error) {
        console.error('❌ Error testing document generation:', error.message);
        console.error(error.stack);
    }
}

testDocumentGeneration();

