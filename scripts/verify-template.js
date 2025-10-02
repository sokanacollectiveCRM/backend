const { createClient } = require('@supabase/supabase-js');

async function verifyTemplate() {
    try {
        console.log('🔍 Verifying Template in Supabase Storage');
        console.log('📋 Checking what template exists and what placeholders it has');
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

        // Test different possible template filenames
        const possibleFilenames = [
            'Labor Support Agreement for Service.docx',
            'Labor Support Agreement.docx',
            'Labor Support Agreement for Service',
            'Labor Support Agreement',
            'Agreement for Postpartum Doula Services.docx'
        ];

        console.log('📁 Testing template filenames:');
        for (const filename of possibleFilenames) {
            console.log(`   Testing: "${filename}"`);

            try {
                const { data, error } = await supabase.storage
                    .from('contract-templates')
                    .download(filename);

                if (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                } else if (data) {
                    console.log(`   ✅ Found template: ${filename}`);
                    console.log(`   📊 File size: ${data.size} bytes`);
                    console.log(`   📄 File type: ${data.type}`);

                    // If we found the Labor Support template, analyze it
                    if (filename.includes('Labor Support')) {
                        console.log(`   🔍 This is the Labor Support template!`);
                        console.log(`   💡 We need to check if it has the correct placeholders:`);
                        console.log(`      - {total_amount}`);
                        console.log(`      - {deposit_amount}`);
                        console.log(`      - {balance_amount}`);
                        console.log(`      - {client_initials}`);
                        console.log(`      - {client_name}`);
                    }
                    break; // Found a template
                } else {
                    console.log(`   ❌ No data returned`);
                }
            } catch (downloadError) {
                console.log(`   ❌ Download error: ${downloadError.message}`);
            }
        }

        console.log('');
        console.log('📋 Listing all files in contract-templates bucket:');
        try {
            const { data: files, error: listError } = await supabase.storage
                .from('contract-templates')
                .list();

            if (listError) {
                console.log(`❌ Error listing files: ${listError.message}`);
            } else if (files && files.length > 0) {
                console.log('📁 Available templates:');
                files.forEach(file => {
                    console.log(`   - ${file.name} (${file.size} bytes)`);
                });
            } else {
                console.log('   No files found in contract-templates bucket');
            }
        } catch (listError) {
            console.log(`❌ Error listing bucket contents: ${listError.message}`);
        }

        console.log('');
        console.log('💡 Next steps:');
        console.log('   1. Verify the correct template filename exists');
        console.log('   2. Check if the template has the expected placeholders');
        console.log('   3. If not, we need to upload the correct template');

    } catch (error) {
        console.error('❌ Error verifying template:', error.message);
    }
}

verifyTemplate();

