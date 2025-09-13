"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const docusignService_1 = require("../services/docusignService");
const router = (0, express_1.Router)();
// Test DocuSign authentication
router.post('/test-auth', async (_req, res) => {
    try {
        const result = await docusignService_1.docusignService.testAuthentication();
        res.json(result);
    }
    catch (error) {
        console.error('DocuSign test auth failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Authentication test failed'
        });
    }
});
// List available templates
router.post('/list-templates', async (_req, res) => {
    try {
        const result = await docusignService_1.docusignService.listTemplates();
        res.json(result);
    }
    catch (error) {
        console.error('List templates failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'List templates failed'
        });
    }
});
// Create envelope with prefilled fields
router.post('/create-envelope', async (req, res) => {
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
        const result = await docusignService_1.docusignService.createEnvelopeWithPrefill(templateId, client, fields, { subject, message });
        res.json(result);
    }
    catch (error) {
        console.error('Create envelope failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create envelope'
        });
    }
});
// Get envelope status
router.get('/envelope/:envelopeId/status', async (req, res) => {
    try {
        const { envelopeId } = req.params;
        const result = await docusignService_1.docusignService.getEnvelopeStatus(envelopeId);
        res.json(result);
    }
    catch (error) {
        console.error('Get envelope status failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get envelope status'
        });
    }
});
// Test envelope creation with prefilled values (simulation)
router.post('/test-envelope-prefill', async (req, res) => {
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
    }
    catch (error) {
        console.error('Test envelope creation failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Test envelope creation failed'
        });
    }
});
// Inspect template fields to see what's available
router.post('/inspect-template', async (req, res) => {
    try {
        const { templateId } = req.body;
        console.log('🔍 Inspecting template fields for template:', templateId);
        // Make real API call to inspect template
        const result = await docusignService_1.docusignService.inspectTemplateFields(templateId);
        res.json(result);
    }
    catch (error) {
        console.error('Template inspection failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Template inspection failed'
        });
    }
});
// OAuth2 callback handler
router.get('/callback', async (req, res) => {
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
        const tokenResult = await docusignService_1.docusignService.exchangeCodeForToken(code);
        // Store the token in the service instance
        docusignService_1.docusignService.setAccessToken(tokenResult.access_token, tokenResult.expires_in);
        res.json({
            success: true,
            message: 'OAuth2 authentication completed successfully',
            token: tokenResult
        });
    }
    catch (error) {
        console.error('OAuth2 callback failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'OAuth2 callback failed'
        });
    }
});
// Get authorization URL for OAuth2 flow
router.get('/auth-url', async (_req, res) => {
    try {
        const result = await docusignService_1.docusignService.getAuthUrl();
        res.json(result);
    }
    catch (error) {
        console.error('Failed to get authorization URL:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get authorization URL'
        });
    }
});
// Generate contract from template with dynamic data
router.post('/generate-contract-from-template', async (req, res) => {
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
        const result = await docusignService_1.docusignService.generateContractFromTemplate(templateId, client, fields, { subject, message });
        res.json(result);
    }
    catch (error) {
        console.error('Generate contract from template failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate contract from template'
        });
    }
});
// Test document processing only (without DocuSign)
router.post('/test-document-processing', async (req, res) => {
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
        const { documentProcessor } = await Promise.resolve().then(() => __importStar(require('../utils/documentProcessor')));
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
    }
    catch (error) {
        console.error('Test document processing failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process document'
        });
    }
});
exports.default = router;
