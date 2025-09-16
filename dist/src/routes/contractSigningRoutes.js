"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const signNowService_1 = require("../services/signNowService");
const signNowContractProcessor_1 = require("../utils/signNowContractProcessor");
const router = (0, express_1.Router)();
/**
 * Test SignNow authentication
 * GET /api/contract-signing/test-auth
 */
router.get('/test-auth', async (req, res) => {
    try {
        console.log('🔐 Testing SignNow authentication...');
        const signNowService = new signNowService_1.SignNowService();
        const result = await signNowService.testAuthentication();
        res.json({
            success: true,
            message: 'SignNow authentication successful',
            data: result
        });
    }
    catch (error) {
        console.error('❌ SignNow authentication failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'SignNow authentication failed',
            details: error.response?.data || error.stack
        });
    }
});
/**
 * Complete contract generation and signature workflow
 * POST /api/contract-signing/generate-and-send
 */
router.post('/generate-and-send', async (req, res) => {
    try {
        const contractData = req.body;
        // Validate required fields
        if (!contractData.contractId || !contractData.clientName || !contractData.clientEmail) {
            res.status(400).json({
                success: false,
                error: 'contractId, clientName, and clientEmail are required'
            });
            return;
        }
        console.log(`🚀 Starting SignNow-only workflow for contract ${contractData.contractId}`);
        // Process contract with SignNow (no nodemailer)
        const result = await (0, signNowContractProcessor_1.processContractWithSignNow)(contractData);
        if (result.success) {
            res.json({
                success: true,
                message: `Contract generated and sent via SignNow to ${result.clientEmail}`,
                data: result
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: result.emailDelivery.message,
                data: result
            });
        }
    }
    catch (error) {
        console.error('❌ SignNow workflow failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'SignNow workflow failed',
            details: error.stack
        });
    }
});
/**
 * POST /api/contract-signing/get-field-coordinates
 * Get field coordinates from a SignNow document
 */
router.post('/get-field-coordinates', async (req, res) => {
    try {
        const { documentId } = req.body;
        if (!documentId) {
            res.status(400).json({ error: 'documentId is required' });
            return;
        }
        const signNowService = new signNowService_1.SignNowService();
        const fields = await signNowService.getDocumentFields(documentId);
        res.json({
            success: true,
            documentId,
            fields,
            message: 'Field coordinates retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error getting field coordinates:', error);
        res.status(500).json({
            error: 'Failed to get field coordinates',
            details: error.message
        });
    }
});
/**
 * Generate contract with payment tracking and send invitation
 * POST /api/contract-signing/generate-contract
 */
router.post('/generate-contract', async (req, res) => {
    try {
        const contractData = req.body;
        // Validate required fields
        if (!contractData.clientName || !contractData.clientEmail || !contractData.totalInvestment || !contractData.depositAmount) {
            res.status(400).json({
                success: false,
                error: 'clientName, clientEmail, totalInvestment, and depositAmount are required'
            });
            return;
        }
        // Generate contract ID if not provided
        const contractId = contractData.contractId || crypto_1.default.randomUUID();
        // Prepare contract data
        const finalContractData = {
            contractId,
            clientName: contractData.clientName,
            clientEmail: contractData.clientEmail,
            serviceType: contractData.serviceType || 'Postpartum Doula Services',
            totalInvestment: contractData.totalInvestment,
            depositAmount: contractData.depositAmount,
            remainingBalance: contractData.remainingBalance ||
                (parseFloat(contractData.totalInvestment.replace(/[$,]/g, '')) -
                    parseFloat(contractData.depositAmount.replace(/[$,]/g, ''))).toFixed(2),
            contractDate: contractData.contractDate || new Date().toLocaleDateString(),
            dueDate: contractData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            startDate: contractData.startDate || new Date().toISOString().split('T')[0],
            endDate: contractData.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        console.log(`🚀 Starting complete contract workflow for ${contractId}`);
        const result = await (0, signNowContractProcessor_1.processContractWithSignNow)(finalContractData);
        res.json({
            success: result.success,
            message: result.success
                ? `Contract generated and sent via SignNow to ${result.clientEmail}`
                : `Contract generation failed: ${result.emailDelivery.message}`,
            data: result
        });
    }
    catch (error) {
        console.error('❌ Contract generation workflow failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Contract generation workflow failed',
            details: error.response?.data || error.stack
        });
    }
});
/**
 * Check status of a SignNow document
 * GET /api/contract-signing/status/:documentId
 */
router.get('/status/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const result = await (0, signNowContractProcessor_1.checkSignNowDocumentStatus)(documentId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('❌ Failed to check document status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check document status'
        });
    }
});
exports.default = router;
