// Test script for the new PDF-based contract system
// This demonstrates the coordinate-stable contract generation
import dotenv from 'dotenv';

import {
  getAvailableContractTemplates,
  processContractWithPdfTemplate,
} from '../dist/utils/pdfContractProcessor.js';

// Load environment variables
dotenv.config();

async function testPdfContractSystem() {
  try {
    console.log('🚀 Testing PDF-based Contract System...\n');

    // 1️⃣ Show available templates
    console.log('📋 Available Templates:');
    const templates = getAvailableContractTemplates();
    templates.forEach((template) => {
      console.log(`  - ${template}`);
    });
    console.log('');

    // 2️⃣ Test with Labor Support template
    console.log('🎯 Testing Labor Support Contract...');
    const laborSupportData = {
      contractId: `labor-support-${Date.now()}`,
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      templateKey: 'labor_support_v1',
      totalAmount: '2400.00',
      deposit: '400.00',
      balanceAmount: '2000.00',
      clientInitials: 'JD',
      client_signed_date: new Date().toLocaleDateString(),
    };

    // SignNow token (placeholder - in production, get from authentication)
    const signNowToken =
      '42d2a44df392aa3418c4e4486316dd2429b27e7b690834c68cd0e407144';

    // Process the contract
    const laborResult = await processContractWithPdfTemplate(
      laborSupportData,
      signNowToken
    );

    console.log('✅ Labor Support Contract Result:');
    console.log(`  Contract ID: ${laborResult.contractId}`);
    console.log(`  Filled PDF: ${laborResult.filledPdfPath}`);
    console.log(`  SignNow Document ID: ${laborResult.documentId}`);
    console.log(`  Signing URL: ${laborResult.signingUrl}`);
    console.log('');

    // 3️⃣ Test with Postpartum template
    console.log('🎯 Testing Postpartum Contract...');
    const postpartumData = {
      contractId: `postpartum-${Date.now()}`,
      clientName: 'Jane Smith',
      clientEmail: 'jane@example.com',
      templateKey: 'postpartum_v1',
      totalHours: '120',
      hourlyRate: '35.00',
      totalAmount: '4200.00',
      deposit: '600.00',
      clientInitials: 'JS',
      date: new Date().toLocaleDateString(),
    };

    const postpartumResult = await processContractWithPdfTemplate(
      postpartumData,
      signNowToken
    );

    console.log('✅ Postpartum Contract Result:');
    console.log(`  Contract ID: ${postpartumResult.contractId}`);
    console.log(`  Filled PDF: ${postpartumResult.filledPdfPath}`);
    console.log(`  SignNow Document ID: ${postpartumResult.documentId}`);
    console.log(`  Signing URL: ${postpartumResult.signingUrl}`);
    console.log('');

    console.log('🎉 PDF Contract System Test Completed Successfully!');
    console.log('📊 Key Benefits:');
    console.log('  ✅ No DOCX conversion - eliminates layout drift');
    console.log('  ✅ Fixed coordinates - perfect SignNow field alignment');
    console.log('  ✅ Consistent layout - identical every time');
    console.log('  ✅ Fast processing - direct PDF manipulation');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testPdfContractSystem().catch(console.error);
