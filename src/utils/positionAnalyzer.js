const fs = require('fs-extra');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

/**
 * Analyze document structure to determine optimal signature field positioning
 */
async function analyzeDocumentStructure(docxPath) {
  try {
    console.log('🔍 Analyzing document structure...');

    // Read the document
    const content = await fs.readFile(docxPath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Get document content
    const xmlContent = zip.file('word/document.xml').asText();

    console.log('📄 Document XML structure:');
    console.log('=====================================');

    // Extract key sections to understand layout
    const lines = xmlContent.split('\n');
    let signatureSectionFound = false;
    let lineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for signature-related content
      if (line.includes('Client Name') || line.includes('Client Signature') ||
          line.includes('Date') || line.includes('Initials') ||
          line.includes('signing this contract')) {
        signatureSectionFound = true;
        console.log(`Line ${i + 1}: ${line.trim()}`);
      }

      // Count total lines to understand document length
      lineCount++;
    }

    console.log('=====================================');
    console.log(`📊 Document Analysis:`);
    console.log(`- Total XML lines: ${lineCount}`);
    console.log(`- Signature section found: ${signatureSectionFound ? 'Yes' : 'No'}`);

    // Based on standard document structure, provide positioning recommendations
    console.log('\n🎯 Positioning Recommendations:');
    console.log('=====================================');

    // Standard A4 page is 612x792 points
    // Signature section is typically at the bottom of the last page
    const recommendations = {
      page2_bottom: {
        initials: { x: 100, y: 650, width: 150, height: 30 },
        name: { x: 100, y: 700, width: 200, height: 30 },
        date: { x: 350, y: 700, width: 150, height: 30 },
        signature: { x: 100, y: 750, width: 200, height: 50 }
      },
      page2_middle: {
        initials: { x: 100, y: 400, width: 150, height: 30 },
        name: { x: 100, y: 450, width: 200, height: 30 },
        date: { x: 350, y: 450, width: 150, height: 30 },
        signature: { x: 100, y: 500, width: 200, height: 50 }
      },
      page2_top: {
        initials: { x: 100, y: 100, width: 150, height: 30 },
        name: { x: 100, y: 150, width: 200, height: 30 },
        date: { x: 350, y: 150, width: 150, height: 30 },
        signature: { x: 100, y: 200, width: 200, height: 50 }
      }
    };

    console.log('Bottom positioning (recommended):');
    console.log(JSON.stringify(recommendations.page2_bottom, null, 2));

    console.log('\nMiddle positioning:');
    console.log(JSON.stringify(recommendations.page2_middle, null, 2));

    console.log('\nTop positioning:');
    console.log(JSON.stringify(recommendations.page2_top, null, 2));

    return {
      signatureSectionFound,
      totalLines: lineCount,
      recommendations
    };

  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

// Run analysis if called directly
if (require.main === module) {
  const docxPath = process.argv[2] || './generated/contract-LOCAL-TEST-1757626198870.docx';
  analyzeDocumentStructure(docxPath)
    .then(result => {
      console.log('\n✅ Analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeDocumentStructure };




