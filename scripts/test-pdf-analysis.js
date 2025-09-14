const path = require('path');
const { debugPdfTextPositions, getSignatureFieldPosition } = require('../dist/src/utils/pdfTextAnalyzer');

async function testPdfAnalysis() {
  const pdfPath = path.join(__dirname, '../generated/contract-test-1757801050667.pdf');

  console.log('🔍 Testing PDF Analysis');
  console.log('📁 PDF Path:', pdfPath);
  console.log('');

  try {
    // Debug all text positions
    console.log('=== ALL TEXT POSITIONS ===');
    await debugPdfTextPositions(pdfPath);

    console.log('');
    console.log('=== SIGNATURE POSITION DETECTION ===');

    // Get signature position
    const signaturePos = await getSignatureFieldPosition(pdfPath);

    if (signaturePos) {
      console.log('✅ Signature position found:');
      console.log(`   X: ${signaturePos.x}`);
      console.log(`   Y: ${signaturePos.y}`);
      console.log(`   Width: ${signaturePos.width}`);
      console.log(`   Height: ${signaturePos.height}`);
      console.log(`   Page: ${signaturePos.page}`);
    } else {
      console.log('❌ No signature position detected');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPdfAnalysis();
