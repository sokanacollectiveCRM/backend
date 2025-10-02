const { createClient } = require('@supabase/supabase-js');

async function testTemplateDownload() {
    try {
        console.log('🧪 Testing Template Download from Supabase Storage');
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
            'Labor Support Agreement'
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
                    break; // Found the correct template
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
                files.forEach(file => {
                    console.log(`   - ${file.name} (${file.size} bytes)`);
                });
            } else {
                console.log('   No files found in contract-templates bucket');
            }
        } catch (listError) {
            console.log(`❌ Error listing bucket contents: ${listError.message}`);
        }

    } catch (error) {
        console.error('❌ Error testing template download:', error.message);
    }
}

testTemplateDownload();

