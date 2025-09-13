const express = require('express');
const SignNowService = require('../services/signNowService');

console.log('[signnow] routes file loaded');
const router = express.Router();
const signNowService = new SignNowService();

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`[signnow] ${req.method} ${req.path}`);
  next();
});

// Test authentication
router.post('/test-auth', async (req, res) => {
  try {
    const result = await signNowService.testAuthentication();
    res.json(result);
  } catch (error) {
    console.error('SignNow authentication test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication test failed'
    });
  }
});

// Upload document
router.post('/upload', async (req, res) => {
  try {
    const { filePath, documentName } = req.body;

    if (!filePath || !documentName) {
      return res.status(400).json({
        success: false,
        error: 'filePath and documentName are required'
      });
    }

    const result = await signNowService.uploadDocument(filePath, documentName);
    res.json(result);
  } catch (error) {
    console.error('SignNow upload failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Create signing invitation
router.post('/create-invitation', async (req, res) => {
  try {
    const { documentId, clientEmail, clientName, contractId } = req.body;

    if (!documentId || !clientEmail || !clientName || !contractId) {
      return res.status(400).json({
        success: false,
        error: 'documentId, clientEmail, clientName, and contractId are required'
      });
    }

    const result = await signNowService.createSigningInvitation(
      documentId,
      clientEmail,
      clientName,
      contractId
    );
    res.json(result);
  } catch (error) {
    console.error('SignNow invitation creation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invitation creation failed'
    });
  }
});

// Get document details
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required'
      });
    }

    const result = await signNowService.getDocument(documentId);
    res.json(result);
  } catch (error) {
    console.error('SignNow document retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Document retrieval failed'
    });
  }
});

// Download document
router.get('/download/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required'
      });
    }

    const documentBuffer = await signNowService.downloadDocument(documentId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document-${documentId}.pdf"`);
    res.send(documentBuffer);
  } catch (error) {
    console.error('SignNow document download failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Document download failed'
    });
  }
});

// Get invitation status
router.get('/status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required'
      });
    }

    const result = await signNowService.getInvitationStatus(documentId);
    res.json(result);
  } catch (error) {
    console.error('SignNow status check failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    });
  }
});

// Process complete contract signing workflow
router.post('/process-contract', async (req, res) => {
  try {
    const { contractPath, clientEmail, clientName, contractId } = req.body;

    if (!contractPath || !clientEmail || !clientName || !contractId) {
      return res.status(400).json({
        success: false,
        error: 'contractPath, clientEmail, clientName, and contractId are required'
      });
    }

    const result = await signNowService.processContractSigning(
      contractPath,
      clientEmail,
      clientName,
      contractId
    );
    res.json(result);
  } catch (error) {
    console.error('SignNow contract processing failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Contract processing failed'
    });
  }
});

// Add fields to document
router.post('/add-fields', async (req, res) => {
  try {
    const { documentId, fields } = req.body;

    if (!documentId || !fields) {
      return res.status(400).json({
        success: false,
        error: 'documentId and fields are required'
      });
    }

    const result = await signNowService.addFieldsToDocument(documentId, fields);
    res.json(result);
  } catch (error) {
    console.error('SignNow add fields failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Add fields failed'
    });
  }
});

// Add standard contract fields
router.post('/add-standard-fields', async (req, res) => {
  try {
    const { documentId, options } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required'
      });
    }

    const result = await signNowService.addStandardContractFields(documentId, options);
    res.json(result);
  } catch (error) {
    console.error('SignNow add standard fields failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Add standard fields failed'
    });
  }
});

// Test complete workflow
router.post('/test-complete-workflow', async (req, res) => {
  try {
    const {
      documentId,
      clientEmail,
      clientName,
      testMode = true
    } = req.body;

    console.log('🧪 Testing complete SignNow workflow...');

    // 1. Add signature fields
    console.log('📝 Adding signature fields...');
    const fieldsResult = await signNowService.addStandardContractFields(documentId);

    // 2. Create signing invitation
    console.log('📧 Creating signing invitation...');
    const invitationResult = await signNowService.createSigningInvitation(
      documentId,
      clientEmail,
      clientName,
      'test-contract-001'
    );

    // 3. Get document details for verification
    console.log('📄 Getting document details...');
    const documentDetails = await signNowService.getDocument(documentId);

    res.json({
      success: true,
      testMode: testMode,
      documentId: documentId,
      fields: fieldsResult.fields,
      invitation: invitationResult,
      documentDetails: documentDetails,
      signingUrl: invitationResult.signingUrl,
      message: 'Complete workflow test successful'
    });

  } catch (error) {
    console.error('❌ Test workflow failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    });
  }
});

// Test status check
router.get('/test-status/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Get document details
    const documentDetails = await signNowService.getDocument(documentId);

    // Get invitation status
    const invitationStatus = await signNowService.getInvitationStatus(documentId);

    res.json({
      success: true,
      documentId: documentId,
      documentDetails: documentDetails,
      invitationStatus: invitationStatus,
      verificationUrl: `https://app.signnow.com/webapp/document/${documentId}`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Invite Client (Signer 1) and optional Partner (Signer 2); sequential by default
router.post('/send-client-partner', async (req, res) => {
  try {
    const { documentId, client, partner, subject, message, sequential } = req.body;

    if (!documentId || !client || !client.email || !client.name) {
      return res.status(400).json({
        success: false,
        error: 'documentId and client {name,email} are required'
      });
    }

    const result = await signNowService.createInvitationClientPartner(
      documentId,
      client,
      partner, // may be undefined if no partner
      { subject, message, sequential } // sequential defaults to true in the service
    );

    res.json(result);
  } catch (error) {
    console.error('send-client-partner failed:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error?.response?.data?.error || error.message
    });
  }
});


module.exports = router;
