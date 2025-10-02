const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function analyzeGeneratedContract() {
    try {
        console.log('🔍 Analyzing Generated Contract for Variable Substitution');
        console.log('');

        // Find the most recent generated contract
        const generatedDir = path.join(process.cwd(), 'generated');
        if (!fs.existsSync(generatedDir)) {
            console.log('❌ Generated directory not found');
            return;
        }

        const files = fs.readdirSync(generatedDir)
            .filter(file => file.endsWith('.docx') && file.includes('contract-'))
            .map(file => ({
                name: file,
                path: path.join(generatedDir, file),
                stats: fs.statSync(path.join(generatedDir, file))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime); // Sort by modification time, newest first

        if (files.length === 0) {
            console.log('❌ No generated contract files found');
            return;
        }

        const latestContract = files[0];
        console.log(`📄 Analyzing latest contract: ${latestContract.name}`);
        console.log(`📅 Generated: ${latestContract.stats.mtime}`);
        console.log('');

        // Read the contract file
        const content = fs.readFileSync(latestContract.path);
        const zip = new PizZip(content);

        // Extract the document.xml to see the content
        const docXml = zip.file('word/document.xml').asText();

        console.log('📋 Contract content analysis:');
        console.log('');

        // Look for common variable patterns
        const variablePatterns = [
            /\{total_amount\}/g,
            /\{deposit_amount\}/g,
            /\{balance_amount\}/g,
            /\{client_name\}/g,
            /\{client_initials\}/g,
            /\{client_name\}/g,
            /\{client_signature\}/g,
            /\{client_signed_date\}/g,
            /\{client_intials\}/g
        ];

        const variableNames = [
            'total_amount',
            'deposit_amount',
            'balance_amount',
            'client_name',
            'client_initials',
            'client_name',
            'client_signature',
            'client_signed_date',
            'client_intials'
        ];

        console.log('🔍 Checking for variable placeholders:');
        let foundVariables = [];
        variableNames.forEach((varName, index) => {
            const pattern = variablePatterns[index];
            const matches = docXml.match(pattern);
            if (matches) {
                console.log(`   ✅ Found ${matches.length} instances of {${varName}}`);
                foundVariables.push(varName);
            } else {
                console.log(`   ❌ {${varName}} not found`);
            }
        });

        console.log('');

        // Look for "undefined" text in the document
        if (docXml.includes('undefined')) {
            console.log('⚠️  Found "undefined" text in the document!');
            console.log('   This indicates variables are not being substituted correctly.');

            // Find the context around "undefined"
            const undefinedMatches = docXml.match(/[^>]*undefined[^<]*/g);
            if (undefinedMatches) {
                console.log('   Context around "undefined":');
                undefinedMatches.forEach(match => {
                    console.log(`   - ${match.trim()}`);
                });
            }
        } else {
            console.log('✅ No "undefined" text found in document');
        }

        console.log('');

        // Look for actual substituted values
        const substitutedValues = [
            '$2,500',
            '$500',
            '$2,000',
            'Jerry Techluminate',
            'JT'
        ];

        console.log('🔍 Checking for substituted values:');
        substitutedValues.forEach(value => {
            if (docXml.includes(value)) {
                console.log(`   ✅ Found substituted value: "${value}"`);
            } else {
                console.log(`   ❌ Substituted value not found: "${value}"`);
            }
        });

        console.log('');
        console.log('📊 Summary:');
        console.log(`   Variables found: ${foundVariables.length}/${variableNames.length}`);
        console.log(`   Found variables: ${foundVariables.join(', ')}`);

        if (foundVariables.length === 0) {
            console.log('   ⚠️  No template variables found - template might not have placeholders');
        }

    } catch (error) {
        console.error('❌ Error analyzing generated contract:', error.message);
        console.error(error.stack);
    }
}

analyzeGeneratedContract();
