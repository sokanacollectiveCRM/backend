import express, { Request, Response } from 'express';

import { logger } from '../common/utils/logger';
import {
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { listPaymentsFromCloudSql } from '../repositories/cloudSqlPaymentRepository';
import {
  ADMIN_BILLING,
  ADMIN_BILLING_DOULA,
  ADMIN_DOULA_CLIENT,
  ADMIN_ONLY,
  decideClientResourceAccess,
  forbiddenBody,
} from '../security/authorizationPolicies';
import { CloudSqlDoulaAssignmentService } from '../services/cloudSqlDoulaAssignmentService';
import { ContractClientService } from '../services/contractClientService';
import { SimplePaymentService } from '../services/simplePaymentService';
import { AuthRequest } from '../types';

const router = express.Router();
const contractService = new ContractClientService();
const paymentService = new SimplePaymentService();
const cloudSqlAssignmentService = new CloudSqlDoulaAssignmentService();

const requireRoles =
  (roles: readonly string[]) =>
  (req: AuthRequest, res: Response, next: express.NextFunction): void => {
    void authorizeRoles(req, res, next, [...roles]);
  };

// GET /api/payments — list payment rows from Cloud SQL (Financial tab). Auth required.
const listPaymentsHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const data = await listPaymentsFromCloudSql(limit);
    res.json({ success: true, data });
  } catch (error) {
    const err = error as Error;
    const msg = err?.message ?? '';
    if (
      msg.includes('payments') &&
      (msg.includes('does not exist') || msg.includes('relation'))
    ) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    if (msg.includes('Cloud SQL') || msg.includes('CLOUD_SQL')) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    logger.error(
      toSafeProviderError('payments', 'list', error),
      'Error listing payments'
    );
    res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
  }
};

router.get(
  '/',
  authMiddleware,
  requireRoles(ADMIN_BILLING_DOULA),
  listPaymentsHandler
);
router.get(
  '',
  authMiddleware,
  requireRoles(ADMIN_BILLING_DOULA),
  listPaymentsHandler
);

// Get payment dashboard — security bug fix (PR 4): was anonymous
router.get(
  '/dashboard',
  authMiddleware,
  requireRoles(ADMIN_BILLING),
  async (_req, res) => {
    try {
      const dashboard = await paymentService.getPaymentDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'dashboard', error),
        'Error getting payment dashboard'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Get overdue payments — security bug fix (PR 4): was anonymous
router.get(
  '/overdue',
  authMiddleware,
  requireRoles(ADMIN_BILLING),
  async (_req, res) => {
    try {
      const overdue = await paymentService.getOverduePayments();
      res.json({ success: true, data: overdue });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'overdue', error),
        'Error getting overdue payments'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

/** Shared client ownership gate for contract-scoped payment reads. */
async function assertContractPaymentAccess(
  req: AuthRequest,
  res: Response,
  contractId: string
): Promise<boolean> {
  if (req.user?.role !== 'client') return true;
  const ownClientId = await cloudSqlAssignmentService.getClientIdByAuthUserId(
    req.user.id
  );
  if (!ownClientId) {
    res.status(404).json({ success: false, error: 'Client profile not found' });
    return false;
  }
  const contract = await contractService.getContractWithClient(contractId);
  const ownerId = contract?.contract?.client_id ?? null;
  const decision = decideClientResourceAccess({
    actor: req.user,
    requestedClientId: ownerId,
    actorClientId: ownClientId,
  });
  if (decision === 'deny') {
    // Do not reveal whether the contract exists.
    res.status(403).json(forbiddenBody());
    return false;
  }
  return true;
}

// Get payment summary for a contract — security bug fix (PR 4): was anonymous
router.get(
  '/contract/:contractId/summary',
  authMiddleware,
  requireRoles(ADMIN_DOULA_CLIENT),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { contractId } = req.params;
      if (!(await assertContractPaymentAccess(req, res, contractId))) return;
      const summary = await paymentService.getPaymentSummary(contractId);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'summary', error),
        'Error getting payment summary'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Get payment schedule for a contract — security bug fix (PR 4): was anonymous
router.get(
  '/contract/:contractId/schedule',
  authMiddleware,
  requireRoles(ADMIN_DOULA_CLIENT),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { contractId } = req.params;
      if (!(await assertContractPaymentAccess(req, res, contractId))) return;
      const schedule = await paymentService.getPaymentSchedule(contractId);
      res.json({ success: true, data: schedule });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'schedule', error),
        'Error getting payment schedule'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Get payment history for a contract
router.get(
  '/contract/:contractId/history',
  authMiddleware,
  requireRoles(ADMIN_DOULA_CLIENT),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { contractId } = req.params;
      let clientIdFilter: string | undefined;

      // Client users can only see their own payment history.
      if (req.user?.role === 'client') {
        const ownClientId =
          await cloudSqlAssignmentService.getClientIdByAuthUserId(req.user.id);
        if (!ownClientId) {
          res
            .status(404)
            .json({ success: false, error: 'Client profile not found' });
          return;
        }
        clientIdFilter = ownClientId;
      }

      const history = await paymentService.getContractPayments(
        contractId,
        clientIdFilter
      );
      if (history.length === 0) {
        res.json({
          success: true,
          data: [],
          message: 'No payment history found',
        });
        return;
      }
      res.json({ success: true, data: history });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'history', error),
        'Error getting payment history'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Update payment status — security bug fix (PR 4): was anonymous mutation
router.put(
  '/payment/:paymentId/status',
  authMiddleware,
  requireRoles(ADMIN_BILLING),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.params;
      const { status, stripe_payment_intent_id, notes } = req.body;

      if (!status) {
        res.status(400).json({ success: false, error: 'Status is required' });
        return;
      }

      const payment = await paymentService.updatePaymentStatus(
        paymentId,
        status,
        stripe_payment_intent_id,
        notes
      );

      res.json({ success: true, data: payment });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'update_status', error),
        'Error updating payment status'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Get payments by status — security bug fix (PR 4): was anonymous
router.get(
  '/status/:status',
  authMiddleware,
  requireRoles(ADMIN_BILLING_DOULA),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.params;
      const payments = await paymentService.getPaymentsByStatus(
        status as 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded'
      );
      res.json({ success: true, data: payments });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'by_status', error),
        'Error getting payments by status'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Get payments due within a date range — security bug fix (PR 4): was anonymous
router.get(
  '/due-between',
  authMiddleware,
  requireRoles(ADMIN_BILLING),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        res.status(400).json({
          success: false,
          error: 'start_date and end_date query parameters are required',
        });
        return;
      }

      const payments = await paymentService.getPaymentsDueBetween(
        start_date as string,
        end_date as string
      );

      res.json({ success: true, data: payments });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'due_between', error),
        'Error getting payments due between dates'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Run daily maintenance — security bug fix (PR 4): was anonymous
router.post(
  '/maintenance/daily',
  authMiddleware,
  requireRoles(ADMIN_ONLY),
  async (_req, res) => {
    try {
      await paymentService.runDailyMaintenance();
      res.json({
        success: true,
        message: 'Daily payment maintenance completed',
      });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'maintenance_daily', error),
        'Error running daily maintenance'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

// Update overdue flags manually — security bug fix (PR 4): was anonymous
router.post(
  '/maintenance/overdue-flags',
  authMiddleware,
  requireRoles(ADMIN_ONLY),
  async (_req, res) => {
    try {
      await paymentService.updateOverdueFlags();
      res.json({ success: true, message: 'Overdue flags updated' });
    } catch (error) {
      logger.error(
        toSafeProviderError('payments', 'maintenance_overdue', error),
        'Error updating overdue flags'
      );
      res.status(500).json(toSafeClientErrorBody('Payment operation failed'));
    }
  }
);

export default router;
