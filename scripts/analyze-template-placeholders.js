const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function analyzeTemplatePlaceholders() {
    try {
        console.log('🔍 Analyzing Template Placeholders');
        console.log('📋 Finding what placeholders actually exist in the template');
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

        console.log('🔍 Searching for all placeholder patterns...');

        // Find all {variable} patterns
        const placeholderPattern = /\{[^}]+\}/g;
        const placeholders = docXml.match(placeholderPattern);

        if (placeholders) {
            console.log('📋 Found placeholders in the document:');
            const uniquePlaceholders = [...new Set(placeholders)];
            uniquePlaceholders.forEach(placeholder => {
                console.log(`   - ${placeholder}`);
            });
        } else {
            console.log('❌ No placeholder patterns found');
        }

        console.log('');

        // Look for "undefined" text and its context
        console.log('🔍 Analyzing "undefined" context...');
        const undefinedContext = docXml.match(/[^>]*undefined[^<]*/g);
        if (undefinedContext) {
            console.log('📋 Context around "undefined":');
            undefinedContext.forEach(context => {
                const cleanContext = context.replace(/<[^>]*>/g, '').trim();
                if (cleanContext && cleanContext.includes('undefined')) {
                    console.log(`   - "${cleanContext}"`);
                }
            });
        }

        console.log('');

        // Look for the specific financial text patterns
        console.log('🔍 Looking for financial text patterns...');
        const financialPatterns = [
            /Doula services:/g,
            /Today I agree to pay/g,
            /balance of/g,
            /Labor Support/g
        ];

        financialPatterns.forEach(pattern => {
            const matches = docXml.match(pattern);
            if (matches) {
                console.log(`   ✅ Found: "${pattern.source}"`);
            } else {
                console.log(`   ❌ Not found: "${pattern.source}"`);
            }
        });

        console.log('');
        console.log('💡 The issue is that the template placeholders don\'t match our variable names');
        console.log('💡 We need to find out what placeholders the template actually uses');

    } catch (error) {
        console.error('❌ Error analyzing template placeholders:', error.message);
    }
}

analyzeTemplatePlaceholders();

