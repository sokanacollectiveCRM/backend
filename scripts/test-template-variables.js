const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function testTemplateVariables() {
    try {
        console.log('🧪 Testing Template Variable Mapping');
        console.log('📋 Template: Labor Support Agreement for Service.docx');
        console.log('💰 Variables: total_amount, deposit_amount, balance_amount');
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

        // Map variables based on contract type
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

        // Test if we can read the template file
        const templatePath = path.join(process.cwd(), 'templates', 'Labor Support Agreement for Service.docx');
        console.log(`📁 Looking for template at: ${templatePath}`);

        if (fs.existsSync(templatePath)) {
            console.log('✅ Template file found!');

            // Read and process template
            const content = fs.readFileSync(templatePath);
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

        } else {
            console.log('❌ Template file not found!');
            console.log('📁 Available files in templates directory:');
            const templatesDir = path.join(process.cwd(), 'templates');
            if (fs.existsSync(templatesDir)) {
                const files = fs.readdirSync(templatesDir);
                files.forEach(file => console.log(`   - ${file}`));
            } else {
                console.log('   Templates directory does not exist');
            }
        }

    } catch (error) {
        console.error('❌ Error testing template variables:', error.message);
        console.error(error.stack);
    }
}

testTemplateVariables();
