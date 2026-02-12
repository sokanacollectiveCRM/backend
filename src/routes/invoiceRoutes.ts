import express, { Request, Response } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { listInvoicesFromCloudSql } from '../repositories/cloudSqlInvoiceRepository';

const router = express.Router();

// GET /api/invoices — list invoices from Cloud SQL (phi_invoices). Auth required.
const listInvoicesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const data = await listInvoicesFromCloudSql(limit);
    res.json({ success: true, data });
  } catch (error) {
    const err = error as Error;
    const msg = err?.message ?? '';
    if (msg.includes('phi_invoices') && (msg.includes('does not exist') || msg.includes('relation'))) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    if (msg.includes('Cloud SQL') || msg.includes('CLOUD_SQL')) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    console.error('Error listing invoices:', error);
    res.status(500).json({ success: false, error: msg || 'Failed to list invoices' });
  }
};

router.get('/', authMiddleware, (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), listInvoicesHandler);
router.get('', authMiddleware, (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), listInvoicesHandler);

export default router;
