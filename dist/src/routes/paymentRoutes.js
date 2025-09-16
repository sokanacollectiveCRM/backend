"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const contractClientService_1 = require("../services/contractClientService");
const simplePaymentService_1 = require("../services/simplePaymentService");
const router = express_1.default.Router();
const contractService = new contractClientService_1.ContractClientService();
const paymentService = new simplePaymentService_1.SimplePaymentService();
// Get payment dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const dashboard = await paymentService.getPaymentDashboard();
        res.json({ success: true, data: dashboard });
    }
    catch (error) {
        console.error('Error getting payment dashboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get overdue payments
router.get('/overdue', async (req, res) => {
    try {
        const overdue = await paymentService.getOverduePayments();
        res.json({ success: true, data: overdue });
    }
    catch (error) {
        console.error('Error getting overdue payments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get payment summary for a contract
router.get('/contract/:contractId/summary', async (req, res) => {
    try {
        const { contractId } = req.params;
        const summary = await paymentService.getPaymentSummary(contractId);
        res.json({ success: true, data: summary });
    }
    catch (error) {
        console.error('Error getting payment summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get payment schedule for a contract
router.get('/contract/:contractId/schedule', async (req, res) => {
    try {
        const { contractId } = req.params;
        const schedule = await paymentService.getPaymentSchedule(contractId);
        res.json({ success: true, data: schedule });
    }
    catch (error) {
        console.error('Error getting payment schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get payment history for a contract
router.get('/contract/:contractId/history', async (req, res) => {
    try {
        const { contractId } = req.params;
        const history = await paymentService.getContractPayments(contractId);
        res.json({ success: true, data: history });
    }
    catch (error) {
        console.error('Error getting payment history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update payment status
router.put('/payment/:paymentId/status', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status, stripe_payment_intent_id, notes } = req.body;
        if (!status) {
            res.status(400).json({ success: false, error: 'Status is required' });
        }
        const payment = await paymentService.updatePaymentStatus(paymentId, status, stripe_payment_intent_id, notes);
        res.json({ success: true, data: payment });
    }
    catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get payments by status
router.get('/status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const payments = await paymentService.getPaymentsByStatus(status);
        res.json({ success: true, data: payments });
    }
    catch (error) {
        console.error('Error getting payments by status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get payments due within a date range
router.get('/due-between', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            res.status(400).json({
                success: false,
                error: 'start_date and end_date query parameters are required'
            });
        }
        const payments = await paymentService.getPaymentsDueBetween(start_date, end_date);
        res.json({ success: true, data: payments });
    }
    catch (error) {
        console.error('Error getting payments due between dates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Run daily maintenance (for cron jobs or manual triggers)
router.post('/maintenance/daily', async (req, res) => {
    try {
        await paymentService.runDailyMaintenance();
        res.json({ success: true, message: 'Daily payment maintenance completed' });
    }
    catch (error) {
        console.error('Error running daily maintenance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update overdue flags manually
router.post('/maintenance/overdue-flags', async (req, res) => {
    try {
        await paymentService.updateOverdueFlags();
        res.json({ success: true, message: 'Overdue flags updated' });
    }
    catch (error) {
        console.error('Error updating overdue flags:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
