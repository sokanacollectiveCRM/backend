const { documentProcessor } = require('../../dist/utils/documentProcessor');

async function testDocumentProcessor() {
  try {
    console.log('🧪 Testing document processor...');
    
    const fields = {
      total_hours: "210",
      hourly_rate_fee: "35.00",
      deposit: "210.00",
      overnight_fee_amount: "0.00",
      total_amount: "7350.00"
    };
    
    const result = await documentProcessor.processTemplate(fields);
    console.log('✅ Document processed successfully!');
    console.log('📄 Buffer size:', result.length);
    
    // Save for inspection
    await documentProcessor.saveProcessedDocument(fields, 'test-contract.docx');
    console.log('💾 Test document saved!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDocumentProcessor();















