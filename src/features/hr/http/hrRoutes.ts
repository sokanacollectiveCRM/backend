import express from 'express';

import { getPool } from '../../../db/cloudSqlPool';
import { doulaController } from '../../../index';
import authMiddleware from '../../../middleware/authMiddleware';
import type { AuthRequest } from '../../../types';
import { canManageHrDocuments } from '../../doulas/application/backgroundCheck';

const router = express.Router();
router.use(authMiddleware);
router.use(async (req: AuthRequest, res, next) => {
  try {
    if (!(await canManageHrDocuments(req))) {
      res.status(403).json({ error: 'HR access required.' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Unable to verify HR access.' });
  }
});
// Explicitly selected fields: no client assignments, notes, hours or billing data.
router.get('/doulas', async (req: AuthRequest, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id,full_name,email,phone,city,state,account_status FROM public.doulas WHERE tenant_id=$1::uuid ORDER BY lower(full_name),id`,
      [req.tenant!.id]
    );
    res.json({ doulas: rows });
  } catch {
    res.status(500).json({ error: 'Unable to load doula directory.' });
  }
});
router.get('/doulas/:doulaId', async (req: AuthRequest, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id,full_name,email,phone,address,unit_number,city,state,zip_code,bio,certifications,account_status FROM public.doulas WHERE tenant_id=$1::uuid AND id::text=$2`,
      [req.tenant!.id, req.params.doulaId]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Doula not found.' });
      return;
    }
    res.json({ doula: rows[0] });
  } catch {
    res.status(500).json({ error: 'Unable to load doula profile.' });
  }
});
router.get('/doulas/:doulaId/documents', (req, res) =>
  doulaController.getDoulaDocumentsAdmin(req, res)
);
router.get('/doulas/:doulaId/documents/:documentId/url', (req, res) =>
  doulaController.getDocumentUrl(req, res)
);
router.patch('/doulas/:doulaId/background-check', (req, res) =>
  doulaController.setBackgroundCheck(req, res)
);
export default router;
