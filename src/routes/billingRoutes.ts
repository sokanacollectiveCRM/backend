import express, { Request, Response } from 'express';

import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import {
  BillingContractDownloadError,
  getBillingContractDocument,
  getBillingContractDownloadLink,
} from '../services/billingContractDownloadService';
import {
  BillingReminderValidationError,
  sendBillingReminderEmail,
} from '../services/billingReminderService';
import {
  getLimitedBillingContractById,
  listLimitedBillingContracts,
} from '../services/limitedBillingContractsService';
import type { AuthRequest } from '../types';
import { ApiResponse } from '../utils/responseBuilder';

const router = express.Router();

router.get(
  '/contracts',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const status =
        typeof _req.query.status === 'string' && _req.query.status.trim()
          ? _req.query.status.trim()
          : undefined;
      const since =
        typeof _req.query.since === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(_req.query.since)
          ? _req.query.since
          : undefined;
      const signingProvider =
        _req.query.signingProvider === 'native' ||
        _req.query.signingProvider === 'legacy'
          ? _req.query.signingProvider
          : undefined;
      const contracts = await listLimitedBillingContracts({
        status,
        since,
        signingProvider,
      });
      res.json(ApiResponse.list(contracts, contracts.length));
    } catch (error) {
      const err = error as Error;
      console.error('Billing contracts list error:', err);
      res
        .status(500)
        .json(
          ApiResponse.error(
            err.message || 'Failed to load billing contracts',
            'BILLING_CONTRACTS_LIST_FAILED'
          )
        );
    }
  }
);

router.get(
  '/contracts/:contractId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const contract = await getLimitedBillingContractById(
        req.params.contractId
      );
      if (!contract) {
        res
          .status(404)
          .json(ApiResponse.error('Billing contract not found', 'NOT_FOUND'));
        return;
      }
      res.json(ApiResponse.success(contract));
    } catch (error) {
      const err = error as Error;
      console.error('Billing contract detail error:', err);
      res
        .status(500)
        .json(
          ApiResponse.error(
            err.message || 'Failed to load billing contract',
            'BILLING_CONTRACT_DETAIL_FAILED'
          )
        );
    }
  }
);

router.get(
  '/contracts/:contractId/document',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const document = await getBillingContractDocument(req.params.contractId);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.fileName}"`
      );
      res.send(document.bytes);
    } catch (error) {
      if (error instanceof BillingContractDownloadError) {
        res
          .status(error.status)
          .json(ApiResponse.error(error.message, error.code));
        return;
      }

      const err = error as Error;
      console.error('Billing contract document error:', err);
      res
        .status(500)
        .json(
          ApiResponse.error(
            err.message || 'Failed to load signed contract PDF',
            'BILLING_CONTRACT_DOCUMENT_FAILED'
          )
        );
    }
  }
);

router.get(
  '/contracts/:contractId/download',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const download = await getBillingContractDownloadLink(
        req.params.contractId,
        { type: 'user', id: req.user!.id }
      );
      res.json(ApiResponse.success(download));
    } catch (error) {
      if (error instanceof BillingContractDownloadError) {
        res
          .status(error.status)
          .json(ApiResponse.error(error.message, error.code));
        return;
      }

      const err = error as Error;
      console.error('Billing contract download error:', err);
      res
        .status(500)
        .json(
          ApiResponse.error(
            err.message || 'Failed to load signed contract PDF',
            'BILLING_CONTRACT_DOWNLOAD_FAILED'
          )
        );
    }
  }
);

router.post(
  '/contracts/:contractId/reminder-email',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await sendBillingReminderEmail({
        senderUserId: req.user!.id,
        senderRole: req.user!.role as 'admin' | 'billing',
        contractId: req.params.contractId,
        installmentNumber:
          typeof req.body?.installmentNumber === 'number'
            ? req.body.installmentNumber
            : null,
        templateKey:
          typeof req.body?.templateKey === 'string'
            ? req.body.templateKey
            : null,
        subject:
          typeof req.body?.subject === 'string' ? req.body.subject : null,
        message:
          typeof req.body?.message === 'string' ? req.body.message : null,
        paymentIssueType:
          typeof req.body?.paymentIssueType === 'string'
            ? req.body.paymentIssueType
            : null,
        clientEmail:
          typeof req.body?.clientEmail === 'string'
            ? req.body.clientEmail
            : null,
        clientName:
          typeof req.body?.clientName === 'string' ? req.body.clientName : null,
        dueDate:
          typeof req.body?.dueDate === 'string' ? req.body.dueDate : null,
        amount: typeof req.body?.amount === 'number' ? req.body.amount : null,
      });

      res.json(ApiResponse.success(result));
    } catch (error) {
      if (error instanceof BillingReminderValidationError) {
        res
          .status(error.status)
          .json(ApiResponse.error(error.message, error.code));
        return;
      }

      const err = error as Error;
      console.error('Billing reminder email error:', err);
      res
        .status(500)
        .json(
          ApiResponse.error(
            err.message || 'Failed to send billing reminder email',
            'BILLING_REMINDER_EMAIL_FAILED'
          )
        );
    }
  }
);

export default router;
