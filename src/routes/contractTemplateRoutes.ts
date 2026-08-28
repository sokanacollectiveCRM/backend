import { Router } from 'express';
import multer from 'multer';

import { contractController } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const requireAdmin = [
  authMiddleware,
  (req: any, res: any, next: any) => authorizeRoles(req, res, next, ['admin']),
];

router.get('/templates', ...requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return contractController.getAllTemplates(req, res);
});

router.get('/templates/:name/signed-url', ...requireAdmin, (req, res) =>
  contractController.getTemplateSignedUrl(req, res)
);

router.get('/templates/:name/download', ...requireAdmin, (req, res) =>
  contractController.downloadTemplate(req, res)
);

router.post(
  '/templates',
  ...requireAdmin,
  upload.single('contract'),
  (req, res) => contractController.uploadTemplate(req as any, res)
);

router.put(
  '/templates/:name',
  ...requireAdmin,
  upload.single('contract'),
  (req, res) => contractController.updateTemplate(req as any, res)
);

router.delete('/templates/:name', ...requireAdmin, (req, res) =>
  contractController.deleteTemplate(req, res)
);

router.post('/templates/generate', ...requireAdmin, (req, res) =>
  contractController.generateTemplate(req, res)
);

export default router;
