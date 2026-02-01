import { Router, Request, Response } from 'express';

const router = Router();

router.all('*', (_req: Request, res: Response): void => {
  res.status(410).json({
    success: false,
    error: 'DocuSign has been disabled; please use SignNow endpoints instead.'
  });
});

export default router;
