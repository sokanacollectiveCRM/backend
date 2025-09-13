"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const signNowService_1 = require("../services/signNowService");
const router = (0, express_1.Router)();
// Test authentication
router.post('/test-auth', async (_req, res) => {
    try {
        const result = await signNowService_1.signNowService.testAuthentication();
        res.json(result);
    }
    catch (error) {
        console.error('Test auth failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Authentication test failed'
        });
    }
});
// Test template access
router.post('/test-template', async (_req, res) => {
    try {
        const templateId = '3cc4323f75af4986b9a142513185d2b13d300759';
        const result = await signNowService_1.signNowService.testTemplate(templateId);
        res.json(result);
    }
    catch (error) {
        console.error('Test template failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Template test failed'
        });
    }
});
// List available templates
router.post('/list-templates', async (_req, res) => {
    try {
        const result = await signNowService_1.signNowService.listTemplates();
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
// Get template field details
router.post('/template-fields', async (_req, res) => {
    try {
        const templateId = '3cc4323f75af4986b9a142513185d2b13d300759';
        const result = await signNowService_1.signNowService.getTemplateFields(templateId);
        res.json(result);
    }
    catch (error) {
        console.error('Get template fields failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Get template fields failed'
        });
    }
});
// Debug: Clone and inspect fields
router.post('/debug-clone-fields', async (_req, res) => {
    try {
        const templateId = '3cc4323f75af4986b9a142513185d2b13d300759';
        // Clone the template
        const cloneResult = await signNowService_1.signNowService.createPrefilledDocFromTemplate(templateId, 'Debug Field Test Document', []);
        // Inspect the fields
        const fieldsInfo = await signNowService_1.signNowService.inspectDocumentFields(cloneResult.documentId);
        res.json({
            success: true,
            documentId: cloneResult.documentId,
            fields: fieldsInfo.fields
        });
    }
    catch (error) {
        console.error('Debug clone fields failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Debug clone fields failed'
        });
    }
});
// Send client+partner invitation
router.post('/send-client-partner', async (req, res) => {
    try {
        const { documentId, client, partner, subject, message, sequential } = req.body;
        if (!client || !client.email || !client.name) {
            res.status(400).json({
                success: false,
                error: 'client {name,email} are required'
            });
            return;
        }
        const result = await signNowService_1.signNowService.createInvitationClientPartner(documentId, client, partner, { subject, message, sequential });
        res.json(result);
    }
    catch (error) {
        // ✅ Always log the full error object with depth
        console.error('SignNow raw error:', JSON.stringify(error, null, 2));
        if (error.response?.data?.errors) {
            // Pretty-print the errors array
            console.error('SignNow error details:', JSON.stringify(error.response.data.errors, null, 2));
        }
        else if (error.response?.data) {
            // Log entire response data if no "errors" array
            console.error('SignNow error response data:', error.response.data);
        }
        else {
            console.error('SignNow error message:', error.message);
        }
        // Handle specific cases (daily limit example)
        if (error?.response?.data?.errors) {
            const dailyLimitError = error.response.data.errors.find((e) => e.code === 65639);
            if (dailyLimitError) {
                res.status(429).json({
                    success: false,
                    error: 'Daily invite limit exceeded. Please try again tomorrow.'
                });
                return;
            }
        }
        // Send back meaningful error to client
        if (error.response?.data?.errors) {
            res.status(error.response.status || 500).json({
                success: false,
                error: error.response.data.errors[0]?.message || 'SignNow API error',
                details: error.response.data.errors
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send contract'
            });
        }
    }
});
exports.default = router;
