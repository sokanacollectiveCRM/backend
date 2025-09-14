#!/usr/bin/env node

/**
 * Test script for contract generation and SignNow integration
 * This script tests the complete workflow from contract generation to signature request
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5050';
const CLIENT_EMAIL = 'jerrybony5@gmail.com';

async function testContractSigning() {
  console.log('🧪 Testing Complete Contract Signing Workflow');
  console.log('=' .repeat(50));

  try {
    // Test data
    const contractId = `test-contract-${Date.now()}`;
    const contractData = {
      clientName: 'Jerry Bony',
      partnerName: 'Michael Johnson',
      serviceType: 'Postpartum Doula Services',
      totalInvestment: '$1,200.00',
      depositAmount: '$600.00',
      remainingBalance: '$600.00',
      contractDate: new Date().toLocaleDateString(),
      dueDate: '2024-04-15',
      startDate: '2024-03-01',
      endDate: '2024-05-01',
      providerName: 'Sokana Collective',
      providerAddress: '123 Main St, City, State 12345',
      providerPhone: '(555) 123-4567',
      providerEmail: 'info@sokanacollective.com',
      clientPhone: '(555) 987-6543',
      clientEmail: CLIENT_EMAIL,
      paymentTerms: '50% deposit, balance due 2 weeks before due date',
      balanceDueDate: '2024-03-01'
    };

    console.log(`📋 Contract ID: ${contractId}`);
    console.log(`👤 Client: ${contractData.clientName}`);
    console.log(`📧 Email: ${CLIENT_EMAIL}`);
    console.log(`💰 Total: ${contractData.totalInvestment}`);
    console.log('');

    // Step 1: Test the quick test endpoint first
    console.log('🚀 Step 1: Testing quick test endpoint...');
    try {
      const testResponse = await axios.post(`${API_BASE_URL}/api/contract-signing/test-send`, {}, {
        timeout: 60000 // 60 second timeout
      });

      if (testResponse.data.success) {
        console.log('✅ Quick test passed!');
        console.log(`📄 Contract generated: ${testResponse.data.data.contract.docxPath}`);
        console.log(`☁️ SignNow Document ID: ${testResponse.data.data.signNow.documentId}`);
        console.log(`📧 Invitation sent to: ${testResponse.data.data.clientEmail}`);
      } else {
        console.log('❌ Quick test failed:', testResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Quick test failed:', error.response?.data?.error || error.message);
    }

    console.log('');

    // Step 2: Test the main workflow endpoint
    console.log('🚀 Step 2: Testing main workflow endpoint...');
    const response = await axios.post(`${API_BASE_URL}/api/contract-signing/generate-and-send`, {
      contractData,
      contractId,
      clientEmail: CLIENT_EMAIL,
      subject: 'Test Contract - Please Sign',
      message: `Dear ${contractData.clientName},\n\nThis is a test contract for our new signature workflow. Please review and sign when convenient.\n\nContract Details:\n- Service: ${contractData.serviceType}\n- Total Investment: ${contractData.totalInvestment}\n- Deposit: ${contractData.depositAmount}\n\nBest regards,\nSokana Collective`
    }, {
      timeout: 60000 // 60 second timeout
    });

    if (response.data.success) {
      console.log('✅ Contract workflow completed successfully!');
      console.log('');
      console.log('📊 Results Summary:');
      console.log(`   Contract ID: ${response.data.data.contractId}`);
      console.log(`   Client Name: ${response.data.data.clientName}`);
      console.log(`   Client Email: ${response.data.data.clientEmail}`);
      console.log('');
      console.log('📄 Contract Generation:');
      console.log(`   DOCX Path: ${response.data.data.contract.docxPath}`);
      console.log(`   PDF Path: ${response.data.data.contract.pdfPath}`);
      console.log(`   Supabase URL: ${response.data.data.contract.supabaseUrl}`);
      console.log(`   Email Sent: ${response.data.data.contract.emailSent}`);
      console.log('');
      console.log('☁️ SignNow Integration:');
      console.log(`   Document ID: ${response.data.data.signNow.documentId}`);
      console.log(`   Invitation Status: ${response.data.data.signNow.status}`);
      console.log(`   Invitation Details:`, response.data.data.signNow.invitation.success ? 'Sent successfully' : 'Failed');

      // Step 3: Check document status
      console.log('');
      console.log('🔍 Step 3: Checking document status...');
      setTimeout(async () => {
        try {
          const statusResponse = await axios.get(`${API_BASE_URL}/api/contract-signing/status/${response.data.data.signNow.documentId}`);

          if (statusResponse.data.success) {
            console.log('✅ Document status retrieved:');
            console.log(`   Status: ${statusResponse.data.data.status}`);
            console.log(`   Document Name: ${statusResponse.data.data.document_name}`);
            console.log(`   Created: ${statusResponse.data.data.created}`);
            console.log('   Signatures:');
            statusResponse.data.data.signatures.forEach((sig, index) => {
              console.log(`     ${index + 1}. Role: ${sig.role}, Email: ${sig.email}, Signed: ${sig.signed}`);
            });
          } else {
            console.log('❌ Failed to get document status:', statusResponse.data.error);
          }
        } catch (error) {
          console.log('❌ Status check failed:', error.response?.data?.error || error.message);
        }
      }, 2000);

    } else {
      console.log('❌ Contract workflow failed:', response.data.error);
      if (response.data.details) {
        console.log('   Details:', response.data.details);
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.response?.data || error.message);

    if (error.response?.data?.details) {
      console.error('   Error details:', JSON.stringify(error.response.data.details, null, 2));
    }
  }

  console.log('');
  console.log('=' .repeat(50));
  console.log('🏁 Test completed');
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL}/`);
    console.log(`✅ Server is running at ${API_BASE_URL}`);
    return true;
  } catch (error) {
    console.log(`❌ Server is not running at ${API_BASE_URL}`);
    console.log('   Please start the server with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 Contract Signing Workflow Test');
  console.log(`🌐 Testing against: ${API_BASE_URL}`);
  console.log('');

  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }

  await testContractSigning();
}

// Run the test
main().catch(console.error);
