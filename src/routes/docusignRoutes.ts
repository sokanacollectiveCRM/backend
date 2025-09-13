import { Request, Response, Router } from 'express';
import { docusignService } from '../services/docusignService';

const router = Router();

interface DocuSignRequest extends Request {
  body: {
    templateId?: string;
    client?: {
      email: string;
      name: string;
    };
    fields?: {
      total_hours: string;
      hourly_rate_fee: string;
      deposit: string;
      overnight_fee_amount: string;
      total_amount: string;
    };
    subject?: string;
    message?: string;
  };
}

// Test DocuSign authentication
router.post('/test-auth', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await docusignService.testAuthentication();
    res.json(result);
  } catch (error) {
    console.error('DocuSign test auth failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication test failed'
    });
  }
});

// List available templates
router.post('/list-templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await docusignService.listTemplates();
    res.json(result);
  } catch (error) {
    console.error('List templates failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'List templates failed'
    });
  }
});

// Create envelope with prefilled fields
router.post('/create-envelope', async (req: DocuSignRequest, res: Response): Promise<void> => {
  try {
    const { templateId, client, fields, subject, message } = req.body;

    if (!templateId) {
      res.status(400).json({
        success: false,
        error: 'templateId is required'
      });
      return;
    }

    if (!client || !client.email || !client.name) {
      res.status(400).json({
        success: false,
        error: 'client {name, email} are required'
      });
      return;
    }

    if (!fields) {
      res.status(400).json({
        success: false,
        error: 'fields are required'
      });
      return;
    }

    const result = await docusignService.createEnvelopeWithPrefill(
      templateId,
      client,
      fields,
      { subject, message }
    );

    res.json(result);
  } catch (error: any) {
    console.error('Create envelope failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create envelope'
    });
  }
});

// Get envelope status
router.get('/envelope/:envelopeId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { envelopeId } = req.params;
    const result = await docusignService.getEnvelopeStatus(envelopeId);
    res.json(result);
  } catch (error) {
    console.error('Get envelope status failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get envelope status'
    });
  }
});

// Test envelope creation with prefilled values (simulation)
router.post('/test-envelope-prefill', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId, client, fields } = req.body;

    console.log('🧪 Testing envelope creation with prefilled values...');
    console.log('📋 Template ID:', templateId);
    console.log('👤 Client:', client);
    console.log('📝 Fields to prefill:', fields);

    // Simulate the envelope creation process
    const simulatedResult = {
      success: true,
      envelopeId: 'DEMO_ENVELOPE_' + Date.now(),
      status: 'sent',
      message: 'Envelope created successfully with prefilled values',
      prefilledFields: fields,
      recipient: {
        email: client.email,
        name: client.name,
        status: 'sent'
      },
      tabs: {
        textTabs: Object.entries(fields).map(([label, value]) => ({
          tabLabel: label,
          value: value,
          locked: true
        }))
      }
    };

    console.log('✅ Simulated envelope creation result:', simulatedResult);
    res.json(simulatedResult);
  } catch (error) {
    console.error('Test envelope creation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test envelope creation failed'
    });
  }
});

// Inspect template fields to see what's available
router.post('/inspect-template', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId } = req.body;

    console.log('🔍 Inspecting template fields for template:', templateId);

    // Make real API call to inspect template
    const result = await docusignService.inspectTemplateFields(templateId);
    res.json(result);
  } catch (error) {
    console.error('Template inspection failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Template inspection failed'
    });
  }
});

// OAuth2 callback handler
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;

    console.log('🔄 OAuth2 callback received:', { code, state });

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code not provided'
      });
      return;
    }

    // Exchange authorization code for access token
    const tokenResult = await docusignService.exchangeCodeForToken(code as string);

    // Store the token in the service instance
    docusignService.setAccessToken(tokenResult.access_token, tokenResult.expires_in);

    res.json({
      success: true,
      message: 'OAuth2 authentication completed successfully',
      token: tokenResult
    });
  } catch (error) {
    console.error('OAuth2 callback failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OAuth2 callback failed'
    });
  }
});

// Get authorization URL for OAuth2 flow
router.get('/auth-url', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await docusignService.getAuthUrl();
    res.json(result);
  } catch (error) {
    console.error('Failed to get authorization URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get authorization URL'
    });
  }
});

// Generate contract from template with dynamic data
router.post('/generate-contract-from-template', async (req: DocuSignRequest, res: Response): Promise<void> => {
  try {
    const { templateId, client, fields, subject, message } = req.body;

    if (!templateId) {
      res.status(400).json({
        success: false,
        error: 'templateId is required'
      });
      return;
    }

    if (!client || !client.email || !client.name) {
      res.status(400).json({
        success: false,
        error: 'client {name, email} are required'
      });
      return;
    }

    if (!fields) {
      res.status(400).json({
        success: false,
        error: 'fields are required'
      });
      return;
    }

    const result = await docusignService.generateContractFromTemplate(
      templateId,
      client,
      fields,
      { subject, message }
    );

    res.json(result);
  } catch (error: any) {
    console.error('Generate contract from template failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate contract from template'
    });
  }
});

// Test document processing only (without DocuSign)
router.post('/test-document-processing', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fields } = req.body;

    if (!fields) {
      res.status(400).json({
        success: false,
        error: 'fields are required'
      });
      return;
    }

    // Import document processor
    const { documentProcessor } = await import('../utils/documentProcessor');
    
    // Test document processing
    const processedBuffer = await documentProcessor.processTemplate(fields);
    
    // Save processed document
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-contract-${timestamp}.docx`;
    const outputPath = await documentProcessor.saveProcessedDocument(fields, filename);

    res.json({
      success: true,
      message: 'Document processed successfully',
      bufferSize: processedBuffer.length,
      outputPath: outputPath,
      fields: fields
    });
  } catch (error: any) {
    console.error('Test document processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process document'
    });
  }
});

export default router;
