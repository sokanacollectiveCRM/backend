const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function findTemplatePlaceholders() {
    try {
        console.log('🔍 Finding Template Placeholders in Generated Contract');
        console.log('');

        // Find the most recent generated contract
        const generatedDir = path.join(process.cwd(), 'generated');
        const files = fs.readdirSync(generatedDir)
            .filter(file => file.endsWith('.docx') && file.includes('contract-'))
            .map(file => ({
                name: file,
                path: path.join(generatedDir, file),
                stats: fs.statSync(path.join(generatedDir, file))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime);

        if (files.length === 0) {
            console.log('❌ No generated contract files found');
            return;
        }

        const latestContract = files[0];
        console.log(`📄 Analyzing: ${latestContract.name}`);

        // Read the contract file
        const content = fs.readFileSync(latestContract.path);
        const zip = new PizZip(content);
        const docXml = zip.file('word/document.xml').asText();

        // Find all placeholder patterns
        console.log('🔍 Searching for all placeholder patterns...');

        // Look for any {variable} patterns
        const placeholderPattern = /\{[^}]+\}/g;
        const placeholders = docXml.match(placeholderPattern);

        if (placeholders) {
            console.log('📋 Found placeholders:');
            const uniquePlaceholders = [...new Set(placeholders)];
            uniquePlaceholders.forEach(placeholder => {
                console.log(`   - ${placeholder}`);
            });
        } else {
            console.log('❌ No placeholder patterns found');
        }

        console.log('');

        // Look for any text that might be placeholders (even without braces)
        console.log('🔍 Searching for potential variable text...');

        // Look for common variable patterns
        const variablePatterns = [
            /total[_\s]*amount/gi,
            /deposit[_\s]*amount/gi,
            /balance[_\s]*amount/gi,
            /client[_\s]*name/gi,
            /client[_\s]*initials/gi,
            /signature/gi,
            /date/gi
        ];

        const patternNames = [
            'total amount',
            'deposit amount',
            'balance amount',
            'client name',
            'client initials',
            'signature',
            'date'
        ];

        patternNames.forEach((name, index) => {
            const pattern = variablePatterns[index];
            const matches = docXml.match(pattern);
            if (matches) {
                console.log(`   ✅ Found "${name}" patterns: ${matches.length} instances`);
            } else {
                console.log(`   ❌ No "${name}" patterns found`);
            }
        });

        console.log('');

        // Look for the specific "undefined" context
        console.log('🔍 Analyzing "undefined" context...');
        const undefinedContext = docXml.match(/[^>]*undefined[^<]*/g);
        if (undefinedContext) {
            console.log('📋 Context around "undefined":');
            undefinedContext.forEach(context => {
                const cleanContext = context.replace(/<[^>]*>/g, '').trim();
                if (cleanContext) {
                    console.log(`   - "${cleanContext}"`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Error analyzing template placeholders:', error.message);
    }
}

findTemplatePlaceholders();
